'use strict';

/**
 * Serverless Autoprune Plugin
 * Kenneth Falck <kennu@iki.fi> 2016
 */

module.exports = function(S) {
  const path    = require('path'),
      fs        = require('fs'),
      SUtils    = require(S.getServerlessPath('utils')),
      SCli      = require(S.getServerlessPath('utils/cli')),
      SError    = require(S.getServerlessPath('Error')),
      BbPromise = require('bluebird'); // Serverless uses Bluebird Promises and we recommend you do to because they provide more than your average Promise :)

  /**
   * ServerlessPluginAutoprune
   */

  class ServerlessPluginAutoprune extends S.classes.Plugin {

    /**
     * Constructor
     * - Keep this and don't touch it unless you know what you're doing.
     */

    constructor() {
      super();
    }

    /**
     * Define your plugins name
     * - We recommend adding prefixing your personal domain to the name so people know the plugin author
     */

    static getName() {
      return 'net.kfalck.' + ServerlessPluginAutoprune.name;
    }

    /**
     * Register Actions
     * - If you would like to register a Custom Action or overwrite a Core Serverless Action, add this function.
     * - If you would like your Action to be used programatically, include a "handler" which can be called in code.
     * - If you would like your Action to be used via the CLI, include a "description", "context", "action" and any options you would like to offer.
     * - Your custom Action can be called programatically and via CLI, as in the example provided below
     */

    registerActions() {
      S.addAction(this.autoprune.bind(this), {
        handler:        'autoprune',
        description:    'Automatically deletes old Lambda function versions not attached to a stage',
        context:        'function',
        contextAction:  'autoprune',
        options:        [
          {
            option:      'stage',
            shortcut:    's',
            description: 'Optional if only one stage is defined in project'
          }, {
            option:      'region',
            shortcut:    'r',
            description: 'Optional - Target one region to deploy to'
          }, {
            option:      'all',
            shortcut:    'a',
            description: 'Autoprune all functions'
          }
        ],
        parameters:     [
          {
            parameter:   'function',
            description: 'Function to autoprune (use -a for all)',
            position:    '0->'
          }
        ]
      });
      return BbPromise.resolve();
    }

    /**
     * Register Hooks
     * - If you would like to register hooks (i.e., functions) that fire before or after a core Serverless Action or your Custom Action, include this function.
     * - Make sure to identify the Action you want to add a hook for and put either "pre" or "post" to describe when it should happen.
     */

    registerHooks() {
      S.addHook(this._hookPostFunctionDeploy.bind(this), {
        action: 'functionDeploy',
        event:  'post'
      });

      return BbPromise.resolve();
    }

    autoprune(evt) {
      var promise = BbPromise.resolve();
      var project = S.getProject();
      var functions = project.functions;
      var found = 0;
      var stage = evt.options.stage;
      var region = evt.options.region;

      if (!evt.options.all && !evt.options.function.length) {
        return BbPromise.reject(new SError('Function name or -a required'));
      }

      if (stage && !project.validateStageExists(stage)) {
        return BbPromise.reject(new SError(`Stage ${stage} doesnt exist in this project!`))
      }

      return BbPromise.resolve()
      .then(() => {
        if (!stage) {
          return this.cliPromptSelectStage('Function Autoprune - Choose a stage: ', stage, false)
          .then(aStage => {
            stage = aStage;
          });
        }
      })
      .then(() => {

        if (stage && region && !proj.validateRegionExists(stage, region)) {
          return BbPromise.reject(new SError(`Region ${region} doesnt exist in stage ${stage}!`))
        }

        // Select default region in stage if not specified
        if (stage && !region) {
          var stageObj = project.getStage(stage);
          var regions = stageObj.getAllRegions();
          if (regions.length == 1) {
            region = regions[0].getName();
          } else {
            return BbPromise.reject(new SError('Region has multiple stages, specify one with -r'));
          }
        }

        Object.keys(functions).map((functionName) => {
          if (evt.options.all || evt.options.function.indexOf(functionName) >= 0) {
            found += 1;
            promise = promise.then(() => {
              return this.autopruneFunction({stage:stage, region:region}, functions[functionName]);
            });
          }
        });
        if (evt.options.function.length && found < evt.options.function.length) {
          return BbPromise.reject(new SError('Function not found'));
        }
        return promise;
      })
      .then(() => {
        return evt;
      });
    }

    /**
     * Post deploy prune hook
     * - Be sure to ALWAYS accept and return the "evt" object, or you will break the entire flow.
     * - The "evt" object contains Action-specific data.  You can add custom data to it, but if you change any data it will affect subsequent Actions and Hooks.
     * - You can also access other Project-specific data @ S Again, if you mess with data on this object, it could break everything, so make sure you know what you're doing ;)
     */

    _hookPostFunctionDeploy(evt) {
      var self = this;
      var promise = BbPromise.resolve();
      Object.keys(evt.data.deployed || []).map(function (region) {
        evt.data.deployed[region].map(function (deployed) {
          var func = S.getProject().getFunction(deployed.functionName);
          promise = promise.then(function () {
            return self.autopruneFunction({stage:evt.options.stage, region:region}, func)
          });
        });
      });
      return promise.then(function () {
        return evt;
      });
    }

    listAllAliases(aws, stage, region, functionName) {
      var self = this;
      var allAliases = [];

      function getMore(nextMarker) {
        return aws.request('Lambda', 'listAliases', {
          FunctionName: functionName,
          Marker: nextMarker
        }, stage, region)
        .then(function (response) {
          allAliases = allAliases.concat(response.Aliases);
          if (response.NextMarker) {
            return getMore(response.NextMarker);
          } else {
            return allAliases;
          }
        });
      }
      return getMore();
    }

    listAllVersions(aws, stage, region, functionName) {
      var self = this;
      var allVersions = [];

      function getMore(nextMarker) {
        return aws.request('Lambda', 'listVersionsByFunction', {
          FunctionName: functionName,
          Marker: nextMarker
        }, stage, region)
        .then(function (response) {
          allVersions = allVersions.concat(response.Versions);
          if (response.NextMarker) {
            return getMore(response.NextMarker);
          } else {
            return allVersions;
          }
        });
      }
      return getMore();
    }

    autopruneFunction(options, func) {
      var self = this;
      var functionName = func.getDeployedName(options);
      var versions;
      var aliases;
      var aliasMap = {};
      return self.listAllVersions(S.providers.aws, options.stage, options.region, functionName)
      .then(function (aVersions) {
        versions = aVersions;
        return self.listAllAliases(S.providers.aws, options.stage, options.region, functionName);
      })
      .then(function (aAliases) {
        aliases = aAliases;
        if (!aliases.length) {
          // No aliases, don't autoprune everything
          SCli.log('Skipping autoprune for ' + functionName + ' because it has no aliases defined.');
          return;
        }
        aliases.map(function (alias) {
          aliasMap[alias.FunctionVersion] = alias.Name;
        });
        var promise = BbPromise.resolve();
        versions.map(function (version) {
          if (version.Version.match(/^\d+$/)) {
            if (!aliasMap[version.Version]) {
              promise = promise.then(function () {
                SCli.log('Autopruning ' + functionName + ' version ' + version.Version);
                return S.providers.aws.request('Lambda', 'deleteFunction', {
                  FunctionName: functionName,
                  Qualifier: version.Version
                }, options.stage, options.region);
              });
            } else {
              SCli.log('Keeping ' + functionName + ' version ' + version.Version + ' (has alias ' + aliasMap[version.Version] + ')');
            }
          }
        });
        return promise;
      });
    }
  }

  // Export Plugin Class
  return ServerlessPluginAutoprune;

};

// Godspeed!

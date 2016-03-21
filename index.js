'use strict';

/**
 * Serverless Autoprune Plugin
 * Kenneth Falck <kennu@iki.fi> 2016
 */

module.exports = function(ServerlessPlugin, serverlessPath) { // Always pass in the ServerlessPlugin Class

  const path    = require('path'),
      fs        = require('fs'),
      SUtils    = require(path.join(serverlessPath, 'utils/index')),
      SCli      = require(path.join(serverlessPath, 'utils/cli')),
      BbPromise = require('bluebird'); // Serverless uses Bluebird Promises and we recommend you do to because they provide more than your average Promise :)

  /**
   * ServerlessPluginAutoprune
   */

  class ServerlessPluginAutoprune extends ServerlessPlugin {

    /**
     * Constructor
     * - Keep this and don't touch it unless you know what you're doing.
     */

    constructor(S) {
      super(S);
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
      return BbPromise.resolve();
    }

    /**
     * Register Hooks
     * - If you would like to register hooks (i.e., functions) that fire before or after a core Serverless Action or your Custom Action, include this function.
     * - Make sure to identify the Action you want to add a hook for and put either "pre" or "post" to describe when it should happen.
     */

    registerHooks() {
      this.S.addHook(this._hookPostFunctionDeploy.bind(this), {
        action: 'functionDeploy',
        event:  'post'
      });

      return BbPromise.resolve();
    }

    /**
     * Post deploy prune hook
     * - Be sure to ALWAYS accept and return the "evt" object, or you will break the entire flow.
     * - The "evt" object contains Action-specific data.  You can add custom data to it, but if you change any data it will affect subsequent Actions and Hooks.
     * - You can also access other Project-specific data @ this.S Again, if you mess with data on this object, it could break everything, so make sure you know what you're doing ;)
     */

    _hookPostFunctionDeploy(evt) {
      var self = this;
      var promise = BbPromise.resolve();
      Object.keys(evt.data.deployed || []).map(function (region) {
        evt.data.deployed[region].map(function (func) {
          promise = promise.then(function () {
            return self.autopruneFunction({stage:evt.options.stage, region:region}, func)
          });
        });
      });
      return promise.then(function () {
        return evt;
      });
    }

    listAllAliases(lambda, functionName) {
      var self = this;
      var allAliases = [];

      function getMore(nextMarker) {
        return lambda.listAliasesPromise({
          FunctionName: functionName,
          Marker: nextMarker
        })
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

    listAllVersions(lambda, functionName) {
      var self = this;
      var allVersions = [];

      function getMore(nextMarker) {
        return lambda.listVersionsByFunctionPromise({
          FunctionName: functionName,
          Marker: nextMarker
        })
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
      var AWS = require('aws-sdk');
      var lambda = new AWS.Lambda({region:options.region, accessKeyId:this.S.config.awsAdminKeyId, secretAccessKey:this.S.config.awsAdminSecretKey});
      var versions;
      var aliases;
      var aliasMap = {};
      BbPromise.promisifyAll(lambda, {suffix:'Promise'});
      return self.listAllVersions(lambda, func.functionName)
      .then(function (aVersions) {
        versions = aVersions;
        return self.listAllAliases(lambda, func.functionName);
      })
      .then(function (aAliases) {
        aliases = aAliases;
        if (!aliases.length) {
          // No aliases, don't autoprune everything
          SCli.log('Skipping autoprune for ' + func.functionName + ' because it has no aliases defined.');
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
                SCli.log('Autopruning ' + func.functionName + ' version ' + version.Version);
                return lambda.deleteFunctionPromise({
                  FunctionName: func.functionName,
                  Qualifier: version.Version
                });
              });
            } else {
              SCli.log('Keeping ' + func.functionName + ' version ' + version.Version + ' (has alias ' + aliasMap[version.Version] + ')');
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

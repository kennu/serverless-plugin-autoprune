'use strict';

/**
 * Serverless Autoprune Plugin
 * Kenneth Falck <kennu@iki.fi> 2016
 */

module.exports = function(ServerlessPlugin) { // Always pass in the ServerlessPlugin Class

  const path    = require('path'),
      fs        = require('fs'),
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
      this.S.addHook(this._hookPost.bind(this), {
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

    _hookPost(evt) {

      let _this = this;

      return new BbPromise(function (resolve, reject) {

        console.log('-------------------');
        console.log('Autopruning Lambda function', JSON.stringify(evt.data));
        console.log('-------------------');

        return resolve(evt);

      });
    }
  }

  // Export Plugin Class
  return ServerlessPluginAutoprune;

};

// Godspeed!

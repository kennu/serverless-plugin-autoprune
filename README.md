# Autoprune Plugin for Serverless
Kenneth Falck <kennu@iki.fi> 2016

This is a plugin that automatically removes old Lambda function versions
whenever you deploy the latest version of a function with Serverless.
Only versions that don't have an alias are removed. If you have stages
dev and prod, for example, those two versions are always kept.

## Installation

First install the plugin into your Serverless project:

    npm install --save serverless-plugin-autoprune

Then edit your **s-project.json**, locate the plugins: [] section, and add
the plugin as follows:

    plugins: [
        "serverless-plugin-autoprune"
    ]

## Usage

The plugin will automatically clean up old Lambda function versions whenever
a function is deployed using Serverless.

You may also use the Serverless CLI to run autoprune manually:

    sls function autoprune -s dev -a
    sls function autoprune -s prod <function-name>

# Autoprune Plugin for Serverless
Kenneth Falck <kennu@iki.fi> 2016

This is a plugin that automatically removes old Lambda function versions
whenever you deploy the latest version of a function with Serverless.

Without this plugin, old versions will keep accumulating in Lambda and
over time fill up the 1.5GB storage limit.

**Note:** Serverless *v0.1.0* or higher is required.

## Installation

First install the plugin into your Serverless project:

    npm install --save serverless-autoprune

Then edit your **s-project.json**, locate the plugins: [] section, and add
the plugin as follows:

    plugins: [
		  "serverless-autoprune"
		]

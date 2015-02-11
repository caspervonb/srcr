#!/usr/bin/env node

var through = require('through2');
var chrome = require('chrome-remote-interface');
var path = require('path');
var http = require('http');

var scripts = {};

var client = chrome(function(client) {
  client.on('error', function() {
  });

  console.log(JSON.stringify({
    time:new Date(),
    level: 'info',
    message: 'client connected on port 9222',
  }));

  process.stdin
    .pipe(through(parse))
    .pipe(process.stdout);

    function parse(buf, enc, next) {
    try {
      var data = JSON.parse(buf);
      if (data.type == 'change') {
        var script = scripts[data.url];

        if (script) {
          http.get(script.url, function(res) {
            var source = '';

            res.setEncoding('utf-8');
            res.on('data', function (chunk) {
              source += chunk;
            });

            res.on('end', function() {
              var params = {
                scriptId: script.scriptId,
                scriptSource: source,
              };

              client.Debugger.setScriptSource(params, function(error, response) {
                if (error) {
                  return console.log(JSON.stringify({
                    time:new Date(),
                    level: 'error',
                    message: response.message,
                  }));
                }

                console.log(JSON.stringify({
                  time:new Date(),
                  level: 'info',
                  event: 'source',
                  url: data.url,
                }));
              });
            });
          });
        }
      }
    } catch (err) {
      // no-op
    }

    this.push(buf);
    next();
  }

  client.on('Debugger.scriptParsed', function(params) {
    if (params.url.indexOf('http://') > -1) {

      scripts[path.basename(params.url)] = params;
      console.log(JSON.stringify({
        time:new Date(),
        level: 'info',
        event: 'parse',
        url: params.url
      }));
    }
  });

  client.Debugger.enable();
});

#!/usr/bin/env node

var cmd = require('commander');
var srcr = require('./');

cmd.usage('[OPTION]...');
cmd.option('-h, --host <HOST>', '', 'localhost');
cmd.option('-p, --port <PORT>', '', '9222');

cmd.parse(process.argv);

var client = srcr.connect(cmd);
client.on('connect', function(targets) {
  console.log(JSON.stringify({
    time: new Date(),
    level: 'info',
    message: 'client connected on port 9222',
  }));

  var target = targets.filter(function(target) {
    return target.url.indexOf(cmd.host) > -1;
  })[0];

  client.attach(targets[0]);
});

client.on('attach', function(target) {
  console.log(JSON.stringify({
    time: new Date(),
    level: 'info',
    message: 'attached to target ' + target.title,
  }));
});

client.on('detatch', function(target) {
  var id = setInterval(function() {
    client.targets(function(targets) {
      var target = targets.filter(function(target) {
        return target.url.indexOf(cmd.host) > -1;
      })[0];

      client.attach(target);
    });
  }, 500);

  client.once('attach', function() {
    clearInterval(id);
  });
});

process.stdin.on('data', function(data) {
  process.stdout.write(data);

  try {
    var message = JSON.parse(data);
    if (message.type == 'change') {
      client.source(message.url, false, function(error) {
        if (error) {
          return console.log(JSON.stringify({
            time: new Date(),
            level: 'error',
            message: error,
          }));
        }

        console.log(JSON.stringify({
          time: new Date(),
          level: 'info',
          event: 'source',
          url: data.url,
        }));
      });
    }
  } catch (error) {}
});

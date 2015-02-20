var http = require('http');
var ws = require('ws');
var path = require('path');

var DebuggerClient = (function() {
  function DebuggerClient() {
    this.request = null;
  }

  DebuggerClient.prototype.connect = function(port, host, callback) {
    this.port = port;
    this.host = host;

    this.targets(callback);
  };

  DebuggerClient.prototype.targets = function targets(callback) {
    var options = {
      host: this.host,
      port: this.port,
      path: '/json'
    };

    var request = http.get(options, function(response) {
      var data = '';

      response.on('data', function(chunk) {
        data += chunk;
      });

      response.on('end', function() {
        var targets = JSON.parse(data);
        callback(null, targets);
      });
    });
  };

  DebuggerClient.prototype.attach = function attach(target, callback) {
    var scripts = [];
    var socket = ws.connect(target.webSocketDebuggerUrl);

    socket.once('open', function() {
      var id = Date.now();

      socket.on('message', function process(data) {
        var message = JSON.parse(data);
        if (message.id == id) {
          socket.removeListener('message', process);

          if (message.error) {
            return callback(message.error);
          }

          callback(null, target);
        }
      });

      socket.send(JSON.stringify({
        id: id,
        method: "Debugger.enable"
      }));
    });

    socket.on('message', function(data) {
      var message = JSON.parse(data);
      if (message.method == 'Debugger.scriptParsed') {
        scripts.push(message.params);
      }
    });
    
    this.socket = socket;
    this.scripts = scripts;
  };

  DebuggerClient.prototype.source = function source(filename, contents, callback) {
    var socket = this.socket;
    var scripts = this.scripts;
    
    var script = scripts.filter(function(src) {
      return path.basename(src.url) == filename;
    })[0];

    if (!script) {
      return callback('Unknown script ' + filename);
    }

    var id = Date.now();
    socket.on('message', function process(data) {
      var message = JSON.parse(data);
      if (message.id == id) {
        socket.removeListener('message', process);

        if (message.error) {
          return callback(message.error);
        }
        
        callback(null, null);
      }
    });

    if (contents) {
      socket.send(JSON.stringify({
        id: id,
        method: "Debugger.setScriptSource",
        params: {
          scriptId: script.scriptId,
          scriptSource: contents
        }
      }));
    } else {
      var request = http.get(script.url, function(response) {
        var contents = '';
        
        response.on('data', function(chunk) {
          contents += chunk;
        });

        response.on('end', function() {        
          socket.send(JSON.stringify({
            id: id,
            method: "Debugger.setScriptSource",
            params: {
              scriptId: script.scriptId,
              scriptSource: contents
            }
          }));
        });
      });
    }
  };

  return DebuggerClient;
}());

function connect(options, callback) {
  var client = new DebuggerClient();
  client.connect(options.port, options.host, callback);

  return client;
}

module.exports.connect = connect;

/* jshint node:true */
'use strict';

var    http = require('http'),
         fs = require('fs'),
    express = require('express'),
     config = require('config');

var app = express();

// all environments
app.use(express.favicon());
app.use(express.logger('dev'));
app.use(express.bodyParser());
app.use(express.methodOverride());
app.use(app.router);
app.use(require('stylus').middleware(__dirname + '/public'));
app.use(express.static('public'));

// development only
if ('development' == app.get('env')) {
  app.use(express.errorHandler());
}

fs.readdirSync(__dirname + '/routes').forEach(function (file) {
  require('./routes/' + file)(app);
});

http.createServer(app).listen(config.port);
console.log('Server listening on port ' + config.port);

var https = require('https');

var options = {
  key: fs.readFileSync('certs/privatekey.pem'),
  cert: fs.readFileSync('certs/certificate.pem')
};

https.createServer(options, app).listen(config.securePort);
console.log('Secure Server listening on port ' + config.securePort);

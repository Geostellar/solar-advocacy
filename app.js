/* jshint node:true */
'use strict';

var    http = require('http'),
      https = require('https'),
         fs = require('fs'),
    express = require('express'),
     config = require('config');

var app = express();

app.set('port', process.env.PORT || config.port);

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



// var options = {
//   key: fs.readFileSync('test/fixtures/keys/agent2-key.pem'),
//   cert: fs.readFileSync('test/fixtures/keys/agent2-cert.pem')
// };

// https.createServer(options, app).listen(config.securePort);

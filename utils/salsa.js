/* jshint node:true */
'use strict';

// -+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-
// -+- Load Requires -+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-
// -+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-

var request = require('request'),
         sc = require('config').salsa;

var apiUrl  = 'https://hq-salsa.wiredforchange.com/';

// -+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-
// -+- Public Functions +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-
// -+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-

// note: for the following two functions, I've already converted the id. In
// other words, I'll be passing you the id as: FACEBOOK_ID@koobecaf.com.

/*
 * Takes in an id and queries salsa for the user with that id. Callback follows
 * the form: cb(err, user). err is a string. user is an object of the form:
 * {
 *   id:      String,
 *   token:   String,
 *   company: String,
 *   privacy: Object?
 * }
 */
function getUser(key, cb) {
  var cookieJar = request.jar();
  _authenticate(cookieJar, function (err) {
    if (err) return cb(err);
    _findUser(key, cookieJar, cb);
  });
}

/*
 * Takes a user (see above for form) and a cb. Saves the user in salsa with the
 * id: user.id. cb is in the form cb(err) where err is a string. If no err is
 * passed, success is assumed.
 */
function saveUser(user, cb) {
  var jar = request.jar();
  _authenticate(jar, function (err) {
    if (err) return cb(err);
    _createUser(user, jar, function (err, key) {
      if (err) return cb(err);
      _addToGroup(key, jar, cb);
    });
  });
}

module.exports = {
  get: getUser,
  save: saveUser
};


// -+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-
// -+- Private Functions -+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-
// -+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-

function _authenticate(jar, cb) {
  var url = apiUrl + 'api/authenticate.sjs';
  request({
    url: url,
    qs: {
      email: sc.user,
      password: sc.pass,
      json: true
    },
    jar: jar
  }, function (err, resp, body) {
    if (err) return cb(err);
    body = JSON.parse(body);
    if (body.status !== 'success') return cb(body.message);
    cb();
  });
}

function _findUser(key, jar, cb) {
  var url = apiUrl + '/api/getObjects.sjs';
  request({
    url: url,
    qs: {
      object: 'supporter',
      condition: 'Email=' + key,
      include: 'fbtoken,solar_company,privacy_settings',
      json: true
    },
    jar: jar
  }, function (err, resp, body) {
    if (err) return cb(err);
    body = JSON.parse(body);
    if (!body.length) return cb ('Not Found');
    cb(null, body[0]);
  });
}

function _createUser(user, jar, cb) {
  request({
    url: apiUrl + 'save',
    method: 'POST',
    qs: {
      object:           'supporter',
      Email:            user.id,
      fbtoken:          user.token,
      solar_company:    user.company,
      privacy_settings: user.privacy,
      json:             true
    },
    jar: jar
  }, function (err, res, body) {
    if (err) return cb(err);
    body = JSON.parse(body)[0];
    if (body.result !== 'success') return cb(body.messages);
    cb(null, body.key);
  });
}

function _addToGroup(userKey, jar, cb) {
  request({
    url: apiUrl + 'save',
    method: 'POST',
    qs: {
      object:           'supporter_groups',
      supporter_KEY:    userKey,
      groups_KEY:       67471,
      json:             true
    },
    jar: jar
  }, function (err, res, body) {
    if (err) return cb(err);
    body = JSON.parse(body)[0];
    if (body.result !== 'success') return cb(body.messages);
    cb();
  });
}
/* jshint node:true */
'use strict';

// -+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-
// -+- Load Requires -+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-
// -+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-

var request = require('request'),
         sc = require('config').salsa,
   waitress = require('waitress');

var salsaChapterKey = 10100;
var apiUrl          = 'https://hq-salsa.wiredforchange.com/';

var groupKeys = {
  sungevity: 67578,
  enphase:   67579,
  sunrun:    67888,
  sunpower:  67887,
  solarcity: 67886,
  other:     67580,
  'borrego solar':       11111,
  'vivint solar':        67577,
  'clean power finance': 67885
};

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
  var groupID = groupKeys[user.company.toLowerCase()] || groupKeys.other;
  var jar     = request.jar();
  _authenticate(jar, function (err) {
    if (err) return cb(err);
    _createUser(user, groupID, jar, function(err, userKey) {
      if (err) return cb(err);
      _assignGroup(userKey, groupID, jar, cb);
    });
  });
}


function deleteUser(email, cb) {
  var jar = request.jar();
  _authenticate(jar, function (err) {
    if (err) return cb(err);
    _findUser(email, jar, function (err, user) {
      if (err) return cb(err);
      _removeUser(user, jar, cb);
    });
  });
}

module.exports = {
  get:    getUser,
  save:   saveUser,
  remove: deleteUser
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
      object:    'supporter',
      condition: 'Email=' + key,
      include:   'fbtoken2,solar_company,privacy_settings2',
      json:      true
    },
    jar: jar
  }, function (err, resp, body) {
    if (err) return cb(err);
    body = JSON.parse(body);
    if (!body.length) return cb ('Not Found');
    cb(null, body[0]);
  });
}

function _createUser(user, groupKey, jar, cb) {
  request({
    url: apiUrl + 'save',
    method: 'POST',
    qs: {
      object:            'supporter',
      Email:             user.id,
      fbtoken2:          user.token,
      solar_company:     user.company,
      privacy_settings2: user.privacy,
      adsource:          user.source,
      link:              'chapter',
      linkKey:           salsaChapterKey,
      json:              true
    },
    jar: jar
  }, function (err, res, body) {
    if (err) return cb(err);
    body = JSON.parse(body)[0];
    if (body.result !== 'success') return cb(body.messages);
    cb(null, body.key);
  });
}

function _assignGroup(userKey, groupKey, jar, cb) {
  var done = waitress(3, cb);
  //should be optimized if this app gets popular enough.
  for (var key in groupKeys) {
    var group = groupKeys[key];
    if (group == groupKey) {
      _addToGroup(groupKey, userKey, jar, done);
    } else {
      _findGroup(group, userKey, jar, function(err, res) {
        if (err) return done(err);
        if (res.hasGroup) {
          _removeFromGroup(res.groupId, userKey, jar, done);
        }
        done();
      });
    }
  }
}

function _findGroup(groupKey, userKey, jar, cb) {
  var url = apiUrl + 'api/getObjects.sjs';
  request({
    url: url,
    qs: {
      object:    'supporter_groups',
      condition: 'groups_KEY=' + groupKey,
      json:      true
    },
    jar: jar
  }, function (err, res, body) {
    if (err) return cb(err);
    body = JSON.parse(body);
    var obj = {
      hasGroup: false
    };
    body.forEach(function(member) {
      if (member.supporter_KEY === userKey) {
        obj.hasGroup = true;
        obj.groupId  = member.key;
      }
    });
    cb(null, obj);
  });
}

function _removeFromGroup(groupKey, userKey, jar, cb) {
  request({
    url:    apiUrl + 'delete',
    method: 'POST',
    qs: {
      object:        'supporter_groups',
      key:           groupKey
    },
    jar: jar
  }, function (err, res, body) {
    if (err) return cb(err);
    cb();
  });
}

function _addToGroup(groupKey, userKey, jar, cb) {
  request({
    url:    apiUrl + 'save',
    method: 'POST',
    qs: {
      object:        'supporter_groups',
      supporter_KEY: userKey,
      groups_KEY:    groupKey,
      json:          true
    },
    jar: jar
  }, function (err) {
    if (err) return cb(err);
    cb();
  });
}


function _removeUser(user, jar, cb) {
  console.log(user);
  request({
    url: apiUrl + 'delete',
    method: 'POST',
    qs: {
      object: 'supporter',
      key:    user.supporter_KEY
    },
    jar: jar
  }, function (err) {
    if (err) return cb(err);
    cb();
  });
}

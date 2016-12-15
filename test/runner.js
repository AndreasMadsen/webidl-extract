'use strict';

const fs = require('fs');
const path = require('path');
const endpoint = require('endpoint');
const WebIDLFetch = require('../index.js');
const interpreted = require('interpreted');

interpreted({
  source: path.resolve(__dirname, 'html'),
  expected: path.resolve(__dirname, 'idl'),

  update: false,
  sourceRead: false,

  test: function (name, content, callback) {
    const htmlPath = path.resolve(__dirname, 'html', name + '.html');

    fs.createReadStream(htmlPath)
      .pipe(new WebIDLFetch())
      .pipe(endpoint(function (err, content) {
        if (err) return callback(err);
        callback(null, content.toString());
      }));
  }
});

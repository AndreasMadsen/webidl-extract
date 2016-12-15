#!/usr/bin/env node
'use strict';

const WebIDLFetch = require('./index.js');

process.stdin
  .pipe(new WebIDLFetch())
  .pipe(process.stdout);

'use strict';

const htmlparser = require('htmlparser2');
const entities = require('entities');
const stream = require('stream');

const HEADER_LEVEL = {
  'h1': 1,
  'h2': 2,
  'h3': 3,
  'h4': 4,
  'h5': 5,
  'h6': 6
};

class WebIDLFetch extends stream.Transform {
  constructor(options) {
    super(options);

    const self = this;

    let withinIDL = false;
    let withinIDLIndex = false;
    let idlIndexBlockTag = '';
    let indexHeaderLevel = 0;

    this._parser = new htmlparser.Parser({
      onopentag(tagName, attributes) {
        if (tagName === 'pre') {
          const classList = (attributes.class || '').split(/\s+/);

          // classList must have idl and not extract
          //    http://stackoverflow.com/questions/7527681#7644380
          // pre element must not have data-no-idl
          //    https://github.com/tabatkins/bikeshed/blob/master/bikeshed/__init__.py
          if (classList.includes('idl') && !classList.includes('extract')
          && !attributes.hasOwnProperty('data-no-idl')) {
            withinIDL = true;
          }
        }

        // An IDL index header was found
        if (attributes.id === 'idl-index') {
          withinIDLIndex = true;
          if (HEADER_LEVEL.hasOwnProperty(tagName)) {
            indexHeaderLevel = HEADER_LEVEL[tagName.toLowerCase()];
          } else if (tagName === 'section') {
            idlIndexBlockTag = tagName;
          } else {
            self.emit('error', new Error(`unexpected idl-index tag <${tagName}>`));
          }
        }

        // An IDL index has previusely been found, this tag may indicate
        // the IDL index section termination, if its hierarchy is higher
        // than the top-level for the index.
        else if (withinIDLIndex && HEADER_LEVEL.hasOwnProperty(tagName)) {
          // If the header is on the same level or higher, then the section
          // is terminated.
          const headerLevel = HEADER_LEVEL[tagName];
          if (headerLevel >= indexHeaderLevel) withinIDLIndex = false;
        }
      },
      ontext(text) {
        if (withinIDL && !withinIDLIndex) {
          self.push(entities.decodeHTML(text));
        }
      },
      onclosetag(tagName) {
        if (withinIDL && tagName === 'pre') {
          withinIDL = false;
          if (!withinIDLIndex) self.push('\n\n');
        } else if (withinIDLIndex && idlIndexBlockTag === tagName) {
          withinIDLIndex = false;
          idlIndexBlockTag = '';
        }
      }
    });
  }

  _transform(data, encoding, callback) {
    // send data to parser, it will call .push() when possible
    this._parser.write(data, encoding);
    callback(null);
  }

  _flush(callback) {
    // document ended, it will call .push() if possible
    this._parser.end();
    callback(null);
  }
}

module.exports = WebIDLFetch;

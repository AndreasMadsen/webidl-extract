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

// Given a string that contains a complete HTML document, return
// just the WebIDL it contains.

function WebIDLFetchFromString(html) {
  let outputIDL = '';               // The IDL gets assembled into this string
  let withinIDL = false;            // Are we currently processing a <pre> containing IDL?
  let withinIDLIndex = false;       // Are we inside a <pre> in the WebIDL index?
  let idlIndexBlockTag = '';        // What tag was used to open the index?
  let indexHeaderLevel = 0;         // At what header level did the index begin?

  const parser = new htmlparser.Parser({
    // Handle a new opening tag
    onopentag(tagName, attributes) {
      if (tagName === 'pre') {
        const classList = (attributes.class || '').split(/\s+/);

        // The class list must include "idl" but not "extract",
        // and the attribute list must not include "data-no-idl"

        if (classList.includes('idl') && !classList.includes('extract')
              && !attributes.hasOwnProperty('data-no-idl')) {
          withinIDL = true;
        }
      }

      // Tags with the ID "idl-index" are the WebIDL index near the bottom
      // of the page. We don't want to consider anything in the index.
      // The index comes in one of two forms: The first begins with a
      // heading element (<hN>) that has the ID "idl-index". For this,
      // we remember the heading level that we were at so that once
      // we go up past that level, we consider the index to be closed.
      // The other is a <section> element with that same ID.

      if (attributes.id === 'idl-index') {
        withinIDLIndex = true;

        if (HEADER_LEVEL.hasOwnProperty(tagName)) {
          indexHeaderLevel = HEADER_LEVEL[tagName.toLowerCase()];
        } else if (tagName === 'section') {
          idlIndexBlockTag = tagName;
        } else {
          throw `Unexpected idl-index tag found: <${tagName}>`;
        }
      }

      // If we're already in an IDL index, see if we are exiting it.
      // This happens if the tag is a heading at a higher level than
      // the one that started a heading-initiated index. For
      // <section>-based indexes, closing the index happens in the
      // onclosetag() function.

      else if (withinIDLIndex && HEADER_LEVEL.hasOwnProperty(tagName)) {
        const headerLevel = HEADER_LEVEL[tagName];

        if (headerLevel >= indexHeaderLevel) {
          withinIDLIndex = false;
        }
      }
    },

    // Handle a text node. The text just gets appended to the
    // output IDL text.
    ontext(text) {
      if (withinIDL && !withinIDLIndex) {
        outputIDL += entities.decodeHTML(text);
      }
    },

    // Handle a close tag
    onclosetag(tagName) {
      if (withinIDL && tagName === 'pre') {
        withinIDL = false;

        // If it's IDL we're actually grabbing, make sure there's a blank
        // line before the next chunk is added
        if (!withinIDLIndex) {
          outputIDL += '\n\n';
        }
      } else if (withinIDLIndex && idlIndexBlockTag === tagName) {
        withinIDLIndex = false;
        idlIndexBlockTag = '';
      }
    }
  });

  // Now send the HTML into the parser for processing

  parser.write(html);
  parser.end();
  return outputIDL;
}

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
module.exports.WebIDLFetchFromString = WebIDLFetchFromString;
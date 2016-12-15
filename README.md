#webidl-extract

> Parse a stream of HTML and output the WebIDL within

## Example

Use the programmable API:

```javascript
const WebIDLFetch = require('webidl-fetch');

process.stdin
  .pipe(new WebIDLFetch())
  .pipe(process.stdout);
```

Use the CLI:

```bash
cat dom.html | webidl-fetch > dom.idl
```

## Acknowledgement

This is really just a modernized and simplified version of [webidl-scraper](https://github.com/motiz88/webidl-scraper).

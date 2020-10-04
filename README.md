# Mailor

> This module glues Maildev and MJML with some Pug and Mustache to enable an easier development workflow for mailings on NodeJS.

<div align="center">

[![Build Status](https://api.travis-ci.org/tacoss/mailor.svg?branch=master)](https://travis-ci.org/tacoss/mailor)
[![NPM version](https://badge.fury.io/js/mailor.svg)](http://badge.fury.io/js/mailor)
[![Coverage Status](https://codecov.io/github/tacoss/mailor/coverage.svg?branch=master)](https://codecov.io/github/tacoss/mailor)
[![Known Vulnerabilities](https://snyk.io/test/npm/mailor/badge.svg)](https://snyk.io/test/npm/mailor)

</div>

Get it globally or within your project:

```bash
$ npm i -g mailor # or `npm i mailor --save-dev`
```

Now, you can start creating templates using pure `.pug` files:

**templates/test1.pug**
```pug
mjml
  mj-body: mj-section
    mj-column: mj-text
      h1 It works!
```

Build or watch for changes, e.g.

```bash
$ mailor watch templates -d generated --no-open
```

Once built, try sending it through the local SMTP, e.g.

```bash
$ mailor send generated/test1.html
```

Open http://localhost:1080 and see how it looks!

## API

By default `maildev` is enabled when watch mode is used.

The `send` command uses `nodemailer` for sending messages through.

You can, however, reuse this module too:

```js
const nodemailer = require('nodemailer');

const mailer = require('mailor').getMailer({
  transport: nodemailer.createTransport(...),
  internalErrors: [],
});

mailer.sendMail({
  template: 'path/to/tpl.html',
  subject: 'Test',
  email: 'test@example.com',
  data: { ... },
});
```

You MUST provide a working `transport` and optionally a list of internal error messages to be aware of, if any matches an exception will be thrown.

### Using input

Local variables are given as `data` and they're rendered by Mustache to build the message to be sent.

Locals for pug-templates MUST be provided as values during `mailor` invocation, e.g.

```bash
$ mailor build templates -o generated username="John Doe" token="x-f4c8"
```

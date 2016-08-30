'use strict';

const handle = require('./lib');

module.exports.handler = function(event, context) {
  return handle(event)
    .then(() => context.succeed())
    .catch(err => context.fail(err));
};
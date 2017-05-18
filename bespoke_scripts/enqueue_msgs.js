'use strict';

const Promise  = require('bluebird');
const co       = require('co');
const AWS      = require('aws-sdk');
AWS.config.region = 'us-east-1';
const Lambda   = new AWS.Lambda();
const SQS      = Promise.promisifyAll(new AWS.SQS());
const _        = require('lodash');
const uuid     = require('node-uuid');

const rate     = 5;
const queueUrl = 'https://sqs.us-east-1.amazonaws.com/374852340823/yc-test';

let sendMsgs = co.wrap(function* (rate) {
  let entries = _.range(0, rate).map(n => {
    return {
      Id: uuid.v4(),
      MessageBody: "test"
    };
  });

  let params = {
    Entries: entries,
    QueueUrl: queueUrl
  };

  yield SQS.sendMessageBatchAsync(params);
  console.log(`send [${entries.length}] messages`);
});

setInterval(() => sendMsgs(5), 1000);
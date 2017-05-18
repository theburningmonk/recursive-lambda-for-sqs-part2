'use strict';

const Promise  = require('bluebird');
const co       = require('co');
const uuid     = require('node-uuid');
const AWS      = require('aws-sdk');
const Lambda   = new AWS.Lambda();
const DynamoDB = Promise.promisifyAll(new AWS.DynamoDB.DocumentClient());

const funcName = 'lambda-sqs-spike-dev-process-msg';
const table    = 'sqs-tokens-dev';

let placeToken = co.wrap(function* (queueUrl) {
  let token = uuid.v4();
  let params = {
    TableName : table,
    Item: { 
      queue: queueUrl, 
      token: token
    }
  };

  yield DynamoDB.putAsync(params);
  return token;
});

let invoke = co.wrap(function* (queueUrl, token) {
  let event = { queueUrl, token };
  let params = {
    FunctionName: funcName,
    InvocationType: 'Event',
    Payload: JSON.stringify(event)
  };
    
  yield Lambda.invoke(params).promise();
  console.log("Started processor.");
});

module.exports = co.wrap(function* (event) {
  console.log(JSON.stringify(event));

  let snsMsg    = JSON.parse(event.Records[0].Sns.Message);
  let accountId = snsMsg.AWSAccountId;
  let queueName = snsMsg
    .Trigger
    .Dimensions
    .find(dim => dim.name === 'QueueName')
    .value;

  let queueUrl = `https://sqs.${AWS.config.region}.amazonaws.com/${accountId}/${queueName}`;

  let token = yield placeToken(queueUrl);

  yield invoke(queueUrl, token);
});
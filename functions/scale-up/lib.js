'use strict';

const Promise  = require('bluebird');
const co       = require('co');
const uuid     = require('node-uuid');
const AWS      = require('aws-sdk');
AWS.config.region = process.env.SERVERLESS_REGION;

const Lambda   = new AWS.Lambda();
const DynamoDB = Promise.promisifyAll(new AWS.DynamoDB.DocumentClient());

const project  = process.env.SERVERLESS_PROJECT;
const funcName = process.env.PROCESSOR_FUNCTION;
const table    = process.env.TOKENS_TABLE;

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
    FunctionName: `${project}-${funcName}`,
    InvocationType: 'Event',
    Qualifier: process.env.SERVERLESS_STAGE,
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

  let queueUrl = `https://sqs.${process.env.SERVERLESS_REGION}.amazonaws.com/${accountId}/${queueName}`;

  let token = yield placeToken(queueUrl);

  yield invoke(queueUrl, token);
});
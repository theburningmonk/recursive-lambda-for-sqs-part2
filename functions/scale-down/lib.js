'use strict';

const Promise  = require('bluebird');
const co       = require('co');
const uuid     = require('node-uuid');
const AWS      = require('aws-sdk');
AWS.config.region = process.env.SERVERLESS_REGION;

const Lambda   = new AWS.Lambda();
const DynamoDB = Promise.promisifyAll(new AWS.DynamoDB.DocumentClient());

const table = process.env.TOKENS_TABLE;

let takeAwayToken = co.wrap(function* (queueUrl) {
  let token = uuid.v4();
  let queryParams = {
    TableName: table,
    KeyConditionExpression: 'queue = :queueUrl',
    ExpressionAttributeValues: {
      ':queueUrl': queueUrl
    }
  };

  let res = yield DynamoDB.queryAsync(queryParams);
  if (res.Items && res.Items.length > 1) {
    let item = res.Items[0];
    console.log(`scaling down SQS processor : ${queueUrl} [${item.token}]`);

    let delParams = {
      TableName: table,
      Key: {
        queue: queueUrl,
        token: item.token
      }
    };
    yield DynamoDB.deleteAsync(delParams);
  } else {
    console.log(`there needs to be at least 1 processor for SQS : ${queueUrl}`);
    console.log('ignoring scale-down request');
  }
});

module.exports = co.wrap(function* (event) {
  console.log(JSON.stringify(event));

  let snsMsg = JSON.parse(event.Records[0].Sns.Message);
  if (snsMsg.OldStateValue !== 'ALARM') {
    console.log('not transitioned from an ALARM state, ignored');
    return;
  }

  let accountId = snsMsg.AWSAccountId;
  let queueName = snsMsg
    .Trigger
    .Dimensions
    .find(dim => dim.name === 'QueueName')
    .value;

  let queueUrl = `https://sqs.${process.env.SERVERLESS_REGION}.amazonaws.com/${accountId}/${queueName}`;

  yield takeAwayToken(queueUrl);
});
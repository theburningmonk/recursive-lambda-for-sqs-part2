'use strict';

const Promise  = require('bluebird');
const co       = require('co');
const AWS      = require('aws-sdk');
const Lambda   = new AWS.Lambda();
const DynamoDB = Promise.promisifyAll(new AWS.DynamoDB.DocumentClient());

const funcName = 'lambda-sqs-spike-dev-process-msg';
const table    = 'sqs-tokens-dev';

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

let findFailedProcessors = co.wrap(function* () {
  let now = new Date();
  let twoMinsAgo = new Date(now.getTime() - 120000);

  let loop = co.wrap(function* (acc, lastKey) {
    let params = {
      TableName         : table,
      FilterExpression  : 'attribute_not_exists(last_used) OR last_used < :twoMinsAgo',
      ExpressionAttributeValues : {
        ':twoMinsAgo' : twoMinsAgo.toJSON()
      },
      ExclusiveStartKey : lastKey
    };

    console.log(`Fetching more... ExclusiveStartKey [${lastKey}]`);
    let res = yield DynamoDB.scanAsync(params);
    let newAcc = acc.concat(res.Items);

    if (res.LastEvaluatedKey) {
      return loop(newAcc, res.LastEvaluatedKey);
    } else {
      return newAcc;
    }
  });

  return yield loop([]);
}); 

module.exports = co.wrap(function* (event) {
  console.log(JSON.stringify(event));

  let keys = yield findFailedProcessors();
  for (let key of keys) {
    console.log(`restating SQS processor : ${key.queue} [${key.token}]`);
    yield invoke(key.queue, key.token);
  }
});
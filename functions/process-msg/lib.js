'use strict';

const Promise  = require('bluebird');
const co       = require('co');
const AWS      = require('aws-sdk');
const Lambda   = new AWS.Lambda();
const SQS      = Promise.promisifyAll(new AWS.SQS());
const DynamoDB = Promise.promisifyAll(new AWS.DynamoDB.DocumentClient());

let sayHello = co.wrap(function* (msg) {
  console.log(`Hello, ${msg.Body} of message ID [${msg.MessageId}]`);
});

let deleteMessage = co.wrap(function* (msg, queueUrl) {
  let delParams = {
    QueueUrl      : queueUrl,
    ReceiptHandle : msg.ReceiptHandle
  };
  
  yield SQS.deleteMessageAsync(delParams);
  console.log(`Message ID [${msg.MessageId}] deleted`);
});

let recurse = co.wrap(function* (event) {
  let params = {
    FunctionName: `lambda-sqs-spike-dev-process-msg`,
    InvocationType: 'Event',
    Qualifier: process.env.SERVERLESS_STAGE,
    Payload: JSON.stringify(event)
  };
    
  yield Lambda.invoke(params).promise();
  console.log("Recursed.");
});

let verifyToken = co.wrap(function* (queueUrl, token) {
  let params = {
    TableName : 'sqs-tokens-dev',
    Item: { 
      queue: queueUrl, 
      token: token, 
      last_used: new Date().toJSON() 
    },
    ConditionExpression: "attribute_exists(#token)",
    ExpressionAttributeNames: {
      '#token': 'token'
    }
  };

  yield DynamoDB.putAsync(params);
});

module.exports = co.wrap(function* (event) {
  console.log(JSON.stringify(event));

  let token = event.token;
  let queueUrl = event.queueUrl;

  try {
    yield verifyToken(queueUrl, token);
  } catch (err) {
    console.log(err, err.stack);
    console.log('failed to verify token, exiting recursive loop');
    return;
  }

  let params = {
    QueueUrl            : queueUrl,
    MaxNumberOfMessages : 10,
    VisibilityTimeout   : 6,
    WaitTimeSeconds     : 20
  };
  
  try {
    let pollRes = yield SQS.receiveMessageAsync(params);
    
    if (pollRes.Messages && pollRes.Messages.length > 0) {
      for (let msg of pollRes.Messages) {
        yield sayHello(msg)
          .then(() => deleteMessage(msg, queueUrl))
          .catch(console.log);
      }
    }
  } catch (err) {
    console.log(err, err.stack);
  }

  yield recurse(event);
});
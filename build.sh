#!/bin/bash
instruction()
{
  echo "./build.sh <command> <env> <region> <aws_profile>"
  echo ""
  echo "command: deploy, test"
  echo "env: eg. dev, staging, prod, ..."
  echo "region: eg. us-east-1, eu-west-1, ..."
  echo "aws_profile: name of local AWS profile, to set one up run 'aws configure --profile profile_name'"
}

if [ $# -eq 0 ]; then
  instruction
  exit 1
elif [ "$1" = "deploy" ] && [ $# -eq 4 ]; then
  STAGE=$2
  REGION=$3
  PROFILE=$4

  npm install
  AWS_PROFILE=$PROFILE 'node_modules/.bin/sls' deploy -s $STAGE -r $REGION

  echo '***ALL DONE***'
elif [ "$1" = "test" ] && [ $# -eq 2 ]; then
  PROFILE=$2

  npm install
  AWS_PROFILE=$PROFILE node 'bespoke_scripts/enqueue_msgs.js'
else
  instruction
  exit 1
fi
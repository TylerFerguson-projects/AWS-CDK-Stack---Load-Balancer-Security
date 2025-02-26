import * as cdk from 'aws-cdk-lib';
import { TimelineCdkDeployStack } from '../lib/timeline-cdk-deploy-stack';

const app = new cdk.App();
new TimelineCdkDeployStack(app, 'TimelineCdkDeployStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  },
});
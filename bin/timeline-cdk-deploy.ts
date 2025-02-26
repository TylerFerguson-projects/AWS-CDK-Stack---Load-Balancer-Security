import * as cdk from 'aws-cdk-lib';
import * as dotenv from 'dotenv';
import { TimelineCdkDeployStack } from '../lib/timeline-cdk-deploy-stack';

dotenv.config();

const app = new cdk.App();

// Set context values from environment variables
if (process.env.ALLOWED_IP_CIDR) {
  app.node.setContext('ALLOWED_IP_CIDR', process.env.ALLOWED_IP_CIDR);
}

new TimelineCdkDeployStack(app, 'TimelineCdkDeployStack', {
 
  // CLI credentials
   env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION },

});
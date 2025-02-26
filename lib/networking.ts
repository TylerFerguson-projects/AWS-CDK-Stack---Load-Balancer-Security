import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';

export class Networking extends Construct {
  public readonly vpc: ec2.Vpc;

  constructor(scope: Construct, id: string) {
    super(scope, id);
  
    // Create minimal VPC with just public subnets (free tier friendly)
    this.vpc = new ec2.Vpc(this, 'TimelineVPC', {
      maxAzs: 2,
      natGateways: 0, // No NAT Gateways to save costs
      subnetConfiguration: [
        {
          name: 'timeline-public',
          subnetType: ec2.SubnetType.PUBLIC,
          cidrMask: 24,
          mapPublicIpOnLaunch: true
        }
      ],
      enableDnsSupport: true,
      enableDnsHostnames: true
    });
    
    cdk.Tags.of(this.vpc).add('Application', 'Timeline');
  }
}

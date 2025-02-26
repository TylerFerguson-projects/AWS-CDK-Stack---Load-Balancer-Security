import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';

export class Networking extends Construct {
  public readonly vpc: ec2.Vpc;

  constructor(scope: Construct, id: string) {
    super(scope, id);
  
    // Create VPC with public and isolated subnets
    // Still free tier friendly, but with better security design
    this.vpc = new ec2.Vpc(this, 'TimelineVPC', {
      maxAzs: 2,                        // 2 AZs for high availability
      natGateways: 0,                   //  I am skipping NAT Gateways to avoid charges 
      subnetConfiguration: [
        {
          name: 'public-subnet',
          subnetType: ec2.SubnetType.PUBLIC,
          cidrMask: 24,
          mapPublicIpOnLaunch: true     // Auto-assign public IPs in public subnets
        },
        {
          name: 'private-subnet',
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED,  
          cidrMask: 24
        }
      ],
      enableDnsSupport: true,
      enableDnsHostnames: true
    });
    
    // Create an S3 gateway endpoint to allow private subnets to access S3
    // This is free and doesn't require NAT gateways
    this.vpc.addGatewayEndpoint('S3GatewayEndpoint', {
      service: ec2.GatewayVpcEndpointAwsService.S3,
      subnets: [{ subnetType: ec2.SubnetType.PRIVATE_ISOLATED }]
    });

    // Create a DynamoDB gateway endpoint
    // Also free and doesn't require NAT gateways
    this.vpc.addGatewayEndpoint('DynamoDBEndpoint', {
      service: ec2.GatewayVpcEndpointAwsService.DYNAMODB,
      subnets: [{ subnetType: ec2.SubnetType.PRIVATE_ISOLATED }]
    });
    
    // Add meaningful tags
    cdk.Tags.of(this.vpc).add('Application', 'Timeline');
    cdk.Tags.of(this.vpc).add('Environment', 'Development');
    cdk.Tags.of(this.vpc).add('ManagedBy', 'CDK');
  }
}
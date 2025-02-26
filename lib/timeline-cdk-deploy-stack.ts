import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Networking } from './networking';
import { Security } from './security';
import { Compute } from './compute';
import { LoadBalancer } from './load-balancer';

export class TimelineCdkDeployStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
    
    // Initialize networking module with minimal resources
    const networking = new Networking(this, 'Networking');
    
    // Initialize security module
    const security = new Security(this, 'Security', networking.vpc);
    
    // Initialize compute with EC2 instance
    const compute = new Compute(this, 'Compute', 
      networking.vpc,
      security
    );
    
    // Initialize load balancer module
    const loadBalancer = new LoadBalancer(this, 'LoadBalancer', {
      vpc: networking.vpc,
      securityGroup: security.albSecurityGroup,
      instance: compute.instance,
      healthCheck: {
        path: '/health',
        interval: cdk.Duration.seconds(30),
        timeout: cdk.Duration.seconds(5),
        healthyThresholdCount: 2,
        unhealthyThresholdCount: 2
      }
    });
    
    // Set up cross-stack connections after the LoadBalancer is created
    security.setupCrossStackConnections();

    // Add stack outputs
    new cdk.CfnOutput(this, 'LoadBalancerDns', {
      value: loadBalancer.loadBalancer.loadBalancerDnsName,
      description: 'The DNS name of the load balancer',
      exportName: `${this.stackName}-LoadBalancerDns`
    });

    new cdk.CfnOutput(this, 'InstancePublicIp', {
      value: compute.instance.instancePublicIp,
      description: 'The public IP address of the EC2 instance',
      exportName: `${this.stackName}-InstancePublicIp`
    });
    
    new cdk.CfnOutput(this, 'InstanceId', {
      value: compute.instance.instanceId,
      description: 'The ID of the EC2 instance',
      exportName: `${this.stackName}-InstanceId`
    });
  }
}
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Networking } from './networking';
import { Security } from './security';
import { Compute } from './compute';
import { LoadBalancer } from 'aws-cdk-lib/aws-elasticloadbalancing';

export class TimelineCdkDeployStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    cdk.Tags.of(this).add('Application', 'Timeline');
    cdk.Tags.of(this).add('ManagedBy', 'CDK');

    // Initialize networking module with minimal resources
    const networking = new Networking(this, 'Networking');

    // Get and validate allowed IP CIDR for SSH access
    const allowedIpCidr = process.env.ALLOWED_IP_CIDR;
    if (!allowedIpCidr) {
      throw new Error('ALLOWED_IP_CIDR environment variable must be set for secure SSH access');
    }
    
    if (allowedIpCidr === '0.0.0.0/0') {
      throw new Error('Security constraint violation: ALLOWED_IP_CIDR cannot be 0.0.0.0/0. Please specify a restricted IP range.');
    }
    
    // Initialize security module
    const security = new Security(this, 'Security', networking.vpc, allowedIpCidr);

    // Initialize compute module with only the application instance
    const compute = new Compute(this, 'Compute', 
      networking.vpc,
      security
    );
    // Initialize load balancer module
    const loadBalancer = new LoadBalancer(this, 'LoadBalancer', {
      vpc: networking.vpc,
      healthCheck: {
        path: '/health',
        port: 80,
        interval: cdk.Duration.minutes(3),  
    timeout: cdk.Duration.seconds(10),
    healthyThreshold: 3,
    unhealthyThreshold: 2
      }
    });

// Add load balancer DNS to outputs
new cdk.CfnOutput(this, 'LoadBalancerDns', {
  value: loadBalancer.loadBalancerDnsName,
  description: 'The DNS name of the load balancer',
  exportName: `${this.stackName}-LoadBalancerDns`
});

    // === Stack Outputs ===
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
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Networking } from './networking';
import { Security } from './security';
import { Compute } from './compute';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { LoadBalancer } from 'aws-cdk-lib/aws-elasticloadbalancing';

export class TimelineCdkDeployStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
    
    // Initialize networking module with minimal resources
    const networking = new Networking(this, 'Networking');
    
    // Initialize security module with secret value
    const security = new Security(this, 'Security', networking.vpc);
    
    // Rest of your stack remains the same
    const compute = new Compute(this, 'Compute', 
      networking.vpc,
      security
    );
    // Initialize load balancer module
    const loadBalancer = new LoadBalancer(this, 'LoadBalancer', {
      vpc: networking.vpc,
      internetFacing: true, 
      listeners: [
        {
          externalPort: 80,
          internalPort: 80
        }
      ],
      subnetSelection: { subnetType: ec2.SubnetType.PUBLIC },
      healthCheck: {
        path: '/health',
        port: 80,
        interval: cdk.Duration.minutes(3),  
    timeout: cdk.Duration.seconds(10),
    
    healthyThreshold: 3,
    unhealthyThreshold: 2
      }
    });

loadBalancer.connections.allowFrom(ec2.Peer.anyIpv4(), ec2.Port.tcp(80));
loadBalancer.connections.allowTo(compute.instance, ec2.Port.tcp(80));


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
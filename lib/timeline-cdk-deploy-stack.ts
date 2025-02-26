import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Networking } from './networking';
import { Security } from './security';
import { Compute } from './compute';
import { LoadBalancer } from './load-balancer';

/**
 * Main stack for the Timeline application infrastructure.
 * 
 * Integrates:
 * - Networking (VPC, subnets)
 * - Security (security groups, IAM, secrets)
 * - Compute (EC2 instance, bastion host)
 * - Load Balancer (ALB, target groups)
 * 
 * This stack provides a complete, production-ready infrastructure for the Timeline web application
 * with proper security controls, high availability, and monitoring capabilities.
 */
export class TimelineCdkDeployStack extends cdk.Stack {
  /**
   * Creates a new TimelineCdkDeployStack
   * 
   * @param scope - Parent construct, typically an App instance
   * @param id - Stack identifier
   * @param props - Standard CDK stack properties
   */
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Apply stack-level tags for resource organization
    cdk.Tags.of(this).add('Application', 'Timeline');
    cdk.Tags.of(this).add('ManagedBy', 'CDK');
    cdk.Tags.of(this).add('Environment', id);

    // Initialize networking module with VPC, subnets, and security groups
    const networking = new Networking(this, 'Networking', true); // Enable flow logs

    // Get and validate allowed IP CIDR for bastion access
    const allowedIpCidr = process.env.ALLOWED_IP_CIDR;
    if (!allowedIpCidr) {
      throw new Error('ALLOWED_IP_CIDR environment variable must be set for secure bastion access');
    }
    
    // Verify it's not too permissive
    if (allowedIpCidr === '0.0.0.0/0') {
      throw new Error('Security constraint violation: ALLOWED_IP_CIDR cannot be 0.0.0.0/0. Please specify a restricted IP range.');
    }
    
    // Initialize security module with security groups, IAM roles, and secrets
    const security = new Security(this, 'Security', networking.vpc, allowedIpCidr);

    // Initialize compute module with EC2 instance and bastion host
    const compute = new Compute(this, 'Compute', 
      networking.vpc,
      security
    );

    // Initialize load balancer module for public access to the application
    const loadBalancer = new LoadBalancer(this, 'LoadBalancer', {
      vpc: networking.vpc,
      securityGroup: networking.albSecurityGroup,
      instance: compute.instance
    });

    // === Stack Outputs ===
    
    // Output the load balancer DNS for accessing the application
    new cdk.CfnOutput(this, 'LoadBalancerDNS', {
      value: loadBalancer.loadBalancer.loadBalancerDnsName,
      description: 'The DNS name of the load balancer',
      exportName: `${this.stackName}-LoadBalancerDNS`
    });

    // Output the instance ID for troubleshooting and monitoring
    new cdk.CfnOutput(this, 'InstanceId', {
      value: compute.instance.instanceId,
      description: 'The ID of the EC2 instance',
      exportName: `${this.stackName}-InstanceId`
    });

    // Output the bastion host IP for secure access
    new cdk.CfnOutput(this, 'BastionHostIP', {
      value: compute.bastionHost.instancePublicIp,
      description: 'The public IP address of the bastion host',
      exportName: `${this.stackName}-BastionHostIP`
    });
    
    // Output VPC ID for reference by other stacks
    new cdk.CfnOutput(this, 'VpcId', {
      value: networking.vpc.vpcId,
      description: 'The ID of the VPC',
      exportName: `${this.stackName}-VpcId`
    });
  }
}
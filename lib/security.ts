import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';

/**
 * Security construct for the Timeline application.
 * 
 * Manages:
 * - Security Groups for application and bastion instances
 * - IAM roles and policies for EC2 instance permissions
 * - Secrets Manager for secure application credentials
 */
export class Security extends Construct {
  /** Security group controlling access to the application instance */
  public readonly timelineSecurityGroup: ec2.SecurityGroup;
  
  /** Security group controlling access to the bastion host */
  public readonly bastionSecurityGroup: ec2.SecurityGroup;
  
  /** IAM role for the application EC2 instance */
  public readonly instanceRole: iam.Role;
  
  /** Secrets Manager secret containing application configuration */
  public readonly appSecrets: secretsmanager.Secret;

  /**
   * Creates a new Security construct for the Timeline application
   * 
   * @param scope - Parent construct
   * @param id - Construct ID
   * @param vpc - VPC where security resources will be deployed
   * @param allowedIp - CIDR range allowed to access the bastion host (default: '0.0.0.0/0')
   */
  constructor(scope: Construct, id: string, vpc: ec2.Vpc, allowedIp: string = '0.0.0.0/0') {
    super(scope, id);

    // Validate allowedIp is a proper CIDR notation
    if (!/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\/\d{1,2}$/.test(allowedIp)) {
      throw new Error(`Invalid CIDR format for allowedIp: ${allowedIp}`);
    }

    // Define standard ports
    const SSH_PORT = 22;
    const HTTP_PORT = 80;
 
    // Security Group for the Timeline application instance
    this.timelineSecurityGroup = new ec2.SecurityGroup(this, 'TimelineSecurityGroup', {
      vpc,
      allowAllOutbound: true, 
      description: 'Controls access to the Timeline application instance',
    });
    
    // Apply standard tags to the application security group
    cdk.Tags.of(this.timelineSecurityGroup).add('Name', 'timeline-app-sg');
    cdk.Tags.of(this.timelineSecurityGroup).add('Application', 'Timeline');
    
    // Security Group for the bastion host
    this.bastionSecurityGroup = new ec2.SecurityGroup(this, 'BastionSecurityGroup', {
      vpc,
      description: 'Controls access to the bastion host',
    });
    
    // Allow SSH access to the bastion from the specified IP range
    this.bastionSecurityGroup.addIngressRule(
      ec2.Peer.ipv4(allowedIp),
      ec2.Port.tcp(SSH_PORT),
      'Allow SSH from specified IP'
    );
    
    // Apply standard tags to the bastion security group
    cdk.Tags.of(this.bastionSecurityGroup).add('Name', 'timeline-bastion-sg');
    cdk.Tags.of(this.bastionSecurityGroup).add('Application', 'Timeline');

    // Allow SSH from the bastion host to the application instance
    this.timelineSecurityGroup.addIngressRule(
      ec2.Peer.securityGroupId(this.bastionSecurityGroup.securityGroupId),
      ec2.Port.tcp(SSH_PORT),
      'Allow SSH from bastion host'
    );

    // IAM Role for the EC2 instance
    this.instanceRole = new iam.Role(this, 'TimelineInstanceRole', {
      assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
      description: 'Role for Timeline application EC2 instance',
      managedPolicies: [
        // Enable AWS Systems Manager (SSM) for instance management
        iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore'),
        // Enable CloudWatch logging
        iam.ManagedPolicy.fromAwsManagedPolicyName('CloudWatchAgentServerPolicy')
      ]
    });
    
    // Create application secrets
    this.appSecrets = new secretsmanager.Secret(this, 'TimelineAppSecrets', {
      description: 'Secrets for the Timeline application (e.g., API keys, database credentials)',
      secretName: `${cdk.Stack.of(this).stackName}-timeline-app-secrets`,
    });
    
    // Add policy to allow secrets access - scoped to the specific secret
    this.instanceRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ['secretsmanager:GetSecretValue'],
        resources: [this.appSecrets.secretArn],
        effect: iam.Effect.ALLOW,
      })
    );
    
    // Apply standard tags to the IAM role
    cdk.Tags.of(this.instanceRole).add('Application', 'Timeline');
  }
}
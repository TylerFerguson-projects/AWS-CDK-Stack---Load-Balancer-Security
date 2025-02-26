import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as cr from 'aws-cdk-lib/custom-resources';

export class Security extends Construct {
  public readonly instanceSecurityGroup: ec2.SecurityGroup;
  public readonly albSecurityGroup: ec2.SecurityGroup;  
  public readonly instanceRole: iam.Role;
  public readonly appSecrets: secretsmanager.ISecret;

  constructor(scope: Construct, id: string, vpc: ec2.Vpc) {
    super(scope, id);

    const HTTP_PORT = 80;
    const HTTPS_PORT = 443;
    const SSH_PORT = 22;

    // Reference existing secret
    this.appSecrets = secretsmanager.Secret.fromSecretNameV2(this, 'AllowedIpSecret', 
      'ALLOWED_IP_CIDR');
    
    // Create security groups first
    this.instanceSecurityGroup = new ec2.SecurityGroup(this, 'InstanceSecurityGroup', {
      vpc,
      allowAllOutbound: true, 
      description: 'Controls access to the Timeline application instance',
    });
    
    this.albSecurityGroup = new ec2.SecurityGroup(this, 'ALBSecurityGroup', {
      vpc,
      allowAllOutbound: true,
      description: 'Controls access to the Timeline Application Load Balancer',
    });
    
    // Use a CDK context value for the CIDR to keep it out of the repo
    const allowedIpCidr = this.node.tryGetContext('allowedIpCidr') || '0.0.0.0/0';
    this.instanceSecurityGroup.addIngressRule(
      ec2.Peer.ipv4(allowedIpCidr),
      ec2.Port.tcp(SSH_PORT),
      'Allow SSH from specified IP'
    );

    // Rest of your security group rules
    this.instanceSecurityGroup.addIngressRule(
      ec2.Peer.securityGroupId(this.albSecurityGroup.securityGroupId),
      ec2.Port.tcp(HTTP_PORT),
      'Allow HTTP from ALB'
    );
    
    this.albSecurityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(HTTP_PORT),
      'Allow HTTP from anywhere'
    );
    
    this.albSecurityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(HTTPS_PORT),
      'Allow HTTPS from anywhere'
    );
    
    // Create instance role
    this.instanceRole = new iam.Role(this, 'TimelineInstanceRole', {
      assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
      description: 'Role for Timeline application EC2 instance',
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore')
      ]
    });
    
    // Add policy to allow access to secrets
    this.instanceRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ['secretsmanager:GetSecretValue'],
        resources: [this.appSecrets.secretArn],
        effect: iam.Effect.ALLOW,
      })
    );
  }
}
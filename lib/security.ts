import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';

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

    this.appSecrets = secretsmanager.Secret.fromSecretNameV2(this, 'AllowedIpSecret', 
      'ALLOWED_IP_CIDR');
    
    // Create security groups w/o cross-references  
    this.instanceSecurityGroup = new ec2.SecurityGroup(this, 'InstanceSecurityGroup', {
      vpc,
      allowAllOutbound: true,
      description: 'Controls access to the Timeline application instance',
    });
    
    this.albSecurityGroup = new ec2.SecurityGroup(this, 'ALBSecurityGroup', {
      vpc,
      allowAllOutbound: true, // Set to true initially to avoid circular dependency
      description: 'Controls access to the Timeline Application Load Balancer',
    });
    
    // Avoid circular dependencies
    const allowedIpCidr = this.node.tryGetContext('allowedIpCidr') || '0.0.0.0/0';
    
    // SHH from Specific IP
    this.instanceSecurityGroup.addIngressRule(
      ec2.Peer.ipv4(allowedIpCidr),
      ec2.Port.tcp(SSH_PORT),
      'Allow SSH from admin IP only'
    );
    
    // HTTP IN --> Load Balancer
    this.albSecurityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(HTTP_PORT),
      'Allow HTTP from anywhere to ALB'
    );
    
    // HTTPS IN --> Load Balancer
    this.albSecurityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(HTTPS_PORT),
      'Allow HTTPS from anywhere to ALB'
    );
    
    // Instance Role creation
    this.instanceRole = new iam.Role(this, 'TimelineInstanceRole', {
      assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
      description: 'Role for Timeline application EC2 instance',
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore')
      ]
    });
    
    // Secrets policy
    this.instanceRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ['secretsmanager:GetSecretValue'],
        resources: [
          this.appSecrets.secretArn,
          'arn:aws:secretsmanager:us-east-1:051826723521:secret:ALLOWED_IP_CIDR-nxkLDR'
        ],
        effect: iam.Effect.ALLOW,
      })
    );
    
    this.instanceRole.addManagedPolicy(
      iam.ManagedPolicy.fromAwsManagedPolicyName('CloudWatchAgentServerPolicy')
    );
  }
  
  // Avoids circular dependencies by being called last
  public setupCrossStackConnections(): void {
     
    this.instanceSecurityGroup.addIngressRule(
      ec2.Peer.securityGroupId(this.albSecurityGroup.securityGroupId),
      ec2.Port.tcp(80),
      'Allow HTTP from ALB only'
    );
  }
}
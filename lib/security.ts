import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';

export class Security extends Construct {
  public readonly timelineSecurityGroup: ec2.SecurityGroup;
  public readonly instanceRole: iam.Role;
  public readonly appSecrets: secretsmanager.Secret;

  constructor(scope: Construct, id: string, vpc: ec2.Vpc, allowedIp: string) {
    super(scope, id);

    if (!/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\/\d{1,2}$/.test(allowedIp)) {
      throw new Error(`Invalid CIDR format for allowedIp: ${allowedIp}`);
    }

    const HTTP_PORT = 80;
    const SSH_PORT = 22;
 
    this.timelineSecurityGroup = new ec2.SecurityGroup(this, 'TimelineSecurityGroup', {
      vpc,
      allowAllOutbound: true, 
      description: 'Controls access to the Timeline application instance',
    });
    
    // Allow SSH from the specified IP
    this.timelineSecurityGroup.addIngressRule(
      ec2.Peer.ipv4(allowedIp),
      ec2.Port.tcp(SSH_PORT),
      'Allow SSH from specified IP'
    );

    // Allow HTTP from anywhere
    this.timelineSecurityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(HTTP_PORT),
      'Allow HTTP from anywhere'
    );
    
    this.instanceRole = new iam.Role(this, 'TimelineInstanceRole', {
      assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
      description: 'Role for Timeline application EC2 instance',
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore')
      ]
    });
    
    this.appSecrets = new secretsmanager.Secret(this, 'TimelineAppSecrets', {
      description: 'Secrets for the Timeline application',
      secretName: `${cdk.Stack.of(this).stackName}-timeline-app-secrets`,
    });
    
    this.instanceRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ['secretsmanager:GetSecretValue'],
        resources: [this.appSecrets.secretArn],
        effect: iam.Effect.ALLOW,
      })
    );
  }
}
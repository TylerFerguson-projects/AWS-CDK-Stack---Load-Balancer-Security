import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { Security } from './security';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Compute construct for the Timeline application.
 * 
 * Provisions and configures:
 * - Application EC2 instance in a private subnet
 * - Bastion host for secure access in a public subnet
 * - User data scripts for instance initialization and application deployment
 */
export class Compute extends Construct {
  /** The EC2 instance running the Timeline application */
  public readonly instance: ec2.Instance;
  
  /** Bastion host for secure SSH access to the application instance */
  public readonly bastionHost: ec2.BastionHostLinux;
  
  /** Security group controlling network access to the application instance */
  public readonly securityGroup: ec2.SecurityGroup;

  /**
   * Creates a new Compute construct for the Timeline application
   * 
   * @param scope - Parent construct
   * @param id - Construct ID
   * @param vpc - VPC where resources will be deployed
   * @param security - Security construct providing security groups and IAM roles
   */
  constructor(
    scope: Construct,
    id: string,
    vpc: ec2.Vpc,
    security: Security
  ) {
    super(scope, id);

    // Assign the security group from the Security instance
    this.securityGroup = security.timelineSecurityGroup;

    // EC2 instance for the Timeline application
    this.instance = new ec2.Instance(this, 'TimelineInstance', {
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.SMALL),
      machineImage: ec2.MachineImage.latestAmazonLinux2023(),
      securityGroup: this.securityGroup,
      role: security.instanceRole,
      userData: this.createUserData(security),
      userDataCausesReplacement: true,
      
      // Add standard tags for resource management and cost allocation
      resourceSignalTimeout: cdk.Duration.minutes(15),
    });
    
    // Apply standard tags to the instance
    cdk.Tags.of(this.instance).add('Application', 'Timeline');
    cdk.Tags.of(this.instance).add('Environment', cdk.Stack.of(this).stackName);
    cdk.Tags.of(this.instance).add('ManagedBy', 'CDK');

    // Configure root volume for the instance
    this.instance.instance.addPropertyOverride('BlockDeviceMappings', [
      {
        DeviceName: '/dev/xvda',
        Ebs: {
          VolumeSize: 20, // 20 GB for app and logs
          VolumeType: 'gp3', // General Purpose SSD
          DeleteOnTermination: true,
          Encrypted: true,
        },
      },
    ]);

    // Bastion host for secure access
    this.bastionHost = new ec2.BastionHostLinux(this, 'TimelineBastionHost', {
      vpc,
      securityGroup: security.bastionSecurityGroup,
      subnetSelection: { subnetType: ec2.SubnetType.PUBLIC },
      instanceName: 'timeline-bastion',
    });
    
    // Apply standard tags to the bastion host
    cdk.Tags.of(this.bastionHost).add('Application', 'Timeline');
    cdk.Tags.of(this.bastionHost).add('Environment', cdk.Stack.of(this).stackName);
    cdk.Tags.of(this.bastionHost).add('ManagedBy', 'CDK');
  }

  /**
   * Creates the user data script for instance initialization and application deployment
   * 
   * @param security - Security construct providing access to secrets
   * @returns UserData object with initialization commands
   */
  private createUserData(security: Security): ec2.UserData {
    const userData = ec2.UserData.forLinux();
    
    userData.addCommands(
      '#!/bin/bash',
      'set -e', // Exit on any error
      'exec > >(tee /var/log/user-data.log|logger -t user-data -s 2>/dev/console) 2>&1', // Log setup
      
      // System initialization
      'echo "Starting deployment at $(date)"',
      'yum update -y',
      'yum install -y docker git amazon-ssm-agent amazon-cloudwatch-agent',
      
      // Service activation
      'systemctl enable amazon-ssm-agent && systemctl start amazon-ssm-agent',
      'systemctl start docker && systemctl enable docker',
      
      // Application setup
      'mkdir -p /app',
      'cd /app',
      'echo "Cloning repository..."',
      'git clone https://github.com/TylerFerguson-projects/timeline-wizard-frontend.git .',
      
      // Secrets management
      'echo "Fetching application secrets..."',
      `aws secretsmanager get-secret-value --secret-id ${security.appSecrets.secretArn} --region ${cdk.Stack.of(this).region} --query SecretString --output text > .env`,
      
      // Application deployment
      'echo "Building Docker image..."',
      'docker build -t timeline-app .',
      'echo "Running Docker container..."',
      'docker run -d -p 80:3000 --restart unless-stopped --name timeline-app --env-file .env timeline-app',
      'rm .env', // Clean up secrets file
      
      // Health checking
      'echo "Waiting for app to start..."',
      'MAX_ATTEMPTS=50',
      'SLEEP_INTERVAL=10',
      'for i in $(seq 1 $MAX_ATTEMPTS); do',
      '  if curl -s http://localhost:80 > /dev/null; then',
      '    echo "App is running successfully"',
      '    break',
      '  else',
      '    echo "Attempt $i: App not yet available"',
      '    sleep $SLEEP_INTERVAL',
      '  fi',
      '  if [ $i -eq $MAX_ATTEMPTS ]; then',
      '    echo "WARNING: App did not become available after $((MAX_ATTEMPTS * SLEEP_INTERVAL)) seconds"',
      '    echo "Checking Docker logs:"',
      '    docker logs timeline-app',
      '  fi',
      'done',
      'echo "Deployment completed at $(date)"'
    );
    
    return userData;
  }
}
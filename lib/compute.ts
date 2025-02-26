import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { Security } from './security';
 
// T2 Micro for free tier, can scale to business requirements
// Uses script for installs, permissions, git, and docker actions.

export class Compute extends Construct {
  public readonly instance: ec2.Instance;
  public readonly securityGroup: ec2.SecurityGroup;

  constructor(
    scope: Construct,
    id: string,
    vpc: ec2.Vpc,
    security: Security
  ) {
    super(scope, id);

    this.securityGroup = security.albSecurityGroup;

    // Free Tier Instance
    this.instance = new ec2.Instance(this, 'TimelineInstance', {
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC }, 
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T2, ec2.InstanceSize.MICRO),  
      machineImage: ec2.MachineImage.latestAmazonLinux2(), 
      role: security.instanceRole,
      userData: this.createUserData(security),
      userDataCausesReplacement: true,
    });
    
    cdk.Tags.of(this.instance).add('Application', 'Timeline');

    // Storage Volume for Ec2
    this.instance.instance.addPropertyOverride('BlockDeviceMappings', [
      {
        DeviceName: '/dev/xvda',
        Ebs: {
          VolumeSize: 8,  
          VolumeType: 'gp2',  
          DeleteOnTermination: true,
          Encrypted: true,
        },
      },
    ]);
  }

  private createUserData(security: Security): ec2.UserData {
    const userData = ec2.UserData.forLinux();
    
    userData.addCommands(
      '#!/bin/bash',
      'set -e',
      
      '# System updates and dependencies',
      'yum update -y',
      'yum install -y docker git amazon-ssm-agent',
      
      '# Start and enable services',
      'systemctl enable amazon-ssm-agent && systemctl start amazon-ssm-agent',
      'systemctl enable docker && systemctl start docker',
      
      '# Create app directory with correct permissions',
      'mkdir -p /app',
      'cd /app',
      
      '# Make sure ec2-user owns the app directory',
      'chown -R ec2-user:ec2-user /app',
      
      '# Add ec2-user to docker group - this is the default user on Amazon Linux',
      'usermod -aG docker ec2-user',
      
      '# Clone the repository',
      'su - ec2-user -c "git clone https://github.com/TylerFerguson-projects/timeline-wizard-frontend.git /app"',
      
      '# Get secrets as ec2-user',
       'su - ec2-user -c "cd /app && aws secretsmanager get-secret-value --secret-id arn:aws:secretsmanager:us-east-1:051826723521:secret:ALLOWED_IP_CIDR-nxkLDR --region us-east-1 --query SecretString --output text > .env"',

      '# Build and run the container as ec2-user',
      'su - ec2-user -c "cd /app && docker build -t timeline-app ."',
      'su - ec2-user -c "cd /app && docker run -d -p 80:3000 --restart unless-stopped --name timeline-app --env-file .env timeline-app"',
      
      '# Cleanup sensitive data',
      'su - ec2-user -c "cd /app && rm .env"',
      
      '# Wait for service to come up - helps with ALB health checks',
      'echo "Waiting for application to start..."',
      'sleep 10',
      
      '# Create a simple health check endpoint for the ALB',
      'mkdir -p /var/www/html',
      'echo "<html><body><h1>Health check OK</h1></body></html>" > /var/www/html/health',
      'chmod 644 /var/www/html/health'
    );
    
    return userData;
  }
}
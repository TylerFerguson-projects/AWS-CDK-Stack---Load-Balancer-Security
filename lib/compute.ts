import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { Security } from './security';
 



 // Compute construct for the application.
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

    this.securityGroup = security.timelineSecurityGroup;

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

    // Storage
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
      'yum update -y',
      'yum install -y docker git amazon-ssm-agent',
      'systemctl enable amazon-ssm-agent && systemctl start amazon-ssm-agent',
      'systemctl start docker && systemctl enable docker',
      'mkdir -p /app',
      'cd /app',
      'git clone https://github.com/TylerFerguson-projects/timeline-wizard-frontend.git .',
      `aws secretsmanager get-secret-value --secret-id ${security.appSecrets.secretArn} --region ${cdk.Stack.of(this).region} --query SecretString --output text > .env`,
      'docker build -t timeline-app .',
      'docker run -d -p 80:3000 --restart unless-stopped --name timeline-app --env-file .env timeline-app',
      'rm .env'
    );
    
    return userData;
  }
}
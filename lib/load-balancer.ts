import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as targets from 'aws-cdk-lib/aws-elasticloadbalancingv2-targets';
import { Construct } from 'constructs';


// Load Balancer
// Scalable, highly available architecture for routing HTTP traffic
// 

export interface LoadBalancerProps {
  // VPC where the load balancer will be deployed  
  vpc: ec2.Vpc;
  
  // Security group for the load balancer 
  securityGroup: ec2.SecurityGroup;
  
  // EC2 instance to register as a target  
  instance: ec2.Instance;
  
  // Health check configuration options 
  healthCheck?: {
    path?: string;
    interval?: cdk.Duration;
    timeout?: cdk.Duration;
    healthyThresholdCount?: number;
    unhealthyThresholdCount?: number;
  };
}

export class LoadBalancer extends Construct {
  // The Application Load Balancer 
  public readonly loadBalancer: elbv2.ApplicationLoadBalancer;
  
  // Target group for the application instance 
  public readonly targetGroup: elbv2.ApplicationTargetGroup;

 
  constructor(scope: Construct, id: string, props: LoadBalancerProps) {
    super(scope, id);

    // Default health check values
    const healthCheckPath = props.healthCheck?.path || '/';
    const healthCheckInterval = props.healthCheck?.interval || cdk.Duration.seconds(60);
    const healthCheckTimeout = props.healthCheck?.timeout || cdk.Duration.seconds(5);
    const healthyThresholdCount = props.healthCheck?.healthyThresholdCount || 2;
    const unhealthyThresholdCount = props.healthCheck?.unhealthyThresholdCount || 2;

    // Create an Application Load Balancer
    this.loadBalancer = new elbv2.ApplicationLoadBalancer(this, 'TimelineALB', {
      vpc: props.vpc,
      internetFacing: true,
      securityGroup: props.securityGroup,
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
      loadBalancerName: 'timeline-alb'
    });
    
    // Apply standard tags to the ALB
    cdk.Tags.of(this.loadBalancer).add('Application', 'Timeline');
    cdk.Tags.of(this.loadBalancer).add('Environment', cdk.Stack.of(this).stackName);
    cdk.Tags.of(this.loadBalancer).add('ManagedBy', 'CDK');

    // Create a target group for the instance
    this.targetGroup = new elbv2.ApplicationTargetGroup(this, 'TimelineTargetGroup', {
      vpc: props.vpc,
      port: 80,
      protocol: elbv2.ApplicationProtocol.HTTP,
      targetType: elbv2.TargetType.INSTANCE,
      healthCheck: {
        path: healthCheckPath,
        interval: healthCheckInterval,
        timeout: healthCheckTimeout,
        healthyThresholdCount: healthyThresholdCount,
        unhealthyThresholdCount: unhealthyThresholdCount,
      },
      targetGroupName: 'timeline-target-group'
    });

    // Add instance to target group
    this.targetGroup.addTarget(new targets.InstanceTarget(props.instance));

    // Add a listener to the load balancer
    const listener = this.loadBalancer.addListener('HttpListener', {
      port: 80,
      defaultTargetGroups: [this.targetGroup],
    });
    
    // Apply standard tags to the listener
    cdk.Tags.of(listener).add('Application', 'Timeline');

    // Allow traffic from the ALB to the application instance
    props.instance.connections.allowFrom(this.loadBalancer, ec2.Port.tcp(80), 'Allow HTTP from ALB');

    // Output the load balancer DNS name
    new cdk.CfnOutput(this, 'AlbDnsName', {
      value: this.loadBalancer.loadBalancerDnsName,
      description: 'The DNS name of the load balancer',
      exportName: `${cdk.Stack.of(this).stackName}-alb-dns`
    });
  }
}
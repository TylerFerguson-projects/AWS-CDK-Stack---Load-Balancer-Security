import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';

/**
 * Networking construct for the Timeline application.
 * 
 * Provisions:
 * - VPC with public and private subnets
 * - NAT Gateway for private subnet internet access
 * - Security groups for load balancer access
 * - Optional VPC Flow Logs for network monitoring
 */
export class Networking extends Construct {
  /** The VPC where application resources will be deployed */
  public readonly vpc: ec2.Vpc;
  
  /** Security group for the application load balancer */
  public readonly albSecurityGroup: ec2.SecurityGroup;

  /**
   * Creates a new Networking construct for the Timeline application
   * 
   * @param scope - Parent construct
   * @param id - Construct ID
   * @param enableFlowLogs - Whether to enable VPC Flow Logs (default: false)
   */
  constructor(scope: Construct, id: string, enableFlowLogs: boolean = false) {
    super(scope, id);

    // Define standard ports
    const HTTP_PORT = 80;
  
    // Create VPC with public and private subnets
    this.vpc = new ec2.Vpc(this, 'TimelineVPC', {
      maxAzs: 2,
      natGateways: 1, // One NAT Gateway for cost optimization
      subnetConfiguration: [
        {
          name: 'timeline-public',
          subnetType: ec2.SubnetType.PUBLIC,
          cidrMask: 24,
          mapPublicIpOnLaunch: true
        },
        {
          name: 'timeline-private',
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
          cidrMask: 24
        }
      ],
      // Enable DNS support for the VPC
      enableDnsSupport: true,
      enableDnsHostnames: true
    });
    
    // Apply standard tags to the VPC
    cdk.Tags.of(this.vpc).add('Name', 'timeline-vpc');
    cdk.Tags.of(this.vpc).add('Application', 'Timeline');
    cdk.Tags.of(this.vpc).add('Environment', cdk.Stack.of(this).stackName);

    // Enable VPC Flow Logs if specified
    if (enableFlowLogs) {
      // Create log group with specific retention
      const logGroup = new cdk.aws_logs.LogGroup(this, 'VpcFlowLogsGroup', {
        retention: cdk.aws_logs.RetentionDays.ONE_WEEK
      });
      
      // Add flow logs to the VPC
      this.vpc.addFlowLog('FlowLogs', {
        trafficType: ec2.FlowLogTrafficType.ALL,
        destination: ec2.FlowLogDestination.toCloudWatchLogs(logGroup)
      });
    }

    // Create security group for the ALB
    this.albSecurityGroup = new ec2.SecurityGroup(this, 'ALBSecurityGroup', {
      vpc: this.vpc,
      description: 'Security group for the Timeline application load balancer',
      allowAllOutbound: true
    });

    // Allow HTTP traffic to ALB
    this.albSecurityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(HTTP_PORT),
      'Allow HTTP traffic from anywhere'
    );
    
    // Apply standard tags to the ALB security group
    cdk.Tags.of(this.albSecurityGroup).add('Name', 'timeline-alb-sg');
    cdk.Tags.of(this.albSecurityGroup).add('Application', 'Timeline');
    cdk.Tags.of(this.albSecurityGroup).add('Environment', cdk.Stack.of(this).stackName);
  }
}
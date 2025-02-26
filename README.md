# AWS CDK Load Balancer Stack 

Deploys a production-ready infrastructure for a React application 

## Architecture Components

* **Networking**: VPC, subnets, and network flow logs
* **Security**: Security groups, IAM roles, and secrets management
* **Compute**: Application EC2 instance and secure bastion host
* **Load Balancer**: Application Load Balancer with target groups

## Prerequisites

* AWS CLI configured with appropriate credentials
* Node.js and npm installed
* AWS CDK installed (`npm install -g aws-cdk`)
* TypeScript installed (`npm install -g typescript`)

## Environment Variables

The stack requires the following environment variable:

* `ALLOWED_IP_CIDR`: IP CIDR range for bastion host access (cannot be `0.0.0.0/0`)

## Deployment Instructions

1. Clone the repository

```bash
git clone https://github.com/your-org/timeline-cdk.git
cd timeline-cdk
```

2. Initialize and update git submodules

```bash
git submodule init
git submodule update
```

3. Install dependencies

```bash
npm install
```

4. Set required environment variable

```bash
export ALLOWED_IP_CIDR="YOUR_IP_RANGE/32"  # Replace with your IP CIDR
```

5. Deploy the stack

```bash
cdk deploy
```

## Stack Outputs

After deployment, the following outputs are available:

* **LoadBalancerDNS**: Access URL for the application
* **InstanceId**: EC2 instance ID for troubleshooting
* **BastionHostIP**: Public IP of bastion host for secure SSH access
* **VpcId**: ID of the created VPC

## Connecting to the Application

Use the LoadBalancerDNS output to access the application in a web browser.

For SSH access to the application server, first connect to the bastion host:

```bash
ssh -i your-key.pem ec2-user@[BastionHostIP]
```

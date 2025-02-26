```mermaid
classDiagram
class VPC {
    +CIDR Block
    +2 Availability Zones
    +DNS Support
    +DNS Hostnames
}

class PublicSubnet {
    +CIDR Mask: /24
    +Internet Gateway
    +Public Route Table
}

class PrivateSubnet {
    +CIDR Mask: /24
    +Isolated
}

class EC2Instance {
    +Type: t2.micro
    +AMI: Amazon Linux 2
    +Public IP
    +User Data
    +EBS Volume: 8GB
}

class ALB {
    +Type: application
    +Internet-facing
    +HTTP Listener(80)
    +Target Group
    +Health Check(/health)
}

class SecurityGroup {
    +Ingress Rules
    +Egress Rules
}

class IAMRole {
    +Trust Policy
    +Managed Policies
    +Inline Policies
}

class SecretsManager {
    +Secret: ALLOWED_IP_CIDR
}

VPC --> PublicSubnet : contains
VPC --> PrivateSubnet : contains
PublicSubnet --> EC2Instance : hosts
PublicSubnet --> ALB : hosts
SecurityGroup --> EC2Instance : protects
SecurityGroup --> ALB : protects
IAMRole --> EC2Instance : grants permissions
EC2Instance --> SecretsManager : fetches
ALB --> EC2Instance : routes traffic


# Security rule catalog

Generated from `services/security-rules`. Rules are deterministic and run on the normalized resource model.

| Rule | Category | Recommended fix |
|---|---|---|
| NET-001 | network | Move the instance into a private subnet, or restrict its security group to known source ranges and front it with a load balancer. |
| NET-002 | network | Require authentication on the API and restrict access with a resource policy or WAF rules. |
| NET-003 | network | Close SSH/RDP to the internet. Use a bastion host, VPN or SSM Session Manager instead. |
| IAM-001 | iam | Replace the admin policy with least-privilege permissions scoped to the resources this role actually needs. |
| IAM-002 | iam | Reduce write access on sensitive resources to read-only, or scope it to specific prefixes or tables. |
| STO-001 | storage | Enable block public access on the bucket and serve public content through a CDN with an origin access identity. |
| SEC-001 | secrets | Limit which identities can read the secret, and scope access to a single secret ARN. |
| DB-001 | database | Disable public accessibility and allow connections only from the application security group. |
| NET-004 | network | Remove internet ingress on non-web ports. Allow only 80/443 through a load balancer and reach admin ports via VPN or SSM. |
| NET-005 | database | Restrict the database security group to the specific application tier, not to groups shared with public workloads. |
| IAM-003 | iam | Limit who can assume privileged roles and require conditions (MFA, source identity) on the trust policy. |
| IAM-004 | iam | Rotate the exposed credentials immediately, revoke active sessions, and move to short-lived role-based access. |

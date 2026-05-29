output "app_public_ip" {
  description = "Elastic IP to point your domain's A record at."
  value       = aws_eip.app.public_ip
}

output "instance_id" {
  description = "EC2 instance ID (use with: aws ssm start-session --target <id>)."
  value       = aws_instance.app.id
}

output "rds_endpoint" {
  description = "RDS endpoint hostname (private)."
  value       = aws_db_instance.main.address
}

output "ssm_parameter_prefix" {
  description = "SSM Parameter Store path holding app config/secrets."
  value       = local.ssm_prefix
}

output "next_steps" {
  description = "What to do after apply."
  value = join("\n", [
    "1. Point ${var.domain_name} A record at ${aws_eip.app.public_ip}",
    "2. Set the OpenAI key: aws ssm put-parameter --name ${local.ssm_prefix}/OPENAI_API_KEY --type SecureString --overwrite --value sk-...",
    "3. Connect: aws ssm start-session --target ${aws_instance.app.id}",
    "4. Get code onto the host, then run deploy/scripts/deploy.sh",
  ])
}

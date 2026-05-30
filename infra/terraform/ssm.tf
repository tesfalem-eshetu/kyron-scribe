resource "random_password" "db" {
  length  = 32
  special = false
}

locals {
  ssm_prefix   = "/${var.project_name}"
  database_url = "postgresql://${var.db_username}:${random_password.db.result}@${aws_db_instance.main.address}:5432/${var.db_name}?schema=public"
}

# Connection string (contains the generated DB password). SecureString + IAM-gated.
resource "aws_ssm_parameter" "database_url" {
  name  = "${local.ssm_prefix}/DATABASE_URL"
  type  = "SecureString"
  value = local.database_url
}

resource "aws_ssm_parameter" "node_env" {
  name  = "${local.ssm_prefix}/NODE_ENV"
  type  = "String"
  value = "production"
}

resource "aws_ssm_parameter" "session_cookie_name" {
  name  = "${local.ssm_prefix}/SESSION_COOKIE_NAME"
  type  = "String"
  value = "session_token"
}

resource "aws_ssm_parameter" "session_ttl_hours" {
  name  = "${local.ssm_prefix}/SESSION_TTL_HOURS"
  type  = "String"
  value = "24"
}

resource "aws_ssm_parameter" "embedding_model" {
  name  = "${local.ssm_prefix}/OPENAI_EMBEDDING_MODEL"
  type  = "String"
  value = "text-embedding-3-small"
}

resource "aws_ssm_parameter" "soap_model" {
  name  = "${local.ssm_prefix}/OPENAI_SOAP_GENERATION_MODEL"
  type  = "String"
  value = "gpt-5.5"
}

resource "aws_ssm_parameter" "extract_model" {
  name  = "${local.ssm_prefix}/OPENAI_PROBLEM_EXTRACT_MODEL"
  type  = "String"
  value = "gpt-5.4-mini"
}

# Created as a placeholder so the real key never enters Terraform state.
# Set the real value after apply:
#   aws ssm put-parameter --name "/kyron-scribe/OPENAI_API_KEY" --type SecureString --overwrite --value "sk-..."
resource "aws_ssm_parameter" "openai_api_key" {
  name  = "${local.ssm_prefix}/OPENAI_API_KEY"
  type  = "SecureString"
  value = "REPLACE_ME"

  lifecycle {
    ignore_changes = [value]
  }
}

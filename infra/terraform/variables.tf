variable "region" {
  description = "AWS region to deploy into."
  type        = string
  default     = "us-east-1"
}

variable "project_name" {
  description = "Short name used to tag and name resources."
  type        = string
  default     = "kyron-scribe"
}

variable "domain_name" {
  description = "Domain or subdomain that will point at the EC2 instance (required for HTTPS)."
  type        = string
}

variable "instance_type" {
  description = "EC2 instance type for the app + nginx host."
  type        = string
  default     = "t3.small"
}

variable "db_instance_class" {
  description = "RDS instance class."
  type        = string
  default     = "db.t4g.micro"
}

variable "db_allocated_storage" {
  description = "RDS allocated storage in GB."
  type        = number
  default     = 20
}

variable "db_name" {
  description = "Initial PostgreSQL database name."
  type        = string
  default     = "kyron_scribe"
}

variable "db_username" {
  description = "PostgreSQL master username."
  type        = string
  default     = "kyron"
}

variable "admin_cidr" {
  description = "CIDR allowed to SSH (port 22) to the EC2 host. Set to your IP/32. Empty disables SSH ingress (use SSM instead)."
  type        = string
  default     = ""
}

variable "ssh_key_name" {
  description = "Optional existing EC2 key pair name for SSH. Empty relies on SSM Session Manager only."
  type        = string
  default     = ""
}

variable "vpc_cidr" {
  description = "CIDR block for the VPC."
  type        = string
  default     = "10.0.0.0/16"
}

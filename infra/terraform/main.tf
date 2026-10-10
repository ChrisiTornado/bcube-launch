locals {
  name        = "${var.name_prefix}-${var.environment}"
  all_domains = concat([var.domain_name], var.alternate_domain_names)
  manage_dns  = var.route53_zone_id != ""
  site_url    = "https://${var.domain_name}"
  ssm_prefix  = "/${var.name_prefix}/${var.environment}"
}

data "aws_caller_identity" "current" {}

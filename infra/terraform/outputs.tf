output "site_bucket" {
  value = aws_s3_bucket.site.bucket
}

output "cloudfront_distribution_id" {
  value = aws_cloudfront_distribution.site.id
}

output "cloudfront_domain_name" {
  description = "Ohne Route 53: CNAME/ALIAS der Domain hierauf zeigen lassen."
  value       = aws_cloudfront_distribution.site.domain_name
}

output "lambda_function_name" {
  value = aws_lambda_function.lead.function_name
}

output "leads_table_name" {
  value = aws_dynamodb_table.leads.name
}

output "github_deploy_role_arn" {
  description = "Als Repo-Variable AWS_DEPLOY_ROLE_ARN in GitHub eintragen."
  value       = aws_iam_role.deploy.arn
}

output "acm_validation_records" {
  description = "Nur ohne Route 53 nötig: diese CNAMEs beim DNS-Anbieter anlegen."
  value = [for o in aws_acm_certificate.site.domain_validation_options : {
    name  = o.resource_record_name
    type  = o.resource_record_type
    value = o.resource_record_value
  }]
}

output "ses_dkim_records" {
  description = "Nur ohne Route 53 nötig: DKIM-CNAMEs beim DNS-Anbieter anlegen."
  value = [for t in aws_sesv2_email_identity.domain.dkim_signing_attributes[0].tokens : {
    name  = "${t}._domainkey.${var.domain_name}"
    type  = "CNAME"
    value = "${t}.dkim.amazonses.com"
  }]
}

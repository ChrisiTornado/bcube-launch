# --- Lead-Funktion: Lambda hinter API Gateway (HTTP API), erreichbar über CloudFront /api/* ------

data "archive_file" "lead" {
  type        = "zip"
  source_dir  = var.lambda_zip_source_dir
  output_path = "${path.module}/build/lead.zip"
  excludes    = ["index.mjs.map"]
}

resource "aws_cloudwatch_log_group" "lead" {
  name              = "/aws/lambda/${local.name}-lead"
  retention_in_days = 30
}

data "aws_iam_policy_document" "lambda_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "lead" {
  name               = "${local.name}-lead"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume.json
}

data "aws_iam_policy_document" "lead" {
  statement {
    sid       = "Logs"
    actions   = ["logs:CreateLogStream", "logs:PutLogEvents"]
    resources = ["${aws_cloudwatch_log_group.lead.arn}:*"]
  }
  statement {
    sid       = "Leads"
    actions   = ["dynamodb:GetItem", "dynamodb:PutItem", "dynamodb:DeleteItem", "dynamodb:UpdateItem"]
    resources = [aws_dynamodb_table.leads.arn]
  }
  statement {
    sid       = "Mail"
    actions   = ["ses:SendEmail"]
    resources = [aws_sesv2_email_identity.domain.arn, aws_sesv2_configuration_set.main.arn]
  }
  statement {
    sid       = "Secrets"
    actions   = ["ssm:GetParameters"]
    resources = [aws_ssm_parameter.turnstile_secret.arn, aws_ssm_parameter.ip_hash_salt.arn]
  }
  statement {
    sid       = "DecryptSecrets"
    actions   = ["kms:Decrypt"]
    resources = ["*"]
    condition {
      test     = "StringEquals"
      variable = "kms:ViaService"
      values   = ["ssm.${var.aws_region}.amazonaws.com"]
    }
  }
}

resource "aws_iam_role_policy" "lead" {
  role   = aws_iam_role.lead.id
  policy = data.aws_iam_policy_document.lead.json
}

resource "aws_lambda_function" "lead" {
  function_name    = "${local.name}-lead"
  role             = aws_iam_role.lead.arn
  runtime          = "nodejs22.x"
  architectures    = ["arm64"]
  handler          = "index.handler"
  filename         = data.archive_file.lead.output_path
  source_code_hash = data.archive_file.lead.output_base64sha256
  memory_size      = 256
  timeout          = 10

  reserved_concurrent_executions = var.lambda_reserved_concurrency

  environment {
    variables = {
      STAGE                  = var.environment
      SITE_URL               = local.site_url
      TABLE_NAME             = aws_dynamodb_table.leads.name
      MAIL_FROM              = "${var.mail_from_name} <${var.mail_from_address}>"
      MAIL_REPLY_TO          = var.mail_reply_to
      NOTIFY_EMAIL           = var.notify_email
      CONSENT_VERSION        = var.consent_version
      SES_CONFIGURATION_SET  = aws_sesv2_configuration_set.main.configuration_set_name
      TURNSTILE_SECRET_PARAM = aws_ssm_parameter.turnstile_secret.name
      IP_HASH_SALT_PARAM     = aws_ssm_parameter.ip_hash_salt.name
      NODE_OPTIONS           = "--enable-source-maps"
    }
  }

  logging_config {
    log_format = "Text"
    log_group  = aws_cloudwatch_log_group.lead.name
  }

  # Code-Updates macht die Deploy-Pipeline (aws lambda update-function-code); Terraform soll sie nicht zurückdrehen.
  lifecycle {
    ignore_changes = [filename, source_code_hash]
  }
}

resource "aws_apigatewayv2_api" "lead" {
  name          = "${local.name}-api"
  protocol_type = "HTTP"
}

resource "aws_apigatewayv2_integration" "lead" {
  api_id                 = aws_apigatewayv2_api.lead.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.lead.invoke_arn
  payload_format_version = "2.0"
  timeout_milliseconds   = 10000
}

locals {
  api_routes = ["POST /api/lead", "GET /api/confirm", "GET /api/unsubscribe", "POST /api/unsubscribe", "GET /api/health"]
}

resource "aws_apigatewayv2_route" "lead" {
  for_each  = toset(local.api_routes)
  api_id    = aws_apigatewayv2_api.lead.id
  route_key = each.value
  target    = "integrations/${aws_apigatewayv2_integration.lead.id}"
}

resource "aws_apigatewayv2_stage" "default" {
  api_id      = aws_apigatewayv2_api.lead.id
  name        = "$default"
  auto_deploy = true

  default_route_settings {
    throttling_rate_limit  = var.api_throttle_rate
    throttling_burst_limit = var.api_throttle_burst
  }
}

resource "aws_lambda_permission" "apigw" {
  statement_id  = "AllowHttpApi"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.lead.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.lead.execution_arn}/*/*"
}

# Einfache Alarmierung: Lambda-Fehler (SNS-Ziel bei Bedarf ergänzen).
resource "aws_cloudwatch_metric_alarm" "lead_errors" {
  alarm_name          = "${local.name}-lead-errors"
  namespace           = "AWS/Lambda"
  metric_name         = "Errors"
  dimensions          = { FunctionName = aws_lambda_function.lead.function_name }
  statistic           = "Sum"
  period              = 300
  evaluation_periods  = 1
  threshold           = 1
  comparison_operator = "GreaterThanOrEqualToThreshold"
  treat_missing_data  = "notBreaching"
}

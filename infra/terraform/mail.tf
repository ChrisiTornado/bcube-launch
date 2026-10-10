# --- Amazon SES (Frankfurt): Domain-Identität mit DKIM -------------------------------------------
# Nach dem apply: Production Access in der SES-Konsole beantragen (Sandbox erlaubt nur verifizierte Empfänger).

resource "aws_sesv2_email_identity" "domain" {
  email_identity = var.domain_name
}

resource "aws_sesv2_configuration_set" "main" {
  configuration_set_name = local.name

  delivery_options {
    tls_policy = "REQUIRE"
  }

  reputation_options {
    reputation_metrics_enabled = true
  }

  suppression_options {
    suppressed_reasons = ["BOUNCE", "COMPLAINT"]
  }
}

resource "aws_route53_record" "dkim" {
  count = local.manage_dns ? 3 : 0

  zone_id = var.route53_zone_id
  name    = "${aws_sesv2_email_identity.domain.dkim_signing_attributes[0].tokens[count.index]}._domainkey.${var.domain_name}"
  type    = "CNAME"
  ttl     = 1800
  records = ["${aws_sesv2_email_identity.domain.dkim_signing_attributes[0].tokens[count.index]}.dkim.amazonses.com"]
}

# DMARC zunächst im Beobachtungsmodus (p=none). Nach ein paar Wochen sauberer Reports auf quarantine anheben.
resource "aws_route53_record" "dmarc" {
  count = local.manage_dns ? 1 : 0

  zone_id = var.route53_zone_id
  name    = "_dmarc.${var.domain_name}"
  type    = "TXT"
  ttl     = 3600
  records = ["v=DMARC1; p=none; rua=mailto:${var.mail_reply_to}; fo=1"]
}

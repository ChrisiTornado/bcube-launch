# Platzhalter – echte Werte NACH dem apply per CLI setzen, nie in .tf/.tfvars (landen sonst im State):
#   aws ssm put-parameter --overwrite --type SecureString --name /bcube-launch/prod/turnstile-secret --value '…'
#   aws ssm put-parameter --overwrite --type SecureString --name /bcube-launch/prod/ip-hash-salt --value "$(openssl rand -base64 32)"
# Die Funktion verweigert den Start, solange noch CHANGE_ME drinsteht.

resource "aws_ssm_parameter" "turnstile_secret" {
  name  = "${local.ssm_prefix}/turnstile-secret"
  type  = "SecureString"
  value = "CHANGE_ME"

  lifecycle {
    ignore_changes = [value]
  }
}

resource "aws_ssm_parameter" "ip_hash_salt" {
  name        = "${local.ssm_prefix}/ip-hash-salt"
  description = "HMAC-Salt für Lead-IDs und IP-Hashes. NICHT rotieren – sonst werden bestehende Leads nicht mehr gefunden."
  type        = "SecureString"
  value       = "CHANGE_ME"

  lifecycle {
    ignore_changes = [value]
  }
}

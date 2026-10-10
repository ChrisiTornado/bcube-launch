# --- Leads: DynamoDB (on-demand, Frankfurt) ------------------------------------------------------
# Single-Table: pk = "lead#<hmac>" für Vormerkungen, "rate#<ip-hash>#<fenster>" für Rate-Limits.
# TTL löscht unbestätigte Leads nach 30 Tagen und abgelaufene Rate-Limit-Zähler automatisch.

resource "aws_dynamodb_table" "leads" {
  name                        = "${local.name}-leads"
  billing_mode                = "PAY_PER_REQUEST"
  hash_key                    = "pk"
  deletion_protection_enabled = true

  attribute {
    name = "pk"
    type = "S"
  }

  ttl {
    attribute_name = "ttl"
    enabled        = true
  }

  point_in_time_recovery {
    enabled = true
  }

  server_side_encryption {
    enabled = true
  }
}

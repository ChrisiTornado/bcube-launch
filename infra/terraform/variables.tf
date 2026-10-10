variable "aws_region" {
  description = "Region für alle Daten (DynamoDB, Lambda, SES, S3)."
  type        = string
  default     = "eu-central-1"
}

variable "environment" {
  type    = string
  default = "prod"
}

variable "name_prefix" {
  type    = string
  default = "bcube-launch"
}

variable "domain_name" {
  description = "Domain der Launch-Seite, z. B. bcube.at."
  type        = string
  default     = "bcube.at"
}

variable "alternate_domain_names" {
  description = "Weitere Hostnamen auf derselben Distribution (z. B. www.bcube.at)."
  type        = list(string)
  default     = ["www.bcube.at"]
}

variable "route53_zone_id" {
  description = "Hosted Zone ID in Route 53. Leer lassen, wenn DNS woanders liegt – dann die Records aus den Outputs manuell anlegen."
  type        = string
  default     = ""
}

variable "mail_from_address" {
  description = "Absenderadresse der Mails (Domain muss in SES verifiziert sein)."
  type        = string
  default     = "hallo@bcube.at"
}

variable "mail_from_name" {
  type    = string
  default = "BCube"
}

variable "mail_reply_to" {
  type    = string
  default = "hallo@bcube.at"
}

variable "notify_email" {
  description = "Empfänger der Benachrichtigung über bestätigte Vormerkungen. Nur in terraform.tfvars setzen (nicht eingecheckt)."
  type        = string
  default     = ""
}

variable "consent_version" {
  description = "Version des Einwilligungstexts – bei Textänderung erhöhen."
  type        = string
  default     = "2026-10-v1"
}

variable "lambda_zip_source_dir" {
  description = "Ordner mit dem gebündelten Handler (npm run build:function)."
  type        = string
  default     = "../../dist-function"
}

variable "api_throttle_rate" {
  description = "Durchschnittliche Anfragen pro Sekunde an die API (HTTP-API-Stage-Throttling)."
  type        = number
  default     = 10
}

variable "api_throttle_burst" {
  type    = number
  default = 20
}

variable "lambda_reserved_concurrency" {
  description = "Obergrenze gleichzeitiger Lambda-Ausführungen (Kostenschutz). -1 = keine Reservierung."
  type        = number
  default     = 10
}

variable "github_repository" {
  description = "GitHub-Repo für das Deployment per OIDC, Format owner/name."
  type        = string
  default     = "ChrisiTornado/bcube-launch"
}

variable "github_oidc_provider_arn" {
  description = "ARN eines bereits existierenden GitHub-OIDC-Providers im Konto (z. B. aus dem bcube-Stack). Leer = neu anlegen."
  type        = string
  default     = ""
}

variable "price_class" {
  description = "CloudFront-Preisklasse. PriceClass_100 = Europa/Nordamerika (günstigste)."
  type        = string
  default     = "PriceClass_100"
}

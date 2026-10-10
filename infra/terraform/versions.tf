terraform {
  required_version = ">= 1.7"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    archive = {
      source  = "hashicorp/archive"
      version = "~> 2.4"
    }
  }

  # Remote-State vor dem ersten echten apply aktivieren (eigener Key, getrennt vom bcube-App-State):
  # backend "s3" {
  #   bucket         = "bcube-terraform-state"
  #   key            = "launch/prod/terraform.tfstate"
  #   region         = "eu-central-1"
  #   dynamodb_table = "bcube-terraform-locks"
  #   encrypt        = true
  # }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "bcube-launch"
      Environment = var.environment
      ManagedBy   = "terraform"
    }
  }
}

# CloudFront verlangt ACM-Zertifikate in us-east-1 (nur das Zertifikat liegt dort, keine Daten).
provider "aws" {
  alias  = "us_east_1"
  region = "us-east-1"

  default_tags {
    tags = {
      Project     = "bcube-launch"
      Environment = var.environment
      ManagedBy   = "terraform"
    }
  }
}

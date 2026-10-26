#!/bin/sh
# Creates the firmware bucket and makes its objects publicly downloadable
set -e

export AWS_ACCESS_KEY_ID="$(cat /run/secrets/access_key)"
export AWS_SECRET_ACCESS_KEY="$(cat /run/secrets/secret_key)"
export AWS_DEFAULT_REGION="${S3_REGION:-us-east-1}"

s3api() { aws --endpoint-url "$S3_ENDPOINT" s3api "$@"; }

s3api head-bucket --bucket "$S3_BUCKET" 2>/dev/null \
  || s3api create-bucket --bucket "$S3_BUCKET"

s3api put-bucket-policy --bucket "$S3_BUCKET" --policy "{
  \"Version\": \"2012-10-17\",
  \"Statement\": [{
    \"Effect\": \"Allow\",
    \"Principal\": { \"AWS\": [\"*\"] },
    \"Action\": [\"s3:GetObject\"],
    \"Resource\": [\"arn:aws:s3:::$S3_BUCKET/*\"]
  }]
}"

echo "bucket $S3_BUCKET ready"

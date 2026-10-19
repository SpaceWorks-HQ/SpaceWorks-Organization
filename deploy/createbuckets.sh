#!/bin/sh
# Creates the private bucket and an application identity limited to it. Runs
# once per start of the stack and is safe to rerun.
set -eu
until mc alias set local https://minio:9000 "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD" >/dev/null; do sleep 1; done
mc mb --ignore-existing local/spaceworks-organization
mc anonymous set none local/spaceworks-organization
mc version enable local/spaceworks-organization
mc admin user add local sworg-app "$S3_APP_PASSWORD" >/dev/null
mc admin policy create local sworg-app /bootstrap/storage-policy.json >/dev/null
mc admin policy attach local sworg-app --user sworg-app >/dev/null 2>&1 || true
echo 'Private storage bucket and application policy ready.'

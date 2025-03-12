#!/usr/bin/env bash

set -e -o pipefail

PROJECT_NAME="$(
  jq \
    --raw-output \
    '."increase-coverage"."project-name"' \
    test-gen-config.json
)"

TEST_ENV_DOCKER_STAGE="$(
  jq \
    --raw-output \
    '."increase-coverage"."test-env-docker-stage"' \
    test-gen-config.json
)"

docker build \
  --target "$TEST_ENV_DOCKER_STAGE" \
  --platform linux/amd64 \
  --tag "$PROJECT_NAME:$TEST_ENV_DOCKER_STAGE" \
  .
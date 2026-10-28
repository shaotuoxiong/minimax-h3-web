#!/usr/bin/env bash
set -euo pipefail
if systemctl --user is-active --quiet h3-direct-https.service; then
  systemctl --user reload h3-direct-https.service
fi

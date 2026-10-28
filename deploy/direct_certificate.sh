#!/usr/bin/env bash
set -euo pipefail
umask 077

if [[ -z "${Ali_Key:-}" || -z "${Ali_Secret:-}" ]]; then
  echo 'Aliyun DNS credentials are missing from the protected local file.' >&2
  exit 1
fi

public_host="${H3_PUBLIC_HOST:-h3.yakiyyy.online}"
if [[ "$public_host" != h3.yakiyyy.online ]]; then
  echo 'This deployment only issues a certificate for h3.yakiyyy.online.' >&2
  exit 1
fi

runtime_directory=/home/sim/projects/minimax-h3-web/temp/direct-public
acme_directory=/home/sim/projects/minimax-h3-tools/acme.sh-3.1.6
mkdir -p "$runtime_directory/acme-state" "$runtime_directory/acme-certificates"
acme_command=(/usr/bin/env -u DEBUG /bin/sh "$acme_directory/acme.sh" --home "$acme_directory" --config-home "$runtime_directory/acme-state" --cert-home "$runtime_directory/acme-certificates" --server letsencrypt)

case "${1:-}" in
  issue)
    "${acme_command[@]}" --issue --dns dns_ali --keylength ec-256 -d "$public_host"
    ;;
  renew)
    status=0
    "${acme_command[@]}" --renew --ecc -d "$public_host" || status=$?
    if [[ "$status" == 2 ]]; then exit 0; fi
    if [[ "$status" != 0 ]]; then exit "$status"; fi
    ;;
  *)
    echo 'Usage: direct_certificate.sh issue|renew' >&2
    exit 2
    ;;
esac

"${acme_command[@]}" --install-cert --ecc -d "$public_host" --key-file "$runtime_directory/privatekey.pem" --fullchain-file "$runtime_directory/fullchain.pem" --reloadcmd '/bin/bash /home/sim/projects/minimax-h3-web/deploy/reload_direct_https.sh'
/usr/bin/openssl x509 -in "$runtime_directory/fullchain.pem" -checkend 86400 -noout

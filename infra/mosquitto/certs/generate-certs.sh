#!/usr/bin/env sh
# Self-signed certs for Mosquitto TLS (dev/MVP). Requires openssl.
set -e
cd "$(dirname "$0")"
openssl req -new -x509 -days 3650 -nodes \
  -subj "/CN=localhost/O=IoT-MVP" \
  -out server.crt \
  -keyout server.key
cp -f server.crt ca.crt
echo "Created ca.crt, server.crt, server.key in $(pwd)"

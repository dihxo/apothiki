#!/bin/bash
# Εγκατάσταση της Αποθήκης σε Ubuntu/Debian server (εκτέλεση ως root)
set -e
REPO=https://github.com/dihxo/apothiki/raw/main
case "$(uname -m)" in aarch64|arm64) BIN=apothiki-linux-arm64 ;; *) BIN=apothiki-linux-amd64 ;; esac
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y curl ufw unattended-upgrades debian-keyring debian-archive-keyring apt-transport-https gnupg
id apothiki >/dev/null 2>&1 || useradd --system --home /var/lib/apothiki --shell /usr/sbin/nologin apothiki
mkdir -p /opt/apothiki /var/lib/apothiki
chown -R apothiki:apothiki /var/lib/apothiki
curl -fsSL -o /opt/apothiki/apothiki "$REPO/$BIN"
chmod 0755 /opt/apothiki/apothiki
cat > /etc/systemd/system/apothiki.service <<'EOF'
[Unit]
Description=Apothiki
After=network-online.target
Wants=network-online.target
[Service]
User=apothiki
Environment=WH_DATA=/var/lib/apothiki
Environment=WH_NO_BROWSER=1
Environment=WH_BIND=127.0.0.1
Environment=WH_PORT=8080
Environment=WH_HTTPS_PORT=0
ExecStart=/opt/apothiki/apothiki
Restart=always
RestartSec=3
[Install]
WantedBy=multi-user.target
EOF
cat > /usr/local/bin/apothiki-update <<EOF
#!/bin/bash
set -e
TMP=\$(mktemp)
curl -fsSL -o "\$TMP" "$REPO/$BIN"
if [ -s "\$TMP" ] && ! cmp -s "\$TMP" /opt/apothiki/apothiki; then install -m 0755 "\$TMP" /opt/apothiki/apothiki; systemctl restart apothiki; echo "updated \$(date)"; fi
rm -f "\$TMP"
EOF
chmod 0755 /usr/local/bin/apothiki-update
cat > /etc/systemd/system/apothiki-update.service <<'EOF'
[Unit]
Description=Apothiki update check
[Service]
Type=oneshot
ExecStart=/usr/local/bin/apothiki-update
EOF
cat > /etc/systemd/system/apothiki-update.timer <<'EOF'
[Unit]
Description=Daily Apothiki update check
[Timer]
OnCalendar=*-*-* 04:30:00
Persistent=true
[Install]
WantedBy=timers.target
EOF
printf 'APT::Periodic::Update-Package-Lists "1";\nAPT::Periodic::Unattended-Upgrade "1";\n' > /etc/apt/apt.conf.d/20auto-upgrades
if ! command -v caddy >/dev/null; then
  curl -1sLf https://dl.cloudsmith.io/public/caddy/stable/gpg.key | gpg --dearmor --yes -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt -o /etc/apt/sources.list.d/caddy-stable.list
  apt-get update -y
  apt-get install -y caddy
fi
IP=$(curl -fsS http://169.254.169.254/hetzner/v1/metadata/public-ipv4 || curl -fsS https://ipv4.icanhazip.com)
H="apothiki.${IP//./-}.sslip.io"
printf '%s {\n  encode gzip\n  reverse_proxy 127.0.0.1:8080\n}\n' "$H" > /etc/caddy/Caddyfile
ufw allow OpenSSH; ufw allow 80/tcp; ufw allow 443/tcp; ufw --force enable
systemctl daemon-reload
systemctl enable --now apothiki
systemctl enable --now apothiki-update.timer
systemctl restart caddy
sleep 5
echo
echo "=============================================="
echo " ΕΤΟΙΜΟ:  https://$H"
echo " Πρώτη σύνδεση: admin / admin"
echo "=============================================="

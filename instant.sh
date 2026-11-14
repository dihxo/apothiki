#!/bin/bash
# Αποθήκη: άμεσες ενημερώσεις (έλεγχος GitHub κάθε λεπτό)
set -e
REPO=https://github.com/dihxo/apothiki/raw/main
case "$(uname -m)" in aarch64|arm64) BIN=apothiki-linux-arm64;; *) BIN=apothiki-linux-amd64;; esac

cat > /usr/local/bin/apothiki-update <<EOF
#!/bin/bash
set -e
WANT=\$(curl -fsSL "$REPO/$BIN.sha256?t=\$(date +%s)" | cut -c1-64)
[ \${#WANT} -eq 64 ] || exit 0
HAVE=\$(sha256sum /opt/apothiki/apothiki | cut -c1-64)
[ "\$WANT" = "\$HAVE" ] && exit 0
TMP=\$(mktemp)
curl -fsSL -o "\$TMP" "$REPO/$BIN?t=\$(date +%s)"
if [ "\$(sha256sum "\$TMP" | cut -c1-64)" = "\$WANT" ]; then
  install -m 0755 "\$TMP" /opt/apothiki/apothiki
  systemctl restart apothiki
  echo "updated \$(date)"
fi
rm -f "\$TMP"
EOF
chmod 0755 /usr/local/bin/apothiki-update

cat > /etc/systemd/system/apothiki-update.timer <<'EOF'
[Unit]
Description=Apothiki update check (every minute)
[Timer]
OnBootSec=1min
OnUnitActiveSec=1min
AccuracySec=10s
[Install]
WantedBy=timers.target
EOF
systemctl daemon-reload
systemctl enable apothiki-update.timer
systemctl restart apothiki-update.timer
/usr/local/bin/apothiki-update || true
echo
echo "=== ΕΤΟΙΜΟ: άμεσες ενημερώσεις ενεργές ==="

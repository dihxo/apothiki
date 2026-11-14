# Αποθήκη — διαχείριση εξοπλισμού ενοικίασης

- `apothiki-linux-amd64` / `apothiki-linux-arm64`: το πρόγραμμα του server. Ο server ελέγχει κάθε βράδυ (04:30) για νέα έκδοση και ενημερώνεται μόνος του.
- `setup.sh`: εγκατάσταση σε νέο Ubuntu/Debian server.
- `source/`: ο πηγαίος κώδικας (Go + JavaScript).

Build: `cd source && GOOS=linux GOARCH=amd64 CGO_ENABLED=0 go build -trimpath -ldflags "-s -w" -o ../apothiki-linux-amd64 .`

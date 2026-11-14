// Αποθήκη — διαχείριση εξοπλισμού ενοικίασης.
// Ένα εκτελέσιμο: τρέχει τοπικό server (HTTP :8080, HTTPS :8443), κρατά τα δεδομένα
// σε data/db.json δίπλα στο .exe και εξυπηρετεί όλους τους υπολογιστές/κινητά του δικτύου.
package main

import (
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"crypto/tls"
	"crypto/x509"
	"crypto/x509/pkix"
	"embed"
	"encoding/hex"
	"encoding/json"
	"encoding/pem"
	"fmt"
	"io"
	"io/fs"
	"log"
	"math/big"
	"net"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"
)

//go:embed web
var webFS embed.FS

const appVersion = "1.0.0"

var (
	httpPort  = envInt("WH_PORT", 8080)
	httpsPort = envInt("WH_HTTPS_PORT", 8443)
	dataDir   string
)

func envInt(k string, d int) int {
	if v, err := strconv.Atoi(os.Getenv(k)); err == nil && v >= 0 {
		return v
	}
	return d
}

/* ===================== STORE ===================== */

type Doc = map[string]any

type LogEntry struct {
	TS      int64  `json:"ts"`
	User    string `json:"user"`
	Summary string `json:"summary"`
}

type DB struct {
	Version  int64                     `json:"version"`
	Colls    map[string]map[string]Doc `json:"colls"`
	Counters map[string]int64          `json:"counters"`
	Log      []LogEntry                `json:"log"`
}

var (
	mu       sync.RWMutex
	db       DB
	dbPath   string
	lastBack string
)

// Collections editable through the generic API (users have their own endpoints).
var editable = map[string]bool{
	"categories": true, "products": true, "units": true, "customers": true,
	"orders": true, "maintenance": true, "settings": true, "crew": true,
}

func loadDB() {
	dbPath = filepath.Join(dataDir, "db.json")
	b, err := os.ReadFile(dbPath)
	if err == nil {
		if err := json.Unmarshal(b, &db); err != nil {
			log.Fatalf("Το αρχείο %s είναι κατεστραμμένο: %v\nΕπανάφερε ένα αντίγραφο από τον φάκελο backups.", dbPath, err)
		}
	}
	if db.Colls == nil {
		db.Colls = map[string]map[string]Doc{}
	}
	if db.Counters == nil {
		db.Counters = map[string]int64{}
	}
	for _, c := range []string{"categories", "products", "units", "customers", "orders", "maintenance", "crew", "settings", "users"} {
		if db.Colls[c] == nil {
			db.Colls[c] = map[string]Doc{}
		}
	}
	if len(db.Colls["users"]) == 0 {
		salt := randHex(16)
		db.Colls["users"]["u_admin"] = Doc{
			"id": "u_admin", "username": "admin", "name": "Διαχειριστής", "role": "admin",
			"salt": salt, "hash": hashPw("admin", salt), "mustChange": true, "createdAt": now(),
		}
		saveDBLocked()
		log.Println("Δημιουργήθηκε χρήστης admin με κωδικό admin — άλλαξέ τον στην πρώτη σύνδεση.")
	}
}

func saveDBLocked() {
	b, err := json.Marshal(db)
	if err != nil {
		log.Println("save:", err)
		return
	}
	tmp := dbPath + ".tmp"
	if err := os.WriteFile(tmp, b, 0o644); err != nil {
		log.Println("save:", err)
		return
	}
	if err := os.Rename(tmp, dbPath); err != nil {
		log.Println("save:", err)
	}
	// Ημερήσιο αντίγραφο ασφαλείας, κρατάμε τα 60 τελευταία.
	day := time.Now().Format("2006-01-02")
	if day != lastBack {
		lastBack = day
		bd := filepath.Join(dataDir, "backups")
		os.MkdirAll(bd, 0o755)
		os.WriteFile(filepath.Join(bd, "db-"+day+".json"), b, 0o644)
		ents, _ := os.ReadDir(bd)
		var names []string
		for _, e := range ents {
			if strings.HasPrefix(e.Name(), "db-") {
				names = append(names, e.Name())
			}
		}
		sort.Strings(names)
		for len(names) > 60 {
			os.Remove(filepath.Join(bd, names[0]))
			names = names[1:]
		}
	}
}

func addLogLocked(user, summary string) {
	db.Log = append(db.Log, LogEntry{TS: now(), User: user, Summary: summary})
	if len(db.Log) > 3000 {
		db.Log = db.Log[len(db.Log)-3000:]
	}
}

func now() int64 { return time.Now().UnixMilli() }

/* ===================== AUTH ===================== */

type session struct {
	UserID string
	Exp    time.Time
}

var (
	sessMu   sync.Mutex
	sessions = map[string]*session{}
)

// οι συνδέσεις κρατιούνται σε αρχείο, ώστε να μη χάνονται σε κάθε ενημέρωση/επανεκκίνηση
func sessFile() string { return filepath.Join(dataDir, "sessions.json") }

func saveSessionsLocked() {
	now := time.Now()
	for k, s := range sessions {
		if now.After(s.Exp) {
			delete(sessions, k)
		}
	}
	if b, err := json.Marshal(sessions); err == nil {
		tmp := sessFile() + ".tmp"
		if os.WriteFile(tmp, b, 0o600) == nil {
			os.Rename(tmp, sessFile())
		}
	}
}

func loadSessions() {
	b, err := os.ReadFile(sessFile())
	if err != nil {
		return
	}
	m := map[string]*session{}
	if json.Unmarshal(b, &m) == nil {
		sessMu.Lock()
		for k, s := range m {
			if s != nil && time.Now().Before(s.Exp) {
				sessions[k] = s
			}
		}
		sessMu.Unlock()
	}
}

func randHex(n int) string {
	b := make([]byte, n)
	rand.Read(b)
	return hex.EncodeToString(b)
}

func hashPw(pw, salt string) string {
	h := sha256.Sum256([]byte(salt + ":" + pw))
	for i := 0; i < 60000; i++ {
		h = sha256.Sum256(append(h[:], []byte(salt)...))
	}
	return hex.EncodeToString(h[:])
}

func publicUser(u Doc) Doc {
	out := Doc{}
	for k, v := range u {
		if k != "hash" && k != "salt" {
			out[k] = v
		}
	}
	return out
}

func currentUser(r *http.Request) Doc {
	c, err := r.Cookie("wh_session")
	if err != nil {
		return nil
	}
	sessMu.Lock()
	s := sessions[c.Value]
	if s != nil && time.Now().After(s.Exp) {
		delete(sessions, c.Value)
		s = nil
	}
	if s != nil {
		s.Exp = time.Now().Add(14 * 24 * time.Hour)
	}
	sessMu.Unlock()
	if s == nil {
		return nil
	}
	mu.RLock()
	defer mu.RUnlock()
	u := db.Colls["users"][s.UserID]
	if u == nil || u["disabled"] == true {
		return nil
	}
	return u
}

func roleLevel(u Doc) int {
	switch u["role"] {
	case "admin":
		return 3
	case "staff":
		return 2
	case "viewer":
		return 1
	}
	return 0
}

func userName(u Doc) string {
	if n, ok := u["name"].(string); ok && n != "" {
		return n
	}
	s, _ := u["username"].(string)
	return s
}

/* ===================== LIVE EVENTS (SSE) ===================== */

var (
	subMu sync.Mutex
	subs  = map[chan int64]bool{}
)

func broadcast(v int64) {
	subMu.Lock()
	for ch := range subs {
		select {
		case ch <- v:
		default:
		}
	}
	subMu.Unlock()
}

/* ===================== HTTP HELPERS ===================== */

func writeJSON(w http.ResponseWriter, code int, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(v)
}

func fail(w http.ResponseWriter, code int, msg string) {
	writeJSON(w, code, map[string]string{"error": msg})
}

func readJSON(r *http.Request, v any) error {
	return json.NewDecoder(io.LimitReader(r.Body, 64<<20)).Decode(v)
}

func need(level int, h func(http.ResponseWriter, *http.Request, Doc)) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		u := currentUser(r)
		if u == nil {
			fail(w, 401, "Απαιτείται σύνδεση")
			return
		}
		if roleLevel(u) < level {
			fail(w, 403, "Δεν έχεις δικαίωμα για αυτή την ενέργεια")
			return
		}
		if r.Method == http.MethodPost {
			// απλή προστασία CSRF: τα αιτήματα πρέπει να είναι JSON από την ίδια την εφαρμογή
			if !strings.HasPrefix(r.Header.Get("Content-Type"), "application/json") {
				fail(w, 400, "Μη έγκυρο αίτημα")
				return
			}
		}
		h(w, r, u)
	}
}

/* ===================== HANDLERS ===================== */

func hLogin(w http.ResponseWriter, r *http.Request) {
	var in struct{ Username, Password string }
	if readJSON(r, &in) != nil {
		fail(w, 400, "Μη έγκυρο αίτημα")
		return
	}
	time.Sleep(300 * time.Millisecond)
	mu.RLock()
	var found Doc
	for _, u := range db.Colls["users"] {
		if strings.EqualFold(fmt.Sprint(u["username"]), strings.TrimSpace(in.Username)) {
			found = u
		}
	}
	mu.RUnlock()
	if found == nil || found["disabled"] == true ||
		subtle.ConstantTimeCompare([]byte(hashPw(in.Password, fmt.Sprint(found["salt"]))), []byte(fmt.Sprint(found["hash"]))) != 1 {
		fail(w, 401, "Λάθος όνομα χρήστη ή κωδικός")
		return
	}
	tok := randHex(32)
	sessMu.Lock()
	sessions[tok] = &session{UserID: fmt.Sprint(found["id"]), Exp: time.Now().Add(14 * 24 * time.Hour)}
	saveSessionsLocked()
	sessMu.Unlock()
	http.SetCookie(w, &http.Cookie{Name: "wh_session", Value: tok, Path: "/", HttpOnly: true, SameSite: http.SameSiteLaxMode, MaxAge: 14 * 24 * 3600})
	mu.Lock()
	addLogLocked(userName(found), "Σύνδεση")
	saveDBLocked()
	mu.Unlock()
	writeJSON(w, 200, publicUser(found))
}

func hLogout(w http.ResponseWriter, r *http.Request) {
	if c, err := r.Cookie("wh_session"); err == nil {
		sessMu.Lock()
		delete(sessions, c.Value)
		saveSessionsLocked()
		sessMu.Unlock()
	}
	http.SetCookie(w, &http.Cookie{Name: "wh_session", Value: "", Path: "/", MaxAge: -1})
	writeJSON(w, 200, map[string]bool{"ok": true})
}

func hMe(w http.ResponseWriter, r *http.Request) {
	u := currentUser(r)
	if u == nil {
		fail(w, 401, "Απαιτείται σύνδεση")
		return
	}
	writeJSON(w, 200, publicUser(u))
}

func hState(w http.ResponseWriter, r *http.Request, u Doc) {
	mu.RLock()
	defer mu.RUnlock()
	data := map[string][]Doc{}
	for name, c := range db.Colls {
		list := make([]Doc, 0, len(c))
		for id, d := range c {
			if d["id"] == nil || d["id"] == "" {
				d["id"] = id
			}
			if name == "users" {
				d = publicUser(d)
			}
			list = append(list, d)
		}
		data[name] = list
	}
	writeJSON(w, 200, map[string]any{"version": db.Version, "data": data, "counters": db.Counters})
}

type Op struct {
	Op   string `json:"op"` // put | del
	Coll string `json:"coll"`
	ID   string `json:"id"`
	Doc  Doc    `json:"doc"`
}

func validID(s string) bool {
	if s == "" || len(s) > 80 {
		return false
	}
	for _, c := range s {
		if !(c >= 'a' && c <= 'z' || c >= 'A' && c <= 'Z' || c >= '0' && c <= '9' || c == '_' || c == '-') {
			return false
		}
	}
	return true
}

func hBatch(w http.ResponseWriter, r *http.Request, u Doc) {
	var in struct {
		Ops     []Op   `json:"ops"`
		Summary string `json:"summary"`
	}
	if readJSON(r, &in) != nil || len(in.Ops) == 0 || len(in.Ops) > 2000 {
		fail(w, 400, "Μη έγκυρο αίτημα")
		return
	}
	for _, op := range in.Ops {
		if !editable[op.Coll] || !validID(op.ID) || (op.Op != "put" && op.Op != "del") {
			fail(w, 400, "Μη έγκυρη λειτουργία: "+op.Coll+"/"+op.ID)
			return
		}
		if op.Coll == "settings" && roleLevel(u) < 3 {
			fail(w, 403, "Μόνο οι διαχειριστές αλλάζουν τις ρυθμίσεις")
			return
		}
	}
	mu.Lock()
	for _, op := range in.Ops {
		if op.Op == "del" {
			delete(db.Colls[op.Coll], op.ID)
			continue
		}
		d := op.Doc
		if d == nil {
			d = Doc{}
		}
		d["id"] = op.ID
		d["updatedAt"] = now()
		d["updatedBy"] = userName(u)
		if old := db.Colls[op.Coll][op.ID]; old != nil {
			if c, ok := old["createdAt"]; ok {
				d["createdAt"] = c
			}
		} else {
			d["createdAt"] = now()
		}
		db.Colls[op.Coll][op.ID] = d
	}
	db.Version++
	if in.Summary != "" {
		s := in.Summary
		if len([]rune(s)) > 300 {
			s = string([]rune(s)[:300])
		}
		addLogLocked(userName(u), s)
	}
	saveDBLocked()
	v := db.Version
	mu.Unlock()
	broadcast(v)
	writeJSON(w, 200, map[string]any{"version": v})
}

func hNext(w http.ResponseWriter, r *http.Request, u Doc) {
	var in struct{ Name string }
	if readJSON(r, &in) != nil || !validID(in.Name) {
		fail(w, 400, "Μη έγκυρο αίτημα")
		return
	}
	mu.Lock()
	db.Counters[in.Name]++
	n := db.Counters[in.Name]
	db.Version++
	saveDBLocked()
	v := db.Version
	mu.Unlock()
	broadcast(v)
	writeJSON(w, 200, map[string]any{"n": n})
}

func hEvents(w http.ResponseWriter, r *http.Request, u Doc) {
	fl, ok := w.(http.Flusher)
	if !ok {
		fail(w, 500, "no stream")
		return
	}
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-store")
	w.Header().Set("X-Accel-Buffering", "no")
	ch := make(chan int64, 4)
	subMu.Lock()
	subs[ch] = true
	subMu.Unlock()
	defer func() { subMu.Lock(); delete(subs, ch); subMu.Unlock() }()
	mu.RLock()
	v := db.Version
	mu.RUnlock()
	fmt.Fprintf(w, "data: %d\n\n", v)
	fl.Flush()
	t := time.NewTicker(25 * time.Second)
	defer t.Stop()
	for {
		select {
		case <-r.Context().Done():
			return
		case v := <-ch:
			fmt.Fprintf(w, "data: %d\n\n", v)
			fl.Flush()
		case <-t.C:
			fmt.Fprint(w, ": ping\n\n")
			fl.Flush()
		}
	}
}

func hUserSave(w http.ResponseWriter, r *http.Request, u Doc) {
	var in struct {
		ID, Username, Name, Role, Password string
		Disabled                           bool
	}
	if readJSON(r, &in) != nil {
		fail(w, 400, "Μη έγκυρο αίτημα")
		return
	}
	in.Username = strings.TrimSpace(in.Username)
	if in.Username == "" || (in.Role != "admin" && in.Role != "staff" && in.Role != "viewer") {
		fail(w, 400, "Συμπλήρωσε όνομα χρήστη και ρόλο")
		return
	}
	mu.Lock()
	defer mu.Unlock()
	for id, x := range db.Colls["users"] {
		if id != in.ID && strings.EqualFold(fmt.Sprint(x["username"]), in.Username) {
			fail(w, 400, "Το όνομα χρήστη υπάρχει ήδη")
			return
		}
	}
	var d Doc
	if in.ID != "" {
		d = db.Colls["users"][in.ID]
		if d == nil {
			fail(w, 404, "Ο χρήστης δεν βρέθηκε")
			return
		}
	} else {
		if len(in.Password) < 4 {
			fail(w, 400, "Ο κωδικός πρέπει να έχει τουλάχιστον 4 χαρακτήρες")
			return
		}
		in.ID = "u_" + randHex(6)
		d = Doc{"id": in.ID, "createdAt": now()}
	}
	// να μείνει πάντα τουλάχιστον ένας ενεργός admin
	if d["role"] == "admin" && (in.Role != "admin" || in.Disabled) {
		admins := 0
		for _, x := range db.Colls["users"] {
			if x["role"] == "admin" && x["disabled"] != true {
				admins++
			}
		}
		if admins <= 1 {
			fail(w, 400, "Πρέπει να υπάρχει τουλάχιστον ένας ενεργός διαχειριστής")
			return
		}
	}
	d["username"], d["name"], d["role"], d["disabled"] = in.Username, strings.TrimSpace(in.Name), in.Role, in.Disabled
	if in.Password != "" {
		if len(in.Password) < 4 {
			fail(w, 400, "Ο κωδικός πρέπει να έχει τουλάχιστον 4 χαρακτήρες")
			return
		}
		salt := randHex(16)
		d["salt"], d["hash"], d["mustChange"] = salt, hashPw(in.Password, salt), true
	}
	d["updatedAt"] = now()
	db.Colls["users"][in.ID] = d
	db.Version++
	addLogLocked(userName(u), "Αποθήκευση χρήστη "+in.Username)
	saveDBLocked()
	bv := db.Version
	go broadcast(bv)
	writeJSON(w, 200, publicUser(d))
}

func hUserDel(w http.ResponseWriter, r *http.Request, u Doc) {
	var in struct{ ID string }
	readJSON(r, &in)
	mu.Lock()
	defer mu.Unlock()
	d := db.Colls["users"][in.ID]
	if d == nil {
		fail(w, 404, "Ο χρήστης δεν βρέθηκε")
		return
	}
	if in.ID == u["id"] {
		fail(w, 400, "Δεν μπορείς να διαγράψεις τον εαυτό σου")
		return
	}
	if d["role"] == "admin" {
		admins := 0
		for _, x := range db.Colls["users"] {
			if x["role"] == "admin" && x["disabled"] != true {
				admins++
			}
		}
		if admins <= 1 {
			fail(w, 400, "Πρέπει να υπάρχει τουλάχιστον ένας διαχειριστής")
			return
		}
	}
	delete(db.Colls["users"], in.ID)
	db.Version++
	addLogLocked(userName(u), "Διαγραφή χρήστη "+fmt.Sprint(d["username"]))
	saveDBLocked()
	bv := db.Version
	go broadcast(bv)
	writeJSON(w, 200, map[string]bool{"ok": true})
}

func hPassword(w http.ResponseWriter, r *http.Request, u Doc) {
	var in struct{ Old, New string }
	readJSON(r, &in)
	if len(in.New) < 4 {
		fail(w, 400, "Ο νέος κωδικός πρέπει να έχει τουλάχιστον 4 χαρακτήρες")
		return
	}
	mu.Lock()
	defer mu.Unlock()
	d := db.Colls["users"][fmt.Sprint(u["id"])]
	if hashPw(in.Old, fmt.Sprint(d["salt"])) != d["hash"] {
		fail(w, 400, "Ο τρέχων κωδικός είναι λάθος")
		return
	}
	salt := randHex(16)
	d["salt"], d["hash"], d["mustChange"] = salt, hashPw(in.New, salt), false
	addLogLocked(userName(u), "Αλλαγή κωδικού")
	saveDBLocked()
	writeJSON(w, 200, map[string]bool{"ok": true})
}

func hBackup(w http.ResponseWriter, r *http.Request, u Doc) {
	mu.RLock()
	b, _ := json.MarshalIndent(db, "", " ")
	mu.RUnlock()
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Content-Disposition", "attachment; filename=apothiki-backup-"+time.Now().Format("2006-01-02-1504")+".json")
	w.Write(b)
}

func hRestore(w http.ResponseWriter, r *http.Request, u Doc) {
	var in DB
	if err := readJSON(r, &in); err != nil || in.Colls == nil {
		fail(w, 400, "Το αρχείο δεν είναι έγκυρο αντίγραφο ασφαλείας")
		return
	}
	mu.Lock()
	// αντίγραφο από την έκδοση browser: δεν έχει χρήστες — κρατάμε τους τρέχοντες
	if len(in.Colls["users"]) == 0 {
		in.Colls["users"] = db.Colls["users"]
	}
	if in.Log == nil {
		in.Log = db.Log
	}
	for k, v := range db.Counters {
		if in.Counters == nil {
			in.Counters = map[string]int64{}
		}
		if in.Counters[k] < v {
			in.Counters[k] = v
		}
	}
	// κράτα αντίγραφο της τρέχουσας κατάστασης πριν την επαναφορά
	if b, err := json.Marshal(db); err == nil {
		bd := filepath.Join(dataDir, "backups")
		os.MkdirAll(bd, 0o755)
		os.WriteFile(filepath.Join(bd, "pre-restore-"+time.Now().Format("2006-01-02-150405")+".json"), b, 0o644)
	}
	v := db.Version
	db = in
	db.Version = v + 1
	if db.Counters == nil {
		db.Counters = map[string]int64{}
	}
	for _, c := range []string{"categories", "products", "units", "customers", "orders", "maintenance", "crew", "settings", "users"} {
		if db.Colls[c] == nil {
			db.Colls[c] = map[string]Doc{}
		}
	}
	// τα αντίγραφα της έκδοσης browser έχουν το id μόνο ως κλειδί
	for _, c := range db.Colls {
		for id, d := range c {
			if d == nil {
				delete(c, id)
				continue
			}
			d["id"] = id
		}
	}
	addLogLocked(userName(u), "Επαναφορά αντιγράφου ασφαλείας")
	saveDBLocked()
	nv := db.Version
	mu.Unlock()
	broadcast(nv)
	writeJSON(w, 200, map[string]bool{"ok": true})
}

func hLog(w http.ResponseWriter, r *http.Request, u Doc) {
	mu.RLock()
	defer mu.RUnlock()
	n := len(db.Log)
	from := n - 500
	if from < 0 {
		from = 0
	}
	out := make([]LogEntry, 0, n-from)
	for i := n - 1; i >= from; i-- {
		out = append(out, db.Log[i])
	}
	writeJSON(w, 200, out)
}

func hInfo(w http.ResponseWriter, r *http.Request, u Doc) {
	host, _ := os.Hostname()
	writeJSON(w, 200, map[string]any{
		"version": appVersion, "ips": localIPs(), "httpPort": httpPort, "httpsPort": httpsPort,
		"dataDir": dataDir, "host": host,
	})
}

/* ===================== NETWORK / TLS ===================== */

func localIPs() []string {
	var out []string
	ifs, _ := net.Interfaces()
	for _, i := range ifs {
		if i.Flags&net.FlagUp == 0 || i.Flags&net.FlagLoopback != 0 {
			continue
		}
		addrs, _ := i.Addrs()
		for _, a := range addrs {
			if ipn, ok := a.(*net.IPNet); ok && ipn.IP.To4() != nil && !ipn.IP.IsLinkLocalUnicast() {
				out = append(out, ipn.IP.String())
			}
		}
	}
	return out
}

func ensureCert() (tls.Certificate, error) {
	certPath := filepath.Join(dataDir, "cert.pem")
	keyPath := filepath.Join(dataDir, "key.pem")
	ips := localIPs()
	if c, err := tls.LoadX509KeyPair(certPath, keyPath); err == nil {
		// νέο πιστοποιητικό αν άλλαξε η IP του υπολογιστή
		if leaf, err := x509.ParseCertificate(c.Certificate[0]); err == nil && time.Now().Before(leaf.NotAfter) {
			have := map[string]bool{}
			for _, ip := range leaf.IPAddresses {
				have[ip.String()] = true
			}
			ok := true
			for _, ip := range ips {
				if !have[ip] {
					ok = false
				}
			}
			if ok {
				return c, nil
			}
		}
	}
	key, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		return tls.Certificate{}, err
	}
	host, _ := os.Hostname()
	tpl := x509.Certificate{
		SerialNumber: big.NewInt(time.Now().UnixNano()),
		Subject:      pkix.Name{CommonName: "Apothiki " + host, Organization: []string{"Apothiki"}},
		NotBefore:    time.Now().Add(-time.Hour),
		NotAfter:     time.Now().AddDate(5, 0, 0),
		KeyUsage:     x509.KeyUsageDigitalSignature | x509.KeyUsageKeyEncipherment,
		ExtKeyUsage:  []x509.ExtKeyUsage{x509.ExtKeyUsageServerAuth},
		DNSNames:     []string{"localhost", host},
		IPAddresses:  []net.IP{net.ParseIP("127.0.0.1")},
	}
	for _, ip := range ips {
		tpl.IPAddresses = append(tpl.IPAddresses, net.ParseIP(ip))
	}
	der, err := x509.CreateCertificate(rand.Reader, &tpl, &tpl, &key.PublicKey, key)
	if err != nil {
		return tls.Certificate{}, err
	}
	kb, _ := x509.MarshalECPrivateKey(key)
	certPEM := pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: der})
	keyPEM := pem.EncodeToMemory(&pem.Block{Type: "EC PRIVATE KEY", Bytes: kb})
	os.WriteFile(certPath, certPEM, 0o644)
	os.WriteFile(keyPath, keyPEM, 0o600)
	return tls.X509KeyPair(certPEM, keyPEM)
}

func openBrowser(url string) {
	var cmd *exec.Cmd
	switch runtime.GOOS {
	case "windows":
		cmd = exec.Command("rundll32", "url.dll,FileProtocolHandler", url)
	case "darwin":
		cmd = exec.Command("open", url)
	default:
		cmd = exec.Command("xdg-open", url)
	}
	cmd.Start()
}

/* ===================== MAIN ===================== */

func main() {
	exe, err := os.Executable()
	if err != nil {
		exe = "."
	}
	base := filepath.Dir(exe)
	if d := os.Getenv("WH_DATA"); d != "" {
		dataDir = d
	} else {
		dataDir = filepath.Join(base, "data")
	}
	if err := os.MkdirAll(dataDir, 0o755); err != nil {
		log.Fatal(err)
	}
	lf, err := os.OpenFile(filepath.Join(dataDir, "server.log"), os.O_CREATE|os.O_APPEND|os.O_WRONLY, 0o644)
	if err == nil {
		log.SetOutput(io.MultiWriter(os.Stdout, lf))
	}
	loadDB()
	loadSessions()

	sub, _ := fs.Sub(webFS, "web")
	static := http.FileServer(http.FS(sub))
	mux := http.NewServeMux()
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Cache-Control", "no-cache")
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("X-Frame-Options", "SAMEORIGIN")
		static.ServeHTTP(w, r)
	})
	mux.HandleFunc("POST /api/login", hLogin)
	mux.HandleFunc("POST /api/logout", hLogout)
	mux.HandleFunc("GET /api/me", hMe)
	mux.HandleFunc("GET /api/state", need(1, hState))
	mux.HandleFunc("GET /api/events", need(1, hEvents))
	mux.HandleFunc("GET /api/info", need(1, hInfo))
	mux.HandleFunc("POST /api/batch", need(2, hBatch))
	mux.HandleFunc("GET /api/imgsearch", need(2, hImgSearch))
	mux.HandleFunc("GET /api/imgfetch", need(2, hImgFetch))
	mux.HandleFunc("POST /api/next", need(2, hNext))
	mux.HandleFunc("POST /api/password", need(1, hPassword))
	mux.HandleFunc("POST /api/users/save", need(3, hUserSave))
	mux.HandleFunc("POST /api/users/del", need(3, hUserDel))
	mux.HandleFunc("GET /api/backup", need(3, hBackup))
	mux.HandleFunc("POST /api/restore", need(3, hRestore))
	mux.HandleFunc("GET /api/log", need(3, hLog))

	fmt.Println("==============================================")
	fmt.Println("  ΑΠΟΘΗΚΗ — Διαχείριση εξοπλισμού  v" + appVersion)
	fmt.Println("==============================================")
	fmt.Printf("  Σε αυτόν τον υπολογιστή:  http://localhost:%d\n", httpPort)
	for _, ip := range localIPs() {
		fmt.Printf("  Από άλλες συσκευές:       http://%s:%d\n", ip, httpPort)
		fmt.Printf("  Με κάμερα κινητού (HTTPS): https://%s:%d\n", ip, httpsPort)
	}
	fmt.Println("  Δεδομένα:", dataDir)
	fmt.Println("  Μην κλείσεις αυτό το παράθυρο όσο χρησιμοποιείται η εφαρμογή.")
	fmt.Println("==============================================")

	bind := os.Getenv("WH_BIND") // π.χ. 127.0.0.1 όταν τρέχει πίσω από Caddy
	if httpsPort == 0 {
		// χωρίς δικό του HTTPS (το αναλαμβάνει ο Caddy)
	} else if cert, err := ensureCert(); err == nil {
		go func() {
			srv := &http.Server{Addr: fmt.Sprintf("%s:%d", bind, httpsPort), Handler: mux, TLSConfig: &tls.Config{Certificates: []tls.Certificate{cert}}}
			if err := srv.ListenAndServeTLS("", ""); err != nil {
				log.Println("HTTPS:", err)
			}
		}()
	} else {
		log.Println("TLS:", err)
	}
	ln, err := net.Listen("tcp", fmt.Sprintf("%s:%d", bind, httpPort))
	if err != nil {
		fmt.Printf("\nΗ θύρα %d χρησιμοποιείται ήδη — μάλλον η εφαρμογή τρέχει ήδη.\n", httpPort)
		openBrowser(fmt.Sprintf("http://localhost:%d", httpPort))
		time.Sleep(4 * time.Second)
		return
	}
	if os.Getenv("WH_NO_BROWSER") == "" {
		go func() { time.Sleep(600 * time.Millisecond); openBrowser(fmt.Sprintf("http://localhost:%d", httpPort)) }()
	}
	log.Fatal(http.Serve(ln, mux))
}

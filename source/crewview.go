package main

// Δημόσια (με μυστικό σύνδεσμο) προβολή προγράμματος συνεργείου — ΧΩΡΙΣ τιμές.

import (
	"crypto/subtle"
	"fmt"
	"net/http"
	"sort"
	"time"
)

func sv(m map[string]any, k string) string {
	if m == nil {
		return ""
	}
	if v, ok := m[k]; ok && v != nil {
		return fmt.Sprint(v)
	}
	return ""
}

func hCrewView(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Cache-Control", "no-store")
	k := r.URL.Query().Get("k")
	mu.RLock()
	defer mu.RUnlock()
	comp := db.Colls["settings"]["company"]
	tok := sv(comp, "crewToken")
	if len(tok) < 16 || len(k) != len(tok) || subtle.ConstantTimeCompare([]byte(k), []byte(tok)) != 1 {
		time.Sleep(400 * time.Millisecond)
		fail(w, 403, "Ο σύνδεσμος δεν είναι έγκυρος. Ζήτησε τον νέο σύνδεσμο από το γραφείο.")
		return
	}
	now := time.Now()
	from := now.AddDate(0, 0, -10).Format("2006-01-02")
	to := now.AddDate(0, 0, 90).Format("2006-01-02")

	type person struct {
		ID   string `json:"id"`
		Name string `json:"name"`
		Role string `json:"role"`
	}
	people := []person{}
	for id, c := range db.Colls["crew"] {
		if c["inactive"] == true {
			continue
		}
		people = append(people, person{id, sv(c, "name"), sv(c, "role")})
	}
	sort.Slice(people, func(i, j int) bool { return people[i].Name < people[j].Name })

	custName := func(id string) string {
		c := db.Colls["customers"][id]
		if c == nil {
			return ""
		}
		if n := sv(c, "company"); n != "" {
			return n
		}
		return sv(c, "name")
	}
	prodName := func(id string) string { return sv(db.Colls["products"][id], "name") }
	crewName := func(id string) string { return sv(db.Colls["crew"][id], "name") }

	jobs := []map[string]any{}
	for _, o := range db.Colls["orders"] {
		st := sv(o, "status")
		if st != "option" && st != "reserved" && st != "started" && st != "stopped" {
			continue
		}
		list, _ := o["crew"].([]any)
		if len(list) == 0 {
			continue
		}
		team := []map[string]any{}
		for _, x := range list {
			a, _ := x.(map[string]any)
			team = append(team, map[string]any{"cid": sv(a, "cid"), "name": crewName(sv(a, "cid")), "role": sv(a, "role"),
				"start": sv(a, "start"), "end": sv(a, "end"), "from": sv(a, "from"), "to": sv(a, "to")})
		}
		equip := []map[string]any{}
		if lines, ok := o["lines"].([]any); ok {
			for _, x := range lines {
				l, _ := x.(map[string]any)
				name := prodName(sv(l, "pid"))
				if name == "" {
					name = sv(l, "name")
				}
				if name == "" {
					continue
				}
				equip = append(equip, map[string]any{"name": name, "qty": l["qty"]})
			}
		}
		ord := map[string]any{"number": sv(o, "number"), "title": sv(o, "name"), "customer": custName(sv(o, "customerId")),
			"venue": sv(o, "venue"), "status": st, "start": sv(o, "start"), "end": sv(o, "end"),
			"startTime": sv(o, "startTime"), "endTime": sv(o, "endTime")}
		for _, x := range list {
			a, _ := x.(map[string]any)
			s, e := sv(a, "start"), sv(a, "end")
			if e == "" {
				e = s
			}
			if e < from || s > to {
				continue
			}
			if st == "stopped" && e < now.Format("2006-01-02") {
				continue
			}
			jobs = append(jobs, map[string]any{"cid": sv(a, "cid"), "role": sv(a, "role"), "start": s, "end": e,
				"from": sv(a, "from"), "to": sv(a, "to"), "note": sv(a, "note"), "order": ord, "team": team, "equipment": equip})
		}
	}
	sort.Slice(jobs, func(i, j int) bool { return fmt.Sprint(jobs[i]["start"], jobs[i]["from"]) < fmt.Sprint(jobs[j]["start"], jobs[j]["from"]) })
	off := map[string]any{}
	for id, c := range db.Colls["crew"] {
		if v, ok := c["off"]; ok {
			off[id] = v
		}
	}
	writeJSON(w, 200, map[string]any{"company": sv(comp, "name"), "people": people, "jobs": jobs, "off": off, "today": now.Format("2006-01-02")})
}

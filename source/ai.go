package main

// Βοηθός AI: ο server κρατά το κλειδί της Anthropic (δεν φτάνει ποτέ στους browsers),
// προωθεί τα αιτήματα στο Messages API και μετράει το κόστος ανά μήνα με όριο.
// Τα εργαλεία (αναζήτηση διαθεσιμότητας, παραγγελιών κλπ) εκτελούνται στον browser,
// που έχει ήδη τα δεδομένα με τα σωστά δικαιώματα (π.χ. χωρίς τιμές για τεχνικούς).

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"
)

type aiConf struct {
	Key       string  `json:"key"`
	BudgetUSD float64 `json:"budgetUSD"`
	Month     string  `json:"month"`
	SpentUSD  float64 `json:"spentUSD"`
	Calls     int     `json:"calls"`
	History   []aiMon `json:"history,omitempty"`
}
type aiMon struct {
	Month    string  `json:"month"`
	SpentUSD float64 `json:"spentUSD"`
	Calls    int     `json:"calls"`
}

var aiMu sync.Mutex
var aiAPI = "https://api.anthropic.com/v1/messages"

const aiModel = "claude-sonnet-5-5"

// τιμές USD ανά εκατομμύριο tokens (Claude Sonnet 5.5)
const (
	aiPriceIn         = 2.0
	aiPriceOut        = 10.0
	aiPriceCacheWrite = 2.5
	aiPriceCacheRead  = 0.10
)

func init() {
	if v := os.Getenv("WH_AI_API"); v != "" {
		aiAPI = v
	}
}

func aiPath() string { return filepath.Join(dataDir, "ai.json") }

func aiLoad() aiConf {
	var c aiConf
	if b, err := os.ReadFile(aiPath()); err == nil {
		json.Unmarshal(b, &c)
	}
	if c.BudgetUSD == 0 {
		c.BudgetUSD = 20
	}
	m := time.Now().Format("2006-01")
	if c.Month != m {
		if c.Month != "" {
			c.History = append(c.History, aiMon{c.Month, c.SpentUSD, c.Calls})
			if len(c.History) > 24 {
				c.History = c.History[len(c.History)-24:]
			}
		}
		c.Month, c.SpentUSD, c.Calls = m, 0, 0
	}
	return c
}

func aiSave(c aiConf) {
	b, _ := json.MarshalIndent(c, "", "  ")
	tmp := aiPath() + ".tmp"
	if os.WriteFile(tmp, b, 0o600) == nil {
		os.Rename(tmp, aiPath())
	}
}

func aiStatus(c aiConf) map[string]any {
	k := ""
	if len(c.Key) > 12 {
		k = c.Key[:10] + "…" + c.Key[len(c.Key)-4:]
	}
	return map[string]any{"enabled": c.Key != "", "keyHint": k, "budgetUSD": c.BudgetUSD, "spentUSD": c.SpentUSD, "calls": c.Calls, "month": c.Month, "history": c.History, "model": aiModel}
}

func hAIStatus(w http.ResponseWriter, r *http.Request, u Doc) {
	aiMu.Lock()
	c := aiLoad()
	aiMu.Unlock()
	st := aiStatus(c)
	if roleLevel(u) < 3 {
		delete(st, "keyHint")
		delete(st, "history")
	}
	writeJSON(w, 200, st)
}

func hAIConfig(w http.ResponseWriter, r *http.Request, u Doc) {
	var in struct {
		Key       *string  `json:"key"`
		BudgetUSD *float64 `json:"budgetUSD"`
	}
	if err := readJSON(r, &in); err != nil {
		fail(w, 400, "Μη έγκυρα δεδομένα")
		return
	}
	aiMu.Lock()
	defer aiMu.Unlock()
	c := aiLoad()
	if in.Key != nil {
		k := strings.TrimSpace(*in.Key)
		if k != "" && !strings.HasPrefix(k, "sk-ant-") {
			fail(w, 400, "Το κλειδί πρέπει να ξεκινά με sk-ant-")
			return
		}
		c.Key = k
	}
	if in.BudgetUSD != nil {
		if *in.BudgetUSD < 1 || *in.BudgetUSD > 1000 {
			fail(w, 400, "Όριο από 1 έως 1000 $")
			return
		}
		c.BudgetUSD = *in.BudgetUSD
	}
	aiSave(c)
	mu.Lock()
	addLogLocked(userName(u), "Ρυθμίσεις βοηθού AI")
	saveDBLocked()
	mu.Unlock()
	writeJSON(w, 200, aiStatus(c))
}

var aiClient = &http.Client{Timeout: 120 * time.Second}

func hAIMessages(w http.ResponseWriter, r *http.Request, u Doc) {
	var in struct {
		System   json.RawMessage `json:"system"`
		Messages json.RawMessage `json:"messages"`
		Tools    json.RawMessage `json:"tools"`
		Choice   json.RawMessage `json:"tool_choice"`
	}
	if err := readJSON(r, &in); err != nil || len(in.Messages) == 0 {
		fail(w, 400, "Μη έγκυρο αίτημα")
		return
	}
	aiMu.Lock()
	c := aiLoad()
	aiMu.Unlock()
	if c.Key == "" {
		fail(w, 400, "Ο βοηθός δεν έχει ρυθμιστεί. Βάλε το κλειδί της Anthropic στις Ρυθμίσεις → Βοηθός AI.")
		return
	}
	if c.SpentUSD >= c.BudgetUSD {
		fail(w, 429, fmt.Sprintf("Έφτασε το μηνιαίο όριο του βοηθού (%.2f $). Αύξησέ το από τις Ρυθμίσεις → Βοηθός AI.", c.BudgetUSD))
		return
	}
	body := map[string]any{"model": aiModel, "max_tokens": 4096, "messages": in.Messages}
	if len(in.System) > 0 {
		body["system"] = in.System
	}
	if len(in.Tools) > 0 && string(in.Tools) != "null" {
		body["tools"] = in.Tools
	}
	if len(in.Choice) > 0 && string(in.Choice) != "null" {
		body["tool_choice"] = in.Choice
	}
	b, _ := json.Marshal(body)
	req, _ := http.NewRequestWithContext(r.Context(), "POST", aiAPI, bytes.NewReader(b))
	req.Header.Set("content-type", "application/json")
	req.Header.Set("x-api-key", c.Key)
	req.Header.Set("anthropic-version", "2023-06-01")
	res, err := aiClient.Do(req)
	if err != nil {
		fail(w, 502, "Δεν υπάρχει σύνδεση με τον βοηθό: "+err.Error())
		return
	}
	defer res.Body.Close()
	rb, _ := io.ReadAll(io.LimitReader(res.Body, 8<<20))
	if res.StatusCode != 200 {
		var e struct {
			Error struct {
				Type    string `json:"type"`
				Message string `json:"message"`
			} `json:"error"`
		}
		json.Unmarshal(rb, &e)
		msg := e.Error.Message
		switch res.StatusCode {
		case 401:
			msg = "Το κλειδί της Anthropic δεν είναι σωστό ή έχει ακυρωθεί."
		case 429:
			msg = "Πολλά αιτήματα ή εξαντλήθηκε το υπόλοιπο στον λογαριασμό Anthropic. Δοκίμασε σε λίγο."
		case 529, 503:
			msg = "Ο βοηθός είναι προσωρινά υπερφορτωμένος. Δοκίμασε σε λίγο."
		}
		if msg == "" {
			msg = res.Status
		}
		fail(w, 502, "Βοηθός: "+msg)
		return
	}
	var out struct {
		Usage struct {
			In         float64 `json:"input_tokens"`
			Out        float64 `json:"output_tokens"`
			CacheWrite float64 `json:"cache_creation_input_tokens"`
			CacheRead  float64 `json:"cache_read_input_tokens"`
		} `json:"usage"`
	}
	json.Unmarshal(rb, &out)
	cost := (out.Usage.In*aiPriceIn + out.Usage.Out*aiPriceOut + out.Usage.CacheWrite*aiPriceCacheWrite + out.Usage.CacheRead*aiPriceCacheRead) / 1e6
	aiMu.Lock()
	c = aiLoad()
	c.SpentUSD += cost
	c.Calls++
	aiSave(c)
	aiMu.Unlock()
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.Header().Set("Cache-Control", "no-store")
	w.Header().Set("X-AI-Cost", fmt.Sprintf("%.5f", cost))
	w.WriteHeader(200)
	w.Write(rb)
}

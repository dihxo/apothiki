package main

// Αυτόματη αναζήτηση φωτογραφιών προϊόντων (Bing / DuckDuckGo, χωρίς κλειδί)
// και ασφαλής λήψη εικόνας από τον server (αποφυγή CORS στον browser).

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"html"
	"io"
	"log"
	"net"
	"net/http"
	"net/url"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"syscall"
	"time"
)

const browserUA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36"

type imgHit struct {
	Image string `json:"image"`
	Thumb string `json:"thumb"`
	Title string `json:"title,omitempty"`
}

// client που αρνείται συνδέσεις σε ιδιωτικές/τοπικές διευθύνσεις (SSRF)
var safeClient = &http.Client{
	Timeout: 15 * time.Second,
	Transport: &http.Transport{
		Proxy: nil,
		DialContext: (&net.Dialer{
			Timeout: 8 * time.Second,
			Control: func(network, address string, c syscall.RawConn) error {
				host, _, err := net.SplitHostPort(address)
				if err != nil {
					return err
				}
				ip := net.ParseIP(host)
				if ip == nil || ip.IsLoopback() || ip.IsPrivate() || ip.IsLinkLocalUnicast() ||
					ip.IsLinkLocalMulticast() || ip.IsUnspecified() || ip.IsMulticast() ||
					ip.Equal(net.ParseIP("169.254.169.254")) {
					return errors.New("blocked address")
				}
				return nil
			},
		}).DialContext,
		TLSHandshakeTimeout:   8 * time.Second,
		ResponseHeaderTimeout: 10 * time.Second,
		MaxIdleConns:          10,
	},
	CheckRedirect: func(req *http.Request, via []*http.Request) error {
		if len(via) >= 5 {
			return errors.New("too many redirects")
		}
		if req.URL.Scheme != "http" && req.URL.Scheme != "https" {
			return errors.New("bad scheme")
		}
		return nil
	},
}

func getText(ctx context.Context, u string, hdr map[string]string, limit int64) (string, error) {
	req, err := http.NewRequestWithContext(ctx, "GET", u, nil)
	if err != nil {
		return "", err
	}
	req.Header.Set("User-Agent", browserUA)
	req.Header.Set("Accept-Language", "en-US,en;q=0.9,el;q=0.8")
	for k, v := range hdr {
		req.Header.Set(k, v)
	}
	res, err := safeClient.Do(req)
	if err != nil {
		return "", err
	}
	defer res.Body.Close()
	if res.StatusCode != 200 {
		return "", errors.New(res.Status)
	}
	b, err := io.ReadAll(io.LimitReader(res.Body, limit))
	return string(b), err
}

var bingRe = regexp.MustCompile(`"murl":"(.*?)","turl":"(.*?)"`)
var bingTitleRe = regexp.MustCompile(`"t":"(.*?)"`)

func searchBing(ctx context.Context, q string) ([]imgHit, error) {
	page, err := getText(ctx, "https://www.bing.com/images/search?form=HDRSC2&first=1&q="+url.QueryEscape(q), map[string]string{"Accept": "text/html"}, 4<<20)
	if err != nil {
		return nil, err
	}
	return parseBing(page), nil
}

var bingMRe = regexp.MustCompile(`\bm="([^"]+)"`)

func parseBing(page string) []imgHit {
	var out []imgHit
	for _, m := range bingMRe.FindAllStringSubmatch(page, 60) {
		meta := html.UnescapeString(m[1])
		var j struct {
			Murl string `json:"murl"`
			Turl string `json:"turl"`
			T    string `json:"t"`
		}
		if json.Unmarshal([]byte(meta), &j) != nil {
			if mm := bingRe.FindStringSubmatch(meta); mm != nil {
				j.Murl, j.Turl = mm[1], mm[2]
				if t := bingTitleRe.FindStringSubmatch(meta); t != nil {
					j.T = t[1]
				}
			}
		}
		if strings.HasPrefix(j.Murl, "http") && strings.HasPrefix(j.Turl, "http") {
			out = append(out, imgHit{Image: j.Murl, Thumb: j.Turl, Title: j.T})
		}
	}
	return out
}

var vqdRe = regexp.MustCompile(`vqd=["']?([\d-]+)`)

func searchDDG(ctx context.Context, q string) ([]imgHit, error) {
	page, err := getText(ctx, "https://duckduckgo.com/?iax=images&ia=images&q="+url.QueryEscape(q), nil, 2<<20)
	if err != nil {
		return nil, err
	}
	m := vqdRe.FindStringSubmatch(page)
	if m == nil {
		return nil, errors.New("no vqd")
	}
	js, err := getText(ctx, "https://duckduckgo.com/i.js?l=wt-wt&o=json&f=,,,&p=1&q="+url.QueryEscape(q)+"&vqd="+m[1],
		map[string]string{"Referer": "https://duckduckgo.com/", "Accept": "application/json"}, 4<<20)
	if err != nil {
		return nil, err
	}
	var r struct {
		Results []struct {
			Image, Thumbnail, Title string
		} `json:"results"`
	}
	if err := json.Unmarshal([]byte(js), &r); err != nil {
		return nil, err
	}
	var out []imgHit
	for _, x := range r.Results {
		if strings.HasPrefix(x.Image, "http") {
			out = append(out, imgHit{Image: x.Image, Thumb: x.Thumbnail, Title: x.Title})
		}
	}
	return out, nil
}

// ---- επιπλέον μηχανές (fallback) ----

var bingCookie = "SRCHHPGUSR=SRCHLANG=en&ADLT=OFF; _EDGE_CD=m=en-us&u=en-us; BCP=AD=1&AL=1&SM=1; MUIDB=1"

func searchBingAsync(ctx context.Context, q string) ([]imgHit, error) {
	page, err := getText(ctx, "https://www.bing.com/images/async?first=0&count=35&mmasync=1&mkt=en-US&setlang=en&cc=US&q="+url.QueryEscape(q),
		map[string]string{"Accept": "text/html", "Cookie": bingCookie, "Referer": "https://www.bing.com/images/search?q=" + url.QueryEscape(q)}, 4<<20)
	if err != nil {
		return nil, err
	}
	h := parseBing(page)
	if len(h) == 0 {
		h = genericThumbs(page)
	}
	if len(h) == 0 {
		return nil, errors.New("0 results (" + snippet(page) + ")")
	}
	return h, nil
}

func searchBingPage(ctx context.Context, q string) ([]imgHit, error) {
	page, err := getText(ctx, "https://www.bing.com/images/search?form=HDRSC2&first=1&mkt=en-US&setlang=en&cc=US&q="+url.QueryEscape(q),
		map[string]string{"Accept": "text/html", "Cookie": bingCookie}, 4<<20)
	if err != nil {
		return nil, err
	}
	h := parseBing(page)
	if len(h) == 0 {
		h = genericThumbs(page)
	}
	if len(h) == 0 {
		return nil, errors.New("0 results (" + snippet(page) + ")")
	}
	return h, nil
}

var braveUrlRe = regexp.MustCompile(`properties:\{url:"(https?:[^"]+)"`)

func searchBrave(ctx context.Context, q string) ([]imgHit, error) {
	page, err := getText(ctx, "https://search.brave.com/images?q="+url.QueryEscape(q), map[string]string{"Accept": "text/html"}, 4<<20)
	if err != nil {
		return nil, err
	}
	th := genericThumbs(page)
	full := braveUrlRe.FindAllStringSubmatch(page, 60)
	for i := range th {
		if i < len(full) {
			if u, e := strconv.Unquote(`"` + full[i][1] + `"`); e == nil {
				th[i].Image = u
			}
		}
	}
	if len(th) == 0 {
		return nil, errors.New("0 results (" + snippet(page) + ")")
	}
	return th, nil
}

func searchGoogle(ctx context.Context, q string) ([]imgHit, error) {
	page, err := getText(ctx, "https://www.google.com/search?tbm=isch&hl=en&gl=us&q="+url.QueryEscape(q),
		map[string]string{"Accept": "text/html", "Cookie": "CONSENT=YES+cb; SOCS=CAESEwgDEgk0ODE3Nzk3MjQaAmVuIAEaBgiA_LyaBg"}, 4<<20)
	if err != nil {
		return nil, err
	}
	h := genericThumbs(page)
	if len(h) == 0 {
		return nil, errors.New("0 results (" + snippet(page) + ")")
	}
	return h, nil
}

var thumbRe = regexp.MustCompile(`https://(?:tse\d\.mm\.bing\.net/th[^"'\s<>\\]*|th\.bing\.com/th[^"'\s<>\\]*|encrypted-tbn\d\.gstatic\.com/images\?q=tbn:[A-Za-z0-9_\-:]+|imgs\.search\.brave\.com/[A-Za-z0-9_\-/=.:]+)`)

// genericThumbs μαζεύει μικρογραφίες γνωστών CDN από οποιαδήποτε σελίδα αποτελεσμάτων.
func genericThumbs(page string) []imgHit {
	var out []imgHit
	seen := map[string]bool{}
	for _, m := range thumbRe.FindAllString(page, 80) {
		u := html.UnescapeString(strings.ReplaceAll(m, `\u0026`, "&"))
		if seen[u] || strings.Contains(u, "favicon") {
			continue
		}
		seen[u] = true
		out = append(out, imgHit{Image: u, Thumb: u})
	}
	return out
}

func snippet(s string) string {
	s = strings.Join(strings.Fields(s), " ")
	if len(s) > 80 {
		s = s[:80]
	}
	return s
}

func hImgSearch(w http.ResponseWriter, r *http.Request, u Doc) {
	q := strings.TrimSpace(r.URL.Query().Get("q"))
	if len(q) < 2 || len(q) > 200 {
		fail(w, 400, "Δώσε όνομα προϊόντος")
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), 18*time.Second)
	defer cancel()
	type eng struct {
		name string
		fn   func(context.Context, string) ([]imgHit, error)
	}
	engines := []eng{{"bing", searchBingPage}, {"bing2", searchBingAsync}, {"ddg", searchDDG}, {"brave", searchBrave}, {"google", searchGoogle}}
	type res struct {
		hits []imgHit
		err  error
		done bool
	}
	results := make([]res, len(engines))
	var wg sync.WaitGroup
	var rmu sync.Mutex
	got := make(chan struct{}, len(engines))
	for i, e := range engines {
		wg.Add(1)
		go func(i int, e eng) {
			defer wg.Done()
			h, err := e.fn(ctx, q)
			rmu.Lock()
			results[i] = res{h, err, true}
			rmu.Unlock()
			got <- struct{}{}
		}(i, e)
	}
	// Περιμένουμε με προτεραιότητα: παίρνουμε την πρώτη (κατά σειρά) μηχανή με αποτελέσματα.
	pick := func() ([]imgHit, bool) {
		rmu.Lock()
		defer rmu.Unlock()
		for _, x := range results {
			if !x.done {
				return nil, false
			}
			if len(x.hits) > 0 {
				return x.hits, true
			}
		}
		return nil, true
	}
	var hits []imgHit
	deadline := time.After(6 * time.Second)
wait:
	for n := 0; n < len(engines); {
		select {
		case <-got:
			n++
			if h, ok := pick(); ok {
				hits = h
				break wait
			}
		case <-deadline:
			// μετά από 6" δεχόμαστε όποια μηχανή έχει ήδη αποτελέσματα
			rmu.Lock()
			for _, x := range results {
				if len(x.hits) > 0 {
					hits = x.hits
					break
				}
			}
			rmu.Unlock()
			if hits != nil {
				break wait
			}
			deadline = nil
		case <-ctx.Done():
			break wait
		}
	}
	diag := map[string]string{}
	rmu.Lock()
	for i, x := range results {
		switch {
		case !x.done:
			diag[engines[i].name] = "pending"
		case x.err != nil:
			diag[engines[i].name] = x.err.Error()
		default:
			diag[engines[i].name] = strconv.Itoa(len(x.hits))
		}
	}
	rmu.Unlock()
	if len(hits) == 0 {
		log.Printf("imgsearch %q: %v", q, diag)
		writeJSON(w, 200, map[string]any{"results": []imgHit{}, "error": "Δεν βρέθηκαν φωτογραφίες", "diag": diag})
		return
	}
	seen := map[string]bool{}
	out := []imgHit{}
	for _, h := range hits {
		if seen[h.Image] {
			continue
		}
		seen[h.Image] = true
		out = append(out, h)
		if len(out) >= 15 {
			break
		}
	}
	writeJSON(w, 200, map[string]any{"results": out, "diag": diag})
}

func hImgFetch(w http.ResponseWriter, r *http.Request, u Doc) {
	raw := r.URL.Query().Get("url")
	pu, err := url.Parse(raw)
	if err != nil || (pu.Scheme != "http" && pu.Scheme != "https") || pu.Host == "" {
		fail(w, 400, "Μη έγκυρη διεύθυνση εικόνας")
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), 20*time.Second)
	defer cancel()
	req, _ := http.NewRequestWithContext(ctx, "GET", pu.String(), nil)
	req.Header.Set("User-Agent", browserUA)
	req.Header.Set("Accept", "image/avif,image/webp,image/png,image/jpeg,image/*;q=0.8")
	res, err := safeClient.Do(req)
	if err != nil {
		fail(w, 502, "Η εικόνα δεν κατέβηκε")
		return
	}
	defer res.Body.Close()
	ct := res.Header.Get("Content-Type")
	if res.StatusCode != 200 {
		fail(w, 502, "Η εικόνα δεν κατέβηκε")
		return
	}
	b, err := io.ReadAll(io.LimitReader(res.Body, 12<<20+1))
	if err != nil || len(b) > 12<<20 {
		fail(w, 502, "Η εικόνα είναι πολύ μεγάλη")
		return
	}
	if !strings.HasPrefix(ct, "image/") {
		ct = http.DetectContentType(b)
	}
	if !strings.HasPrefix(ct, "image/") || strings.Contains(ct, "svg") {
		fail(w, 502, "Η διεύθυνση δεν είναι εικόνα")
		return
	}
	w.Header().Set("Content-Type", ct)
	w.Header().Set("Cache-Control", "no-store")
	w.Write(b)
}

// Διαγνωστικό χωρίς σύνδεση: σταθερή αναζήτηση, αποτέλεσμα κρυφό για 2 λεπτά.
var diagMu sync.Mutex
var diagAt time.Time
var diagOut map[string]any

func hImgDiag(w http.ResponseWriter, r *http.Request) {
	diagMu.Lock()
	defer diagMu.Unlock()
	if diagOut != nil && time.Since(diagAt) < 2*time.Minute {
		writeJSON(w, 200, diagOut)
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), 20*time.Second)
	defer cancel()
	q := "Shure SM58 microphone"
	out := map[string]any{}
	type eng struct {
		name string
		fn   func(context.Context, string) ([]imgHit, error)
	}
	var wg sync.WaitGroup
	var m sync.Mutex
	for _, e := range []eng{{"bing", searchBingPage}, {"bing2", searchBingAsync}, {"ddg", searchDDG}, {"brave", searchBrave}, {"google", searchGoogle}} {
		wg.Add(1)
		go func(e eng) {
			defer wg.Done()
			t := time.Now()
			h, err := e.fn(ctx, q)
			s := fmt.Sprintf("%d hits", len(h))
			if err != nil {
				s = "ERR " + err.Error()
			}
			if len(h) > 0 {
				s += " " + h[0].Thumb
			}
			m.Lock()
			out[e.name] = fmt.Sprintf("%s (%dms)", s, time.Since(t).Milliseconds())
			m.Unlock()
		}(e)
	}
	probes := map[string]string{
		"p_cnbing":    "https://cn.bing.com/images/async?first=0&count=35&mmasync=1&q=" + url.QueryEscape(q),
		"p_cnbing2":   "https://cn.bing.com/images/search?q=" + url.QueryEscape(q),
		"p_yahoo":     "https://images.search.yahoo.com/search/images?p=" + url.QueryEscape(q),
		"p_yandex":    "https://yandex.com/images/search?text=" + url.QueryEscape(q),
		"p_baidu":     "https://image.baidu.com/search/acjson?tn=resultjson_com&ipn=rj&word=" + url.QueryEscape(q) + "&queryWord=" + url.QueryEscape(q) + "&pn=0&rn=30",
		"p_thomann":   "https://www.thomann.de/intl/search_dir.html?sw=" + url.QueryEscape("Shure SM58"),
		"p_bax":       "https://www.bax-shop.co.uk/search?keyword=" + url.QueryEscape("Shure SM58"),
		"p_musicst":   "https://www.musicstore.com/en_GB/GBP/search?SearchTerm=" + url.QueryEscape("Shure SM58"),
		"p_openverse": "https://api.openverse.org/v1/images/?q=" + url.QueryEscape(q),
		"p_commons":   "https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=search&gsrnamespace=6&gsrlimit=10&prop=imageinfo&iiprop=url&gsrsearch=" + url.QueryEscape(q),
		"p_startpage": "https://www.startpage.com/sp/search?cat=images&query=" + url.QueryEscape(q),
		"p_mojeek":    "https://www.mojeek.com/search?fmt=images&q=" + url.QueryEscape(q),
		"p_seznam":    "https://obrazky.seznam.cz/?q=" + url.QueryEscape(q),
		"p_sogou":     "https://pic.sogou.com/napi/pc/searchList?mode=1&start=0&xml_len=48&query=" + url.QueryEscape(q),
		"p_ddghtml":   "https://html.duckduckgo.com/html/?q=" + url.QueryEscape(q),
	}
	imgRe := regexp.MustCompile(`https?:[^"'\s<>]+?\.(?:jpe?g|png|webp)`)
	for k, u := range probes {
		wg.Add(1)
		go func(k, u string) {
			defer wg.Done()
			t := time.Now()
			page, err := getText(ctx, u, map[string]string{"Accept": "text/html,application/json"}, 4<<20)
			s := ""
			if err != nil {
				s = "ERR " + err.Error()
			} else {
				ims := imgRe.FindAllString(page, 400)
				ex := ""
				if len(ims) > 3 {
					ex = ims[3]
				}
				s = fmt.Sprintf("len=%d murl=%d thumbs=%d imgs=%d ex=%s | %s", len(page), strings.Count(page, "murl"), len(genericThumbs(page)), len(ims), ex, snippet(page))
			}
			m.Lock()
			out[k] = fmt.Sprintf("%s (%dms)", s, time.Since(t).Milliseconds())
			m.Unlock()
		}(k, u)
	}
	wg.Wait()
	diagOut, diagAt = out, time.Now()
	writeJSON(w, 200, out)
}

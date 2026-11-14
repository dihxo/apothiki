package main

// Αυτόματη αναζήτηση φωτογραφιών προϊόντων (Bing / DuckDuckGo, χωρίς κλειδί)
// και ασφαλής λήψη εικόνας από τον server (αποφυγή CORS στον browser).

import (
	"context"
	"encoding/json"
	"errors"
	"html"
	"io"
	"log"
	"net"
	"net/http"
	"net/url"
	"regexp"
	"strings"
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

func hImgSearch(w http.ResponseWriter, r *http.Request, u Doc) {
	q := strings.TrimSpace(r.URL.Query().Get("q"))
	if len(q) < 2 || len(q) > 200 {
		fail(w, 400, "Δώσε όνομα προϊόντος")
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), 20*time.Second)
	defer cancel()
	hits, err := searchBing(ctx, q)
	if len(hits) == 0 {
		var err2 error
		hits, err2 = searchDDG(ctx, q)
		if err2 != nil && err == nil {
			err = err2
		}
	}
	if len(hits) == 0 {
		msg := "Δεν βρέθηκαν φωτογραφίες"
		if err != nil {
			log.Printf("imgsearch %q: %v", q, err)
		}
		writeJSON(w, 200, map[string]any{"results": []imgHit{}, "error": msg})
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
		if len(out) >= 10 {
			break
		}
	}
	writeJSON(w, 200, map[string]any{"results": out})
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
	if res.StatusCode != 200 || !strings.HasPrefix(ct, "image/") || strings.Contains(ct, "svg") {
		fail(w, 502, "Η διεύθυνση δεν είναι εικόνα")
		return
	}
	b, err := io.ReadAll(io.LimitReader(res.Body, 12<<20+1))
	if err != nil || len(b) > 12<<20 {
		fail(w, 502, "Η εικόνα είναι πολύ μεγάλη")
		return
	}
	w.Header().Set("Content-Type", ct)
	w.Header().Set("Cache-Control", "no-store")
	w.Write(b)
}

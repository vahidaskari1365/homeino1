#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
HOMEINO — گردآور روزانه اطلاعات بازاریابی (recon-daily)
بر پایهٔ مسیرهای Agent-Reach (فلسفه: چند-بک‌اند + fallback، همهٔ بک‌ندها رایگان):

  جستجوی معنایی:  Exa MCP — HTTP خام (بی‌کلید، بدون وابستگی)
                  →  fallback: mcporter CLI  →  fallback: DuckDuckGo HTML
  صفحه‌خوانی:     دریافت مستقیم با UA مرورگر           →  fallback: Jina Reader (r.jina.ai)
  فید:            RSS/Atom با xml.etree (استاندارد پایتون — بدون pip install)
  موضوعات بروز:   فرش، روشنایی، مبل، وسایل خانه — تغذیهٔ مجله/ترند
  پینترست:        کشف پین با Exa site:pinterest.com → استخراج og:image (i.pinimg.com)
                  → افزودن مستقیم به استخر الهام (scripts/inspiration-pool.json)
  اینستاگرام:     کشف اینفلوئنسر با Exa (site:instagram.com)؛ خواندن عمیق پروفایل
                  نیازمند OpenCLI/دسکتاپ است (فاز B) — اینجا فقط best-effort

خروجی:  recon/YYYY-MM-DD.md  (گزارش فارسی)
        recon/pinterest.json (برداشت‌های پینترست)
        recon/latest.json    (مهر زمانی + شمارش بخش‌ها — ورودی واچ‌داگ)
اجرا:   python3 scripts/recon/recon_daily.py            (چرخهٔ کامل)
        python3 scripts/recon/recon_daily.py --quick    (تست سریع)
"""

import json
import os
import re
import subprocess
import sys
import time
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timezone

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT_DIR = os.path.join(ROOT, "recon")
QUICK = "--quick" in sys.argv

UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/124.0 Safari/537.36")
EXA_TIMEOUT_S = 75
FETCH_TIMEOUT_S = 30

# ---------------------------------------------------------------- پیکربندی ---
# کلمه‌های کلیدی کارخانهٔ ایده و ترند (فاز A) — هر جا خواستید، اضافه/کم کنید
TREND_QUERIES = [
    ("fa", "ترند دکوراسیون داخلی 2026"),
    ("fa", "ایده دکوراسیون منزل مدرن مبل و رنگ"),
    ("en", "home decor trends 2026"),
    ("en", "interior design color trends 2026 living room"),
]

# مطالب و مدل‌های بروز (فرش/روشنایی/وسایل خانه) — تغذیهٔ مجله و ترند (فاز A)
TOPIC_QUERIES = [
    ("فرش", "rug trends 2026 modern living room"),
    ("فرش ایرانی", "persian rug modern interior styling"),
    ("روشنایی", "lighting trends 2026 interior lamp chandelier"),
    ("مبل و وسایل", "sofa furniture trends 2026"),
    ("وسایل خانه", "home decor accessories trends 2026"),
]

# برداشت پینترست → استخر الهام (مطابق ماتریس سبک×فضای inspiration-daily)
STYLE_EN = {
    "modern": "modern interior design living",
    "minimal": "minimalist interior clean lines",
    "scandinavian": "scandinavian interior bright cozy",
    "japandi": "japandi interior warm wood zen",
    "classic": "classic elegant interior ornate",
    "neoclassic": "neoclassical interior modern elegance",
    "industrial": "industrial interior brick metal loft",
    "boho": "bohemian interior colorful textiles plants",
    "rustic": "rustic interior wood beams stone fireplace",
    "mediterranean": "mediterranean interior white blue arches",
    "contemporary": "contemporary interior design sleek",
    "art-deco": "art deco interior glam gold velvet",
}
SPACE_EN = {
    "پذیرایی": "living room",
    "اتاق خواب": "bedroom",
    "فضای کار": "home office workspace",
    "ناهارخوری": "dining room",
    "بیرونی": "outdoor patio balcony",
}
PINTEREST_TOPICS = [
    "rug carpet", "lighting lamp", "sofa furniture", "decor accessories", "curtains textile",
    "coffee table styling", "bedroom headboard", "kitchen backsplash", "bathroom vanity",
    "wall art gallery", "indoor plants corner", "bookshelf styling", "mirror decor",
    "dining table centerpiece", "entryway console", "ceiling design", "floor tile pattern",
]
POOL_FILE = os.path.join(ROOT, "scripts/inspiration-pool.json")
GEN_FILE = os.path.join(ROOT, "src/data/inspirations.generated.json")
PINIMG_OK = re.compile(r"^https://i\.pinimg\.com/[0-9a-zA-Z]+x?/[0-9a-zA-Z/]+\.(jpg|png|jpeg|webp)$", re.I)
OG_RE = [
    re.compile(r'<meta[^>]+property="og:image"[^>]+content="([^"]+)"', re.I),
    re.compile(r'<meta[^>]+content="([^"]+)"[^>]+property="og:image"', re.I),
    re.compile(r'<meta[^>]+name="twitter:image(?::src)?"[^>]+content="([^"]+)"', re.I),
]

# فیدهای دکوراسیون معتبر (بدون بلاک، بدون کلید)
FEEDS = [
    ("Dezeen", "https://www.dezeen.com/feed/"),
    ("Designboom", "https://www.designboom.com/feed/"),
]

# جاسوسی از رقبا (فاز A/B): بذرهای دستی + کشف پویا با Exa
COMPETITOR_SEEDS = ["berssini.com", "emersun.com"]
COMPETITOR_QUERIES = [
    "فروشگاه اینترنتی مبلمان و دکوراسیون منزل ایران",
    "خرید آنلاین مبل فرش دکوراسیون",
]

# اثبات اجتماعی واقعی: رصد منشن‌های هومینو
MENTION_QUERIES = [
    "هایومینو",
    "homeino",
    "homeino.ir",
    "site:instagram.com homeino",
]

# کشف اینفلوئنسر (فاز C): دکوراتورهای ایرانی در اینستاگرام
INFLUENCER_QUERIES = [
    "دکوراسیون داخلی منزل site:instagram.com",
    "دکوراتور ایرانی site:instagram.com",
    "طراحی داخلی و بازسازی خانه site:instagram.com",
]

# خواندن عمیق پروفایل (فقط وقتی روی دسکتاپ OpenCLI راه افتاد فعال می‌شود)
IG_HANDLES = []  # مثال: ["homeino.ir"]

IG_RESERVED = {"p", "reel", "explore", "accounts", "tv", "stories", "about",
               "legal", "developer", "directory", "web", "graphql", "checkout"}


# ---------------------------------------------------------------- ابزار پایه ---
def log(msg: str) -> None:
    print(f"[recon {datetime.now(timezone.utc).strftime('%H:%M:%S')}] {msg}", flush=True)


def http_get(url: str, timeout: int = FETCH_TIMEOUT_S, max_bytes: int = 400_000):
    req = urllib.request.Request(url, headers={
        "User-Agent": UA,
        "Accept": "text/html,application/xhtml+xml,application/xml,application/rss+xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "fa,en;q=0.8",
    })
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return resp.status, resp.read(max_bytes).decode("utf-8", errors="replace")


def fetch_page(url: str):
    """چند-مسیری: مستقیم → Jina. خروجی: {ok, route, text}"""
    try:
        status, text = http_get(url)
        if status < 400 and len(text.strip()) > 200:
            return {"ok": True, "route": "direct", "text": text}
    except Exception:
        pass
    try:
        status, text = http_get("https://r.jina.ai/" + url, timeout=45)
        if status < 400 and len(text.strip()) > 200:
            return {"ok": True, "route": "jina", "text": text}
    except Exception:
        pass
    return {"ok": False, "route": "none", "text": ""}


def strip_html(html: str, limit: int = 300) -> str:
    txt = re.sub(r"<(script|style)[^>]*>.*?</\1>", " ", html, flags=re.S | re.I)
    txt = re.sub(r"<[^>]+>", " ", txt)
    txt = re.sub(r"\s+", " ", txt).strip()
    return txt[:limit]


def clean(s: str, limit: int = 220) -> str:
    return re.sub(r"\s+", " ", (s or "")).strip()[:limit] or "—"


# ---------------------------------------------------------------- جستجوها ---
EXA_MCP = "https://mcp.exa.ai/mcp"
_exa_sid = {"v": None}
_exa_ready = None  # وضعیت fallback مربوط به mcporter (سه‌حالته)


def _sse_data(text: str) -> dict:
    """از پاسخ SSE (event/data)، آخرین بلوک data معتبر را JSON برگردان"""
    for line in reversed(text.splitlines()):
        if line.startswith("data: "):
            try:
                return json.loads(line[6:])
            except Exception:
                continue
    return {}


def _exa_post(body: dict, sid: str = "", timeout: int = 60):
    headers = {"Content-Type": "application/json",
               "Accept": "application/json, text/event-stream", "User-Agent": UA}
    if sid:
        headers["Mcp-Session-Id"] = sid
    req = urllib.request.Request(EXA_MCP, data=json.dumps(body).encode("utf-8"),
                                 headers=headers, method="POST")
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return resp.status, {k.lower(): v for k, v in resp.headers.items()}, \
            resp.read(2_000_000).decode("utf-8", "replace")


def _exa_call(query: str, num: int) -> str:
    """tools/call روی MCP HTTP خام → متن بلوک‌های Title/URL/Highlights"""
    sid = _exa_sid["v"]
    if not sid:
        body = {"jsonrpc": "2.0", "id": 1, "method": "initialize",
                "params": {"protocolVersion": "2024-11-05", "capabilities": {},
                           "clientInfo": {"name": "homeino-recon", "version": "1.0"}}}
        _, headers, _ = _exa_post(body, timeout=30)
        sid = headers.get("mcp-session-id", "")
        if not sid:
            raise RuntimeError("exa: no session id")
        _exa_post({"jsonrpc": "2.0", "method": "notifications/initialized"}, sid, timeout=20)
        _exa_sid["v"] = sid
    call = {"jsonrpc": "2.0", "id": 2, "method": "tools/call",
            "params": {"name": "web_search_exa",
                       "arguments": {"query": query, "numResults": int(num)}}}
    _, _, text = _exa_post(call, sid, timeout=90)
    data = _sse_data(text)
    if data.get("error"):
        raise RuntimeError(str(data["error"])[:100])
    blobs = [c.get("text", "") for c in (data.get("result", {}).get("content") or [])
             if isinstance(c, dict)]
    return "\n".join(blobs)


def _exa_mcporter(query: str, num: int) -> str:
    """fallback دوم: Exa از طریق mcporter CLI (اگر نصب/قابل‌تنظیم باشد)"""
    global _exa_ready
    if _exa_ready is False:
        return ""
    try:
        probe = subprocess.run(["mcporter", "list", "exa"], capture_output=True, text=True, timeout=30)
        _exa_ready = probe.returncode == 0
        if not _exa_ready:
            subprocess.run(["mcporter", "config", "add", "exa", "https://mcp.exa.ai/mcp", "--scope", "home"],
                           capture_output=True, text=True, timeout=30)
            _exa_ready = subprocess.run(["mcporter", "list", "exa"], capture_output=True, text=True,
                                        timeout=60).returncode == 0
        if not _exa_ready:
            log(f"  ⚠ mcporter: exa آماده نیست ({probe.stderr.strip()[:60] or 'unknown'})")
            return ""
        r = subprocess.run(
            ["mcporter", "call", "exa.web_search_exa", "--output", "json", "--args",
             json.dumps({"query": query, "numResults": str(num)})],
            capture_output=True, text=True, timeout=EXA_TIMEOUT_S)
        data = json.loads(r.stdout or "{}")
        blobs = [c.get("text", "") for c in data.get("content", []) if isinstance(c, dict)]
        return "\n".join(blobs)
    except Exception as e:
        log(f"  ⚠ mcporter fail: {type(e).__name__}: {str(e)[:80]}")
        return ""


def exa_search(query: str, num: int = 5):
    """Exa → لیست {title,url,published,highlight}؛ HTTP خام → mcporter → None"""
    text = ""
    for attempt in (1, 2):
        try:
            text = _exa_call(query, num)
            break
        except Exception as e:
            if attempt == 1:
                _exa_sid["v"] = None  # احتمالاً نشست منقضی شده — از نو
                log(f"  ↻ exa retry ({type(e).__name__}: {str(e)[:60]})")
            else:
                log(f"  ⚠ exa-http fail: {type(e).__name__}: {str(e)[:80]}")
    if not text:
        text = _exa_mcporter(query, num)
    if not text:
        return None
    entries = []
    for block in re.split(r"\n(?=Title: )", text):
        m_t = re.search(r"Title: (.+)", block)
        m_u = re.search(r"URL: (\S+)", block)
        if not (m_t and m_u):
            continue
        m_p = re.search(r"Published: (\S+)", block)
        m_h = re.search(r"Highlights:\s*(.+)", block, re.S)
        entries.append({
            "title": clean(m_t.group(1), 140),
            "url": m_u.group(1).strip(),
            "published": (m_p.group(1) if m_p else "")[:10],
            "highlight": clean(m_h.group(1), 240) if m_h else "",
        })
    return entries or None


def ddg_search(query: str, num: int = 5):
    """fallback سبک: DuckDuckGo HTML lite → [{title,url}]"""
    try:
        q = urllib.parse.quote_plus(query)
        _, html = http_get(f"https://html.duckduckgo.com/html/?q={q}", timeout=30)
        out = []
        for m in re.finditer(r'class="result__a"[^>]*href="([^"]+)"[^>]*>(.*?)</a>', html, re.S):
            href, title = m.group(1), re.sub(r"<[^>]+>", "", m.group(2))
            if "uddg=" in href:
                href = urllib.parse.unquote(href.split("uddg=")[1].split("&")[0])
            if href.startswith("http"):
                out.append({"title": clean(title, 140), "url": href,
                            "published": "", "highlight": ""})
            if len(out) >= num:
                break
        return out or None
    except Exception:
        return None


def search(query: str, num: int = 5):
    res = exa_search(query, num)
    route = "exa"
    if not res:
        res, route = ddg_search(query, num), "ddg"
    log(f"  {'✓' if res else '✗'} [{route}] {query[:60]} → {len(res or [])}")
    return (res or []), route


# ---------------------------------------------------------------- ماژول‌ها ---
def module_trends():
    items, routes = [], set()
    for lang, q in (TREND_QUERIES[:2] if QUICK else TREND_QUERIES):
        found, route = search(q, 5)
        routes.add(route)
        for it in found:
            it["lang"] = lang
            items.append(it)
    return items, routes


def module_topics():
    """مدل‌ها و مطالب بروز فرش/روشنایی/وسایل — تغذیهٔ مجله و ترند"""
    items = []
    for topic_fa, q in (TOPIC_QUERIES[:2] if QUICK else TOPIC_QUERIES):
        found, _ = search(q, 5)
        for it in found:
            it["topic"] = topic_fa
            items.append(it)
    return items


def _og_image(html: str):
    for rx in OG_RE:
        m = rx.search(html)
        if m:
            return m.group(1).replace("&amp;", "&")
    return None


def _pool_seen():
    seen = set()
    for path in (POOL_FILE, GEN_FILE):
        try:
            doc = json.load(open(path, encoding="utf-8"))
            items = doc.get("pool", doc) if isinstance(doc, dict) else doc
            for v in (items.values() if isinstance(items, dict) else items):
                if isinstance(v, dict):
                    for vv in v.values():
                        if isinstance(vv, list):
                            seen.update(p.get("url", "") for p in vv if isinstance(p, dict))
                elif isinstance(v, list):
                    seen.update(p.get("image", p.get("url", "")) for p in v if isinstance(p, dict))
        except Exception:
            pass
    return seen


def _pin_id(url: str):
    path = urllib.parse.urlparse(url).path
    m = re.search(r"--(\d{8,})/?$", path) or re.search(r"/pin/(\d{8,})(?:/|$)", path)
    return m.group(1) if m else None


def _pidgets(pin_ids):
    """API عمومی ویجت پینترست → {id: {image, desc, saves}} — بدون لاگین، از هر IP"""
    out = {}
    ids = [p for p in pin_ids if p]
    for chunk in [ids[i:i + 10] for i in range(0, len(ids), 10)]:
        try:
            _, txt = http_get("https://widgets.pinterest.com/v3/pidgets/pins/info/?pin_ids=" + ",".join(chunk), timeout=25)
            for p in (json.loads(txt).get("data") or []):
                imgs = p.get("images") or {}
                best = imgs.get("orig") or imgs.get("736x") or imgs.get("564x") \
                    or (max(imgs.values(), key=lambda v: v.get("width", 0)) if imgs else None)
                out[str(p.get("id"))] = {
                    "image": (best or {}).get("url", ""),
                    "desc": clean(strip_html(p.get("description") or ""), 240),
                    "saves": int(((p.get("aggregated_pin_data") or {}).get("aggregated_stats") or {}).get("saves", 0) or 0),
                }
        except Exception as e:
            log(f"  ⚠ pidgets: {type(e).__name__}")
    return out


def module_pinterest():
    """برداشت پینترست: Exa پین را پیدا می‌کند، pidgets تصویر/توضیح را می‌دهد → استخر الهام"""
    combos = [(s, sp) for s in STYLE_EN for sp in SPACE_EN]
    day_no = int(datetime.now(timezone.utc).strftime("%j"))
    n_topics = 1 if QUICK else 3
    n_combos = 2 if QUICK else 4
    topic_plan = [PINTEREST_TOPICS[(day_no + i) % len(PINTEREST_TOPICS)] for i in range(n_topics)]
    plan = []
    for ti, topic in enumerate(topic_plan):
        for ci in range(n_combos):
            style, space = combos[(day_no * 7 + ti * 4 + ci * 3) % len(combos)]
            plan.append((style, space, topic))
    seen = _pool_seen()
    items, added, ids_todo = [], [], {}
    for style, space, topic in plan:
        q = f"{STYLE_EN[style]} {SPACE_EN[space]} {topic} site:pinterest.com"
        found, _ = search(q, 4)
        for it in found:
            pid = _pin_id(it["url"])
            if pid:
                ids_todo[pid] = {"pin": it["url"], "title": it["title"],
                                 "style": style, "space": space, "topic": topic}
    info = _pidgets(list(ids_todo.keys()))
    for pid, base in ids_todo.items():
        meta = info.get(pid, {})
        img = meta.get("image", "")
        entry = {"pin": base["pin"], "image": img, "title": base["title"],
                 "desc": meta.get("desc") or "", "style": base["style"],
                 "space": base["space"], "topic": base["topic"], "saves": meta.get("saves", 0)}
        items.append(entry)
        if img and PINIMG_OK.match(img) and img not in seen:
            seen.add(img)
            added.append(entry)
    # افزودن به استخر الهام (سقف ۲۴ در هر اجرا)
    if added and not QUICK:
        try:
            pool_doc = json.load(open(POOL_FILE, encoding="utf-8"))
            for e in added[:24]:
                pool_doc.setdefault("pool", {}).setdefault(e["style"], {}).setdefault(e["space"], []).append(
                    {"url": e["image"], "source": "Pinterest"})
            json.dump(pool_doc, open(POOL_FILE, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
            log(f"  ✓ {min(len(added), 24)} عکس پینترست → استخر الهام")
        except Exception as e:
            log(f"  ⚠ افزودن به استخر ناموفق: {type(e).__name__}")
    return {"items": items, "added_to_pool": min(len(added), 24) if not QUICK else 0,
            "generated_at": datetime.now(timezone.utc).isoformat()}


def module_feeds():
    items = []
    for name, url in FEEDS:
        try:
            _, xml_text = http_get(url, timeout=25, max_bytes=2_000_000)
            parsed = parse_rss(xml_text)
            for it in parsed[: (2 if QUICK else 5)]:
                it["title"] = f"{name} — {it['title']}"
                items.append(it)
            log(f"  ✓ RSS {name}: {min(len(parsed), 5)} آیتم")
        except Exception as e:
            log(f"  ⚠ RSS {name}: {type(e).__name__}")
    return items


def module_competitors():
    found = {}
    for seed in COMPETITOR_SEEDS:
        found[seed] = {"url": f"https://{seed}", "source": "seed"}
    for q in ([] if QUICK else COMPETITOR_QUERIES):
        for it in search(q, 6):
            try:
                dom = urllib.parse.urlparse(it["url"]).netloc.replace("www.", "")
            except Exception:
                continue
            bad = ("wiki", "youtube", "instagram", "digikala", "namnak", "blogspot",
                   "pinterest", "aparat", "telegram", "linkedin")
            if dom.endswith(".ir") and dom not in found and not any(b in dom for b in bad):
                found[dom] = {"url": f"https://{dom}", "source": "exa-discovery"}
    snaps = []
    for dom, meta in list(found.items())[: (3 if QUICK else 8)]:
        page = fetch_page(f"https://{dom}")
        info = {"domain": dom, "url": meta["url"], "source": meta["source"],
                "route": page["route"], **extract_page_info(page["text"])}
        snaps.append(info)
        log(f"  {'✓' if page['ok'] else '✗'} رقیب {dom} ({page['route']}) — {info['title'][:50]}")
        time.sleep(1)
    return snaps


def module_mentions():
    items, routes = [], set()
    for q in ([] if QUICK else MENTION_QUERIES):
        found, route = search(q, 5)
        routes.add(route)
        for it in found:
            it["query"] = q
            items.append(it)
    return items, routes


def module_influencers():
    handles, items = {}, []
    for q in ([] if QUICK else INFLUENCER_QUERIES):
        found, _ = search(q, 8)
        for it in found:
            items.append(it)
            m = re.search(r"instagram\.com/([A-Za-z0-9_.]{2,30})/?", it["url"])
            if m and m.group(1).lower() not in IG_RESERVED:
                h = m.group(1).lower()
                handles[h] = handles.get(h, 0) + 1
    ranked = sorted(handles.items(), key=lambda x: -x[1])
    return items, [h for h, _ in ranked[:20]]


# ---------------------------------------------------------------- پارس صفحه/فید ---
def extract_page_info(html: str):
    info = {"title": "—", "description": "", "headings": []}
    if not html:
        return info
    m = re.search(r"<title[^>]*>(.*?)</title>", html, re.S | re.I)
    if m:
        info["title"] = clean(strip_html(m.group(1)), 120)
    m = re.search(r'<meta[^>]+name=["\']description["\'][^>]+content=["\'](.*?)["\']', html, re.S | re.I)
    if not m:
        m = re.search(r'<meta[^>]+content=["\'](.*?)["\'][^>]+name=["\']description["\']', html, re.S | re.I)
    if m:
        info["description"] = clean(strip_html(m.group(1)), 240)
    for hm in list(re.finditer(r"<h[23][^>]*>(.*?)</h[23]>", html, re.S | re.I))[:8]:
        h = clean(strip_html(hm.group(1)), 80)
        if len(h) > 3:
            info["headings"].append(h)
    return info


def parse_rss(xml_text: str):
    """RSS 2.0 + Atom با استاندارد پایتون"""
    out = []
    cleaned = re.sub(r"&(?!(amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);)", "&amp;", xml_text).lstrip("﻿ \t\r\n")
    try:
        root = ET.fromstring(cleaned)
    except ET.ParseError:
        try:
            # بعضی فیدها پیشوند فضای‌نام/کاراکترهای ناخواسته دارند — با ریختن تگ‌های چسبیده تلاش کن
            root = ET.fromstring(re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f]", "", cleaned))
        except ET.ParseError:
            return out
    ns = {"atom": "http://www.w3.org/2005/Atom"}
    for it in root.iter("item"):
        t = it.findtext("title", "").strip()
        l = it.findtext("link", "").strip()
        d = it.findtext("pubDate", "") or it.findtext("{http://purl.org/dc/elements/1.1/}date", "")
        s = it.findtext("description", "")
        if t and l:
            out.append({"title": clean(t, 140), "url": l, "published": clean(d, 16),
                        "highlight": clean(strip_html(s), 200)})
    for e in root.findall("atom:entry", ns):
        t = e.findtext("atom:title", "", ns).strip()
        link_el = e.find("atom:link", ns)
        l = link_el.get("href", "") if link_el is not None else ""
        d = e.findtext("atom:updated", "", ns)
        s = e.findtext("atom:summary", "", ns)
        if t and l:
            out.append({"title": clean(t, 140), "url": l, "published": clean(d, 10),
                        "highlight": clean(strip_html(s), 200)})
    return out


# ---------------------------------------------------------------- گزارش ---
def render_md(data: dict) -> str:
    today = data["generated_at"][:10]
    L = [f"# گزارش اطلاعات بازاریابی هومینو — {today}", "",
         f"تولید خودکار با مسیرهای Agent-Reach (Exa/RSS/صفحه‌خوانی چند-مسیری) در "
         f"`{data['generated_at']}` UTC • مدت اجرا: {data['duration_s']} ثانیه • "
         f"وضعیت: `{data['status']}`", ""]
    sec = data["sections"]

    L += ["## ① ترندهای دکوراسیون (فاز A — کارخانهٔ ایده)", ""]
    L += ["| عنوان | زبان | تاریخ | نکته |", "|---|---|---|---|"]
    for it in sec["trends"][:18]:
        L.append(f"| [{it['title']}]({it['url']}) | {it.get('lang','')} | {it['published'] or '—'} | {it['highlight'][:120]} |")

    L += ["", "## ② مدل‌ها و مطالب بروز (فرش/روشنایی/وسایل — مجله و ترند)", ""]
    L += ["| موضوع | عنوان | تاریخ | نکته |", "|---|---|---|---|"]
    for it in sec["topics"][:16]:
        L.append(f"| {it.get('topic','')} | [{it['title']}]({it['url']}) | {it['published'] or '—'} | {it['highlight'][:110]} |")

    pin = sec["pinterest"]
    L += ["", f"## ③ برداشت پینترست → استخر الهام ({pin['added_to_pool']} عکس تازه)", ""]
    L += ["| موضوع | عنوان پین | تصویر |", "|---|---|---|"]
    for it in pin["items"][:12]:
        img = f"[عکس]({it['image']})" if it["image"] else "—"
        L.append(f"| {it['style']}×{it['space']} {it['topic']} | [{it['title'][:70]}]({it['pin']}) | {img} |")

    L += ["", "## ④ تازه‌های فیدهای دکوراسیون", ""]
    L += ["| عنوان | تاریخ | خلاصه |", "|---|---|---|"]
    for it in sec["feeds"][:14]:
        L.append(f"| [{it['title']}]({it['url']}) | {it['published'] or '—'} | {it['highlight'][:120]} |")

    L += ["", "## ⑤ رقبای ایرانی (فاز A/B)", ""]
    L += ["| دامنه | منبع کشف | مسیر | توضیح متا |", "|---|---|---|---|"]
    for c in sec["competitors"]:
        L.append(f"| [{c['domain']}]({c['url']}) | {c['source']} | {c['route']} | {c['description'][:120] or c['title']} |")

    L += ["", "## ⑥ منشن‌های هومینو (اثبات اجتماعی)", ""]
    if sec["mentions"]:
        L += ["| عبارت | نتیجه |", "|---|---|"]
        for it in sec["mentions"][:12]:
            L.append(f"| `{it['query']}` | [{it['title']}]({it['url']}) |")
        hits = [it for it in sec["mentions"] if "homeino" in it["url"].lower() or "هومینو" in it["title"]]
        tail = "؛ ".join(f"[{it['title']}]({it['url']})" for it in hits[:5]) if hits else ""
        L += ["", f"**برخورد مستقیم: {len(hits)}**" + (f" — {tail}" if tail else "")]
    else:
        L += ["امروز کوئری منشن اجرا نشد (حالت quick)."]

    L += ["", "## ⑦ اینفلوئنسرهای بالقوه (فاز C)", ""]
    if sec["influencer_handles"]:
        L += ["هندل‌های کشف‌شده از نتایج اینستاگرام (به‌ترتیب تکرار):", ""]
        L += [" | ".join(f"`{h}`" for h in sec["influencer_handles"])]
    else:
        L += ["امروز هندلی کشف نشد."]
    L += ["", f"نتایج خام اینستاگرام: {len(sec['influencer_items'])} مورد", ""]
    L += ["| نتیجه |", "|---|"]
    for it in sec["influencer_items"][:10]:
        L.append(f"| [{it['title']}]({it['url']}) |")

    L += ["", "## ⑧ پوشش و محدودیت‌ها", "",
          "- **اینستاگرام عمیق** (پست‌های اخیر رقبا، تعامل، دایرکت): نیازمند OpenCLI روی دسکتاپ با اکانت اختصاصی — فاز B. جریان فعلی فقط کشف سطح‌بالا با Exa است.",
          "- **پینترست**: کشف پین با Exa (site:pinterest.com) + تصویر/توضیح از API عمومی pidgets؛ i.pinimg.com در وایت‌لیست next/image است و هات‌لینکش تست شده.",
          "- فهرست کوئری‌ها/فیدها/رقبا/موضوعات: بالای فایل `scripts/recon/recon_daily.py` — قابل ویرایش.", ""]
    return "\n".join(L)


# ---------------------------------------------------------------- main ---
def main():
    t0 = time.time()
    os.makedirs(OUT_DIR, exist_ok=True)
    log("شروع گردآوری اطلاعات بازاریابی هومینو…")
    data = {"generated_at": datetime.now(timezone.utc).isoformat(),
            "status": "ok", "sections": {}, "routes": {}}

    try:
        trends, r = module_trends()
        data["routes"]["trends"] = sorted(r)
        data["sections"]["trends"] = trends
        data["sections"]["topics"] = module_topics()
        data["sections"]["pinterest"] = module_pinterest()
        data["sections"]["feeds"] = module_feeds()
        data["sections"]["competitors"] = module_competitors()
        mentions, r = module_mentions()
        data["routes"]["mentions"] = sorted(r)
        data["sections"]["mentions"] = mentions
        inf_items, handles = module_influencers()
        data["sections"]["influencer_items"] = inf_items
        data["sections"]["influencer_handles"] = handles
        # برداشت پینترست را جداگانه هم ذخیره کن (سابقه و عیب‌یابی)
        with open(os.path.join(OUT_DIR, "pinterest.json"), "w", encoding="utf-8") as f:
            json.dump(data["sections"]["pinterest"], f, ensure_ascii=False, indent=1)
    except Exception as e:
        data["status"] = "partial"
        log(f"⚠ خطای کلی ماژول: {type(e).__name__}: {str(e)[:120]}")

    data["duration_s"] = round(time.time() - t0, 1)

    md = render_md(data)
    today = data["generated_at"][:10]
    md_path = os.path.join(OUT_DIR, f"{today}.md")
    with open(md_path, "w", encoding="utf-8") as f:
        f.write(md)
    slim = {k: v for k, v in data.items() if k != "sections"}
    slim["sections"] = {}
    for k, v in data["sections"].items():
        if k == "pinterest":
            slim["sections"][k] = {"items": len(v.get("items", [])),
                                   "added_to_pool": v.get("added_to_pool", 0)}
        else:
            slim["sections"][k] = len(v)
    slim["generated_at_epoch"] = int(time.time())
    with open(os.path.join(OUT_DIR, "latest.json"), "w", encoding="utf-8") as f:
        json.dump(slim, f, ensure_ascii=False, indent=1)

    log(f"گزارش: {md_path} ({len(md)} کاراکتر) — وضعیت {data['status']} در {data['duration_s']}s")
    print(json.dumps(slim["sections"], ensure_ascii=False))


if __name__ == "__main__":
    main()

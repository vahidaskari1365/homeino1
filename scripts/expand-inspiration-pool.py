#!/usr/bin/env python3
# ============================================================
# HOMEINO — شارژ استخر عکس ایجنت الهام
# برای هر ترکیب سبک×فضا (12×5=60) کوئری متنوع جستجو می‌کند،
# تکراری‌ها را حذف می‌کند و استخر را تا ~۱۰ عکس تازه در هر ترکیب پر می‌کند.
# ذخیره تدریجی بعد از هر ترکیب (مقاوم به تایم‌اوت) — اجرای مجدد امن است.
# اجرا: python3 expand-inspiration-pool.py
# ============================================================
import json, subprocess, os, sys, time

# مسیر ریپو نسبت به محل اسکریپت (اسکریپت در <repo>/scripts/ زندگی می‌کند)
HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, ".."))
POOL_FILE = os.path.join(REPO, "scripts/inspiration-pool.json")
GEN_FILE = os.path.join(REPO, "src/data/inspirations.generated.json")

STYLES = [
    {"slug": "modern", "en": "modern interior design living"},
    {"slug": "minimal", "en": "minimalist interior clean lines"},
    {"slug": "scandinavian", "en": "scandinavian interior bright cozy"},
    {"slug": "japandi", "en": "japandi interior warm wood zen"},
    {"slug": "classic", "en": "classic elegant interior ornate"},
    {"slug": "neoclassic", "en": "neoclassical interior modern elegance"},
    {"slug": "industrial", "en": "industrial interior brick metal loft"},
    {"slug": "boho", "en": "bohemian interior colorful textiles plants"},
    {"slug": "rustic", "en": "rustic interior wood beams stone fireplace"},
    {"slug": "mediterranean", "en": "mediterranean interior white blue arches"},
    {"slug": "contemporary", "en": "contemporary interior design sleek"},
    {"slug": "art-deco", "en": "art deco interior glam gold velvet"},
]
SPACES = [
    {"slug": "پذیرایی", "en": "living room"},
    {"slug": "اتاق خواب", "en": "bedroom"},
    {"slug": "فضای کار", "en": "home office workspace"},
    {"slug": "ناهارخوری", "en": "dining room"},
    {"slug": "بیرونی", "en": "outdoor patio balcony"},
]
PER_COMBO_TARGET = 10
QUERY_TAILS = ["layout", "decor inspiration", "design ideas", "interior photo"]

# ---------- بارگذاری وضعیت ----------
pool_doc = json.load(open(POOL_FILE))
pool = pool_doc.get("pool", {})
used = set()
for p in json.load(open(GEN_FILE)):
    used.add(p.get("image"))
seen = set(used)
for style in pool.values():
    for items in style.values():
        for it in items:
            seen.add(it.get("url"))

def _parse(d):
    out = []
    for res in d.get("results", []):
        url = res.get("original_url") or ""
        if not url or not url.startswith("http"):
            continue
        w = int(str(res.get("original_width", "1200")).replace("px", "") or 0)
        out.append({"url": url, "source": (res.get("source") or "وب")[:60], "w": w})
    return out

def search(query, retries=1):
    """یک جستجوی تصویر z-ai با backoff برای 429"""
    for attempt in range(retries + 1):
        try:
            r = subprocess.run(
                ["z-ai", "image-search", "-q", query, "--count", "10", "--gl", "us", "--no-rank"],
                capture_output=True, text=True, timeout=120)
            raw = r.stdout
            if "{" not in raw:
                if "429" in (r.stderr or "") + raw and attempt < retries:
                    print("    429 rate-limited — صبر ۳۰ ثانیه…", flush=True)
                    time.sleep(30)
                    continue
                return []
            return _parse(json.loads(raw[raw.index("{"):]))
        except Exception as e:
            print(f"    ! search failed: {e}", flush=True)
            if attempt < retries:
                time.sleep(15)
    return []

def fill_combo(style, space, variant=0):
    """عکس تازه به ترکیب اضافه می‌کند؛ خروجی: (label, kept, raw_found)"""
    key_style, key_space = style["slug"], space["slug"]
    existing = pool.get(key_style, {}).get(key_space, [])
    have = [it for it in existing if it.get("url") not in used]
    need = PER_COMBO_TARGET - len(have)
    label = f"{style['en'][:26]} × {key_space}"
    if need <= 0:
        return (label, 0, 0)
    query = f"{style['en']} {space['en']} {QUERY_TAILS[variant % len(QUERY_TAILS)]}"
    kept = 0
    raw_found = 0
    results = search(query)
    raw_found = len(results)
    for r in results:
        if kept >= need:
            break
        u = r["url"]
        if u in seen or (r["w"] and r["w"] < 600):
            continue
        pool.setdefault(key_style, {}).setdefault(key_space, []).append(
            {"url": u, "source": r["source"]})
        seen.add(u)
        kept += 1
    return (label, kept, raw_found)

def save():
    total = sum(sum(len(v) for v in spaces.values()) for spaces in pool.values())
    pool_doc["pool"] = pool
    pool_doc["_comment"] = ("استخر عکس ایجنت الهام — جفت سبک×فضا؛ فقط URLهای OSS پایدار. "
                            "شارژ: scripts/expand-inspiration-pool.py (سندباکس) — "
                            "هدف: همیشه ≥۸ عکس مصرف‌نشده در هر ترکیب")
    with open(POOL_FILE, "w") as f:
        json.dump(pool_doc, f, ensure_ascii=False, indent=2)
        f.write("\n")
    return total

# ---------- اجرای ترتیبی با پاس‌های متوالی ----------
MAX_PASSES = 4
total_kept = 0
print(f"seen URLs: {len(seen)}", flush=True)
for pass_i in range(1, MAX_PASSES + 1):
    starved = []
    for s in STYLES:
        for sp in SPACES:
            existing = pool.get(s["slug"], {}).get(sp["slug"], [])
            unused = [it for it in existing if it.get("url") not in used]
            if len(unused) < PER_COMBO_TARGET:
                starved.append((s, sp))
    print(f"--- pass {pass_i}: {len(starved)} starved combos ---", flush=True)
    if not starved:
        break
    for s, sp in starved:
        label, kept, raw = fill_combo(s, sp, variant=pass_i)
        total_kept += kept
        if kept:
            print(f"  {label}: +{kept} (raw {raw})", flush=True)
        save()
        time.sleep(2)

# ---------- گزارش ----------
total = save()
print("\n=== POOL REPORT ===")
for s in STYLES:
    print(f"  {s['slug']}: {sum(len(v) for v in pool.get(s['slug'], {}).values())}")
print(f"TOTAL: {total} (this run: +{total_kept})")

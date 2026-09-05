#!/usr/bin/env python3
# Round 11 — Rebrand user-visible "هوش مصنوعی"/"AI" → "هومینو استودیو"
# Precise, asserted replacements across src/. Technical NLU lists untouched.
import os, sys

ROOT = "/home/z/my-project/src"

# (relative file, old, new, expected_count)
EDITS = [
    # ---- Persian: هوش مصنوعی → هومینو استودیو (all UI surfaces) ----
    ("app/products/[slug]/page.tsx", "با هوش مصنوعی آن را در فضای خودتان تصور کنید", "با هومینو استودیو آن را در فضای خودتان تصور کنید", 1),
    ("app/products/[slug]/page.tsx", "هوش مصنوعی برای این محصول", "هومینو استودیو برای این محصول", 1),
    ("app/page.tsx", "خانه · دکوراسیون · هوش مصنوعی", "خانه · دکوراسیون · هومینو استودیو", 1),
    ("app/page.tsx", "طراحی با هوش مصنوعی", "طراحی با هومینو استودیو", 1),
    ("app/layout.tsx", "طراحی هوشمند با هوش مصنوعی", "طراحی هوشمند با هومینو استودیو", 1),
    ("app/inspiration/[id]/page.tsx", "یا با هوش مصنوعی، مشابه آن را برای اتاق خودت بسازی", "یا با هومینو استودیو، مشابه آن را برای اتاق خودت بسازی", 1),
    ("app/ai/layout.tsx", "طراحی هوشمند — پیش‌نمایش چیدمان با هوش مصنوعی", "هومینو استودیو — پیش‌نمایش چیدمان خانه‌ات", 1),
    ("app/ai/layout.tsx", "ارائه‌شده با موتور هوش مصنوعی Homeino.", "هومینو استودیو: محصولات واقعی را در عکس خانه‌ات ببین، جای آن‌ها را عوض کن و قبل از خرید نتیجه را ببین.", 1),
    ("app/ai/layout.tsx", "طراحی هوشمند — Homeino AI", "هومینو استودیو — Homeino Studio", 1),
    ("app/ai/layout.tsx", 'alt: "Homeino AI"', 'alt: "Homeino Studio"', 1),
    ("app/admin/ai/page.tsx", "مصرف هوش مصنوعی", "مصرف هومینو استودیو", 1),
    ("app/account/credits/page.tsx", "هر طراحی هوش مصنوعی از این اعتبار کم می‌شود", "هر طراحی هومینو استودیو از این اعتبار کم می‌شود", 1),
    ("components/products/FilterableProductGrid.tsx", "پیشنهاد هوش مصنوعی", "پیشنهاد هومینو استودیو", 2),
    ("components/auth/AuthShell.tsx", "الهام، محصول و طراحی با هوش مصنوعی", "الهام، محصول و طراحی با هومینو استودیو", 1),
    ("components/admin/automation/WorkflowsPanel.tsx", 'agent: "ایجنت هوش مصنوعی"', 'agent: "ایجنت هومینو استودیو"', 1),
    ("components/admin/automation/ToolsPanel.tsx", 'ai: "هوش مصنوعی"', 'ai: "هومینو استودیو"', 1),
    ("components/layout/AIPanel.tsx", "استودیو طراحی هوش مصنوعی", "هومینو استودیو", 1),
    ("components/layout/Footer.tsx", "طراحی با هوش مصنوعی.", "طراحی با هومینو استودیو.", 1),
    ("components/layout/Footer.tsx", "۲۰ اعتبار هوش مصنوعی رایگان", "۲۰ اعتبار هومینو استودیو رایگان", 1),
    ("components/layout/MobileNav.tsx", "استودیو طراحی با هوش مصنوعی", "هومینو استودیو", 1),
    ("components/layout/MobileNav.tsx", 'aria-label="استودیو هوش مصنوعی"', 'aria-label="هومینو استودیو"', 1),
    ("components/layout/Header.tsx", "استودیو هوش مصنوعی", "هومینو استودیو", 1),
    ("components/layout/Header.tsx", "خانه‌ات را با هوش مصنوعی", "خانه‌ات را با هومینو استودیو", 1),
    ("components/layout/Header.tsx", "اعتبار هدیه هوش مصنوعی", "اعتبار هدیه هومینو استودیو", 1),
    ("config/notifications.ts", "پیشنهاد هوش مصنوعی", "پیشنهاد هومینو استودیو", 1),
    ("config/platform.ts", "۳۰ اعتبار هوش مصنوعی رایگان", "۳۰ اعتبار هومینو استودیو رایگان", 1),
    ("services/agents/defaults.ts", 'agent: "ایجنت هوش مصنوعی"', 'agent: "ایجنت هومینو استودیو"', 1),
    ("services/agents/defaults.ts", "پل بین AI Designer و سیستم ایجنتی", "پل بین هومینو استودیو و سیستم ایجنتی", 1),
    ("services/ai/productAdvice.ts", "«هوش مصنوعی برای این محصول»", "«هومینو استودیو برای این محصول»", 1),
    # ---- AI-studio compound labels ----
    ("app/ai/history/page.tsx", 'eyebrow="AI استودیو"', 'eyebrow="هومینو استودیو"', 1),
    ("app/ai/result/[id]/page.tsx", '"AI استودیو"', '"هومینو استودیو"', 2),
    ("app/wishlist/page.tsx", "طراحی AI‌ای ذخیره نکرده‌ای", "طراحی هومینو استودیو ذخیره نکرده‌ای", 1),
    ("app/wishlist/page.tsx", "ورود به AI استودیو", "ورود به هومینو استودیو", 1),
    ("components/layout/AIPanel.tsx", "ورود به AI استودیو ←", "ورود به هومینو استودیو ←", 1),
    ("components/layout/Header.tsx", "<span className=\"relative z-10\">استودیو AI</span>", "<span className=\"relative z-10\">هومینو استودیو</span>", 1),
    # ---- CTAs with AI ----
    ("app/page.tsx", "طراحی فضای من با AI", "طراحی فضای من با هومینو استودیو", 1),
    ("app/page.tsx", "<Sparkles size={12} /> Homeino AI", "<Sparkles size={12} /> هومینو استودیو", 1),
    ("app/page.tsx", "طراحی با AI", "طراحی با هومینو استودیو", 1),
    ("app/checkout/success/page.tsx", "طراحی اتاق با AI", "طراحی اتاق با هومینو استودیو", 1),
    ("app/cart/page.tsx", "طراحی با AI", "طراحی با هومینو استودیو", 1),
    ("app/inspiration/[id]/page.tsx", "بساز مشابهش با AI", "بساز مشابهش با هومینو استودیو", 1),
    ("app/projects/[id]/page.tsx", "این پروژه را با AI برای خودت بازسازی کن", "این پروژه را با هومینو استودیو برای خودت بازسازی کن", 1),
    # ---- Studio internals ----
    ("components/ai/design/BudgetStep.tsx", "دستور به AI (اختیاری)", "دستور به استودیو (اختیاری)", 1),
    ("components/ai/design/AnalysisBanner.tsx", "پیشنهادهای هوشمند AI:", "پیشنهادهای هومینو استودیو:", 1),
]

failures = []
for rel, old, new, count in EDITS:
    path = os.path.join(ROOT, rel)
    with open(path, encoding="utf-8") as f:
        content = f.read()
    n = content.count(old)
    if n != count:
        failures.append(f"{rel}: expected {count}x {old[:40]!r}, found {n}")
        continue
    with open(path, "w", encoding="utf-8") as f:
        f.write(content.replace(old, new))

if failures:
    print("FAILED:")
    for f in failures:
        print(" -", f)
    sys.exit(1)
print(f"OK — {len(EDITS)} replacement groups applied")

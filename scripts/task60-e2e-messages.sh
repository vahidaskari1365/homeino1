#!/usr/bin/env bash
# ============================================================
# Task 60 — تست E2E زندهٔ گفتگوی مشتری و فروشنده روی پروداکشن
# (homeino.vercel.app) با حساب واقعی: فروشندهٔ تست → فروشگاه pending
# → مشتری تست پیام می‌دهد → اعلان customer_message → پاسخ فروشنده
# → خواندن مشتری. هیچ دادهٔ فیک در UI — همه‌چیز واقعی و fail-safe.
# ============================================================
set -uo pipefail
BASE="https://homeino.vercel.app"
TS=$(date +%s)
VENDOR_EMAIL="task60-vendor-${TS}@test.homeino.ir"
CUSTOMER_EMAIL="task60-customer-${TS}@test.homeino.ir"
PASS="Task60!secure1"
VD="/tmp/t60_vendor.jar"; CU="/tmp/t60_customer.jar"
rm -f "$VD" "$CU"

say() { echo "== $* =="; }
jqpy() { python3 -c "import json,sys;d=json.load(sys.stdin);($1)"; }

say "1) ثبت‌نام فروشندهٔ تست: $VENDOR_EMAIL"
R=$(curl -s -c "$VD" -X POST "$BASE/api/auth/register" -H "Content-Type: application/json" \
  -d "{\"email\":\"$VENDOR_EMAIL\",\"password\":\"$PASS\",\"name\":\"فروشنده تست ۶۰\"}")
echo "$R" | jqpy "print('id:', d['data']['id'][:8], '| ok:', d['ok'])"

say "2) onboarding فروشگاه (pending)"
R=$(curl -s -b "$VD" -c "$VD" -X POST "$BASE/api/vendor/onboarding" -H "Content-Type: application/json" \
  -d '{"name":"فروشگاه تست تسک ۶۰","city":"تهران","description":"فروشگاه آزمایشی برای تست گفتگو"}')
echo "$R" | jqpy "print('vendorId:', d['data']['vendorId'][:8], '| status:', d['data']['status'], '| created:', d['data']['created'])"

say "3) گرفتن slug فروشگاه از /api/vendor/me"
R=$(curl -s -b "$VD" "$BASE/api/vendor/me")
SLUG=$(echo "$R" | jqpy "print(d['data']['vendor']['slug'])")
echo "slug: $SLUG"

say "4) ثبت‌نام مشتری تست: $CUSTOMER_EMAIL"
R=$(curl -s -c "$CU" -X POST "$BASE/api/auth/register" -H "Content-Type: application/json" \
  -d "{\"email\":\"$CUSTOMER_EMAIL\",\"password\":\"$PASS\",\"name\":\"مشتری تست ۶۰\"}")
echo "$R" | jqpy "print('ok:', d['ok'])"

say "5) مشتری پیام می‌دهد: POST /api/stores/$SLUG/messages"
R=$(curl -s -b "$CU" -X POST "$BASE/api/stores/$SLUG/messages" -H "Content-Type: application/json" \
  -d '{"body":"سلام، موجودی این محصول را دارید؟"}')
echo "$R" | jqpy "print('ok:', d['ok'], '| sender:', d['data']['message']['senderRole'], '| body:', d['data']['message']['body'][:30])"

say "6) مشتری رشتهٔ خودش را می‌بیند: GET"
R=$(curl -s -b "$CU" "$BASE/api/stores/$SLUG/messages")
echo "$R" | jqpy "print('items:', len(d['data']['items']))"

say "7) صندوق فروشنده: رشتهٔ جدید + unread=1"
R=$(curl -s -b "$VD" "$BASE/api/vendor/messages")
echo "$R" | jqpy "t=d['data']['threads']; print('threads:', len(t), '| unread:', d['data']['unread'], '| از:', t[0]['customerName'], '| last:', t[0]['lastBody'][:30])" 2>/dev/null || echo "$R" | head -c 300
CUSTOMER_ID=$(echo "$R" | jqpy "print(d['data']['threads'][0]['customerId'])")

say "8) اعلان customer_message در صندوق Task 59 (SMS صادقانه skipped)"
R=$(curl -s -b "$VD" "$BASE/api/vendor/notifications?limit=5")
echo "$R" | jqpy "n=[x for x in d['data']['items'] if x['kind']=='customer_message']; print('found:', len(n), '| title:', n[0]['title'] if n else '-', '| sms:', n[0]['smsStatus'] if n else '-')"

say "9) پاسخ فروشنده: POST /api/vendor/messages"
R=$(curl -s -b "$VD" -X POST "$BASE/api/vendor/messages" -H "Content-Type: application/json" \
  -d "{\"customerId\":\"$CUSTOMER_ID\",\"body\":\"بله موجود است — ارسال از فردا\"}")
echo "$R" | jqpy "print('ok:', d['ok'], '| sender:', d['data']['message']['senderRole'])"

say "10) مشتری پاسخ را می‌بیند (و پاسخ‌های فروشنده خوانده‌شده می‌شوند)"
R=$(curl -s -b "$CU" "$BASE/api/stores/$SLUG/messages")
echo "$R" | jqpy "it=d['data']['items']; print('items:', len(it), '| آخرین پیام از:', it[-1]['senderRole'], '|', it[-1]['body'][:30])"

say "11) دوباره صندوق فروشنده — unread باید ۰ باشد"
R=$(curl -s -b "$VD" "$BASE/api/vendor/messages")
echo "$R" | jqpy "print('unread:', d['data']['unread'])"

say "12) گارد: مشتری نمی‌تواند به API فروشنده برسد (403)"
R=$(curl -s -o /dev/null -w "%{http_code}" -b "$CU" "$BASE/api/vendor/messages")
echo "status: $R"

say "13) گارد: پاسخ فروشنده به مشتریِ بدون رشته (باید 404 شود)"
R=$(curl -s -o /dev/null -w "%{http_code}" -b "$VD" -X POST "$BASE/api/vendor/messages" -H "Content-Type: application/json" \
  -d "{\"customerId\":\"11111111-1111-1111-1111-111111111111\",\"body\":\"سلام\"}")
echo "status: $R"

say "پایان تست زندهٔ Task 60 ✓"

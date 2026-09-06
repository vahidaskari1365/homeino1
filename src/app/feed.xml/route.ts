import { contentRepository } from "@/repositories/content";
import { trendBriefs } from "@/lib/trends";
import { SITE_URL } from "@/config/site";

/**
 * RSS 2.0 feed — مجله + ترندهای روز.
 * مسیر: /feed.xml (روبوت‌ها و فیدخوان‌ها؛ مشمول گیت احراز نیست).
 * ترندها به لنگر روز خودشان لینک می‌شوند: /trends/{date}#{slug}
 */
function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export async function GET(): Promise<Response> {
  const articles = await contentRepository.articles();

  const articleItems = articles
    .map((a) => ({
      title: a.title,
      link: `${SITE_URL}/magazine/${a.slug}`,
      description: a.excerpt,
      pubDate: new Date().toUTCString(),
      guid: `magazine-${a.slug}`,
    }))
    .filter(Boolean);

  const briefItems = trendBriefs.map((b) => ({
    title: b.title,
    link: `${SITE_URL}/trends/${b.date}#${b.slug}`,
    description: `${b.summary} — برای خانه ایرانی: ${b.takeaway}`,
    pubDate: new Date(`${b.date}T06:00:00Z`).toUTCString(),
    guid: `trend-${b.slug}`,
  }));

  const items = [...briefItems, ...articleItems]
    .map(
      (i) =>
        `    <item>\n      <title>${esc(i.title)}</title>\n      <link>${esc(i.link)}</link>\n      <guid isPermaLink="false">${esc(i.guid)}</guid>\n      <pubDate>${i.pubDate}</pubDate>\n      <description>${esc(i.description)}</description>\n    </item>`,
    )
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>هومینو — مجله و ترندهای دیزاین خانه</title>
    <link>${SITE_URL}/trends</link>
    <description>ترندهای روز دیزاین داخلی به فارسی + مقالات مجله هومینو؛ بازنویسی اختصاصی از منابع معتبر جهانی.</description>
    <language>fa-ir</language>
    <atom:link href="${SITE_URL}/feed.xml" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=1800",
    },
  });
}

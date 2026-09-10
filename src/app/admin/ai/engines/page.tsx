// ============================================================
// پنل ادمین → موتورهای هوش مصنوعی (/admin/ai/engines)
// مدیریت کلید و مدل‌های Google AI + نقشه‌ی کامل ابزارهای گوگل
// برای هومینو (کدام فعال است، کدام نیازمند اعتبار است).
// داده‌ی کارت Gemini واقعی و زنده است (GET /api/admin/ai/settings).
// ============================================================
import { Sparkles, Camera, Image as ImageIcon, FileText, Video, Languages, Bot, Wrench, FlaskConical, KeyRound } from "lucide-react";
import { Badge } from "@/components/ui/primitives";
import { GeminiEngineCard } from "./GeminiEngineCard";

export const dynamic = "force-dynamic";

/** ابزارهای اکوسیستم هوش مصنوعی گوگل — نقش دقیق هرکدام در هومینو. */
const GOOGLE_TOOLS: { icon: typeof Sparkles; name: string; role: string; status: string; tone: "success" | "neutral" | "gold" }[] = [
  {
    icon: KeyRound,
    name: "Google AI Studio (کلید API)",
    role: "ساخت کلید رایگان Gemini — سوئیچ اصلی روشن‌شدن بقیه‌ی ابزارها؛ کلید از aistudio.google.com/apikey",
    status: "همین صفحه — کلید را ذخیره کنید",
    tone: "gold",
  },
  {
    icon: FileText,
    name: "Gemini Flash / Flash-Lite (متن)",
    role: "توضیحات خودکار محصولات غرفه‌ها، چت دستیار دکوراسیون، تحلیل درخواست کاربر — فارسی روان",
    status: "با کلید رایگان فعال می‌شود",
    tone: "success",
  },
  {
    icon: ImageIcon,
    name: "Nano Banana (تولید و ویرایش عکس)",
    role: "استیجینگ عکس اتاق با محصولات واقعی غرفه‌ها — تولید و ویرایش؛ عکس قبلی حفظ می‌شود",
    status: "با کلید رایگان فعال می‌شود",
    tone: "success",
  },
  {
    icon: Bot,
    name: "Gemma (مدل باز گوگل)",
    role: "متن سبک‌وزن و رایگان روی همان API — جایگزین کم‌هزینه برای دسته‌بندی و برچسب‌گذاری",
    status: "با همان کلید قابل استفاده",
    tone: "success",
  },
  {
    icon: ImageIcon,
    name: "Imagen 4 (عکس استودیویی)",
    role: "تولید عکس کیفیت خیلی بالای محصول برای بنر و کمپین",
    status: "نیازمند فعال‌سازی صورتحساب گوگل",
    tone: "neutral",
  },
  {
    icon: Video,
    name: "Veo 3 (تولید ویدیو)",
    role: "ویدیوی کوتاه معرفی محصول غرفه‌ها برای مجله و اینستاگرام",
    status: "نیازمند صورتحساب (پولی)",
    tone: "neutral",
  },
  {
    icon: Languages,
    name: "Google Cloud Translation",
    role: "ترجمه توضیحات غرفه‌ها برای نسخه‌های چندزبانه",
    status: "نیازمند صورتحساب جداگانه",
    tone: "neutral",
  },
  {
    icon: Wrench,
    name: "Jules (ایجنت کدنویسی گیت‌هاب)",
    role: "ایجنت گوگل روی همین ریپو — فیکس‌ها و بهبودهای کوچک سایت با اتصال به گیت‌هاب",
    status: "ابزار تعاملی — رایگان محدود",
    tone: "neutral",
  },
  {
    icon: FlaskConical,
    name: "NotebookLM / Opal / Firebase Studio",
    role: "پژوهش و مستندسازی داخلی، پروتوتایپ اپ بدون کد، محیط توسعه ابری — بدون API عمومی برای سایت",
    status: "ابزار تعاملی — بیرون از سایت",
    tone: "neutral",
  },
];

export default function AdminAiEnginesPage() {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-xl font-black text-ink">موتورهای هوش مصنوعی</h1>
        <p className="mt-1 text-xs leading-6 text-ink-muted">
          مدیریت کلیدها و مدل‌های AI سایت — بدون دست‌زدن به متغیرهای Vercel. تنظیمات اینجا روی «متن (توضیحات و چت)»
          و «عکس (تولید و ویرایش)» اثر فوری دارد؛ تولید عکس رایگان با Pollinations همیشه به‌عنوان پشتیبان فعال است.
        </p>
      </div>

      <GeminiEngineCard />

      <div className="card-surface overflow-hidden">
        <div className="border-b border-clay/40 bg-ivory-2 px-3 py-2.5 text-xs font-bold text-ink">
          اکوسیستم هوش مصنوعی گوگل — نقش هر ابزار در هومینو
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-clay/40 bg-ivory-2 text-right text-xs text-ink-muted">
                <th className="p-3 font-medium">ابزار</th>
                <th className="p-3 font-medium">برای هومینو چه می‌کند</th>
                <th className="p-3 font-medium">وضعیت</th>
              </tr>
            </thead>
            <tbody>
              {GOOGLE_TOOLS.map((t) => (
                <tr key={t.name} className="border-b border-clay/30 align-top hover:bg-ivory-2/50">
                  <td className="p-3">
                    <div className="flex items-center gap-2 text-ink">
                      <t.icon size={15} className="text-terracotta-deep" />
                      <span className="text-xs font-bold">{t.name}</span>
                    </div>
                  </td>
                  <td className="p-3 text-xs leading-6 text-ink-muted">{t.role}</td>
                  <td className="p-3"><Badge tone={t.tone}>{t.status}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card-surface p-5">
        <div className="flex items-center gap-2">
          <Camera size={18} className="text-terracotta-deep" />
          <h2 className="font-display text-sm font-black text-ink">اینستاگرام هومینو</h2>
          <Badge tone="neutral">به‌زودی</Badge>
        </div>
        <p className="mt-2 text-xs leading-6 text-ink-muted">
          جایگاه اتصال اکانت اینستاگرام سایت از همین صفحه مدیریت می‌شود: انتشار خودکار پست محصولات منتخب غرفه‌ها،
          کپشن هوشمند با همان موتور متن، و استوری از عکس‌های استیج‌شده. ساختار پنل آماده است — فقط اکانت وصل می‌شود.
        </p>
      </div>

      <div className="card-surface p-5">
        <div className="flex items-center gap-2">
          <Sparkles size={18} className="text-gold" />
          <h2 className="font-display text-sm font-black text-ink">پشتیبان رایگان — Pollinations</h2>
          <Badge tone="success">همیشه فعال</Badge>
        </div>
        <p className="mt-2 text-xs leading-6 text-ink-muted">
          اگر گوگل غیرفعال باشد یا سهمیه رایگان تمام شود، تولید عکس بدون هیچ کلیدی با Pollinations ادامه می‌یابد
          و ویرایش عکس به‌جای پیش‌نمایش قلابی، حالت «پیش‌نمایش صادقانه» نشان می‌دهد.
        </p>
      </div>
    </div>
  );
}

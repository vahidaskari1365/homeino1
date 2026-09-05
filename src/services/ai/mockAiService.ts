import type { AiProvider, GenerateDesignInput, GeneratedDesign } from "./types";
import { roomShots} from "../../data/media";
import { uid, formatPrice } from "../../lib/utils";
import { validateResult, type ProductCatalogEntry } from "./roomState";
import { products } from "../../data/products";

type RealProduct = (typeof products)[number];

/** First real catalog product matching a predicate — never an invented item. */
function realProduct(predicate: (p: RealProduct) => boolean): RealProduct | undefined {
  return products.find(predicate);
}

/** «نام محصول» با قیمتِ واقعی کاتالوگ — used inside canned advice. */
function citeProduct(p?: RealProduct): string {
  if (!p) return "";
  return `«${p.name}» با قیمت ${formatPrice(p.price)} تومان`;
}

// Interior-design-aware mock chat engine — gives genuinely useful advice
// even without a real LLM. Understands Persian design questions.
function mockChatReply(message: string, context?: string): string {
  const msg = message.toLowerCase();

  // ---- OFF-TOPIC GUARD: Homeino AI is home/interior only ----
  const offTopicKeywords = [
    "آب‌وهوا", "آب و هوا", "فردا هوا", "هوا چطور", "بارون", "باران", "برف", "weather", "forecast",
    "هوش مصنوعی چقدر", "ساختید", "کدوم شرکت", "لینوکس", "پایتون", "برنامه‌نویسی", "سیاست", "ورزش", "فیلم", "بازی", "سفر", "تاریخ", "ریاضی", "علم", "پزشکی", "سلامتی", "دارو", "news", "politics", "sport",
  ];
  if (offTopicKeywords.some((k) => msg.includes(k))) {
    return "من فقط دستیار خانه و دکوراسیون Homeino هستم و درباره‌ی دکوراسیون، مبلمان، رنگ، نور و خرید محصولات خانه کمک می‌کنم. درباره‌ی فضای خونه‌ات بپرس!";
  }
  if (/^(سلام|درود|hello|hi|hey|الو)\b/.test(msg) && msg.length < 20) {
    return "سلام! من دستیار Homeino هستم. هر سؤالی درباره‌ی دکوراسیون، مبلمان، رنگ یا نور داری بپرس؛ اگر محصول خاصی می‌خوای، سبک و بودجه‌ات رو هم بگو.";
  }

  // Also block generic questions with no design context. The OLD guard was
  // dead because the panel always sends a non-empty page context — only a real
  // product-page context («محصول: …») counts as design grounding now.
  const designKeywords = ["خانه", "اتاق", "مبل", "کاناپه", "فرش", "قالیچه", "پرده", "رنگ", "سبک", "نور", "چیدمان", "دکور", "مبلمان", "تخت", "میز", "کوسن", "تابلو", "آینه", "گلدان", "چراغ", "لوستر", "آباژور", "پذیرایی", "نشیمن", "خواب", "آشپزخانه", "فضا", "بودجه", "خرید", "ارزان", "طراحی", "home", "room", "decor", "furniture", "sofa", "rug", "color", "style", "lighting"];
  const hasDesignContext = designKeywords.some((k) => msg.includes(k)) || Boolean(context && context.startsWith("محصول:"));
  if (!hasDesignContext && msg.length > 12) {
    return "این سؤال خارج از حوزه‌ی تخصص منه. من درباره‌ی طراحی داخلی، مبلمان، رنگ، نورپردازی و خرید محصولات خانه راهنماییت می‌کنم. چه چیزی تو خونه‌ات می‌خوای تغییر بدی؟";
  }

  // Context: product page — name is the REAL product name (never an English slug)
  if (context && context.startsWith("محصول:")) {
    const prodName = context.slice("محصول:".length).split("(id:")[0].trim() || "این محصول";
    const hasItems = ["کوسن", "میز", "فرش", "چراغ", "تابلو", "گلدان"].some((k) => msg.includes(k));
    if (/ست|هماهنگ|مناسب|ترکیب|ست میکنه/.test(msg) && !hasItems) {
      const rug = realProduct((p) => (p.subCategorySlug ?? "").match(/^(rug|carpet)$/) !== null);
      return `برای «${prodName}»، پیشنهاد می‌کنم با رنگ‌های خنثی مثل کرم و طوسی ترکیبش کنی. یک ${citeProduct(rug)} یا چند کوسن رنگی فضا رو کامل می‌کنه.`;
    }
    if (/رنگ|color/.test(msg)) {
      const cushion = realProduct((p) => p.subCategorySlug === "cushion");
      return `«${prodName}» پالت گرمی داره. برای هماهنگی، رنگ‌های کرم، شنی یا سبز مریم‌گلی عالی می‌شن؛ ${citeProduct(cushion) || "یک کوسن رنگی"} می‌تونه پل رنگی فضا باشه. از رنگ‌های جیغ پرهیز کن.`;
    }
    return `در مورد «${prodName}»، می‌تونم درباره‌ی هماهنگی با سایر وسایل، انتخاب رنگ مناسب، یا جایگذاری در فضات کمک کنم. دقیق‌تر بپرس!`;
  }

  // Color questions
  if (/رنگ|color|پالت|هماهنگی رنگ/.test(msg)) {
    if (/کوچک|کوچیک|small/.test(msg)) {
      const curtain = realProduct((p) => p.subCategorySlug === "curtain");
      return `برای فضای کوچک، رنگ‌های روشن و خنثی (کرم، سفید شکسته، طوسی روشن) انتخاب کن و نور طبیعی رو آزاد بذار. ${curtain ? `یک ${citeProduct(curtain)} هم فضای بصری رو بازتر نشون می‌ده.` : "آینه و نور طبیعی فضای بصری رو بازتر نشون می‌دن."}`;
    }
    const rug = realProduct((p) => (p.subCategorySlug ?? "").match(/^(rug|carpet)$/) !== null);
    const throwP = realProduct((p) => p.subCategorySlug === "throw");
    return `پالت خاکی با ترکیب کرم، شنی و یک رنگ تاکیدی مثل تراکوتا یا سبز مریم‌گلی، تعادلی دلنشین می‌سازه. رنگ غالب رو خنثی بگیر؛ ${rug ? `${citeProduct(rug)} یا` : ""} ${throwP ? citeProduct(throwP) : "یک بافت گرم"} می‌تونه نقطه‌ی تاکیدی فضا باشه.`;
  }

  // Style questions
  if (/سبک|style|مدرن|کلاسیک|مینیمال|اسکاندیناوی|ژاپندی|صنعتی|لوکس|بوهمی/.test(msg)) {
    const japandi = /ژاپندی|japandi/.test(msg);
    const scandi = /اسکاندیناوی|نوردیک|scandinavian/.test(msg);
    if (japandi && scandi) {
      const table = realProduct((p) => p.subCategorySlug === "coffee-table" && p.styleSlugs.includes("scandinavian") && p.styleSlugs.includes("japandi"));
      const lamp = realProduct((p) => p.subCategorySlug === "table-lamp" && p.styleSlugs.includes("japandi"));
      return "ژاپندی یعنی مینیمالیسم ژاپنی با گرمای چوب و خطوط ساده‌تر؛ اسکاندیناوی روشن‌تره، با چوب کم‌رنگ، نور زیاد و کاربردی‌بودن. هر دو خاکی و آرام‌بخشن؛ مثلاً برای پذیرایی، هر دو سبک با این‌ها کامل می‌شن: " + [citeProduct(table), citeProduct(lamp)].filter(Boolean).join(" و ") + ".";
    }
    if (/مینیمال|minimal/.test(msg)) {
      const art = realProduct((p) => p.subCategorySlug === "wall-art" && p.styleSlugs.includes("minimal"));
      const lamp = realProduct((p) => p.subCategorySlug === "table-lamp" && p.styleSlugs.includes("minimal"));
      return `سبک مینیمال یعنی حذف اضافات: کمتر اما بهتر. رنگ‌های خنثی و نور فراوان کلید این سبکن؛ ${[citeProduct(art), citeProduct(lamp)].filter(Boolean).join(" و ")} از کاتالوگ واقعی Homeino انتخاب‌های خوبی‌ان.`;
    }
    if (japandi) {
      const lamp = realProduct((p) => p.subCategorySlug === "table-lamp" && p.styleSlugs.includes("japandi"));
      const table = realProduct((p) => p.subCategorySlug === "coffee-table" && p.styleSlugs.includes("japandi"));
      return `جاپندی ترکیب مینیمالیسم ژاپنی با گرمای اسکاندیناویه: چوب طبیعی، خطوط ساده، رنگ‌های زمینی. ${[citeProduct(lamp), citeProduct(table)].filter(Boolean).join(" و ")} کاملاً با این سبک هم‌خوانن.`;
    }
    if (/لوکس|luxury/.test(msg)) {
      const lamp = realProduct((p) => p.subCategorySlug === "floor-lamp");
      const mirror = realProduct((p) => p.subCategorySlug === "mirror");
      return `برای حس لوکس، متریال باکیفیت مثل مرمر، برنج و مخمل رو با رنگ‌های عمیق ترکیب کن؛ ${[citeProduct(lamp), citeProduct(mirror)].filter(Boolean).join(" و ")} جزئیات طلایی و نورپردازی گرم رو کامل می‌کنن.`;
    }
    if (/صنعتی|industrial/.test(msg)) {
      const table = realProduct((p) => p.subCategorySlug === "coffee-table" && p.styleSlugs.includes("industrial"));
      return `سبک صنعتی با فلز، چوب خام و سطوح بتنی شناخته می‌شه؛ ${citeProduct(table)} یک انتخاب واقعیِ هماهنگ با این سبکه. یک دیوار آجری هم کاراکتر فضا رو چند برابر می‌کنه.`;
    }
    if (/مدرن|modern/.test(msg)) {
      const sofa = realProduct((p) => p.subCategorySlug === "armchair" && p.styleSlugs.includes("modern") && p.price <= 20_000_000);
      const lamp = realProduct((p) => p.subCategorySlug === "ceiling" && p.styleSlugs.includes("modern"));
      return `سبک مدرن با خطوط صاف، رنگ‌های خنثی و عملکرد ساده شناخته می‌شه؛ ${[citeProduct(sofa), citeProduct(lamp)].filter(Boolean).join(" و ")} نمونه‌های واقعی این سبک در Homeino هستن.`;
    }
    return "هر سبک شخصیتی داره. بگو فضات چطوره تا دقیق‌تر راهنماییت کنم — مدرن (خطوط صاف)، مینیمال (خلوت)، کلاسیک (اصالت)، یا ژاپندی (آرامش).";
  }

  // Room type questions
  if (/پذیرایی|نشیمن|living|پزورایی/.test(msg)) {
    const sofa = realProduct((p) => p.subCategorySlug === "sofa");
    const rug = realProduct((p) => (p.subCategorySlug ?? "").match(/^(rug|carpet)$/) !== null);
    return `برای پذیرایی، کاناپه نقطه‌ی کانونیه: رو به منبع نور بذارش و با قالیچه ناحیه‌ی نشیمن رو تعریف کن. ${[citeProduct(sofa), citeProduct(rug)].filter(Boolean).join(" و ")} دو تا از پرفروش‌ترین‌های واقعی کاتالوگ‌ان. یک آباژور گوشه و گیاه طبیعی هم فضا رو دنج می‌کنه.`;
  }
  if (/اتاق خواب|خواب|bedroom/.test(msg)) {
    const bed = realProduct((p) => p.subCategorySlug === "bed");
    const bedding = realProduct((p) => p.subCategorySlug === "bedding");
    return `در اتاق خواب، تخت مرکز توجهه. روتختی نرم با رنگ‌های آرام‌بخش (کرم، سبز کمرنگ) انتخاب کن؛ ${[citeProduct(bed), citeProduct(bedding)].filter(Boolean).join(" و ")} انتخاب‌های واقعی و پرفروش Homeino در این بخش هستن. چراغ رومیزی با نور گرم هم برای مطالعه ضروریه.`;
  }
  if (/آشپزخانه|کابینت|kitchen/.test(msg)) {
    const dinnerware = realProduct((p) => p.subCategorySlug === "dinnerware");
    const organizer = realProduct((p) => p.subCategorySlug === "organizer");
    return `آشپزخانه باید کاربردی و زیبا باشه؛ کابینت‌های روشن با سطح کار سنگی یا چوبی عالی می‌شن. ${[citeProduct(dinnerware), citeProduct(organizer)].filter(Boolean).join(" و ")} هم از کاتالوگ واقعی‌ان. نور زیر کابینت برای کار راحتی می‌کنه.`;
  }

  // Budget
  if (/بودجه|ارزان|اقتصادی|budget|قیمت/.test(msg)) {
    const organizer = realProduct((p) => p.subCategorySlug === "organizer");
    const candle = realProduct((p) => p.subCategorySlug === "candle");
    return `با بودجه‌ی محدود هم می‌شه فضای زیبا ساخت: کوسن و رومیزی جدید، رنگ دیوار و گیاه ارزان‌ترین تغییراتن. از کاتالوگ واقعی، ${[citeProduct(organizer), citeProduct(candle)].filter(Boolean).join(" و ")} گزینه‌های زیر یک‌میلیونی‌ان. اگر بودجه بیشتر داری، روی کاناپه و فرش سرمایه‌گذاری کن.`;
  }

  // Warmth / mood
  if (/گرم|دنج|cozy|warm/.test(msg)) {
    const throwP = realProduct((p) => p.subCategorySlug === "throw");
    const candle = realProduct((p) => p.subCategorySlug === "candle");
    return `برای حس گرما: نور گرم (۳۰۰۰K)، چوب طبیعی، پارچه‌های نرم مثل کتان و ولور، و رنگ‌های خاکی. ${[citeProduct(throwP), citeProduct(candle)].filter(Boolean).join(" و ")} هم انتخاب‌های ارزون و واقعی برای حسِ دنجی هستن.`;
  }

  // Lighting
  if (/نور|چراغ|light|لوستر|آباژور/.test(msg)) {
    const lamp = realProduct((p) => p.subCategorySlug === "table-lamp");
    const ceiling = realProduct((p) => p.subCategorySlug === "ceiling");
    return `نورپردازی سه لایه داره: محیطی (سقفی)، وظیفه‌ای (مطالعه/کار) و تاکیدی. نور گرم (۳۰۰۰K) حس دنجی و نور سرد (۴۰۰۰K) حس تمیزی می‌ده؛ ${[citeProduct(ceiling), citeProduct(lamp)].filter(Boolean).join(" و ")} دو محصول واقعی برای شروع‌ان. دایمر هم پیشنهاد طلایی‌ست.`;
  }

  // Fallback — still useful
  return "سؤال خوبیه! می‌تونم درباره‌ی انتخاب رنگ، سبک دکوراسیون، نورپردازی، چیدمان، یا انتخاب مبلمان کمک کنم. دقیق‌تر بگو فضات چطوره یا چی می‌خوای تغییر بدی؟";
}

/** Mock provider — honest about being a preview. Does NOT fabricate fake
 *  AI-generated images. Returns `preview: true` so the UI can label the
 *  output as a development preview. Wire a real provider (Gemini) to get
 *  actual generated images without changing any UI code. */
export const mockAiProvider: AiProvider = {
  async generateDesign(input: GenerateDesignInput): Promise<GeneratedDesign> {
    await new Promise((r) => setTimeout(r, 1800));
    const { detectIntent } = await import("./roomState");
    const intent = detectIntent(input.prompt || "", input.style);
    // PREVIEW: preserve the original image. HONEST — no fake success.
    const afterImage = input.referenceImage ?? roomShots[0];
    const validation = validateResult({
      beforeImage: input.referenceImage,
      afterImage,
      intent,
      providerMarkedPreview: true,
    });
    return {
      id: uid(),
      beforeImage: input.referenceImage,
      afterImage,
      creditsUsed: 5,
      preview: validation.status === "preview",
      products: [
        { label: "کاناپه", productId: "p1" },
        { label: "چراغ رومیزی", productId: "p9" },
        { label: "قالیچه", productId: "p12" },
        { label: "کوسن", productId: "p15" },
      ],
    };
  },

  async editImage(input: GenerateDesignInput): Promise<GeneratedDesign> {
    await new Promise((r) => setTimeout(r, 1400));
    return {
      id: uid(),
      beforeImage: input.referenceImage,
      afterImage: input.referenceImage ?? roomShots[0],
      creditsUsed: 3,
      preview: true,
      products: [
        { label: "فرش", productId: "p12" },
        { label: "کوسن", productId: "p15" },
      ],
    };
  },

  async inpaint(input: GenerateDesignInput): Promise<GeneratedDesign> {
    await new Promise((r) => setTimeout(r, 1200));
    // PREVIEW: no real edit model available. The original image is preserved
    // unchanged — we honestly mark this as preview: true so the UI shows a
    // development badge, never a fake "success" on an unedited image.
    const img = input.referenceImage ?? roomShots[0];
    return { id: uid(), beforeImage: img, afterImage: img, creditsUsed: 1, preview: true, products: [] };
  },

  async chat({ message, context }) {
    await new Promise((r) => setTimeout(r, 800));
    return { content: mockChatReply(message, context) };
  },

  async suggestDecor({ room, style }) {
    await new Promise((r) => setTimeout(r, 1200));
    return {
      color: "پالت خاکی با تاکید تراکوتا",
      furniture: ["کاناپه ۳ نفره کرم", "میز جلو مبلی چوب بلوط", "صندلی تکی مخمل"],
      lighting: "چراغ رومیزی کتانی با نور گرم",
      rug: "قالیچه بربری دست‌بافت",
      accessories: ["گلدان سرامیکی", "ست کوسن بافت‌دار", "تابلو خطی"],
      layout: `چیدمان باز با تمرکز بر نور طبیعی، مناسب ${room} با سبک ${style}`,
    };
  },

  async analyzeRoom(input) {
    await new Promise((r) => setTimeout(r, 1400));
    const detectedStyle = input.style || "Scandinavian";
    return {
      roomType: input.room || "پذیرایی",
      style: input.style || "اسکاندیناوی",
      likelyStyle: {
        style: detectedStyle,
        confidence: 0.78,
      },
      palette: ["#F4EFEA", "#D8C7B5", "#8C7A6B", "#3E443C"],
      mood: "آرام و دلنشین",
      confidence: 0.82,
      architecture: {
        walls: "رنگ خنثی یکدست",
        floor: "پارکت چوب روشن",
        ceiling: "سقف ساده سفید",
        windows: 1,
        doors: 1,
      },
      lighting: "نور طبیعی مناسب از پنجره، نیازمند نورپردازی لایه‌ای و موضعی",
      furniture: ["کاناپه", "میز جلو مبلی"],
      furnitureTypes: ["sofa", "table"],
      materials: ["پارچه بافت‌دار", "چوب طبیعی"],
      decor: ["گلدان کوچک"],
      composition: "چیدمان خطی با فضای باز در مرکز",
      spatialConstraints: ["ابعاد متوسط", "مسیر تردد مشخص"],
      emptySpaces: ["دیوار اصلی خالی", "گوشه دنج کنار پنجره", "مرکز نشیمن بدون تفکیک"],
      visualBalance: "تعادل نسبی، نیازمند نقطه کانونی مشخص",
      functionalIssues: [
        "نورپردازی فقط سقفی است و نور موضعی مطالعه وجود ندارد",
        "فضای نشیمن بدون فرش تفکیک بصری کافی ندارد",
      ],
      designOpportunities: [
        "نصب تابلوی دیواری روی دیوار خالی به عنوان نقطه کانونی",
        "افزودن قالیچه بزرگ برای ایجاد گرما و انسجام در نشیمن",
        "قراردادن آباژور ایستاده با نور گرم در گوشه فضا",
        "افزودن گیاه طبیعی برای شادابی محیط",
      ],
      strengths: [
        "نور طبیعی مناسبی از پنجره وارد فضا می‌شود",
        "ارتفاع سقف و تناسبات فضا استاندارد و باز است",
        "پلان اتاق امکان چیدمان منعطف می‌دهد",
      ],
      opportunities: [
        "دیوار اصلی خالی است و نیازمند تابلوی هنری یا کنسول است",
        "نبود قالیچه مناسب باعث گسستگی ناحیه نشیمن شده است",
        "نورپردازی فقط سقفی است و نیاز به نور موضعی (آباژور) دارد",
      ],
      suggestions: [
        "افزودن یک قالیچه برای تعریف ناحیه‌ی نشیمن",
        "استفاده از آباژور با نور گرم برای حس دنجی در شب",
        "نصب اثر هنری روی دیوار خالی به عنوان نقطه کانونی",
        "اضافه‌کردن گیاه طبیعی برای زنده‌کردن فضا",
      ],
      guidedSuggestions: [
        { id: "gs1", title: "افزودن فرش برای تعریف فضا", desc: "یک قالیچه بزرگ زیر ناحیه‌ی نشیمن، فضا را گرم‌تر و منظم‌تر می‌کند.", impact: "high", creditCost: 3, category: "rug" },
        { id: "gs2", title: "نور گرم و موضعی", desc: "افزودن آباژور یا چراغ رومیزی با نور گرم (۳۰۰۰K)، حس دنجی می‌آورد.", impact: "medium", creditCost: 2, category: "lighting" },
        { id: "gs3", title: "نقطه کانونی با اثر هنری", desc: "نصب تابلوی مینیمال روی دیوار خالی برای ایجاد تعادل و جلوه بصری.", impact: "medium", creditCost: 2, category: "art" },
        { id: "gs4", title: "گیاه طبیعی برای طراوت", desc: "یک گیاه آپارتمانی در گوشه‌ی فضا، فضا را زنده و طبیعی می‌کند.", impact: "low", creditCost: 1, category: "plant" },
        { id: "gs5", title: "مبل متناسب با سبک", desc: "هماهنگ‌سازی رنگ و فرم مبلمان با سبک و پالت رنگی فضا.", impact: "high", creditCost: 5, category: "sofa" },
      ],
    };
  },

  async recommendProducts(input) {
    await new Promise((r) => setTimeout(r, 900));
    // Match from REAL catalog — never invent product IDs
    const catalog: ProductCatalogEntry[] = products.map((p) => ({
      id: p.id, category: p.categorySlug, styleSlugs: p.styleSlugs as string[], price: p.price, inStock: p.inStock,
    }));
    const styleMap: Record<string, string> = { modern: "modern", classic: "classic", minimalist: "minimal", scandinavian: "scandinavian" };
    const { matchProducts, detectIntent } = await import("./roomState");
    const intent = detectIntent(input.prompt || "", input.style);
    return matchProducts(catalog, intent, styleMap, undefined, 5);
  },
};

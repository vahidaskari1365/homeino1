// ============================================================
// تست قرارداد نگارش انسانی هومینو (Task 38)
// منبع: scripts/lib/style-contract.mjs
//   ادغام بومی‌شدهٔ github.com/petergyang/no-ai-slop (MIT)
//   + github.com/ayghri/i-have-adhd (MIT)
// شامل گارد سیم‌کشی: اسکریپت‌های محتوا باید قرارداد را تزریق و گیت slop را داشته باشند.
// ============================================================
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  WRITING_CONTRACT,
  SLOP_HARD,
  SLOP_SOFT,
  slopVerdict,
  buildSlopRetryHint,
} from "../../scripts/lib/style-contract.mjs";

describe("style-contract — تشخیص الگوهای ماشینی", () => {
  it("متن انسانیِ تمیز، تمیز گزارش می‌شود", () => {
    const text =
      "مبل راحتی سه‌نفره با پارچه مخمل گردویی؛ برای نشیمن ۳×۴ متری مناسب است. " +
      "پایه‌های چوب بلوط ارتفاع ۱۸ سانتی‌متر دارند و زیر مبل را برای جاروکشی آزاد می‌گذارند.";
    const v = slopVerdict(text);
    expect(v.clean).toBe(true);
    expect(v.hard).toHaveLength(0);
  });

  it("مقدمه‌چینی و تذکر اداری فارسی را می‌گیرد", () => {
    const v = slopVerdict("در دنیای امروز، دکوراسیون خانه مهم است. شایان ذکر است که انتخاب فرش باید دقیق باشد.");
    expect(v.clean).toBe(false);
    const phrases = v.hard.map((h) => h.phrase);
    expect(phrases).toContain("در دنیای امروز");
    expect(phrases).toContain("شایان ذکر است");
  });

  it("استناد عروسکی و اختتامیهٔ وبلاگی را می‌گیرد", () => {
    const v = slopVerdict("کارشناسان می‌گویند رنگ سال آبی است. امیدواریم این مطلب مفید بوده باشد.");
    expect(v.hard.map((h) => h.phrase)).toContain("کارشناسان میگویند");
    expect(v.hard.map((h) => h.phrase)).toContain("امیدواریم این مطلب");
  });

  it("با نیم‌فاصله/فاصله/کشیدهٔ متفاوت هم می‌گیرد (نرمال‌سازی فارسی)", () => {
    expect(slopVerdict("بدون‌شک بهترین است").hard.length).toBe(1);
    expect(slopVerdict("بی شک بهترین است").hard.length).toBe(1);
    expect(slopVerdict("همان‌طور که می‌دانید مبل گران است").hard.map((h) => h.phrase)).toContain("همانطور که میدانید");
  });

  it("الگوهای انگلیسی را case-insensitive می‌گیرد", () => {
    const v = slopVerdict("It Is Important To Note that this sofa stands In The World Of comfort. Hope this helps!");
    const phrases = v.hard.map((h) => h.phrase);
    expect(phrases).toContain("it is important to note");
    expect(phrases).toContain("in the world of");
    expect(phrases).toContain("hope this helps");
  });

  it("فقط soft → clean می‌ماند ولی گزارش می‌شود", () => {
    const v = slopVerdict("این کمد بی‌نظیر است و یک طراحی robust هم دارد.");
    // «بی‌نظیر» فارسی soft + «robust» انگلیسی soft
    expect(v.clean).toBe(true);
    expect(v.soft.length).toBeGreaterThanOrEqual(2);
  });

  it("فهرست‌های ممنوعه خالی نیستند", () => {
    expect(SLOP_HARD.length).toBeGreaterThanOrEqual(40);
    expect(SLOP_SOFT.length).toBeGreaterThanOrEqual(15);
  });
});

describe("style-contract — تذکر بازنویسی", () => {
  it("hint شامل عبارت‌های یافته‌شده است", () => {
    const v = slopVerdict("در دنیای امروز گفتنی است که ...");
    const hint = buildSlopRetryHint(v.hard);
    expect(hint).toContain("«در دنیای امروز»");
    expect(hint).toContain("«گفتنی است»");
    expect(hint).toContain("بازنویسی");
  });

  it("برای متن تمیز hint خالی است", () => {
    expect(buildSlopRetryHint([])).toBe("");
  });
});

describe("style-contract — خودِ قرارداد", () => {
  it("قواعد کلیدی i-have-adhd + no-ai-slop در متن قرارداد هست", () => {
    expect(WRITING_CONTRACT).toContain("مستقیم شروع کن");
    expect(WRITING_CONTRACT).toContain("ادعای بی‌منبع ممنوع");
    expect(WRITING_CONTRACT).toContain("جمع‌بندی تکراری ممنوع");
    expect(WRITING_CONTRACT).toContain("اغراق و تملق ممنوع");
  });
});

describe("style-contract — گارد سیم‌کشی اسکریپت‌های محتوا", () => {
  const repo = process.cwd();
  const readScript = (name: string) => readFileSync(path.join(repo, "scripts", name), "utf8");

  it("magazine-daily قرارداد را تزریق و گیت slop دارد", () => {
    const src = readScript("magazine-daily.mjs");
    expect(src).toContain('from "./lib/style-contract.mjs"');
    expect(src).toContain("WRITING_CONTRACT");
    expect(src).toContain("slopVerdict");
    expect(src).toContain("buildSlopRetryHint");
    // گیت بریف (۲ فراخوان) + گیت مقاله (۲ فراخوان) هر دو باید باشند
    expect(src.match(/slopVerdict\(/g)?.length).toBeGreaterThanOrEqual(4);
  });

  it("inspiration-daily قرارداد را تزریق و گیت slop دارد", () => {
    const src = readScript("inspiration-daily.mjs");
    expect(src).toContain('from "./lib/style-contract.mjs"');
    expect(src).toContain("${WRITING_CONTRACT}");
    expect(src.match(/slopVerdict\(/g)?.length).toBeGreaterThanOrEqual(4);
  });
});

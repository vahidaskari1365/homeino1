// ============================================================
// NOTIFICATION PREFERENCES — Re-engagement architecture.
// Frontend-ready for backend notification system.
// Today: preferences stored in localStorage.
// Future: POST /api/notifications → push/email/SMS.
// ============================================================

export type NotificationChannel = "in_app" | "email" | "push" | "sms";

export type NotificationType =
  | "price_drop"           // محصول ذخیره‌شده ارزان‌تر شد
  | "back_in_stock"        // محصول ناموجود موجود شد
  | "design_reminder"      // یادآوری طراحی ناتمام
  | "new_product"          // محصول جدید در دسته‌ی مورد‌علاقه
  | "ai_suggestion"        // پیشنهاد طراحی جدید
  | "credit_bonus"         // پاداش/اعتبار اضافی
  | "order_update"         // وضعیت سفارش
  | "store_update"         // فروشگاه دنبال‌شده محصول جدید
  | "style_trend";         // ترند جدید در سبک دنبال‌شده

export interface NotificationPreference {
  type: NotificationType;
  enabled: boolean;
  channels: NotificationChannel[];
}

export const DEFAULT_NOTIFICATION_PREFS: NotificationPreference[] = [
  { type: "price_drop", enabled: true, channels: ["in_app", "email"] },
  { type: "back_in_stock", enabled: true, channels: ["in_app"] },
  { type: "design_reminder", enabled: true, channels: ["in_app"] },
  { type: "new_product", enabled: false, channels: ["in_app"] },
  { type: "ai_suggestion", enabled: true, channels: ["in_app"] },
  { type: "credit_bonus", enabled: true, channels: ["in_app", "email"] },
  { type: "order_update", enabled: true, channels: ["in_app", "email", "sms"] },
  { type: "store_update", enabled: false, channels: ["in_app"] },
  { type: "style_trend", enabled: false, channels: ["in_app"] },
];

// ---- Display labels ----
export const NOTIFICATION_LABELS: Record<NotificationType, { title: string; desc: string }> = {
  price_drop: { title: "کاهش قیمت محصول", desc: "وقتی محصول ذخیره‌شده‌ات ارزان‌تر شد" },
  back_in_stock: { title: "موجود شدن محصول", desc: "وقتی محصول ناموجود دوباره موجود شد" },
  design_reminder: { title: "یادآوری طراحی", desc: "یادآوری طراحی‌های ناتمام" },
  new_product: { title: "محصول جدید", desc: "محصول جدید در دسته‌های موردعلاقه" },
  ai_suggestion: { title: "پیشنهاد هوش مصنوعی", desc: "ایده‌های طراحی جدید بر اساس سلیقه‌ات" },
  credit_bonus: { title: "پاداش و اعتبار", desc: "اعتبار هدیه و کمپین‌های تخفیف" },
  order_update: { title: "وضعیت سفارش", desc: "به‌روزرسانی وضعیت ارسال و تحویل" },
  store_update: { title: "فروشگاه‌های دنبال‌شده", desc: "محصول جدید از فروشگاه‌های دنبال‌شده" },
  style_trend: { title: "ترند سبک‌ها", desc: "ترندهای جدید در سبک‌های موردعلاقه" },
};

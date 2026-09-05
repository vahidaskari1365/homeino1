"use client";
// «آدرس‌های من» — the customer's delivery address book.
import { useState } from "react";
import { MapPin, Plus, Trash2, Pencil, BadgeCheck, RefreshCcw } from "lucide-react";
import { Button, EmptyState, Badge, ConfirmDialog } from "@/components/ui/primitives";
import { listSavedAddresses, addSavedAddress, updateSavedAddress, deleteSavedAddress, setDefaultAddress, type SavedAddress } from "@/data/localAddresses";
import { useHasHydrated } from "@/lib/useHasHydrated";
import { useUi } from "@/stores/useApp";
import { fromFa } from "@/lib/utils";

const input = "w-full rounded-xl border border-clay/60 bg-cream p-2.5 text-sm outline-none focus:border-ink";

export default function AddressBookPage() {
  const { toast } = useUi();
  const hydrated = useHasHydrated();
  const [version, setVersion] = useState(0);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<SavedAddress | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<SavedAddress | null>(null);
  const addresses = hydrated ? listSavedAddresses() : [];

  const openNew = () => { setEditing(null); setShowForm(true); };
  const openEdit = (address: SavedAddress) => { setEditing(address); setShowForm(true); };
  const closeForm = () => { setShowForm(false); setEditing(null); };

  function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const digits = (key: string) => fromFa(String(fd.get(key) ?? "")).replace(/[^\d]/g, "");
    const draft = {
      label: String(fd.get("label") ?? ""),
      fullName: String(fd.get("fullName") ?? ""),
      phone: digits("phone"),
      city: String(fd.get("city") ?? ""),
      postalCode: digits("postalCode"),
      line: String(fd.get("line") ?? ""),
    };
    const result = editing ? updateSavedAddress(editing.id, draft) : addSavedAddress(draft);
    if (!result.ok) { toast(result.error, "error"); return; }
    setVersion((v) => v + 1);
    closeForm();
    toast(editing ? "آدرس به‌روزرسانی شد" : "آدرس ذخیره شد — از این به بعد در پرداخت پیشنهاد می‌شود");
  }

  return (
    <div className="space-y-5" data-addresses-version={version}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-black text-ink">آدرس‌های من</h1>
          <p className="text-sm text-ink-muted">دفترچهٔ نشانی تو — در پرداخت، یک‌بار انتخاب کافی است.</p>
        </div>
        {!showForm && <Button onClick={openNew}><Plus size={16} /> آدرس جدید</Button>}
      </div>

      {showForm && (
        <form key={editing?.id ?? "new"} onSubmit={save} className="card-surface space-y-4 p-6">
          <h2 className="flex items-center gap-2 font-display text-lg font-bold text-ink"><MapPin size={18} /> {editing ? "ویرایش آدرس" : "آدرس جدید"}</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div><label htmlFor="addr-label" className="mb-1 block text-sm text-ink-muted">برچسب (خانه، محل کار…)</label><input id="addr-label" name="label" placeholder="خانه" className={input} /></div>
            <div><label htmlFor="addr-fullName" className="mb-1 block text-sm text-ink-muted">نام و نام خانوادگی گیرنده</label><input id="addr-fullName" name="fullName" required defaultValue={editing?.fullName} placeholder="نام کامل" className={input} /></div>
            <div><label htmlFor="addr-phone" className="mb-1 block text-sm text-ink-muted">شماره موبایل</label><input id="addr-phone" name="phone" required inputMode="tel" dir="ltr" defaultValue={editing?.phone} placeholder="09xxxxxxxxx" className={input} /></div>
            <div><label htmlFor="addr-city" className="mb-1 block text-sm text-ink-muted">شهر</label><input id="addr-city" name="city" required defaultValue={editing?.city} placeholder="شهر" className={input} /></div>
            <div><label htmlFor="addr-postal" className="mb-1 block text-sm text-ink-muted">کد پستی (اختیاری)</label><input id="addr-postal" name="postalCode" inputMode="numeric" dir="ltr" defaultValue={editing?.postalCode} placeholder="10 رقم" className={input} /></div>
          </div>
          <div><label htmlFor="addr-line" className="mb-1 block text-sm text-ink-muted">نشانی کامل</label><textarea id="addr-line" name="line" required rows={2} defaultValue={editing?.line} placeholder="استان، شهر، خیابان، پلاک…" className={`${input} resize-none`} /></div>
          <div className="flex gap-2">
            <Button type="submit">{editing ? "ذخیره تغییرات" : "ذخیره آدرس"}</Button>
            <Button type="button" variant="ghost" onClick={closeForm}>انصراف</Button>
          </div>
        </form>
      )}

      {addresses.length ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {addresses.map((address) => (
            <div key={address.id} className="card-surface flex flex-col gap-2 p-4">
              <div className="flex items-start justify-between gap-2">
                <h3 className="flex items-center gap-1.5 font-display font-bold text-ink"><MapPin size={15} className="text-ink-muted" /> {address.label}</h3>
                {address.isDefault && <Badge tone="success"><BadgeCheck size={12} /> پیش‌فرض</Badge>}
              </div>
              <p className="text-sm text-ink">{address.fullName} · <span dir="ltr">{address.phone}</span></p>
              <p className="text-xs leading-6 text-ink-muted">{address.city} — {address.line}{address.postalCode ? ` · کدپستی ${address.postalCode}` : ""}</p>
              <div className="mt-auto flex gap-1.5 pt-2">
                {!address.isDefault && (
                  <Button size="sm" variant="outline" onClick={() => { if (setDefaultAddress(address.id)) { setVersion((v) => v + 1); toast("آدرس پیش‌فرض تغییر کرد"); } }}><BadgeCheck size={14} /> پیش‌فرض</Button>
                )}
                <Button size="sm" variant="outline" onClick={() => openEdit(address)}><Pencil size={14} /> ویرایش</Button>
                <Button size="sm" variant="ghost" className="text-danger" onClick={() => setConfirmDelete(address)}><Trash2 size={14} /> حذف</Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        !showForm && (
          <EmptyState
            icon={<MapPin size={28} />}
            title="هنوز آدرسی ذخیره نکرده‌ای"
            desc="نشانی‌های پرتکرارت را یک‌بار ذخیره کن تا در پرداخت‌های بعدی فقط انتخابش کنی."
            action={<Button onClick={openNew}><Plus size={16} /> ثبت اولین آدرس</Button>}
          />
        )
      )}

      {addresses.length > 0 && (
        <p className="flex items-center gap-2 text-[11px] text-ink-muted"><RefreshCcw size={12} /> آدرس‌ها فقط در همین مرورگر ذخیره می‌شوند و در مرحلهٔ نشانیِ پرداخت به‌صورت آماده پیشنهاد می‌شوند.</p>
      )}

      <ConfirmDialog
        open={Boolean(confirmDelete)}
        onClose={() => setConfirmDelete(null)}
        onConfirm={() => {
          if (confirmDelete && deleteSavedAddress(confirmDelete.id)) {
            setVersion((v) => v + 1);
            toast("آدرس حذف شد");
          }
        }}
        title="حذف این آدرس"
        description={`«${confirmDelete?.label ?? ""}» از دفترچهٔ آدرس‌های تو حذف می‌شود.`}
        confirmLabel="حذف کن"
        destructive
      />
    </div>
  );
}

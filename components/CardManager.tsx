import React, { useState } from "react";
import { Card as CardType } from "./types";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Checkbox } from "./ui/checkbox";
import { Plus, Trash2, CreditCard } from "lucide-react";

interface Props {
  cards: CardType[];
  token: string;
  onRefresh: () => void;
  onUnauthorized: () => void;
}

const emptyForm = {
  name: "", last4: "", statementDay: "1", dueDay: "15", note: "",
  payReminderEnabled: true,          // 結帳隔天提醒可繳費
  dueReminderEnabled: true,          // 繳費到期前提醒
  dueReminderDaysBefore: "3",
};

export default function CardManager({ cards, token, onRefresh, onUnauthorized }: Props) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(false);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/card", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          name: form.name,
          last4: form.last4,
          statementDay: form.statementDay,
          dueDay: form.dueDay,
          note: form.note,
          payReminder: { enabled: form.payReminderEnabled, daysAfter: 1 },
          dueReminder: { enabled: form.dueReminderEnabled, daysBefore: Number(form.dueReminderDaysBefore) || 0 },
        }),
      });
      if (res.status === 401) { onUnauthorized(); return; }
      if (res.ok) { setForm(emptyForm); setOpen(false); onRefresh(); }
    } finally { setLoading(false); }
  }

  async function handleDelete(id: string) {
    setLoading(true);
    try {
      const res = await fetch("/api/card", {
        method: "DELETE",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ id }),
      });
      if (res.status === 401) { onUnauthorized(); return; }
      if (res.ok) onRefresh();
    } finally { setLoading(false); }
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <div className="text-sm font-semibold text-muted-foreground">信用卡</div>
        <Button size="sm" variant="outline" onClick={() => setOpen(true)}><Plus className="w-4 h-4 mr-1" />新增卡片</Button>
      </div>
      {cards.length === 0 ? (
        <div className="text-sm text-muted-foreground py-4 text-center">尚未新增信用卡</div>
      ) : (
        <div className="rounded-lg border divide-y bg-card">
          {cards.map(card => (
            <div key={card._id} className="flex items-center px-4 py-3 gap-3">
              <CreditCard className="w-5 h-5 text-muted-foreground" />
              <div className="flex-1 min-w-0">
                <div className="font-semibold truncate">{card.name}{card.last4 && ` ****${card.last4}`}</div>
                <div className="text-xs text-muted-foreground mt-0.5">結帳 {card.statementDay} 號 · 繳費截止 {card.dueDay} 號</div>
              </div>
              <button type="button" className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700" onClick={() => handleDelete(card._id)} aria-label="刪除">
                <Trash2 className="w-4 h-4 text-destructive" />
              </button>
            </div>
          ))}
        </div>
      )}
      <Dialog open={open} onOpenChange={v => { setOpen(v); if (!v) setForm(emptyForm); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>新增信用卡</DialogTitle></DialogHeader>
          <form className="flex flex-col gap-4 mt-4" onSubmit={handleAdd}>
            <div>
              <label className="block mb-1 text-sm font-medium">卡片名稱</label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="例：國泰 CUBE" required />
            </div>
            <div>
              <label className="block mb-1 text-sm font-medium">末四碼（可選）</label>
              <Input value={form.last4} onChange={e => setForm(f => ({ ...f, last4: e.target.value }))} maxLength={4} inputMode="numeric" />
            </div>
            <div className="flex gap-4">
              <div className="flex-1">
                <label className="block mb-1 text-sm font-medium">結帳日</label>
                <Input type="number" min={1} max={31} value={form.statementDay} onChange={e => setForm(f => ({ ...f, statementDay: e.target.value }))} required />
              </div>
              <div className="flex-1">
                <label className="block mb-1 text-sm font-medium">繳費截止日</label>
                <Input type="number" min={1} max={31} value={form.dueDay} onChange={e => setForm(f => ({ ...f, dueDay: e.target.value }))} required />
              </div>
            </div>
            <div className="space-y-3 rounded-md border p-3">
              <div className="text-sm font-medium">提醒</div>
              <div className="flex items-center gap-2">
                <Checkbox id="card-pay-reminder" checked={form.payReminderEnabled} onCheckedChange={v => setForm(f => ({ ...f, payReminderEnabled: !!v }))} />
                <label htmlFor="card-pay-reminder" className="text-sm select-none cursor-pointer">結帳隔天提醒可繳費</label>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <Checkbox id="card-due-reminder" checked={form.dueReminderEnabled} onCheckedChange={v => setForm(f => ({ ...f, dueReminderEnabled: !!v }))} />
                  <label htmlFor="card-due-reminder" className="text-sm select-none cursor-pointer">繳費到期前提醒</label>
                </div>
                {form.dueReminderEnabled && (
                  <div className="mt-2 flex items-center gap-2 pl-6">
                    <span className="text-sm text-muted-foreground">提前</span>
                    <Input type="number" min={0} className="w-20" value={form.dueReminderDaysBefore} onChange={e => setForm(f => ({ ...f, dueReminderDaysBefore: e.target.value }))} />
                    <span className="text-sm text-muted-foreground">天</span>
                  </div>
                )}
              </div>
            </div>
            <div>
              <label className="block mb-1 text-sm font-medium">備註</label>
              <Input value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} placeholder="備註 (可選)" />
            </div>
            <Button type="submit" className="mt-2" disabled={loading}>{loading ? "新增中..." : "新增卡片"}</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

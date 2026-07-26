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

type CardForm = {
  name: string;
  last4: string;
  statementDay: string;
  dueDay: string;
  note: string;
  payReminderEnabled: boolean;      // 結帳隔天提醒可繳費
  dueReminderEnabled: boolean;      // 繳費到期前提醒
  dueReminderDaysBefore: string;
};

const emptyForm: CardForm = {
  name: "", last4: "", statementDay: "1", dueDay: "", note: "",
  payReminderEnabled: true,
  dueReminderEnabled: true,
  dueReminderDaysBefore: "3",
};

// 由既有卡片資料建立表單初始值（含舊資料相容：單一 reminder 視為到期前提醒）。
function cardToForm(card: CardType): CardForm {
  const due = card.dueReminder ?? card.reminder;
  return {
    name: card.name,
    last4: card.last4 ?? "",
    statementDay: String(card.statementDay),
    dueDay: card.dueDay != null ? String(card.dueDay) : "",
    note: card.note ?? "",
    payReminderEnabled: card.payReminder?.enabled ?? false,
    dueReminderEnabled: due?.enabled ?? false,
    dueReminderDaysBefore: String(due?.daysBefore ?? 3),
  };
}

export default function CardManager({ cards, token, onRefresh, onUnauthorized }: Props) {
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<CardForm>(emptyForm);
  const [loading, setLoading] = useState(false);

  function openAdd() {
    setForm(emptyForm);
    setEditingId(null);
    setOpen(true);
  }

  function openEdit(card: CardType) {
    setForm(cardToForm(card));
    setEditingId(card._id);
    setOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const body = {
      name: form.name,
      last4: form.last4,
      statementDay: form.statementDay,
      dueDay: form.dueDay,
      note: form.note,
      payReminder: { enabled: form.payReminderEnabled, daysAfter: 1 },
      dueReminder: { enabled: form.dueDay !== "" && form.dueReminderEnabled, daysBefore: Number(form.dueReminderDaysBefore) || 0 },
    };
    try {
      const res = await fetch(editingId ? `/api/card/${editingId}` : "/api/card", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      if (res.status === 401) { onUnauthorized(); return; }
      if (res.ok) { setForm(emptyForm); setEditingId(null); setOpen(false); onRefresh(); }
    } finally { setLoading(false); }
  }

  async function handleDelete() {
    if (!editingId) return;
    setLoading(true);
    try {
      const res = await fetch("/api/card", {
        method: "DELETE",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ id: editingId }),
      });
      if (res.status === 401) { onUnauthorized(); return; }
      if (res.ok) { setForm(emptyForm); setEditingId(null); setOpen(false); onRefresh(); }
    } finally { setLoading(false); }
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <div className="text-sm font-semibold text-muted-foreground">信用卡</div>
        <Button size="sm" variant="outline" onClick={openAdd}><Plus className="w-4 h-4 mr-1" />新增卡片</Button>
      </div>
      {cards.length === 0 ? (
        <div className="text-sm text-muted-foreground py-4 text-center">尚未新增信用卡</div>
      ) : (
        <div className="rounded-lg border divide-y bg-card">
          {cards.map(card => (
            <button
              key={card._id}
              type="button"
              onClick={() => openEdit(card)}
              className="w-full flex items-center px-4 py-3 gap-3 text-left hover:bg-muted transition-colors"
            >
              <CreditCard className="w-5 h-5 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="font-semibold truncate">{card.name}{card.last4 && ` ****${card.last4}`}</div>
                <div className="text-xs text-muted-foreground mt-0.5">結帳 {card.statementDay} 號{card.dueDay != null ? ` · 繳費截止 ${card.dueDay} 號` : ""}</div>
              </div>
            </button>
          ))}
        </div>
      )}
      <Dialog open={open} onOpenChange={v => { setOpen(v); if (!v) { setForm(emptyForm); setEditingId(null); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingId ? "編輯信用卡" : "新增信用卡"}</DialogTitle></DialogHeader>
          <form className="flex flex-col gap-4 mt-4" onSubmit={handleSubmit}>
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
                <label className="block mb-1 text-sm font-medium">繳費截止日（選填）</label>
                <Input type="number" min={1} max={31} placeholder="選填" value={form.dueDay} onChange={e => setForm(f => ({ ...f, dueDay: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-3 rounded-md border p-3">
              <div className="text-sm font-medium">提醒</div>
              <div className="flex items-center gap-2">
                <Checkbox id="card-pay-reminder" checked={form.payReminderEnabled} onCheckedChange={v => setForm(f => ({ ...f, payReminderEnabled: !!v }))} />
                <label htmlFor="card-pay-reminder" className="text-sm select-none cursor-pointer">結帳隔天提醒可繳費</label>
              </div>
              {form.dueDay !== "" && (
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
              )}
            </div>
            <div>
              <label className="block mb-1 text-sm font-medium">備註</label>
              <Input value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} placeholder="備註 (可選)" />
            </div>
            <div className="flex gap-2 mt-2">
              <Button type="submit" className="flex-1" disabled={loading}>{loading ? "儲存中..." : editingId ? "儲存" : "新增卡片"}</Button>
              {editingId && (
                <Button type="button" variant="destructive" onClick={handleDelete} disabled={loading} aria-label="刪除卡片"><Trash2 className="w-4 h-4" /></Button>
              )}
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

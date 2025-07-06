import React, { useState } from "react";
import { Subscription } from "./types";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { Button } from "./ui/button";
import { format } from "date-fns";
import { ChevronDown, ChevronUp } from "lucide-react";
import { formatNumberWithCommas } from "@/lib/utils";
import { Input } from "./ui/input";
import { Checkbox } from "./ui/checkbox";

interface SubscriptionListProps {
  subscriptions: Subscription[];
  mode: 'monthly' | 'halfyear' | 'yearly';
  token: string;
  onRefresh: () => void;
}

export default function SubscriptionList({ subscriptions, mode, token, onRefresh }: SubscriptionListProps) {
  const [loading, setLoading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [sortBy, setSortBy] = useState<'amount' | 'date'>("amount");
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>("desc");
  // 新增：展開狀態
  const [expandedId, setExpandedId] = useState<string | null>(null);
  // Dialog 狀態
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Subscription | null>(null);
  // 編輯狀態
  const [editMode, setEditMode] = useState(false);
  const [form, setForm] = useState<Subscription | null>(null);

  function convert(amount: number, cycle: string) {
    if (mode === 'monthly') {
      if (cycle === 'monthly') return amount;
      if (cycle === 'halfyear') return amount / 6;
      if (cycle === 'yearly') return amount / 12;
    }
    if (mode === 'halfyear') {
      if (cycle === 'monthly') return amount * 6;
      if (cycle === 'halfyear') return amount;
      if (cycle === 'yearly') return amount / 2;
    }
    if (mode === 'yearly') {
      if (cycle === 'monthly') return amount * 12;
      if (cycle === 'halfyear') return amount * 2;
      if (cycle === 'yearly') return amount;
    }
    return amount;
  }

  // 計算下次帳單日
  function getNextBillingDate(sub: Subscription) {
    const now = new Date();
    let billingDate = new Date(sub.billingDate);
    while (billingDate < now) {
      billingDate = new Date(billingDate); // 複製
      if (sub.cycle === 'monthly') {
        billingDate.setMonth(billingDate.getMonth() + 1);
      } else if (sub.cycle === 'halfyear') {
        billingDate.setMonth(billingDate.getMonth() + 6);
      } else if (sub.cycle === 'yearly') {
        billingDate.setFullYear(billingDate.getFullYear() + 1);
      }
    }
    return billingDate;
  }

  // 幣別對台幣匯率（可依實際需求調整）
  const EXCHANGE_RATE: Record<string, number> = {
    TWD: 1,
    USD: 32,
    JPY: 0.21,
    EUR: 35,
    HKD: 4.1,
    CNY: 4.5
  };

  // 換算成台幣金額，並依 mode 換算週期
  function toTWD(amount: number, currency: string) {
    return amount * (EXCHANGE_RATE[currency] || 1);
  }

  // 排序狀態循環
  const sortStates: Array<{ by: 'amount' | 'date', order: 'asc' | 'desc' }> = [
    { by: 'amount', order: 'asc' },
    { by: 'amount', order: 'desc' },
    { by: 'date', order: 'asc' },
    { by: 'date', order: 'desc' },
  ];
  const currentSortIndex = sortStates.findIndex(s => s.by === sortBy && s.order === sortOrder);
  function handleSortClick() {
    const next = sortStates[(currentSortIndex + 1) % sortStates.length];
    setSortBy(next.by);
    setSortOrder(next.order);
  }
  function getSortLabel() {
    if (sortBy === 'amount') return '依金額排序';
    return '依日期排序';
  }
  function getSortIcon() {
    return sortOrder === 'asc' ? <ChevronUp className="w-4 h-4 inline ml-1" /> : <ChevronDown className="w-4 h-4 inline ml-1" />;
  }

  // 排序 subscriptions，依照 mode 換算後的台幣金額
  const sortedSubscriptions = [...subscriptions].sort((a, b) => {
    if (sortBy === 'amount') {
      // 先換算成對應 mode 的金額，再換算台幣
      const aAmount = toTWD(convert(Number(a.price) || 0, a.cycle), a.currency);
      const bAmount = toTWD(convert(Number(b.price) || 0, b.cycle), b.currency);
      return sortOrder === 'asc' ? aAmount - bAmount : bAmount - aAmount;
    } else {
      const dateA = getNextBillingDate(a).getTime();
      const dateB = getNextBillingDate(b).getTime();
      return sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
    }
  });

  // 儲存編輯
  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!selected || !form) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/subscription/${selected._id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          ...form,
          price: parseFloat(String(form.price)),
          billingDate: new Date(form.billingDate)
        })
      });
      if (res.ok) {
        setOpen(false);
        setEditMode(false);
        onRefresh();
      }
    } finally {
      setLoading(false);
    }
  }

  // 點擊刪除
  async function handleDelete() {
    if (!selected) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/subscription/${selected._id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      if (res.ok) {
        setOpen(false);
        setEditMode(false);
        setConfirmDelete(false);
        onRefresh();
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div className="flex items-center justify-between mb-2">
        <div className="font-bold text-lg"></div>
        <button
          type="button"
          className="text-xs px-2 py-1 flex items-center hover:underline focus:outline-none bg-transparent"
          onClick={handleSortClick}
        >
          {getSortLabel()}
          {getSortIcon()}
        </button>
      </div>
      <div className="rounded-lg border divide-y bg-card">
        {sortedSubscriptions.map(sub => {
          const total = Number(sub.price) || 0;
          const self = Number(sub.selfRatio) || 1;
          const adv = Number(sub.advanceRatio) || 0;
          // 代墊金額
          const advanceAmount = sub.isAdvance ? toTWD(convert(total * (adv / (self + adv)), sub.cycle), sub.currency) : 0;
          const isExpanded = expandedId === sub._id;
          return (
            <div key={sub._id} className="transition-all">
              {/* 卡片頭部 */}
              <div className="flex items-center px-4 py-3 gap-3 w-full text-left">
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-base truncate flex items-center gap-1">
                    {sub.name}
                    {sub.isAdvance && (
                      <span className="ml-1 text-xs text-blue-500 border border-blue-200 rounded px-1">含代墊</span>
                    )}
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    每{sub.cycle === 'monthly' ? '月' : sub.cycle === 'halfyear' ? '半年' : '年'}{new Date(sub.billingDate).getDate()}號
                  </div>
                </div>
                <div className="text-lg font-bold whitespace-nowrap">
                  ${formatNumberWithCommas(Math.floor(convert(total, sub.cycle)))} {sub.currency}
                  {/* <span className="text-xs text-gray-500 ml-2">（${formatNumberWithCommas(Math.floor(displayAmount))} TWD）</span> */}
                </div>
                <button
                  type="button"
                  className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition"
                  onClick={() => setExpandedId(isExpanded ? null : sub._id)}
                  aria-label={isExpanded ? '收合' : '展開'}
                >
                  {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                </button>
              </div>
              {/* 展開內容 */}
              {isExpanded && (
                <div className="bg-muted px-6 py-3 text-sm text-gray-700 dark:text-gray-200 border-t">
                  <div className="mb-1">自己負擔：<span className="font-bold">${formatNumberWithCommas(Math.floor(toTWD(convert(total * (self / (self + (sub.isAdvance ? adv : 0))), sub.cycle), sub.currency)))} TWD</span></div>
                  <div className="mb-1">週期：{sub.cycle === 'monthly' ? '每月' : sub.cycle === 'halfyear' ? '每半年' : '每年'}</div>
                  <div className="mb-1">下次帳單日：{format(getNextBillingDate(sub), 'yyyy-MM-dd')}</div>
                  {sub.isAdvance && (
                    <>
                      <div className="mb-1">代墊金額：<span className="font-bold">${formatNumberWithCommas(Math.floor(advanceAmount))} TWD</span></div>
                      <div className="mb-1 text-xs text-gray-500">（總金額 × 代墊比例 / 總比例，已依週期換算）</div>
                      <div className="mb-1">分攤比例：自己 {sub.selfRatio}，代墊 {sub.advanceRatio}</div>
                    </>
                  )}
                  {sub.note && <div className="mt-2 text-xs text-gray-500">備註：{sub.note}</div>}
                  <div className="mt-4 flex justify-end">
                    <Button size="sm" variant="outline" onClick={() => { setSelected(sub); setOpen(true); }}>查看詳情</Button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
      {/* 以下 Dialog 相關區塊全部移除 */}
      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>確認刪除</DialogTitle>
          </DialogHeader>
          <div className="mb-4">確定要刪除這筆訂閱嗎？此操作無法復原。</div>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setConfirmDelete(false)} disabled={loading}>取消</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={loading}>{loading ? "刪除中..." : "確定刪除"}</Button>
          </div>
        </DialogContent>
      </Dialog>
      {/* Dialog 詳細內容（原本的 Dialog 內容） */}
      <Dialog open={open} onOpenChange={v => { setOpen(v); if (!v) setEditMode(false); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>訂閱詳情</DialogTitle>
          </DialogHeader>
          {selected && (
            <div>
              <form className="flex flex-col gap-4 mt-4" onSubmit={handleSave}>
                <div>
                  <label className="block mb-1 text-sm font-medium">訂閱名稱</label>
                  <Input value={editMode && form ? form.name : selected.name} onChange={e => editMode && form && setForm({ ...form, name: e.target.value })} disabled={!editMode} required />
                </div>
                <div>
                  <label className="block mb-1 text-sm font-medium">金額</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-base">$</span>
                    <Input type="number" value={editMode && form ? (form.price ?? "") : (selected.price ?? "")} onChange={e => editMode && form && setForm({ ...form, price: e.target.value === "" ? 0 : Number(e.target.value) })} disabled={!editMode} required className="pl-6" />
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <Checkbox id="advance" checked={editMode && form ? form.isAdvance : selected.isAdvance} onCheckedChange={v => editMode && form && setForm({ ...form, isAdvance: !!v })} disabled={!editMode} />
                    <label htmlFor="advance" className="text-sm select-none cursor-pointer">此訂閱包含代墊</label>
                  </div>
                  {(editMode && form ? form.isAdvance : selected.isAdvance) && (
                    <div className="flex gap-4 mt-2">
                      <div>
                        <label className="block mb-1 text-xs font-medium">自己出的比例</label>
                        <Input type="number" value={editMode && form ? (form.selfRatio ?? "") : (selected.selfRatio ?? "")} onChange={e => editMode && form && setForm({ ...form, selfRatio: e.target.value === "" ? 1 : Math.max(1, Number(e.target.value) || 1) })} disabled={!editMode} className="w-20" />
                      </div>
                      <div>
                        <label className="block mb-1 text-xs font-medium">代墊的比例</label>
                        <Input type="number" value={editMode && form ? (form.advanceRatio ?? "") : (selected.advanceRatio ?? "")} onChange={e => editMode && form && setForm({ ...form, advanceRatio: e.target.value === "" ? 1 : Math.max(1, Number(e.target.value) || 1) })} disabled={!editMode} className="w-20" />
                      </div>
                      <div>
                        <label className="block mb-1 text-xs font-medium">每一份比例金額</label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-base">$</span>
                          <Input
                            type="number"
                            value={(() => {
                              const total = Number(editMode && form ? form.price ?? 0 : selected.price) || 0;
                              const ratio = Number(editMode && form ? form.selfRatio ?? 0 : selected.selfRatio) + Number(editMode && form ? form.advanceRatio ?? 0 : selected.advanceRatio);
                              return ratio > 0 ? String(Math.floor(total / ratio)) : "";
                            })()}
                            disabled
                            className="w-28 bg-muted pl-6"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                <div className="w-full">
                  <label className="block mb-1 text-sm font-medium">幣別</label>
                  <Input value={editMode && form ? form.currency : selected.currency} onChange={v => editMode && form && setForm({ ...form, currency: v.target.value })} disabled={!editMode} className="w-full" />
                </div>
                <div className="w-full">
                  <label className="block mb-1 text-sm font-medium">帳單起始日</label>
                  <Input value={editMode && form ? (form.billingDate ? format(new Date(form.billingDate), "yyyy-MM-dd") : "") : (selected.billingDate ? format(new Date(selected.billingDate), "yyyy-MM-dd") : "")} onChange={e => editMode && form && setForm({ ...form, billingDate: e.target.value })} disabled={!editMode} className="w-full" />
                </div>
                <div>
                  <label className="block mb-1 text-sm font-medium">週期</label>
                  <Input value={editMode && form ? form.cycle : selected.cycle} onChange={e => editMode && form && setForm({ ...form, cycle: e.target.value })} disabled={!editMode} className="w-full" />
                </div>
                <div>
                  <label className="block mb-1 text-sm font-medium">備註</label>
                  <Input value={editMode && form ? form.note || "" : selected.note || ""} onChange={e => editMode && form && setForm({ ...form, note: e.target.value })} disabled={!editMode} placeholder="備註 (可選)" />
                </div>
                <div className="flex gap-2 justify-end mt-6">
                  {editMode ? (
                    <>
                      <Button type="submit" variant="default" disabled={loading}>{loading ? "儲存中..." : "儲存"}</Button>
                      <Button type="button" variant="outline" onClick={() => setEditMode(false)} disabled={loading}>取消</Button>
                    </>
                  ) : (
                    <>
                      <Button type="button" variant="outline" onClick={e => { e.preventDefault(); setEditMode(true); setForm(selected); }}>編輯</Button>
                      <Button type="button" variant="destructive" onClick={() => setConfirmDelete(true)}>刪除</Button>
                    </>
                  )}
                </div>
              </form>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
} 
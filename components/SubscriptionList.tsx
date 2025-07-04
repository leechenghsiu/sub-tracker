import React, { useState } from "react";
import { Subscription } from "./types";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { Input } from "./ui/input";
import { Checkbox } from "./ui/checkbox";
import { Button } from "./ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Tabs, TabsList, TabsTrigger } from "./ui/tabs";
import { Calendar as CalendarIcon } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronUp } from "lucide-react";

interface SubscriptionListProps {
  subscriptions: Subscription[];
  mode: 'monthly' | 'halfyear' | 'yearly';
  token: string;
  onRefresh: () => void;
}

export default function SubscriptionList({ subscriptions, mode, token, onRefresh }: SubscriptionListProps) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Subscription | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [form, setForm] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [sortBy, setSortBy] = useState<'amount' | 'date'>("amount");
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>("desc");

  function handleClick(sub: Subscription) {
    setSelected(sub);
    setForm(sub);
    setEditMode(false);
    setOpen(true);
  }

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

  // 排序 subscriptions
  const sortedSubscriptions = [...subscriptions].sort((a, b) => {
    if (sortBy === 'amount') {
      const totalA = Number(a.price) || 0;
      const selfA = Number(a.selfRatio) || 1;
      const advA = Number(a.advanceRatio) || 0;
      const myAmountA = totalA * (selfA / (selfA + (a.isAdvance ? advA : 0)));
      const displayAmountA = convert(myAmountA, a.cycle);
      const totalB = Number(b.price) || 0;
      const selfB = Number(b.selfRatio) || 1;
      const advB = Number(b.advanceRatio) || 0;
      const myAmountB = totalB * (selfB / (selfB + (b.isAdvance ? advB : 0)));
      const displayAmountB = convert(myAmountB, b.cycle);
      return sortOrder === 'asc' ? displayAmountA - displayAmountB : displayAmountB - displayAmountA;
    } else {
      const dateA = getNextBillingDate(a).getTime();
      const dateB = getNextBillingDate(b).getTime();
      return sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
    }
  });

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
        <div className="font-bold text-lg">訂閱列表</div>
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
          const myAmount = total * (self / (self + (sub.isAdvance ? adv : 0)));
          const displayAmount = convert(myAmount, sub.cycle);
          return (
            <button
              key={sub._id}
              className="flex items-center px-4 py-3 gap-3 w-full text-left hover:bg-muted transition"
              onClick={() => handleClick(sub)}
              type="button"
            >
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-base truncate">{sub.name}</div>
                <div className="text-xs text-gray-500 mt-0.5">
                  每{sub.cycle === 'monthly' ? '月' : sub.cycle === 'halfyear' ? '半年' : '年'}{new Date(sub.billingDate).getDate()}號
                </div>
              </div>
              <div className="text-lg font-bold whitespace-nowrap">
                {Math.floor(displayAmount)} {sub.currency}
              </div>
            </button>
          );
        })}
      </div>
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
                  <Input value={editMode && form ? form.name : selected.name} onChange={e => form && setForm({ ...form, name: e.target.value })} disabled={!editMode} required />
                </div>
                <div>
                  <label className="block mb-1 text-sm font-medium">金額</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-base">$</span>
                    <Input
                      type="number"
                      value={editMode && form ? (form.price ?? "") : (selected.price ?? "")}
                      onChange={e => form && setForm({ ...form, price: e.target.value === "" ? 0 : Number(e.target.value) })}
                      disabled={!editMode}
                      required
                      className="pl-6"
                    />
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <Checkbox id="advance" checked={editMode && form ? form.isAdvance : selected.isAdvance} onCheckedChange={v => editMode && form && setForm({ ...form, isAdvance: !!v })} disabled={!editMode} />
                    <label htmlFor="advance" className="text-sm select-none cursor-pointer">此訂閱包含代墊</label>
                  </div>
                  {(editMode && form ? form.isAdvance : selected.isAdvance) && (
                    <div className="flex gap-4 mt-2">
                      <div>
                        <label className="block mb-1 text-xs font-medium">自己出的比例</label>
                        <Input
                          type="number"
                          value={editMode && form ? (form.selfRatio ?? "") : (selected.selfRatio ?? "")}
                          onChange={e => form && setForm({ ...form, selfRatio: e.target.value === "" ? 1 : Math.max(1, Number(e.target.value) || 1) })}
                          disabled={!editMode}
                          className="w-20"
                        />
                      </div>
                      <div>
                        <label className="block mb-1 text-xs font-medium">代墊的比例</label>
                        <Input
                          type="number"
                          value={editMode && form ? (form.advanceRatio ?? "") : (selected.advanceRatio ?? "")}
                          onChange={e => form && setForm({ ...form, advanceRatio: e.target.value === "" ? 1 : Math.max(1, Number(e.target.value) || 1) })}
                          disabled={!editMode}
                          className="w-20"
                        />
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
                  <Select value={editMode && form ? form.currency : selected.currency} onValueChange={v => editMode && form && setForm({ ...form, currency: v })} disabled={!editMode}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="選擇幣別" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="TWD">TWD</SelectItem>
                      <SelectItem value="USD">USD</SelectItem>
                      <SelectItem value="JPY">JPY</SelectItem>
                      <SelectItem value="EUR">EUR</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-full">
                  <label className="block mb-1 text-sm font-medium">帳單起始日</label>
                  <Popover open={editMode ? undefined : false}>
                    <PopoverTrigger asChild>
                      <Button
                        variant={"outline"}
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !(editMode && form ? form.billingDate : selected.billingDate) && "text-muted-foreground"
                        )}
                        disabled={!editMode}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {(editMode && form ? form.billingDate : selected.billingDate) ? format(new Date(editMode && form ? form.billingDate : selected.billingDate), "yyyy-MM-dd") : "選擇日期"}
                      </Button>
                    </PopoverTrigger>
                    {editMode && form && (
                      <PopoverContent className="w-auto p-0">
                        <input type="date" value={form && form.billingDate ? form.billingDate : ""} onChange={e => form && setForm({ ...form, billingDate: e.target.value })} className="w-full border rounded px-2 py-1" />
                      </PopoverContent>
                    )}
                  </Popover>
                </div>
                <div>
                  <label className="block mb-1 text-sm font-medium">週期</label>
                  <Tabs value={editMode && form ? form.cycle : selected.cycle} onValueChange={v => editMode && form && setForm({ ...form, cycle: v })} className="w-full" >
                    <TabsList className="w-full grid grid-cols-3">
                      <TabsTrigger value="monthly" disabled={!editMode}>每月</TabsTrigger>
                      <TabsTrigger value="halfyear" disabled={!editMode}>每半年</TabsTrigger>
                      <TabsTrigger value="yearly" disabled={!editMode}>每年</TabsTrigger>
                    </TabsList>
                  </Tabs>
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
                      <Button type="button" variant="outline" onClick={e => { e.preventDefault(); setEditMode(true); }}>編輯</Button>
                      <Button type="button" variant="destructive" onClick={() => setConfirmDelete(true)}>刪除</Button>
                    </>
                  )}
                </div>
              </form>
            </div>
          )}
        </DialogContent>
      </Dialog>
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
    </>
  );
} 
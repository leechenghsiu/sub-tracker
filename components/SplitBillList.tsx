"use client";
import React, { useState, useEffect } from "react";
import { Subscription, Settlement, MonthlyRecord } from "./types";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { format } from "date-fns";
import { ChevronDown, ChevronUp, Plus, Trash2, Check } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "./ui/tabs";
import { formatNumberWithCommas } from "@/lib/utils";
import { Calendar } from "./ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { cn } from "@/lib/utils";
import { Calendar as CalendarIcon } from "lucide-react";

interface SplitBillListProps {
  subscriptions: Subscription[];
  token: string;
  onRefresh: () => void;
  onUnauthorized: () => void;
}

function getPersonUnsettledMonths(name: string, records: MonthlyRecord[], settlements: Settlement[]): string[] {
  const participated = records.filter(r => r.participants.includes(name)).map(r => r.month).sort();
  const settled = new Set(settlements.filter(s => s.person === name).flatMap(s => s.months || []));
  return participated.filter(m => !settled.has(m));
}

function getPersonBalance(name: string, records: MonthlyRecord[], perPersonAmount: number, settlements: Settlement[]): { totalMonths: number; unsettledMonths: number; owed: number; paid: number; balance: number } {
  const participated = records.filter(r => r.participants.includes(name)).map(r => r.month);
  const settled = new Set(settlements.filter(s => s.person === name).flatMap(s => s.months || []));
  const unsettled = participated.filter(m => !settled.has(m));
  const owed = participated.length * perPersonAmount;
  const paid = settled.size * perPersonAmount;
  return { totalMonths: participated.length, unsettledMonths: unsettled.length, owed, paid, balance: unsettled.length * perPersonAmount };
}

function monthLabel(m: string) {
  const [y, mo] = m.split("-");
  return `${y} 年 ${parseInt(mo)} 月`;
}

function getPerPersonAmount(sub: Subscription): number {
  if (sub.perPersonAmount != null && sub.perPersonAmount > 0) return sub.perPersonAmount;
  const total = Number(sub.price) || 0;
  const self = Number(sub.selfRatio) || 0;
  const adv = Number(sub.advanceRatio) || 0;
  const ratio = self + adv;
  return ratio > 0 ? Math.floor(total / ratio) : 0;
}

const YEARS = Array.from({ length: 5 }, (_, i) => String(new Date().getFullYear() - 2 + i));
const MONTHS = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, "0"));

export default function SplitBillList({ subscriptions, token, onRefresh, onUnauthorized }: SplitBillListProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [detailSub, setDetailSub] = useState<Subscription | null>(null);
  const [showAddSettlement, setShowAddSettlement] = useState(false);
  const [settlePerson, setSettlePerson] = useState("");
  const [settleCount, setSettleCount] = useState(0);
  const [settlementDate, setSettlementDate] = useState<Date | undefined>(undefined);
  const [settleNote, setSettleNote] = useState("");
  const [loading, setLoading] = useState(false);

  // month-based editing
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), "yyyy-MM"));
  const [monthParticipants, setMonthParticipants] = useState<string[]>([]);
  const [newMemberInput, setNewMemberInput] = useState("");
  const [memberDropdownOpen, setMemberDropdownOpen] = useState(false);
  const [editingRecordMonth, setEditingRecordMonth] = useState<string | null>(null);

  useEffect(() => {
    if (detailSub) {
      const updated = subscriptions.find(s => s._id === detailSub._id);
      if (updated) setDetailSub(updated);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subscriptions]);

  useEffect(() => {
    if (detailSub && editingRecordMonth === "__new__") {
      const records = detailSub.records || [];
      const existing = records.find(r => r.month === selectedMonth);
      if (existing) {
        setMonthParticipants(existing.participants);
      } else {
        setMonthParticipants(detailSub.knownMembers || []);
      }
    }
  }, [detailSub, selectedMonth]);

  async function saveMonthRecord(subId: string) {
    setLoading(true);
    try {
      const sub = subscriptions.find(s => s._id === subId);
      if (!sub) return;
      const records = [...(sub.records || [])];
      const idx = records.findIndex(r => r.month === selectedMonth);
      if (idx >= 0) {
        records[idx] = { month: selectedMonth, participants: monthParticipants };
      } else {
        records.push({ month: selectedMonth, participants: monthParticipants });
      }
      // also update knownMembers to include any new names
      const allNames = new Set(sub.knownMembers || []);
      monthParticipants.forEach(p => allNames.add(p));
      const res = await fetch(`/api/subscription/${subId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ records, knownMembers: [...allNames] }),
      });
      if (res.status === 401) { onUnauthorized(); return; }
      if (res.ok) {
        setEditingRecordMonth(null);
        onRefresh();
      }
    } finally {
      setLoading(false);
    }
  }

  async function deleteMonthRecord(subId: string, month: string) {
    setLoading(true);
    try {
      const sub = subscriptions.find(s => s._id === subId);
      if (!sub) return;
      const records = (sub.records || []).filter(r => r.month !== month);
      const res = await fetch(`/api/subscription/${subId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ records }),
      });
      if (res.status === 401) { onUnauthorized(); return; }
      if (res.ok) onRefresh();
    } finally {
      setLoading(false);
    }
  }



  async function addSettlement(subId: string) {
    setLoading(true);
    try {
      const sub = subscriptions.find(s => s._id === subId);
      if (!sub) return;
      const ppa = getPerPersonAmount(sub);
      const unsettled = getPersonUnsettledMonths(settlePerson, sub.records || [], sub.settlements || []);
      const monthsToSettle = unsettled.slice(0, settleCount);
      const res = await fetch(`/api/subscription/${subId}/settlement`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          person: settlePerson,
          months: monthsToSettle,
          amount: monthsToSettle.length * ppa,
          date: settlementDate ? format(settlementDate, "yyyy-MM-dd") : "",
          note: settleNote,
        }),
      });
      if (res.status === 401) { onUnauthorized(); return; }
      if (res.ok) {
        setShowAddSettlement(false);
        setSettlePerson("");
        setSettleCount(0);
        setSettlementDate(undefined);
        setSettleNote("");
        onRefresh();
      }
    } finally {
      setLoading(false);
    }
  }

  async function deleteSettlement(subId: string, settlementId: string) {
    setLoading(true);
    try {
      const res = await fetch(`/api/subscription/${subId}/settlement`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ settlementId }),
      });
      if (res.status === 401) { onUnauthorized(); return; }
      if (res.ok) onRefresh();
    } finally {
      setLoading(false);
    }
  }

  if (subscriptions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <p className="text-lg mb-1">尚無代墊項目</p>
        <p className="text-sm">點擊右上角新增代墊開始記錄</p>
      </div>
    );
  }

  return (
    <>
      <div className="rounded-lg border divide-y bg-card">
        {subscriptions.map(sub => {
          const records = sub.records || [];
          const settlements = sub.settlements || [];
          const knownMembers = sub.knownMembers || [];
          const ppa = getPerPersonAmount(sub);
          const isExpanded = expandedId === sub._id;
          const totalBalance = knownMembers.reduce((sum, name) => sum + getPersonBalance(name, records, ppa, settlements).balance, 0);
          const myShare = (sub.price || 0) - ppa * knownMembers.length;

          return (
            <div key={sub._id} className="transition-all">
              <div className="flex items-center px-4 py-3 gap-3 w-full text-left">
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-base truncate">{sub.name}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {knownMembers.length} 人分帳 · ${ppa}/人/月
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold whitespace-nowrap">
                    ${formatNumberWithCommas(Math.floor(totalBalance))}
                  </div>
                  <div className="text-xs text-muted-foreground">待收</div>
                </div>
                <button
                  type="button"
                  className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition"
                  onClick={() => setExpandedId(isExpanded ? null : sub._id)}
                >
                  {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                </button>
              </div>

              {isExpanded && (
                <div className="bg-muted px-4 py-3 text-sm border-t space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-medium">我</span>
                      <span className="text-xs text-muted-foreground ml-2">${myShare}/月</span>
                    </div>
                    <span className="text-xs text-muted-foreground">自付</span>
                  </div>
                  {knownMembers.map(name => {
                    const { unsettledMonths, balance } = getPersonBalance(name, records, ppa, settlements);
                    return (
                      <div key={name} className="flex items-center justify-between">
                        <div>
                          <span className="font-medium">{name}</span>
                          <span className="text-xs text-muted-foreground ml-2">{unsettledMonths}個月未結</span>
                        </div>
                        <span className={cn("font-bold", balance > 0 ? "text-red-500" : "text-green-500")}>
                          ${formatNumberWithCommas(Math.floor(balance))}
                        </span>
                      </div>
                    );
                  })}
                  <div className="flex justify-end pt-2">
                    <Button size="sm" variant="outline" onClick={() => {
                      setDetailSub(sub);
                      setShowAddSettlement(false);

                      setEditingRecordMonth(null);
                      setSelectedMonth(format(new Date(), "yyyy-MM"));
                    }}>
                      查看詳情
                    </Button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 詳情 Dialog */}
      <Dialog open={!!detailSub} onOpenChange={v => { if (!v) { setDetailSub(null); setShowAddSettlement(false); setEditingRecordMonth(null); } }}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{detailSub?.name}</DialogTitle>
          </DialogHeader>
          {detailSub && (() => {
            const records = detailSub.records || [];
            const settlements = detailSub.settlements || [];
            const knownMembers = detailSub.knownMembers || [];
            const ppa = getPerPersonAmount(detailSub);

            return (
              <div className="mt-2">
                <div className="flex items-center justify-between text-sm mb-3">
                  <span className="text-muted-foreground">每人每月 <span className="font-bold text-foreground">${ppa}</span> · 總金額 ${detailSub.price}/{detailSub.cycle === 'monthly' ? '月' : detailSub.cycle === 'halfyear' ? '半年' : '年'}</span>
                </div>

                <Tabs defaultValue="records" className="w-full">
                  <TabsList className="w-full grid grid-cols-2 mb-3">
                    <TabsTrigger value="records">月份記錄</TabsTrigger>
                    <TabsTrigger value="balance">餘額與結清</TabsTrigger>
                  </TabsList>

                  <TabsContent value="records" className="space-y-3">
                    <div className="flex justify-end">
                      <Button size="sm" variant="ghost" onClick={() => {
                        if (editingRecordMonth) { setEditingRecordMonth(null); } else {
                          setSelectedMonth(format(new Date(), "yyyy-MM"));
                          setMonthParticipants(knownMembers);
                          setEditingRecordMonth("__new__");
                        }
                      }}>
                        {editingRecordMonth ? "取消" : <><Plus className="w-3 h-3 mr-1" />新增月份</>}
                      </Button>
                    </div>

                    {editingRecordMonth && (
                      <div className="rounded-lg border p-3 space-y-3">
                        <div className="flex gap-2">
                          <Select value={selectedMonth.split("-")[0]} onValueChange={y => setSelectedMonth(`${y}-${selectedMonth.split("-")[1]}`)}>
                            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                            <SelectContent>{YEARS.map(y => <SelectItem key={y} value={y}>{y} 年</SelectItem>)}</SelectContent>
                          </Select>
                          <Select value={selectedMonth.split("-")[1]} onValueChange={m => setSelectedMonth(`${selectedMonth.split("-")[0]}-${m}`)}>
                            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                            <SelectContent>{MONTHS.map(m => <SelectItem key={m} value={m}>{parseInt(m)} 月</SelectItem>)}</SelectContent>
                          </Select>
                        </div>
                        <Popover open={memberDropdownOpen} onOpenChange={v => { setMemberDropdownOpen(v); if (!v) setNewMemberInput(""); }}>
                          <PopoverTrigger asChild>
                            <button type="button" className="flex flex-wrap gap-1.5 w-full rounded-md border border-input bg-card px-2 py-1.5 min-h-[36px] text-left items-center cursor-pointer hover:bg-accent/50 transition-colors">
                              {monthParticipants.length > 0 ? monthParticipants.map(name => (
                                <span key={name} className="inline-flex items-center bg-primary/15 text-primary text-xs font-medium px-2 py-0.5 rounded">{name}</span>
                              )) : (
                                <span className="text-sm text-muted-foreground">選擇成員...</span>
                              )}
                            </button>
                          </PopoverTrigger>
                          <PopoverContent className="p-0 w-[--radix-popover-trigger-width]" align="start">
                            <div className="p-2 border-b">
                              <input autoFocus placeholder="搜尋或新增..." value={newMemberInput} onChange={e => setNewMemberInput(e.target.value)}
                                onKeyDown={e => {
                                  if (e.key === "Enter" && newMemberInput.trim()) {
                                    e.preventDefault();
                                    const name = newMemberInput.trim();
                                    if (!monthParticipants.includes(name)) setMonthParticipants([...monthParticipants, name]);
                                    setNewMemberInput("");
                                  }
                                }}
                                className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                              />
                            </div>
                            <div className="max-h-48 overflow-y-auto py-1">
                              {knownMembers.filter(name => !newMemberInput || name.toLowerCase().includes(newMemberInput.toLowerCase())).map(name => {
                                const isIn = monthParticipants.includes(name);
                                return (
                                  <button key={name} type="button" onClick={() => {
                                    if (isIn) setMonthParticipants(monthParticipants.filter(p => p !== name));
                                    else setMonthParticipants([...monthParticipants, name]);
                                  }} className="flex items-center gap-2 w-full px-3 py-1.5 text-sm hover:bg-muted transition-colors text-left">
                                    <div className={cn("w-4 h-4 rounded border flex items-center justify-center shrink-0", isIn ? "bg-primary border-primary" : "border-border")}>
                                      {isIn && <Check className="w-3 h-3 text-primary-foreground" />}
                                    </div>
                                    <span className="inline-flex items-center bg-primary/15 text-primary text-xs font-medium px-2 py-0.5 rounded">{name}</span>
                                  </button>
                                );
                              })}
                              {newMemberInput.trim() && !knownMembers.includes(newMemberInput.trim()) && (
                                <button type="button" onClick={() => {
                                  const name = newMemberInput.trim();
                                  if (!monthParticipants.includes(name)) setMonthParticipants([...monthParticipants, name]);
                                  setNewMemberInput("");
                                }} className="flex items-center gap-2 w-full px-3 py-1.5 text-sm hover:bg-muted transition-colors text-left">
                                  <Plus className="w-4 h-4 text-muted-foreground shrink-0" />
                                  <span className="text-muted-foreground">新增</span>
                                  <span className="inline-flex items-center bg-primary/15 text-primary text-xs font-medium px-2 py-0.5 rounded">{newMemberInput.trim()}</span>
                                </button>
                              )}
                            </div>
                          </PopoverContent>
                        </Popover>
                        <Button size="sm" className="w-full" onClick={() => saveMonthRecord(detailSub._id)} disabled={loading}>
                          {loading ? "儲存中..." : "儲存"}
                        </Button>
                      </div>
                    )}

                    {records.length === 0 && !editingRecordMonth ? (
                      <p className="text-sm text-muted-foreground">尚無月份記錄</p>
                    ) : (
                      <div className="rounded-lg border divide-y">
                        {[...records].sort((a, b) => a.month.localeCompare(b.month)).map(r => (
                          <div key={r.month} className="px-3 py-2">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-sm font-medium">{monthLabel(r.month)}</span>
                              <div className="flex items-center gap-1">
                                <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => {
                                  setSelectedMonth(r.month);
                                  setMonthParticipants(r.participants);
                                  setEditingRecordMonth(r.month);
                                }}>編輯</Button>
                                <Button variant="ghost" size="sm" className="h-6 px-2 text-xs text-muted-foreground hover:text-destructive" onClick={() => deleteMonthRecord(detailSub._id, r.month)}>
                                  <Trash2 className="w-3 h-3" />
                                </Button>
                              </div>
                            </div>
                            <div className="flex flex-wrap gap-1">
                              {r.participants.map(name => (
                                <span key={name} className="inline-flex items-center bg-primary/15 text-primary text-xs font-medium px-2 py-0.5 rounded">{name}</span>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="balance" className="space-y-6">
                    {/* 成員餘額 */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-semibold text-sm">成員餘額</h3>
                        <Button size="sm" variant="ghost" onClick={() => {
                          setShowAddSettlement(!showAddSettlement);
                          if (!showAddSettlement) { setSettlePerson(""); setSettleCount(0); setSettlementDate(undefined); setSettleNote(""); }
                        }}>
                          {showAddSettlement ? "取消" : <><Plus className="w-3 h-3 mr-1" />結清</>}
                        </Button>
                      </div>

                      {showAddSettlement && (() => {
                        const unsettled = settlePerson ? getPersonUnsettledMonths(settlePerson, records, settlements) : [];
                        const monthsToSettle = unsettled.slice(0, settleCount);
                        const settleAmount = monthsToSettle.length * ppa;
                        return (
                          <div className="rounded-lg border p-3 mb-3 space-y-3">
                            <div>
                              <label className="block text-xs font-medium mb-1">對象</label>
                              <Select value={settlePerson} onValueChange={v => { setSettlePerson(v); setSettleCount(0); }}>
                                <SelectTrigger><SelectValue placeholder="選擇成員" /></SelectTrigger>
                                <SelectContent>
                                  {knownMembers.map(name => {
                                    const u = getPersonUnsettledMonths(name, records, settlements);
                                    return <SelectItem key={name} value={name} disabled={u.length === 0}>{name} ({u.length}個月未結)</SelectItem>;
                                  })}
                                </SelectContent>
                              </Select>
                            </div>
                            {settlePerson && unsettled.length > 0 && (
                              <>
                                <div>
                                  <label className="block text-xs font-medium mb-1">結清月數（從最舊開始）</label>
                                  <div className="flex items-center gap-3">
                                    <Input type="number" min={1} max={unsettled.length} value={settleCount || ""} onChange={e => setSettleCount(Math.min(Number(e.target.value) || 0, unsettled.length))} className="w-20" />
                                    <span className="text-xs text-muted-foreground">/ {unsettled.length} 個月</span>
                                    <Button type="button" variant="outline" size="sm" className="text-xs" onClick={() => setSettleCount(unsettled.length)}>全部</Button>
                                  </div>
                                </div>
                                {settleCount > 0 && (
                                  <div className="text-xs text-muted-foreground">
                                    結清：{monthsToSettle.map(m => monthLabel(m)).join("、")}
                                    <div className="font-bold text-foreground text-sm mt-1">金額：${formatNumberWithCommas(settleAmount)}</div>
                                  </div>
                                )}
                                <div>
                                  <label className="block text-xs font-medium mb-1">結清日期</label>
                                  <Popover>
                                    <PopoverTrigger asChild>
                                      <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !settlementDate && "text-muted-foreground")}>
                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                        {settlementDate ? format(settlementDate, "yyyy-MM-dd") : "選擇日期"}
                                      </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0">
                                      <Calendar mode="single" selected={settlementDate} onSelect={setSettlementDate} initialFocus />
                                    </PopoverContent>
                                  </Popover>
                                </div>
                                <div>
                                  <label className="block text-xs font-medium mb-1">備註</label>
                                  <Input placeholder="選填" value={settleNote} onChange={e => setSettleNote(e.target.value)} />
                                </div>
                                <Button size="sm" className="w-full" onClick={() => addSettlement(detailSub._id)} disabled={loading || settleCount === 0 || !settlementDate}>
                                  {loading ? "結清中..." : "確認結清"}
                                </Button>
                              </>
                            )}
                          </div>
                        );
                      })()}

                      <div className="rounded-lg border divide-y">
                        {(() => {
                          const myShare = (detailSub.price || 0) - ppa * knownMembers.length;
                          return (
                            <div className="px-3 py-2 flex items-center justify-between">
                              <span className="font-medium">我</span>
                              <span className="text-xs text-muted-foreground">${myShare}/月 · 自付</span>
                            </div>
                          );
                        })()}
                        {knownMembers.map(name => {
                          const { totalMonths, unsettledMonths, balance } = getPersonBalance(name, records, ppa, settlements);
                          return (
                            <div key={name} className="px-3 py-2">
                              <div className="flex items-center justify-between">
                                <span className="font-medium">{name}</span>
                                <span className={cn("font-bold", balance > 0 ? "text-red-500" : "text-green-500")}>
                                  ${formatNumberWithCommas(Math.floor(balance))}
                                </span>
                              </div>
                              <div className="text-xs text-muted-foreground mt-0.5">
                                {unsettledMonths > 0 ? `${unsettledMonths}個月未結` : "已全部結清"} · 共 {totalMonths} 個月
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* 結清紀錄 */}
                    <div>
                      <h3 className="font-semibold text-sm mb-2">結清紀錄</h3>
                      {settlements.length === 0 ? (
                        <p className="text-sm text-muted-foreground">尚無結清紀錄</p>
                      ) : (
                        <div className="rounded-lg border divide-y">
                          {[...settlements].reverse().map(s => (
                            <div key={s._id} className="px-3 py-2 flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <div className="text-sm">
                                  <span className="font-medium">{s.person}</span>
                                  <span className="ml-2 font-bold">${formatNumberWithCommas(s.amount)}</span>
                                </div>
                                <div className="text-xs text-muted-foreground mt-0.5">
                                  {s.date} · {(s.months || []).length}個月
                                </div>
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {(s.months || []).map(m => (
                                    <span key={m} className="text-xs bg-muted px-1.5 py-0.5 rounded">{monthLabel(m)}</span>
                                  ))}
                                </div>
                                {s.note && <div className="text-xs text-muted-foreground mt-1">{s.note}</div>}
                              </div>
                              <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive" onClick={() => deleteSettlement(detailSub._id, s._id)}>
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </TabsContent>
                </Tabs>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </>
  );
}

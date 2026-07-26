import React, { useState } from "react";
import { Subscription, Card as CardType } from "./types";
import { getMonthlyEvents } from "@/app/lib/schedule";
import { formatNumberWithCommas } from "@/lib/utils";
import CardManager from "./CardManager";
import { Button } from "./ui/button";
import { ChevronLeft, ChevronRight, Wallet, CreditCard, Receipt } from "lucide-react";

interface Props {
  subscriptions: Subscription[];
  cards: CardType[];
  token: string;
  onRefreshCards: () => void;
  onUnauthorized: () => void;
}

const KIND_LABEL: Record<string, string> = { charge: "扣款", statement: "結帳", due: "繳費" };
const CATEGORY_LABEL: Record<string, string> = { subscription: "訂閱", investment: "投資", expense: "固定支出" };

export default function ScheduleView({ subscriptions, cards, token, onRefreshCards, onUnauthorized }: Props) {
  const now = new Date();
  const [ym, setYm] = useState({ year: now.getFullYear(), month: now.getMonth() });

  const events = getMonthlyEvents(subscriptions, cards, ym.year, ym.month);

  function shiftMonth(delta: number) {
    setYm(prev => {
      const d = new Date(prev.year, prev.month + delta, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="icon" onClick={() => shiftMonth(-1)} aria-label="上個月"><ChevronLeft className="w-5 h-5" /></Button>
        <div className="font-semibold">{ym.year} 年 {ym.month + 1} 月</div>
        <Button variant="ghost" size="icon" onClick={() => shiftMonth(1)} aria-label="下個月"><ChevronRight className="w-5 h-5" /></Button>
      </div>

      {events.length === 0 ? (
        <div className="text-sm text-muted-foreground py-6 text-center">本月沒有排定的財務事件</div>
      ) : (
        <div className="rounded-lg border divide-y bg-card">
          {events.map((ev, i) => (
            <div key={`${ev.sourceId}-${ev.kind}-${i}`} className="flex items-center px-4 py-3 gap-3">
              <div className="w-10 text-center">
                <div className="text-lg font-bold leading-none">{ev.date.getDate()}</div>
                <div className="text-[10px] text-muted-foreground">{ev.date.getMonth() + 1}月</div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold truncate flex items-center gap-1.5">
                  {ev.kind === "charge" ? <Wallet className="w-4 h-4 text-muted-foreground" /> : ev.kind === "statement" ? <CreditCard className="w-4 h-4 text-muted-foreground" /> : <Receipt className="w-4 h-4 text-muted-foreground" />}
                  {ev.title}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {KIND_LABEL[ev.kind]}
                  {ev.category && ` · ${CATEGORY_LABEL[ev.category] ?? ""}`}
                  {ev.reminder?.enabled && ` · 提前 ${ev.reminder.daysBefore} 天提醒`}
                </div>
              </div>
              {ev.kind === "charge" && ev.amount != null && (
                <div className="text-base font-bold whitespace-nowrap">${formatNumberWithCommas(Math.floor(ev.amount))} {ev.currency}</div>
              )}
            </div>
          ))}
        </div>
      )}

      <CardManager cards={cards} token={token} onRefresh={onRefreshCards} onUnauthorized={onUnauthorized} />
    </div>
  );
}

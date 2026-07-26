import React from "react";
import { ScheduleEvent } from "./types";
import { formatNumberWithCommas } from "@/lib/utils";
import { Wallet, CreditCard, Receipt } from "lucide-react";

export const KIND_LABEL: Record<string, string> = { charge: "扣款", statement: "結帳", due: "繳費截止" };
export const CATEGORY_LABEL: Record<string, string> = { subscription: "訂閱", investment: "投資", expense: "固定支出" };
export const REMINDER_LABEL: Record<string, string> = { charge: "扣款提醒", statement: "可繳費提醒", due: "到期提醒" };

// 事件種類對應的標籤底色（日曆格子的事件 chip 用，搭配白字）。
export const KIND_CHIP: Record<string, string> = {
  charge: "bg-blue-500",
  statement: "bg-amber-600",
  due: "bg-rose-500",
};

export function formatMD(d: Date): string {
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function KindIcon({ kind }: { kind: ScheduleEvent["kind"] }) {
  if (kind === "charge") return <Wallet className="w-4 h-4 text-muted-foreground" />;
  if (kind === "statement") return <CreditCard className="w-4 h-4 text-muted-foreground" />;
  return <Receipt className="w-4 h-4 text-muted-foreground" />;
}

export function EventRow({ ev, showDate = true }: { ev: ScheduleEvent; showDate?: boolean }) {
  return (
    <div className="flex items-center px-4 py-3 gap-3">
      {showDate && (
        <div className="w-10 text-center">
          <div className="text-lg font-bold leading-none">{ev.date.getDate()}</div>
          <div className="text-[10px] text-muted-foreground">{ev.date.getMonth() + 1}月</div>
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="font-semibold truncate flex items-center gap-1.5">
          <KindIcon kind={ev.kind} />
          {ev.title}
        </div>
        <div className="text-xs text-muted-foreground mt-0.5">
          {KIND_LABEL[ev.kind]}
          {ev.category && ` · ${CATEGORY_LABEL[ev.category] ?? ""}`}
          {ev.reminderDate && ` · 🔔 ${formatMD(ev.reminderDate)} ${REMINDER_LABEL[ev.kind]}`}
        </div>
      </div>
      {ev.kind === "charge" && ev.amount != null && (
        <div className="text-base font-bold whitespace-nowrap">${formatNumberWithCommas(Math.floor(ev.amount))} {ev.currency}</div>
      )}
    </div>
  );
}

import React, { useMemo, useState } from "react";
import { ScheduleEvent } from "./types";
import { EventRow, KIND_DOT, KIND_LABEL } from "./ScheduleEventRow";
import { cn } from "@/lib/utils";

interface Props {
  events: ScheduleEvent[];
  year: number;
  month: number; // 0-11
}

const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];

export default function ScheduleCalendar({ events, year, month }: Props) {
  // 依「幾號」把事件分組。
  const eventsByDay = useMemo(() => {
    const map = new Map<number, ScheduleEvent[]>();
    for (const ev of events) {
      const day = ev.date.getDate();
      const list = map.get(day) ?? [];
      list.push(ev);
      map.set(day, list);
    }
    return map;
  }, [events]);

  const firstWeekday = new Date(year, month, 1).getDay(); // 0=週日
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const today = new Date();
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month;
  const todayDate = isCurrentMonth ? today.getDate() : null;

  // 預設選取：本月選今天，否則選第一個有事件的日子，否則不選。
  const firstEventDay = useMemo(() => {
    const days = [...eventsByDay.keys()].sort((a, b) => a - b);
    return days.length > 0 ? days[0] : null;
  }, [eventsByDay]);
  const [selected, setSelected] = useState<number | null>(todayDate ?? firstEventDay);

  // 切換月份後，selected 可能超出範圍，夾回合理值。
  const effectiveSelected = selected != null && selected <= daysInMonth ? selected : (todayDate ?? firstEventDay);

  // 建立格子（前置空白 + 當月每日）。
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const selectedEvents = effectiveSelected != null ? (eventsByDay.get(effectiveSelected) ?? []) : [];

  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-card p-2">
        <div className="grid grid-cols-7 mb-1">
          {WEEKDAYS.map((w, i) => (
            <div key={w} className={cn("text-center text-xs py-1 font-medium", (i === 0 || i === 6) ? "text-rose-500" : "text-muted-foreground")}>{w}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-0.5">
          {cells.map((day, idx) => {
            if (day == null) return <div key={`blank-${idx}`} />;
            const dayEvents = eventsByDay.get(day);
            const kinds = dayEvents ? Array.from(new Set(dayEvents.map(e => e.kind))) : [];
            const isToday = day === todayDate;
            const isSelected = day === effectiveSelected;
            return (
              <button
                key={day}
                type="button"
                onClick={() => setSelected(day)}
                className={cn(
                  "aspect-square flex flex-col items-center justify-start pt-1 rounded-md text-sm transition-colors",
                  isSelected ? "bg-primary/15 ring-1 ring-primary" : "hover:bg-muted",
                )}
              >
                <span className={cn(
                  "w-6 h-6 flex items-center justify-center rounded-full",
                  isToday && "bg-primary text-primary-foreground font-bold",
                )}>{day}</span>
                <span className="mt-1 flex gap-0.5 h-1.5">
                  {kinds.map(k => (
                    <span key={k} className={cn("w-1.5 h-1.5 rounded-full", KIND_DOT[k])} />
                  ))}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 圖例 */}
      <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
        {(["charge", "statement", "due"] as const).map(k => (
          <span key={k} className="flex items-center gap-1">
            <span className={cn("w-1.5 h-1.5 rounded-full", KIND_DOT[k])} />
            {KIND_LABEL[k]}
          </span>
        ))}
      </div>

      {/* 選取日明細 */}
      {effectiveSelected != null && (
        <div>
          <div className="text-sm font-semibold mb-2">{month + 1} 月 {effectiveSelected} 日</div>
          {selectedEvents.length === 0 ? (
            <div className="text-sm text-muted-foreground py-4 text-center">這天沒有排定事件</div>
          ) : (
            <div className="rounded-lg border divide-y bg-card">
              {selectedEvents.map((ev, i) => (
                <EventRow key={`${ev.sourceId}-${ev.kind}-${i}`} ev={ev} showDate={false} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

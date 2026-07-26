import React, { useState } from "react";
import { Subscription, Card as CardType } from "./types";
import { getMonthlyEvents } from "@/app/lib/schedule";
import CardManager from "./CardManager";
import ScheduleCalendar from "./ScheduleCalendar";
import { EventRow } from "./ScheduleEventRow";
import { Button } from "./ui/button";
import { Tabs, TabsList, TabsTrigger } from "./ui/tabs";
import { ChevronLeft, ChevronRight, List, CalendarDays } from "lucide-react";

interface Props {
  subscriptions: Subscription[];
  cards: CardType[];
  token: string;
  onRefreshCards: () => void;
  onUnauthorized: () => void;
}

export default function ScheduleView({ subscriptions, cards, token, onRefreshCards, onUnauthorized }: Props) {
  const now = new Date();
  const [ym, setYm] = useState({ year: now.getFullYear(), month: now.getMonth() });
  const [view, setView] = useState<"list" | "calendar">("calendar");

  const events = getMonthlyEvents(subscriptions, cards, ym.year, ym.month);

  function shiftMonth(delta: number) {
    setYm(prev => {
      const d = new Date(prev.year, prev.month + delta, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="icon" onClick={() => shiftMonth(-1)} aria-label="上個月"><ChevronLeft className="w-5 h-5" /></Button>
        <div className="font-semibold">{ym.year} 年 {ym.month + 1} 月</div>
        <Button variant="ghost" size="icon" onClick={() => shiftMonth(1)} aria-label="下個月"><ChevronRight className="w-5 h-5" /></Button>
      </div>

      <Tabs value={view} onValueChange={v => setView(v as "list" | "calendar")} className="w-full">
        <TabsList className="w-full grid grid-cols-2">
          <TabsTrigger value="calendar"><CalendarDays className="w-4 h-4 mr-1.5" />日曆</TabsTrigger>
          <TabsTrigger value="list"><List className="w-4 h-4 mr-1.5" />清單</TabsTrigger>
        </TabsList>
      </Tabs>

      {view === "calendar" ? (
        <ScheduleCalendar events={events} year={ym.year} month={ym.month} />
      ) : events.length === 0 ? (
        <div className="text-sm text-muted-foreground py-6 text-center">本月沒有排定的財務事件</div>
      ) : (
        <div className="rounded-lg border divide-y bg-card">
          {events.map((ev, i) => (
            <EventRow key={`${ev.sourceId}-${ev.kind}-${i}`} ev={ev} />
          ))}
        </div>
      )}

      <CardManager cards={cards} token={token} onRefresh={onRefreshCards} onUnauthorized={onUnauthorized} />
    </div>
  );
}

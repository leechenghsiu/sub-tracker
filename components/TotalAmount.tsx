import React from "react";
import { Subscription } from "./types";
import { Card, CardHeader, CardTitle, CardContent } from "./ui/card";
import { Wallet } from "lucide-react";
// shadcn badge
import { Badge } from "./ui/badge";

// 匯率常數（可自行調整）
const EXCHANGE_RATE: Record<string, number> = {
  TWD: 1,
  USD: 32,
  JPY: 0.21,
  EUR: 35
};

function getUnit(mode: 'monthly' | 'halfyear' | 'yearly') {
  if (mode === 'monthly') return '月';
  if (mode === 'halfyear') return '半年';
  if (mode === 'yearly') return '年';
  return '';
}

export default function TotalAmount({ subscriptions, mode }: { subscriptions: Subscription[]; mode: 'monthly' | 'halfyear' | 'yearly' }) {
  function getSelfAmount(sub: Subscription) {
    const total = Number(sub.price) || 0;
    const self = Number(sub.selfRatio) || 1;
    const adv = Number(sub.advanceRatio) || 0;
    return total * (self / (self + (sub.isAdvance ? adv : 0)));
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
  function toTWD(amount: number, currency: string) {
    return amount * (EXCHANGE_RATE[currency] || 1);
  }
  const total = subscriptions.reduce((sum, sub) =>
    sum + toTWD(convert(getSelfAmount(sub), sub.cycle), sub.currency), 0);
  const unit = getUnit(mode);
  return (
    <Card className="w-full py-4">
      <CardHeader className="pb-2 flex flex-row items-center justify-between relative">
        <CardTitle className="text-lg flex items-center gap-2">
          <Wallet className="w-5 h-5" />
          總花費
        </CardTitle>
        <Badge className="absolute right-4 top-1 select-none">共 {subscriptions.length} 筆訂閱</Badge>
      </CardHeader>
      <CardContent>
        <div className="flex items-baseline gap-2">
          <span className="text-base font-medium">約</span>
          <span className="text-3xl font-bold">{Math.round(total)}</span>
          <span className="text-base font-medium">TWD / {unit}</span>
        </div>
      </CardContent>
    </Card>
  );
} 
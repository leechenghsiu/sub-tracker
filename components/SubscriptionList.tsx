import React from "react";
import { Subscription } from "./types";

export default function SubscriptionList({ subscriptions, mode }: { subscriptions: Subscription[]; mode: 'monthly' | 'halfyear' | 'yearly' }) {
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
  return (
    <div className="rounded-lg border divide-y bg-card">
      {subscriptions.map(sub => {
        const total = Number(sub.price) || 0;
        const self = Number(sub.selfRatio) || 1;
        const adv = Number(sub.advanceRatio) || 0;
        const myAmount = total * (self / (self + (sub.isAdvance ? adv : 0)));
        const displayAmount = convert(myAmount, sub.cycle);
        return (
          <div key={sub._id} className="flex items-center px-4 py-3 gap-3">
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-base truncate">{sub.name}</div>
              <div className="text-xs text-gray-500 mt-0.5">
                每{sub.cycle === 'monthly' ? '月' : sub.cycle === 'halfyear' ? '半年' : '年'}{new Date(sub.billingDate).getDate()}號
              </div>
            </div>
            <div className="text-lg font-bold whitespace-nowrap">
              {Math.floor(displayAmount)} {sub.currency}
            </div>
          </div>
        );
      })}
    </div>
  );
} 
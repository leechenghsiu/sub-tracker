import React from "react";
import { Subscription } from "./types";
import TotalAmount from "./TotalAmount";
import SubscriptionList from "./SubscriptionList";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "./ui/tabs";

interface OverviewTabsProps {
  subscriptions: Subscription[];
  tabMode: 'monthly'|'halfyear'|'yearly';
  setTabMode: (v: 'monthly'|'halfyear'|'yearly') => void;
  token: string;
  onRefresh: () => void;
  onUnauthorized: () => void;
}

const CATEGORY_LABELS: Record<string, string> = {
  subscription: '訂閱',
  investment: '投資',
  expense: '固定支出',
};
const CATEGORY_ORDER = ['subscription', 'investment', 'expense'] as const;

export default function OverviewTabs({ subscriptions, tabMode, setTabMode, token, onRefresh, onUnauthorized }: OverviewTabsProps) {
  const renderByCategory = (mode: 'monthly' | 'halfyear' | 'yearly') => (
    <div className="space-y-6">
      {CATEGORY_ORDER.map(cat => {
        const list = subscriptions.filter(s => (s.category ?? 'subscription') === cat);
        if (list.length === 0) return null;
        return (
          <div key={cat}>
            <div className="text-sm font-semibold text-muted-foreground mb-2">{CATEGORY_LABELS[cat]}</div>
            <SubscriptionList subscriptions={list} mode={mode} token={token} onRefresh={onRefresh} onUnauthorized={onUnauthorized} />
          </div>
        );
      })}
    </div>
  );

  return (
    <Tabs defaultValue="monthly" className="w-full" onValueChange={v => setTabMode(v as 'monthly'|'halfyear'|'yearly')}>
      <div className="mb-4">
        <div className="flex flex-col items-center gap-2">
          <TabsList className="w-full grid grid-cols-3 mb-2">
            <TabsTrigger value="monthly">每月花費</TabsTrigger>
            <TabsTrigger value="halfyear">每半年花費</TabsTrigger>
            <TabsTrigger value="yearly">每年花費</TabsTrigger>
          </TabsList>
          <TotalAmount subscriptions={subscriptions} mode={tabMode} />
        </div>
      </div>
      <TabsContent value="monthly">
        {renderByCategory('monthly')}
      </TabsContent>
      <TabsContent value="halfyear">
        {renderByCategory('halfyear')}
      </TabsContent>
      <TabsContent value="yearly">
        {renderByCategory('yearly')}
      </TabsContent>
    </Tabs>
  );
} 
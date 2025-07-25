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
}

export default function OverviewTabs({ subscriptions, tabMode, setTabMode, token, onRefresh }: OverviewTabsProps) {
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
        <SubscriptionList subscriptions={subscriptions} mode="monthly" token={token} onRefresh={onRefresh} />
      </TabsContent>
      <TabsContent value="halfyear">
        <SubscriptionList subscriptions={subscriptions} mode="halfyear" token={token} onRefresh={onRefresh} />
      </TabsContent>
      <TabsContent value="yearly">
        <SubscriptionList subscriptions={subscriptions} mode="yearly" token={token} onRefresh={onRefresh} />
      </TabsContent>
    </Tabs>
  );
} 
import { Skeleton } from "./ui/skeleton";
import { Card, CardContent, CardHeader } from "./ui/card";
import { Tabs, TabsList, TabsTrigger } from "./ui/tabs";

export default function SubscriptionSkeleton() {
  return (
    <Tabs defaultValue="monthly" className="w-full">
      <div className="mb-4">
        <div className="flex flex-col items-center gap-2">
          <TabsList className="w-full grid grid-cols-3 mb-2">
            <TabsTrigger value="monthly">每月花費</TabsTrigger>
            <TabsTrigger value="halfyear">每半年花費</TabsTrigger>
            <TabsTrigger value="yearly">每年花費</TabsTrigger>
          </TabsList>
          
          {/* Total Amount Skeleton */}
          <Card className="w-full py-4 gap-4">
            <CardHeader className="flex flex-row items-center justify-between relative">
              <Skeleton className="h-6 w-20" />
              <Skeleton className="h-5 w-16" />
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <Skeleton className="h-4 w-4" />
                <Skeleton className="h-9 w-32" />
                <Skeleton className="h-4 w-16" />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
      
      {/* Subscription List Skeleton */}
      <div className="rounded-lg border divide-y bg-card">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="flex items-center px-4 py-3 gap-3 w-full">
            <div className="flex-1 min-w-0">
              <Skeleton className="h-5 w-32 mb-1" />
              <Skeleton className="h-3 w-20" />
            </div>
            <div className="flex flex-col items-end gap-1">
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-3 w-16" />
            </div>
            <Skeleton className="h-5 w-5" />
          </div>
        ))}
      </div>
    </Tabs>
  );
}
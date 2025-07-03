import { Button } from "./ui/button";
import { ListChecks, Plus } from "lucide-react";
import React from "react";

export default function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-96 text-muted-foreground">
      <ListChecks className="w-12 h-12 mb-4 opacity-60" />
      <div className="text-lg font-semibold mb-2">目前沒有任何訂閱</div>
      <div className="mb-4 text-sm">點擊「新增訂閱」來開始管理你的訂閱項目！</div>
      <Button variant="default" className="flex items-center gap-2" onClick={onAdd}>
        <Plus className="w-4 h-4" /> 新增訂閱
      </Button>
    </div>
  );
} 
import React from "react";
import { Checkbox } from "./ui/checkbox";
import { Input } from "./ui/input";

interface ReminderFieldProps {
  // 同一頁可能同時存在新增與編輯兩個表單，checkbox 的 id 必須各自唯一。
  id: string;
  enabled: boolean;
  // 以字串保存，讓輸入框在使用者清空時不會被立即改寫；送出時才用 normalizeDaysBefore 收斂。
  daysBefore: string;
  disabled?: boolean;
  onChange: (next: { enabled: boolean; daysBefore: string }) => void;
}

// 訂閱的扣款提醒設定。0 天代表扣款當天通知。
export default function ReminderField({ id, enabled, daysBefore, disabled, onChange }: ReminderFieldProps) {
  const days = Number(daysBefore);
  const hint = daysBefore.trim() === "" || !Number.isFinite(days)
    ? null
    : days <= 0
      ? "扣款當天早上 9 點通知"
      : `扣款日前 ${Math.floor(days)} 天早上 9 點通知`;

  return (
    <div>
      <div className="flex items-center gap-2">
        <Checkbox
          id={id}
          checked={enabled}
          disabled={disabled}
          onCheckedChange={v => onChange({ enabled: !!v, daysBefore })}
        />
        <label htmlFor={id} className="text-sm select-none cursor-pointer">扣款提醒</label>
      </div>
      {enabled && (
        <>
          <div className="mt-2 flex items-center gap-2">
            <span className="text-sm text-muted-foreground">提前</span>
            <Input
              type="number"
              inputMode="numeric"
              min={0}
              className="w-20"
              disabled={disabled}
              value={daysBefore}
              onChange={e => onChange({ enabled, daysBefore: e.target.value })}
            />
            <span className="text-sm text-muted-foreground">天（0 = 當天）</span>
          </div>
          {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
        </>
      )}
    </div>
  );
}

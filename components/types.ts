export type Reminder = {
  enabled: boolean;
  daysBefore: number;
};

export type PayReminder = {
  enabled: boolean;
  daysAfter: number; // 結帳日之後幾天提醒（可開始繳費）
};

export type Category = 'subscription' | 'investment' | 'expense';

export type Card = {
  _id: string;
  name: string;
  last4?: string;
  statementDay: number; // 每月幾號 1-31
  dueDay: number;       // 每月幾號 1-31
  color?: string;
  note?: string;
  payReminder: PayReminder; // 結帳後可繳費提醒（結帳日 + daysAfter 天）
  dueReminder: Reminder;    // 繳費到期前提醒（繳費截止日 - daysBefore 天）
  reminder?: Reminder;      // legacy：舊資料的單一到期前提醒
  createdAt: string;
  deletedAt: string | null;
};

export type ScheduleEvent = {
  date: Date;
  kind: 'charge' | 'statement' | 'due';
  title: string;
  category?: Category;
  amount?: number;
  currency?: string;
  cardName?: string;
  reminder?: Reminder;
  reminderDate?: Date; // 提醒實際觸發日期（未啟用則為 undefined）
  sourceId: string;
};

export type Member = {
  name: string;
  amount: number;
  startDate: string; // YYYY-MM
};

export type MonthlyRecord = {
  month: string; // YYYY-MM
  participants: string[];
};

export type Settlement = {
  _id: string;
  person: string;
  months: string[];
  amount: number;
  date: string;
  note?: string;
};

export type Subscription = {
  _id: string;
  name: string;
  price: number;
  currency: string;
  billingDate: string;
  cycle: string;
  note?: string;
  createdAt: string;
  deletedAt: string | null;
  selfRatio: number;
  advanceRatio: number;
  isAdvance: boolean;
  category?: Category;
  reminder?: Reminder;
  twdAmount?: number;
  // legacy
  members?: Member[];
  // new split bill fields
  perPersonAmount?: number;
  knownMembers?: string[];
  records?: MonthlyRecord[];
  settlements?: Settlement[];
};

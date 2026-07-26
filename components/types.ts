export type Reminder = {
  enabled: boolean;
  daysBefore: number;
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
  reminder: Reminder;
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
  reminder: Reminder;
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

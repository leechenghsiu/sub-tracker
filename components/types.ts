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
  twdAmount?: number;
  // legacy
  members?: Member[];
  // new split bill fields
  perPersonAmount?: number;
  knownMembers?: string[];
  records?: MonthlyRecord[];
  settlements?: Settlement[];
};

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
}; 
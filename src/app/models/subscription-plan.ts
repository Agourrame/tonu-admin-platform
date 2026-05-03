export interface SubscriptionPlan {
  code: string;
  name: string;
  monthly_price: number;
  commission_pct: number;
  max_vehicles: number;
  priority_listing: boolean;
  is_active: boolean;
}

export interface SubscriptionPlanInsert {
  code: string;
  name: string;
  monthly_price: number;
  commission_pct: number;
  max_vehicles: number;
  priority_listing?: boolean;
  is_active?: boolean;
}

export type SubscriptionPlanUpdate = Partial<SubscriptionPlanInsert>;

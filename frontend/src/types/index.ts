export interface DashboardOverview {
  total_revenue: number;
  total_orders: number;
  total_ad_spend: number;
  total_profit: number;
  aov: number;
  roas: number;
  revenue_by_day: DailyMetric[];
  top_products: ProductMetric[];
  platform_split: PlatformMetric[];
  recent_orders: OrderSummary[];
}

export interface DailyMetric {
  date: string;
  revenue: number;
  orders: number;
  ad_spend: number;
  profit: number;
}

export interface ProductMetric {
  sku: string;
  name: string;
  revenue: number;
  quantity: number;
  profit: number;
}

export interface PlatformMetric {
  platform: string;
  revenue: number;
  orders: number;
  share: number;
}

export interface OrderSummary {
  id: number;
  platform: string;
  platform_order_id: string;
  customer_name: string;
  total_amount: number;
  status: string;
  order_date: string;
}

export interface OrderDetail {
  id: number;
  platform: string;
  platform_order_id: string;
  status: string;
  customer_name: string;
  customer_email: string;
  city: string;
  currency: string;
  total_amount: number;
  subtotal_amount: number;
  shipping_amount: number;
  discount_amount: number;
  tax_amount: number;
  commission_amount: number;
  net_profit: number;
  order_date: string;
  items: OrderItem[];
}

export interface OrderItem {
  product_name: string;
  sku: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  cost_price: number;
  commission: number;
}

export interface Integration {
  id: number;
  platform: string;
  platform_type: string;
  status: string;
  last_sync_at: string | null;
  created_at: string;
}

export interface AdPerformance {
  summary: {
    total_spend: number;
    total_impressions: number;
    total_clicks: number;
    total_conversions: number;
    total_revenue: number;
    roas: number;
    cpc: number;
    ctr: number;
  };
  daily: Array<{
    date: string;
    spend: number;
    impressions: number;
    clicks: number;
    conversions: number;
    revenue: number;
    roas: number;
  }>;
  campaigns: Array<{
    campaign_id: string;
    campaign_name: string;
    platform: string;
    spend: number;
    impressions: number;
    clicks: number;
    conversions: number;
    revenue: number;
    roas: number;
  }>;
}

export interface ProfitAnalysis {
  revenue: number;
  cogs: number;
  gross_profit: number;
  gross_margin: number;
  commission: number;
  ad_spend: number;
  shipping_cost: number;
  discount: number;
  tax: number;
  net_profit: number;
  net_margin: number;
  total_orders: number;
  aov: number;
}

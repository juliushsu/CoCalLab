// 訂閱方案類型
export type SubscriptionPlan = 'free' | 'basic' | 'professional' | 'enterprise';

// 訂閱狀態
export type SubscriptionStatus = 'active' | 'expired' | 'cancelled' | 'suspended';

// 訂閱資訊
export interface Subscription {
  id: string;
  organization_id: string;
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  start_date: string;
  end_date: string;
  auto_renew: boolean;
  
  // 配額限制
  max_projects: number;
  max_documents_per_month: number;
  max_activities_per_project: number;
  max_users: number;
  
  // 當前使用量
  current_projects: number;
  current_documents_this_month: number;
  current_users: number;
  
  // 功能權限
  features: {
    ai_report_generation: boolean;
    advanced_analytics: boolean;
    api_access: boolean;
    custom_emission_factors: boolean;
    priority_support: boolean;
    white_label: boolean;
  };
  
  created_at: string;
  updated_at: string;
}

// 方案詳情
export interface PlanDetails {
  plan: SubscriptionPlan;
  name: string;
  description: string;
  price_monthly: number;
  price_yearly: number;
  max_projects: number;
  max_documents_per_month: number;
  max_activities_per_project: number;
  max_users: number;
  features: {
    ai_report_generation: boolean;
    advanced_analytics: boolean;
    api_access: boolean;
    custom_emission_factors: boolean;
    priority_support: boolean;
    white_label: boolean;
  };
}

// 使用量統計
export interface UsageStatistics {
  organization_id: string;
  current_period_start: string;
  current_period_end: string;
  projects_count: number;
  documents_count: number;
  activities_count: number;
  users_count: number;
  storage_used_mb: number;
  api_calls_count: number;
}

// 訂閱限制檢查結果
export interface SubscriptionLimitCheck {
  is_allowed: boolean;
  limit_type?: 'projects' | 'documents' | 'activities' | 'users' | 'expired';
  current_value?: number;
  max_value?: number;
  message?: string;
}
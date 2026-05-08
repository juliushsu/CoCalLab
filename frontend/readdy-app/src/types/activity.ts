// 包含/排除狀態 — 對齊 DB enum inclusion_status
export type InclusionStatus = 'included' | 'excluded' | 'pending';

// 活動狀態 — 對齊 DB enum activity_status
export type ActivityStatus = 'active' | 'voided' | 'archived';

// 排放活動 — 對齊 DB schema emission_activities
export interface EmissionActivity {
  id: string;
  organization_id: string;
  project_id: string;
  project_name?: string;               // join from projects

  // 來源追溯
  source_document_id?: string | null;
  source_draft_id?: string | null;

  // 活動基本資訊
  activity_code: string;
  activity_name: string;
  activity_date: string;               // date
  category: string;
  subcategory?: string | null;
  activity_type: string;

  // 數量
  quantity: number;
  unit: string;
  normalized_quantity?: number | null;
  normalized_unit?: string | null;

  // 資料品質
  data_quality: string;

  // 排放分類
  inclusion_status: InclusionStatus;
  exclusion_reason?: string | null;
  review_note?: string | null;

  // 範疇（DB 用 smallint）
  suggested_scope?: number | null;
  final_scope?: number | null;

  // AI 信心度
  confidence_score?: number | null;

  // 狀態
  status: ActivityStatus;
  archived_at?: string | null;

  // 計算結果（從 calculation_results join，非 DB 直接欄位）
  co2e_amount?: number | null;
  co2e_unit?: string | null;

  created_by_user_id?: string | null;
  created_at: string;
  updated_at: string;
}

// 活動列表查詢參數
export interface ActivityListQuery {
  project_id?: string;
  organization_id?: string;
  inclusion_status?: InclusionStatus;
  activity_status?: ActivityStatus;
  date_from?: string;
  date_to?: string;
  search?: string;
  sort_by?: 'activity_date' | 'created_at';
  sort_order?: 'asc' | 'desc';
  page?: number;
  page_size?: number;
}

// 活動統計
export interface ActivityStatistics {
  total_count: number;
  by_scope: {
    scope1: number;
    scope2: number;
    scope3: number;
  };
  by_inclusion: {
    included: number;
    excluded: number;
    pending: number;
  };
  by_status: {
    active: number;
    voided: number;
    archived: number;
  };
  total_co2e: number;
}

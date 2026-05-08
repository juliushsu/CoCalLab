// 報告狀態
export type ReportStatus = 'draft' | 'generating' | 'completed' | 'failed';

// 報告格式
export type ReportFormat = 'pdf' | 'docx' | 'html';

// 報告章節類型
export type ReportSectionType = 
  | 'executive_summary'
  | 'organization_info'
  | 'methodology'
  | 'scope_boundaries'
  | 'emission_inventory'
  | 'scope1_analysis'
  | 'scope2_analysis'
  | 'scope3_analysis'
  | 'reduction_recommendations'
  | 'appendix'
  | 'organization_overview'
  | 'scope1_emissions'
  | 'scope2_emissions'
  | 'scope3_emissions'
  | 'reduction_plan'
  | 'conclusion';

// 報告章節
export interface ReportSection {
  id: string;
  report_version_id?: string;
  report_id?: string;
  section_type: ReportSectionType;
  section_title?: string;
  section_order: number;
  title?: string;
  content: string;
  is_ai_generated: boolean;
  is_user_modified: boolean;
  metadata?: Record<string, any>;
  ai_prompt_used?: string | null;
  section_status?: string;
  word_count?: number;
  generated_at?: string;
  last_modified_at?: string;
  last_modified_by?: string;
  created_at: string;
  updated_at: string;
}

// 報告版本
export interface ReportVersion {
  id: string;
  project_id: string;
  project_name?: string;
  version_number: number;
  report_type?: string;
  language?: 'zh' | 'en' | 'ja' | string;
  report_status: ReportStatus;
  generated_by: string;
  generated_at: string;
  completed_at?: string;
  error_message?: string;
  total_sections: number;
  completed_sections: number;
  ai_generated_sections?: number;
  user_modified_sections?: number;
  last_modified_at?: string;
  last_modified_by?: string;
  metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

// 報告統計
export interface ReportStatistics {
  total_emissions: number;
  scope1_emissions: number;
  scope2_emissions: number;
  scope3_emissions: number;
  total_activities: number;
  included_activities: number;
  excluded_activities: number;
  verified_activities: number;
  emission_by_category: Array<{
    category: string;
    emissions: number;
    percentage: number;
  }>;
  emission_trend?: Array<{
    date: string;
    emissions: number;
  }>;
}

// 建立報告輸入
export interface GenerateReportInput {
  project_id: string;
  include_sections: ReportSectionType[];
  format?: ReportFormat;
  language?: 'zh' | 'en' | 'ja';
}

// 更新章節輸入
export interface UpdateReportSectionInput {
  section_id: string;
  content: string;
}

// 重新生成章節輸入
export interface RegenerateReportSectionInput {
  section_id: string;
  custom_prompt?: string;
}

// 匯出報告輸入
export interface ExportReportInput {
  report_version_id: string;
  format: ReportFormat;
  include_sections?: ReportSectionType[];
}

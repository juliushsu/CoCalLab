// 對齊 DB schema: projects 表
export type ProjectStatus = 'draft' | 'active' | 'closed' | 'archived';

export type BoundaryType = 'operational_control' | 'financial_control' | 'equity_share';

export type ProjectType = 'organization' | 'product' | 'facility' | 'supply_chain' | 'other' | string;

export interface Project {
  id: string;
  organization_id: string;
  organization_name?: string;           // join from organizations
  project_code: string;                 // DB: project_code
  name: string;
  description?: string;
  reporting_start_date: string;         // DB: reporting_start_date
  reporting_end_date: string;           // DB: reporting_end_date
  boundary_type: BoundaryType;          // DB: boundary_type
  status: ProjectStatus;
  base_currency: string;
  project_type?: ProjectType;
  baseline_year?: number | null;
  reduction_target?: number | null;
  legal_entity_id?: string | null;
  site_id?: string | null;
  archived_at?: string | null;
  created_at: string;
  updated_at: string;

  // 前端相容別名（從 DB 欄位對應）
  code?: string;                        // alias for project_code
  start_date?: string;                  // alias for reporting_start_date
  end_date?: string;                    // alias for reporting_end_date
}

export interface CreateProjectInput {
  organization_id: string;
  project_code: string;
  name: string;
  description?: string;
  reporting_start_date: string;
  reporting_end_date: string;
  boundary_type?: BoundaryType;
  status?: ProjectStatus;
  base_currency?: string;
  code?: string;
  start_date?: string;
  end_date?: string;
  project_type?: ProjectType;
  baseline_year?: number | null;
  reduction_target?: number | null;
  legal_entity_id?: string | null;
  site_id?: string | null;
}

export interface UpdateProjectInput extends Partial<CreateProjectInput> {
  id: string;
}

export interface ProjectStatistics {
  total_documents: number;
  total_activities: number;
  total_emissions: number;
  completion_rate: number;
  documents_uploaded: number;
  activities_confirmed: number;
  calculation_completed: boolean;
  report_generated: boolean;
}

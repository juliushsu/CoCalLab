import type { EmissionActivity } from '../types/activity';
import type { ReportVersion, ReportSection, ReportStatistics } from '../types/report';
import { mockActivities } from '../mocks/activities.fixture';
import { mockReport, mockSections, mockStatistics } from '../mocks/reports.fixture';

/**
 * Fixture Service
 * 當 Supabase 尚未連線時，提供離線 mock 資料。
 * 只作為測試/開發使用，切勿在正式環境使用。
 */
export const fixtureService = {
  async getEmissionActivities(): Promise<EmissionActivity[]> {
    // 直接回傳 mock 陣列
    return mockActivities;
  },

  async getReportData(reportId: string) {
    // 依照 reportId 回傳對應的 mock（此範例僅回傳同一筆資料）
    return {
      report: mockReport,
      sections: mockSections,
      statistics: mockStatistics,
    };
  },
};
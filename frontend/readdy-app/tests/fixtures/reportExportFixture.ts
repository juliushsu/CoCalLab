/** Synthetic, test-only report. Never imported by production src. */
export function reportExportFixture() {
  return {
    id:'00000000-0000-0000-0000-000000000001',
    project_id:'00000000-0000-0000-0000-000000000002',
    organization_id:'00000000-0000-0000-0000-000000000003',
    status:'completed',report_version:2,created_at:'2026-11-02T00:00:00Z',
    payload_hash:'synthetic-test-only-not-a-verified-hash',
    payload:{project_metadata:{name:'SYNTHETIC TEST ONLY'},note:'Not a customer report'},
    is_test:true,env:'synthetic-local-test',
    scope_totals:{scope_1:1500,scope_2:500,scope_3:0,unknown:250},
    category_totals:{electricity:500},included_activity_count:2,
    excluded_activity_count:0,pending_activity_count:0,warning_count:0,
  };
}

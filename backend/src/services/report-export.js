// Saved snapshot allowlist; keep in sync with frontend reportExport.ts.
export const REPORT_EXPORT_FIELDS=['id','organization_id','project_id','status','integrity_status','report_version','created_at','payload','payload_hash','reporting_period_start','reporting_period_end','included_activity_count','excluded_activity_count','pending_activity_count','scope_totals','category_totals','factor_sources','warning_count','based_on_calculated_at','is_test','env','legal_entity_snapshot','site_snapshot','boundary_snapshot','gross_emissions_snapshot','adjustment_summary','claim_results','claim_purpose','adjustment_manifest'];
export function exportSnapshotInput(value){
 const keys=['organization_id','project_id','report_id'];
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(k=>!keys.includes(k))||keys.some(k=>typeof value[k]!=='string'||!(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i).test(value[k])))throw new Error('INVALID_EXPORT_INPUT');
 return Object.fromEntries(keys.map(k=>[k,value[k].toLowerCase()]));
}
export function exportSavedSnapshot(row,input){
 if(!row||row.id!==input.report_id||row.project_id!==input.project_id||row.organization_id!==input.organization_id||row.status!=='completed')throw new Error('REPORT_NOT_FOUND');
 if(row.integrity_status!=='server_verified')throw new Error('REPORT_SNAPSHOT_UNVERIFIED');
 if(!Number.isInteger(row.report_version)||row.report_version<1||!row.payload||typeof row.payload!=='object'||Array.isArray(row.payload)||typeof row.payload_hash!=='string'||!row.payload_hash)throw new Error('REPORT_SNAPSHOT_INCOMPLETE');
 return Object.fromEntries(REPORT_EXPORT_FIELDS.map(k=>[k,row[k]??null]));
}

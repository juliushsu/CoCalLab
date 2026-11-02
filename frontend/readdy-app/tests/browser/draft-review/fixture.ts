import type { ExtractedDocumentDraft } from '../../../src/types/document';
export const organizationId = '00000000-0000-4000-8000-000000000001';
export const projectId = '00000000-0000-4000-8000-000000000002';
export const draftId = '00000000-0000-4000-8000-000000000003';
const secondId = '00000000-0000-4000-8000-000000000004';
export const session = { access_token: 'synthetic-test-token', expires_at: 4102444800, user: { id: organizationId } };
const scenario = new URLSearchParams(location.search).get('case');
let rows = [draftId, secondId].map((id, index) => ({
  id, organization_id: organizationId, project_id: projectId, uploaded_document_id: id,
  status: 'pending_review', is_latest: true, suggested_category: 'electricity', suggested_scope: 2,
  extraction_provider: scenario === 'mock' ? 'mock-ocr' : undefined,
  parsed_quantity: 900, parsed_unit: 'kg', suggested_activity_date: '2000-01-01',
  normalized_payload: { quantity: index, unit: 'kWh', activity_date: '2026-11-02' },
} as ExtractedDocumentDraft));
let calls = 0;
function evidence() {
  document.getElementById('fixture-evidence')!.textContent = `fixture=${scenario || 'success'}; requests=${calls}; pending=${rows.length}`;
}
export async function readDrafts(_projectId?:string,_organizationId?:string,documentId?:string) {
  evidence();
  if(scenario==='read-error')throw new Error('synthetic read failed');
  if(scenario==='single-document'&&documentId!==draftId)throw new Error('document filter was not forwarded by the actual page');
  return rows.filter(row=>!documentId||row.uploaded_document_id===documentId);
}
export async function invoke({payload}: {payload?: Record<string, unknown>}) {
  calls++;
  if (scenario === 'partial' && payload?.draft_id === secondId) {
    evidence(); return {success: false, error: {code: 'DENIED', message: 'synthetic permission denied'}};
  }
  rows = rows.filter(row => row.id !== payload?.draft_id);
  evidence();
  if (scenario === 'lost-response') throw new Error('synthetic response lost AFTER save');
  return {success: true, data: {draft_id: payload?.draft_id, draft_status: payload?.decision,
    emission_activity_id: payload?.decision === 'confirmed' ? projectId : null}};
}

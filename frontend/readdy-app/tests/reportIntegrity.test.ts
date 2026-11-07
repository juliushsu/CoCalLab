import test from 'node:test';
import assert from 'node:assert/strict';
import { reportIntegrityExportBlock, reportIntegrityNotice } from '../src/services/reportIntegrity.ts';
import { readAuthorizedReportSnapshot } from '../src/services/reportExportRead.ts';
import { reportExportFixture } from './fixtures/reportExportFixture.ts';

test('legacy, absent and invalid evidence markers stay inspectable but never imply export authority', () => {
  for (const marker of ['legacy_unverified', undefined, null, 'completed', true, {verified: true}]) {
    assert.match(reportIntegrityExportBlock(marker)!, /歷史檢視/);
    assert.match(reportIntegrityNotice(marker), /不會自動補簽/);
  }
  assert.equal(reportIntegrityExportBlock('server_verified'), null);
  assert.match(reportIntegrityNotice('server_verified'), /標記本身不是驗證結果/);
});

test('successful export envelope with a legacy or missing marker is rejected, not locally signed', async () => {
  const row=reportExportFixture();
  for (const marker of [undefined,'legacy_unverified','server_verified']) {
    const client={functions:{invoke:async()=>({error:null,data:{success:true,data:{policy:'tenant_write_v1',snapshot:{...row,integrity_status:marker}}}})}};
    const operation=()=>readAuthorizedReportSnapshot(client as never,row.id,row.project_id,row.organization_id);
    if(marker==='server_verified')assert.equal((await operation()).integrity_status,marker);
    else await assert.rejects(operation,/保存證據/);
  }
});

import test from 'node:test';
import assert from 'node:assert/strict';

import { getOcrProvider, getLlmProvider } from '../src/providers/index.js';
import {
  validateProcessDocumentInput,
  validateClassifyDocumentInput,
  validateGenerateReportInput,
} from '../src/contracts/contracts.js';

test('mock OCR provider should return provider/model/raw payload', async () => {
  const provider = getOcrProvider('mock');
  const result = await provider.extractDocument({
    organization_id: '11111111-1111-4111-8111-111111111111',
    project_id: '51111111-1111-4111-8111-111111111111',
    uploaded_document_id: 'a4444444-1111-4111-8111-111111111111',
    original_filename: 'electricity-bill.png',
    mime_type: 'image/png',
    storage_path: 'fixtures/electricity-bill.png',
  });

  assert.equal(result.provider, 'mock-ocr');
  assert.equal(result.model, 'mock-ocr-v1');
  assert.ok(result.raw_payload.vendor);
});

test('mock LLM provider should classify and audit with stable shape', async () => {
  const provider = getLlmProvider('mock');

  const classify = await provider.classifyDraft({
    normalized_payload: {
      vendor: 'Taiwan Electric Company',
      raw_text_snippets: ['electric bill'],
      normalized_quantity: 300,
      activity_date: '2026-03-01',
    },
  });

  assert.equal(classify.provider, 'mock-llm');
  assert.equal(classify.model, 'mock-classifier-v1');
  assert.equal(classify.classification.classification_status, 'classified');

  const audit = await provider.auditReport({
    report_payload: {
      boundary_summary: { included_count: 1, excluded_count: 0, pending_count: 0 },
      included_activities_summary: [{ emission_activity_id: 'ea1', category: 'energy', co2e_kg: 10 }],
      excluded_items_summary: [],
      category_totals: { energy: 10 },
    },
  });

  assert.equal(audit.provider, 'mock-llm');
  assert.equal(audit.model, 'mock-audit-v1');
  assert.equal(audit.audit.status, 'completed');
  assert.ok(audit.audit.summary_text.zh_tw);
});

test('contracts should allow provider-driven requests without raw payload in request body', () => {
  const processInput = validateProcessDocumentInput({
    organization_id: '11111111-1111-4111-8111-111111111111',
    project_id: '51111111-1111-4111-8111-111111111111',
    uploaded_document_id: 'a4444444-1111-4111-8111-111111111111',
    provider_hint: 'mock',
  });

  assert.equal(processInput.provider_hint, 'mock');

  const classifyInput = validateClassifyDocumentInput({
    organization_id: '11111111-1111-4111-8111-111111111111',
    project_id: '51111111-1111-4111-8111-111111111111',
    draft_id: 'a5555555-1111-4111-8111-111111111111',
    model_hint: 'mock',
  });

  assert.equal(classifyInput.model_hint, 'mock');
});

test('generate-report contract should validate claim_purpose enum', () => {
  const valid = validateGenerateReportInput({
    organization_id: '11111111-1111-4111-8111-111111111111',
    project_id: '51111111-1111-4111-8111-111111111111',
    report_version: 2,
    claim_purpose: 'internal_management',
  });

  assert.equal(valid.claim_purpose, 'internal_management');

  assert.throws(() => {
    validateGenerateReportInput({
      organization_id: '11111111-1111-4111-8111-111111111111',
      project_id: '51111111-1111-4111-8111-111111111111',
      report_version: 2,
      claim_purpose: 'invalid_purpose',
    });
  }, /claim_purpose is invalid/);
});

test('generate-report contract should accept Report Center payload shape', () => {
  const valid = validateGenerateReportInput({
    organization_id: '11111111-1111-4111-8111-111111111111',
    project_id: '51111111-1111-4111-8111-111111111111',
    report_version: 3,
    language: 'zh',
    claim_purpose: 'internal_management',
    request_id: 'report-center-test',
  });

  assert.equal(valid.organization_id, '11111111-1111-4111-8111-111111111111');
  assert.equal(valid.project_id, '51111111-1111-4111-8111-111111111111');
  assert.equal(valid.report_version, 3);
  assert.equal(valid.claim_purpose, 'internal_management');
});

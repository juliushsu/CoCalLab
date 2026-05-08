import {
  LlmProviderAdapter,
  validateLlmClassifyOutput,
  validateLlmAuditOutput,
} from './llm-provider.js';
import { classify_document_draft } from '../services/classify-document-draft.js';
import { run_ai_audit } from '../services/run-ai-audit.js';

export class MockLlmProvider extends LlmProviderAdapter {
  async classifyDraft(input) {
    const classification = classify_document_draft({
      normalized_payload: input.normalized_payload,
    });

    return validateLlmClassifyOutput({
      provider: 'mock-llm',
      model: 'mock-classifier-v1',
      classification,
    });
  }

  async auditReport(input) {
    const audit = run_ai_audit({
      report_payload: input.report_payload,
      model_info: {
        model_provider: 'mock-llm',
        model_name: 'mock-audit-v1',
        model_version: 'v1',
      },
    });

    return validateLlmAuditOutput({
      provider: 'mock-llm',
      model: 'mock-audit-v1',
      audit,
    });
  }
}

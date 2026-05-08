/**
 * @typedef {Object} LlmClassifyInput
 * @property {Object} normalized_payload
 * @property {Object} [context]
 */

/**
 * @typedef {Object} LlmClassifyOutput
 * @property {string} provider
 * @property {string} model
 * @property {Object} classification
 */

/**
 * @typedef {Object} LlmAuditInput
 * @property {Object} report_payload
 * @property {Object} [context]
 */

/**
 * @typedef {Object} LlmAuditOutput
 * @property {string} provider
 * @property {string} model
 * @property {Object} audit
 */

/**
 * @interface
 */
export class LlmProviderAdapter {
  /**
   * @param {LlmClassifyInput} _input
   * @returns {Promise<LlmClassifyOutput>}
   */
  async classifyDraft(_input) {
    throw new Error('classifyDraft() must be implemented by provider adapter');
  }

  /**
   * @param {LlmAuditInput} _input
   * @returns {Promise<LlmAuditOutput>}
   */
  async auditReport(_input) {
    throw new Error('auditReport() must be implemented by provider adapter');
  }
}

export function validateLlmClassifyOutput(output) {
  if (!output || typeof output !== 'object') {
    throw new Error('llm classification output must be object');
  }
  if (typeof output.provider !== 'string' || !output.provider) {
    throw new Error('llm classification output.provider must be non-empty string');
  }
  if (typeof output.model !== 'string' || !output.model) {
    throw new Error('llm classification output.model must be non-empty string');
  }
  if (!output.classification || typeof output.classification !== 'object') {
    throw new Error('llm classification output.classification must be object');
  }
  return output;
}

export function validateLlmAuditOutput(output) {
  if (!output || typeof output !== 'object') {
    throw new Error('llm audit output must be object');
  }
  if (typeof output.provider !== 'string' || !output.provider) {
    throw new Error('llm audit output.provider must be non-empty string');
  }
  if (typeof output.model !== 'string' || !output.model) {
    throw new Error('llm audit output.model must be non-empty string');
  }
  if (!output.audit || typeof output.audit !== 'object') {
    throw new Error('llm audit output.audit must be object');
  }
  return output;
}

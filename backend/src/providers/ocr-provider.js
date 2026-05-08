/**
 * @typedef {Object} OcrExtractInput
 * @property {string} organization_id
 * @property {string} project_id
 * @property {string} uploaded_document_id
 * @property {string|null} original_filename
 * @property {string|null} mime_type
 * @property {string|null} storage_path
 */

/**
 * @typedef {Object} OcrExtractOutput
 * @property {string} provider
 * @property {string} model
 * @property {Object} raw_payload
 * @property {number} confidence_score
 * @property {Array<Object>} warnings
 */

/**
 * @interface
 */
export class OcrProviderAdapter {
  /**
   * @param {OcrExtractInput} _input
   * @returns {Promise<OcrExtractOutput>}
   */
  async extractDocument(_input) {
    throw new Error('extractDocument() must be implemented by provider adapter');
  }
}

export function validateOcrOutput(output) {
  if (!output || typeof output !== 'object') {
    throw new Error('ocr output must be object');
  }
  if (typeof output.provider !== 'string' || !output.provider) {
    throw new Error('ocr output.provider must be non-empty string');
  }
  if (typeof output.model !== 'string' || !output.model) {
    throw new Error('ocr output.model must be non-empty string');
  }
  if (!output.raw_payload || typeof output.raw_payload !== 'object') {
    throw new Error('ocr output.raw_payload must be object');
  }
  if (typeof output.confidence_score !== 'number' || output.confidence_score < 0 || output.confidence_score > 1) {
    throw new Error('ocr output.confidence_score must be number in [0,1]');
  }
  if (!Array.isArray(output.warnings)) {
    throw new Error('ocr output.warnings must be array');
  }
  return output;
}

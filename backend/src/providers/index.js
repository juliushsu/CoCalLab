import { MockOcrProvider } from './mock-ocr-provider.js';
import { MockLlmProvider } from './mock-llm-provider.js';

export function getOcrProvider(providerHint) {
  const hint = (providerHint || '').toLowerCase();
  if (!hint || hint === 'mock') {
    return new MockOcrProvider();
  }
  throw new Error(`Unsupported OCR provider: ${providerHint}`);
}

export function getLlmProvider(providerHint) {
  const hint = (providerHint || '').toLowerCase();
  if (!hint || hint === 'mock') {
    return new MockLlmProvider();
  }
  throw new Error(`Unsupported LLM provider: ${providerHint}`);
}

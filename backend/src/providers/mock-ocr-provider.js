import { OcrProviderAdapter, validateOcrOutput } from './ocr-provider.js';

export class MockOcrProvider extends OcrProviderAdapter {
  async extractDocument(input) {
    const filename = input.original_filename || '';
    const isElectricity = /electric|power|bill|電/i.test(filename);

    const output = {
      provider: 'mock-ocr',
      model: 'mock-ocr-v1',
      raw_payload: isElectricity
        ? {
            vendor: 'Taiwan Power',
            invoice_date: '2026-03-01',
            quantity: 1200,
            unit: 'kWh',
            total_amount: 6500,
            currency: 'TWD',
            text_blocks: ['electric bill', 'kWh usage'],
          }
        : {
            vendor: 'Unknown Vendor',
            invoice_date: '2026-03-05',
            quantity: 1,
            unit: 'kg',
            total_amount: 500,
            currency: 'TWD',
            text_blocks: ['manual review required'],
          },
      confidence_score: isElectricity ? 0.92 : 0.64,
      warnings: [],
    };

    return validateOcrOutput(output);
  }
}

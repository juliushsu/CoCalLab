import type { UpdateOrganizationInput } from '../types/organization.ts';
import type { UpdateProjectInput } from '../types/project.ts';

function assertKeys(input: object, allowed: string[]) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Invalid update input.');
  for (const key of Object.keys(input)) {
    if (!allowed.includes(key)) throw new Error(`Unsupported update field: ${key}`);
  }
}
function required(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${field} is required.`);
  return value.trim();
}
function optional(value: unknown, field: string): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') throw new Error(`${field} must be text.`);
  return value.trim() || null;
}
function date(value: unknown, field: string): string {
  const text = required(value, field);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text) || !Number.isFinite(Date.parse(text)) || new Date(text).toISOString().slice(0, 10) !== text) {
    throw new Error(`${field} must be a valid YYYY-MM-DD date.`);
  }
  return text;
}
export function organizationUpdatePayload(input: UpdateOrganizationInput) {
  assertKeys(input, ['id', 'legal_name', 'display_name', 'tax_id', 'country_code', 'timezone']);
  required(input.id, 'id');
  const country = required(input.country_code, 'country_code').toUpperCase();
  if (!/^[A-Z]{2}$/.test(country)) throw new Error('country_code must contain two letters.');
  const timezone = required(input.timezone, 'timezone');
  try { new Intl.DateTimeFormat('en', { timeZone: timezone }); }
  catch { throw new Error('Invalid timezone.'); }
  return {
    legal_name: required(input.legal_name, 'legal_name'),
    display_name: required(input.display_name, 'display_name'),
    tax_id: optional(input.tax_id, 'tax_id'),
    country_code: country,
    timezone,
  };
}
export function projectUpdatePayload(input: UpdateProjectInput) {
  assertKeys(input, ['id', 'organization_id', 'project_code', 'name', 'description', 'reporting_start_date', 'reporting_end_date', 'boundary_type', 'base_currency']);
  required(input.id, 'id'); required(input.organization_id, 'organization_id');
  const start = date(input.reporting_start_date, 'reporting_start_date');
  const end = date(input.reporting_end_date, 'reporting_end_date');
  if (end < start) throw new Error('Reporting end date must not precede start date.');
  if (!['operational_control', 'financial_control', 'equity_share'].includes(input.boundary_type)) throw new Error('Invalid boundary_type.');
  const currency = required(input.base_currency, 'base_currency').toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) throw new Error('base_currency must contain three letters.');
  return {
    project_code: required(input.project_code, 'project_code'),
    name: required(input.name, 'name'),
    description: optional(input.description, 'description'),
    reporting_start_date: start,
    reporting_end_date: end,
    boundary_type: input.boundary_type,
    base_currency: currency,
  };
}

/** RLS may deny an UPDATE with an error or return zero rows; neither is success. */
export function requireUpdatedRow<T>(result: { data: T | null; error: unknown }): T {
  if (result.error) throw result.error;
  if (!result.data) throw new Error('Update returned no row. Check permissions and the original record.');
  return result.data;
}

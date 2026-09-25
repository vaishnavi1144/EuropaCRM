export function normalizeJobPayload(payload: unknown): Record<string, unknown> {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return {} as Record<string, unknown>;
  }

  const source = { ...(payload as Record<string, unknown>) };
  const rawRateType = source.rateType;

  if (rawRateType !== undefined && rawRateType !== null && String(rawRateType).trim() !== '') {
    source.rateType = String(rawRateType).trim().toUpperCase();
  } else if (rawRateType !== undefined) {
    source.rateType = '';
  }

  return source;
}

export function normalizeJobPayload(payload: unknown): Record<string, unknown> {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return {} as Record<string, unknown>;
  }

  const source = { ...(payload as Record<string, unknown>) };
  const rawRateType = source.rateType;

  if (rawRateType === undefined || rawRateType === null || String(rawRateType).trim() === '') {
    source.rateType = 'C2C';
  } else {
    const value = String(rawRateType).trim().toUpperCase();
    source.rateType = value;
  }

  return source;
}

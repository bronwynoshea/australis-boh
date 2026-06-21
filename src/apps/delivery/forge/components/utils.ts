export const normalizeReleaseStatus = (status: string | null | undefined) =>
  (status || '').trim().toLowerCase();

export const isInProgressStatus = (status: string | null | undefined) =>
  normalizeReleaseStatus(status) === 'in progress';

export const isReleasedStatus = (status: string | null | undefined) =>
  normalizeReleaseStatus(status) === 'released';

export const parseIsoDate = (iso: string): Date | null => {
  const v = (iso || '').trim();
  if (!v) return null;
  const [y, m, d] = v.split('-').map((p) => Number(p));
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null;
  return new Date(y, m - 1, d);
};

export const formatReleaseDateForUi = (iso: string | null | undefined) => {
  const parsed = iso ? parseIsoDate((iso || '').slice(0, 10)) : null;
  return parsed
    ? parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : 'date TBD';
};

export const formatVersionNumberForUi = (version: string | null | undefined) => {
  const v = (version || '').trim();
  if (!v) return 'v?.?.?';
  return v.startsWith('v') ? v : `v${v}`;
};

export const formatEnvironmentLabel = (environment?: string | null) => {
  const value = (environment || '').trim();
  if (!value) return 'Unknown';
  return value
    .split(/[_\-\s]+/)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');
};

export const getEnvironmentGroup = (environment?: string | null) => {
  const value = (environment || '').trim().toLowerCase();
  if (['cats', 'dogs', 'internal', 'boh', 'people'].includes(value)) return 'internal';
  if (['teas', 'coffees', 'external', 'market', 'store'].includes(value)) return 'external';
  return 'unknown';
};

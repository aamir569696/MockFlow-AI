/**
 * Global Edge Regional Gateway — region catalogue.
 *
 * Single source of truth for the region tokens, human labels, flags, and the
 * simulated edge latency window (in ms) applied on the backend. The backend
 * mirrors these same latency numbers in routes/mock.js.
 *
 * Token → sent as the `x-mockflow-region` HTTP header.
 */
export const REGIONS = [
  {
    token:    'us-east-1',
    label:    'US East',
    flag:     '🇺🇸',
    location: 'N. Virginia',
    latencyMs: 280,
  },
  {
    token:    'eu-central-1',
    label:    'Europe',
    flag:     '🇪🇺',
    location: 'Frankfurt',
    latencyMs: 110,
  },
  {
    token:    'ap-southeast-1',
    label:    'Singapore',
    flag:     '🇸🇬',
    location: 'Singapore',
    latencyMs: 45,
  },
  {
    token:    'local',
    label:    'Local Edge Native',
    flag:     '⚡',
    location: 'In-Memory',
    latencyMs: 0,
  },
];

/** Look up a region descriptor by token; falls back to Local Edge Native. */
export function getRegion(token) {
  return REGIONS.find((r) => r.token === token) ?? REGIONS[REGIONS.length - 1];
}

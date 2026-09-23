import type { ClimateManifest } from './types';

export const REAL_REFERENCE_DATASET = 'real-reference';
export const REAL_ANNUAL_DATASET = 'real-2025';
export const SYNTHETIC_DATASET = 'synthetic';

export type DatasetKind = 'real-annual' | 'real-reference' | 'synthetic';

function trailingSlash(value: string): string {
  return value.endsWith('/') ? value : `${value}/`;
}

export function resolveDatasetBaseUrl(search: string, viteBaseUrl: string): string {
  const baseUrl = trailingSlash(viteBaseUrl);
  const dataset = new URLSearchParams(search).get('dataset');
  if (dataset === REAL_REFERENCE_DATASET) return `${baseUrl}${REAL_REFERENCE_DATASET}/`;
  if (dataset === REAL_ANNUAL_DATASET) return `${baseUrl}${REAL_ANNUAL_DATASET}/`;
  if (dataset === SYNTHETIC_DATASET) return `${baseUrl}${SYNTHETIC_DATASET}/`;
  return baseUrl;
}

export function classifyClimateManifest(
  manifest: Pick<ClimateManifest, 'sources' | 'temporalCoverage'>,
): DatasetKind {
  const sourceNames = [manifest.sources.land.dataset, manifest.sources.ocean.dataset];
  if (sourceNames.some((source) => source.toLowerCase().includes('synthetic'))) return 'synthetic';
  return manifest.temporalCoverage === 'reference' ? 'real-reference' : 'real-annual';
}

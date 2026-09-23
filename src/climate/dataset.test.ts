import { describe, expect, it } from 'vitest';
import { classifyClimateManifest, resolveDatasetBaseUrl } from './dataset';

describe('dataset selection', () => {
  it('uses the normal Vite base by default', () => {
    expect(resolveDatasetBaseUrl('', '/temperies/')).toBe('/temperies/');
  });

  it('selects the isolated real reference dataset explicitly', () => {
    expect(resolveDatasetBaseUrl('?dataset=real-reference', '/temperies/')).toBe('/temperies/real-reference/');
  });

  it('ignores unsupported dataset names', () => {
    expect(resolveDatasetBaseUrl('?dataset=unknown', '/')).toBe('/');
  });

  it('keeps the archived synthetic and annual real datasets independently selectable', () => {
    expect(resolveDatasetBaseUrl('?dataset=synthetic', '/temperies/')).toBe('/temperies/synthetic/');
    expect(resolveDatasetBaseUrl('?dataset=real-2025', '/temperies/')).toBe('/temperies/real-2025/');
  });

  it('classifies presentation language from manifest provenance', () => {
    const sources = (land: string, ocean: string) => ({
      land: { dataset: land, variable: 'air' },
      ocean: { dataset: ocean, variable: 'sst' },
      units: '°C',
    });

    expect(classifyClimateManifest({ temporalCoverage: 'annual', sources: sources('Copernicus ERA5 daily statistics', 'NOAA OISST v2.1 AVHRR') })).toBe('real-annual');
    expect(classifyClimateManifest({ temporalCoverage: 'reference', sources: sources('Copernicus ERA5 daily statistics', 'NOAA OISST v2.1 AVHRR') })).toBe('real-reference');
    expect(classifyClimateManifest({ temporalCoverage: 'annual', sources: sources('ERA5-style synthetic field', 'OISST-style synthetic field') })).toBe('synthetic');
  });
});

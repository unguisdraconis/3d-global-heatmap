import { useEffect, useMemo } from 'react';
import { mesh } from 'topojson-client';
import type { GeometryCollection, Topology } from 'topojson-specification';
import worldData from 'world-atlas/countries-110m.json';
import type { VectorLayerVisibility } from '../climate/types';
import { createLineGeometry } from './vectorGeometry';

export function VectorLayers({ countries, coastlines }: VectorLayerVisibility) {
  const geometries = useMemo(() => {
    const topology = worldData as unknown as Topology<{ countries: GeometryCollection; land: GeometryCollection }>;
    return {
      borders: createLineGeometry(mesh(topology, topology.objects.countries, (a, b) => a !== b), 1.006),
      coasts: createLineGeometry(mesh(topology, topology.objects.land), 1.009),
    };
  }, []);
  useEffect(() => () => { geometries.borders.dispose(); geometries.coasts.dispose(); }, [geometries]);
  return <>
    {countries && <lineSegments geometry={geometries.borders}><lineBasicMaterial color="#b8d4d2" transparent opacity={0.3} depthWrite={false} /></lineSegments>}
    {coastlines && <lineSegments geometry={geometries.coasts}><lineBasicMaterial color="#e3f2ec" transparent opacity={0.68} depthWrite={false} /></lineSegments>}
  </>;
}

import { useEffect, useMemo, useRef } from 'react';
import type { ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import type { DisplayMode, FramePair, HoveredCell, LegendSelection, TemperatureRenderStyle } from '../climate/types';
import { latLonToGridCell, spherePointToLatLon } from '../climate/grid';
import { createPaletteTexture } from './textures';
import { DisplayTextureCache } from './displayTextureCache';
import { canonicalGridUniformSize, HEATMAP_GRID_PRESENTATION, heatmapGridActive } from './rendering';
import { lookupTemperatureAtIndex } from './temperatureLookup';
import vertexShader from './shaders/temperature.vert.glsl?raw';
import fragmentShader from './shaders/temperature.frag.glsl?raw';

const displayTextureCache = new DisplayTextureCache();

interface Props {
  frames: FramePair; mask: Uint8Array; mode: DisplayMode; renderStyle: TemperatureRenderStyle; highlight: LegendSelection | null;
  onHover: (cell: HoveredCell) => void; onLeave: () => void;
}

export function TemperatureSphere({ frames, mask, mode, renderStyle, highlight, onHover, onLeave }: Props) {
  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const initialRenderStyle = useRef(renderStyle);
  const fieldTexture = useMemo(() => displayTextureCache.get(frames.current, mask, mode), [frames, mask, mode]);
  const paletteTexture = useMemo(() => createPaletteTexture(), []);
  const uniforms = useMemo(() => ({
    uField: { value: fieldTexture }, uLut: { value: paletteTexture },
    uHighlightActive: { value: 0 }, uHighlightMin: { value: 0 }, uHighlightMax: { value: 0 },
    uGridSize: { value: canonicalGridUniformSize() },
    uHeatmapGridActive: { value: heatmapGridActive(initialRenderStyle.current) },
    uHeatmapGridOpacity: { value: HEATMAP_GRID_PRESENTATION.opacity },
    uHeatmapGridColor: { value: new THREE.Color(HEATMAP_GRID_PRESENTATION.color) },
    uGridLineHalfWidthPixels: { value: HEATMAP_GRID_PRESENTATION.lineHalfWidthPixels },
    uGridFadeStartPixelsPerCell: { value: HEATMAP_GRID_PRESENTATION.fadeStartPixelsPerCell },
    uGridFadeEndPixelsPerCell: { value: HEATMAP_GRID_PRESENTATION.fadeEndPixelsPerCell },
  }), [fieldTexture, paletteTexture]);

  useEffect(() => () => paletteTexture.dispose(), [paletteTexture]);
  useEffect(() => {
    if (materialRef.current) materialRef.current.uniforms.uHeatmapGridActive!.value = heatmapGridActive(renderStyle);
  }, [renderStyle]);
  useEffect(() => {
    const uniformsNow = materialRef.current?.uniforms;
    if (!uniformsNow) return;
    uniformsNow.uHighlightActive!.value = highlight ? 1 : 0;
    if (highlight) { uniformsNow.uHighlightMin!.value = highlight.minimum; uniformsNow.uHighlightMax!.value = highlight.maximum; }
  }, [highlight]);

  const handleMove = (event: ThreeEvent<PointerEvent>) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    event.stopPropagation();
    const localPoint = mesh.worldToLocal(event.point.clone());
    const coordinates = spherePointToLatLon(localPoint.x, localPoint.y, localPoint.z);
    const cell = latLonToGridCell(coordinates.latitude, coordinates.longitude);
    const { surface, temperatureC } = lookupTemperatureAtIndex(frames, mask, mode, cell.index, 0);
    onHover({ ...cell, ...coordinates, surface, temperatureC,
      clientX: event.nativeEvent.clientX, clientY: event.nativeEvent.clientY, interpolation: 0 });
  };

  return <mesh ref={meshRef} onPointerMove={handleMove} onPointerOut={onLeave}>
    <sphereGeometry args={[1, 192, 96]} />
    <shaderMaterial ref={materialRef} uniforms={uniforms} vertexShader={vertexShader} fragmentShader={fragmentShader} glslVersion={THREE.GLSL3} />
  </mesh>;
}

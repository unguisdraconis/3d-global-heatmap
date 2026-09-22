import { useEffect, useMemo, useRef } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import type { DisplayMode, FramePair, HoveredCell, LegendSelection } from '../climate/types';
import { gridCellToLatLon, uvToGridCell } from '../climate/grid';
import { interpolateTemperatureC } from '../climate/temperature';
import { createClimateTexture, createMaskTexture, createPaletteTexture } from './textures';
import vertexShader from './shaders/temperature.vert.glsl?raw';
import fragmentShader from './shaders/temperature.frag.glsl?raw';

interface Props {
  frames: FramePair; mask: Uint8Array; mode: DisplayMode; highlight: LegendSelection | null;
  playing: boolean; secondsPerWeek: number; onHover: (cell: HoveredCell) => void;
  onLeave: () => void; onAdvance: () => void;
}

export function TemperatureSphere({ frames, mask, mode, highlight, playing, secondsPerWeek, onHover, onLeave, onAdvance }: Props) {
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const mixRef = useRef(0); const advancedRef = useRef(false);
  const fieldTextures = useMemo(() => ({
    airA: createClimateTexture(frames.current.air), airB: createClimateTexture(frames.next.air),
    sstA: createClimateTexture(frames.current.sst), sstB: createClimateTexture(frames.next.sst),
  }), [frames]);
  const maskTexture = useMemo(() => createMaskTexture(mask), [mask]);
  const paletteTexture = useMemo(() => createPaletteTexture(), []);
  const uniforms = useMemo(() => ({
    uAirA: { value: fieldTextures.airA }, uAirB: { value: fieldTextures.airB },
    uSstA: { value: fieldTextures.sstA }, uSstB: { value: fieldTextures.sstB },
    uMask: { value: maskTexture }, uLut: { value: paletteTexture }, uMix: { value: 0 },
    uMode: { value: 0 }, uHighlightActive: { value: 0 }, uHighlightMin: { value: 0 }, uHighlightMax: { value: 0 },
  }), [fieldTextures, maskTexture, paletteTexture]);

  useEffect(() => () => Object.values(fieldTextures).forEach((texture) => texture.dispose()), [fieldTextures]);
  useEffect(() => () => maskTexture.dispose(), [maskTexture]);
  useEffect(() => () => paletteTexture.dispose(), [paletteTexture]);
  useEffect(() => {
    mixRef.current = 0; advancedRef.current = false;
    if (materialRef.current) materialRef.current.uniforms.uMix!.value = 0;
  }, [frames]);
  useEffect(() => {
    if (materialRef.current) materialRef.current.uniforms.uMode!.value = mode === 'composite' ? 0 : mode === 'air' ? 1 : 2;
  }, [mode]);
  useEffect(() => {
    const uniformsNow = materialRef.current?.uniforms;
    if (!uniformsNow) return;
    uniformsNow.uHighlightActive!.value = highlight ? 1 : 0;
    if (highlight) { uniformsNow.uHighlightMin!.value = highlight.minimum; uniformsNow.uHighlightMax!.value = highlight.maximum; }
  }, [highlight]);

  useFrame((_, delta) => {
    if (!playing || !materialRef.current) return;
    mixRef.current = Math.min(1, mixRef.current + delta / secondsPerWeek);
    materialRef.current.uniforms.uMix!.value = mixRef.current;
    if (mixRef.current >= 1 && !advancedRef.current) { advancedRef.current = true; onAdvance(); }
  });

  const handleMove = (event: ThreeEvent<PointerEvent>) => {
    if (!event.uv) return;
    event.stopPropagation();
    const cell = uvToGridCell(event.uv.x, event.uv.y); const surface = mask[cell.index] === 1 ? 'land' : 'ocean';
    let temperatureC: number | null;
    if ((mode === 'air' && surface === 'ocean') || (mode === 'sst' && surface === 'land')) temperatureC = null;
    else {
      const current = mode === 'sst' ? frames.current.sst : mode === 'air' ? frames.current.air : surface === 'land' ? frames.current.air : frames.current.sst;
      const next = mode === 'sst' ? frames.next.sst : mode === 'air' ? frames.next.air : surface === 'land' ? frames.next.air : frames.next.sst;
      temperatureC = interpolateTemperatureC(current[cell.index]!, next[cell.index]!, mixRef.current);
    }
    onHover({ ...cell, ...gridCellToLatLon(cell.row, cell.column), surface, temperatureC,
      clientX: event.nativeEvent.clientX, clientY: event.nativeEvent.clientY, interpolation: mixRef.current });
  };

  return <mesh onPointerMove={handleMove} onPointerOut={onLeave}>
    <sphereGeometry args={[1, 192, 96]} />
    <shaderMaterial ref={materialRef} uniforms={uniforms} vertexShader={vertexShader} fragmentShader={fragmentShader} />
  </mesh>;
}


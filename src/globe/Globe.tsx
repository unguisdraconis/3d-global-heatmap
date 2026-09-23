import { Canvas } from '@react-three/fiber';
import { OrbitControls, Stars } from '@react-three/drei';
import type { DisplayMode, FramePair, HoveredCell, LegendSelection, TemperatureRenderStyle, VectorLayerVisibility } from '../climate/types';
import { TemperatureSphere } from './TemperatureSphere';
import { VectorLayers } from './VectorLayers';

interface Props {
  frames: FramePair; mask: Uint8Array; mode: DisplayMode; renderStyle: TemperatureRenderStyle; highlight: LegendSelection | null;
  vectorLayers: VectorLayerVisibility; reducedMotion: boolean;
  onHover: (cell: HoveredCell) => void; onLeave: () => void;
}

export function Globe({ frames, mask, mode, renderStyle, highlight, vectorLayers, reducedMotion, onHover, onLeave }: Props) {
  return <Canvas aria-label="Interactive temperature globe" fallback={<div className="webgl-error" role="alert">WebGL is unavailable in this browser.</div>}
    camera={{ position: [0, 0.18, 2.55], fov: 39 }} dpr={[1, 1.6]} gl={{ antialias: true, alpha: true }}>
    <ambientLight intensity={0.6} />
    {!reducedMotion && <Stars radius={8} depth={20} count={900} factor={1.5} saturation={0} fade speed={0.25} />}
    <group rotation={[0.03, -0.36, 0]}>
      <TemperatureSphere frames={frames} mask={mask} mode={mode} renderStyle={renderStyle} highlight={highlight}
        onHover={onHover} onLeave={onLeave} />
      <VectorLayers {...vectorLayers} />
    </group>
    <OrbitControls enablePan={false} minDistance={1.45} maxDistance={4.2} rotateSpeed={0.45} zoomSpeed={0.65} dampingFactor={0.06} enableDamping={!reducedMotion} />
  </Canvas>;
}

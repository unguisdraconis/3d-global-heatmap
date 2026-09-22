import { useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Stars } from '@react-three/drei';
import * as THREE from 'three';
import { mesh } from 'topojson-client';
import world from 'world-atlas/countries-110m.json';
import { createLutData } from '../lib/colorScale';
import { cellToCoordinates, decodeTemperature, uvToCell } from '../lib/temperature';

const vertexShader = `
  varying vec2 vUv;
  varying vec3 vNormalW;
  void main() {
    vUv = uv;
    vNormalW = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = `
  precision highp float;
  uniform sampler2D uAirA; uniform sampler2D uAirB;
  uniform sampler2D uSstA; uniform sampler2D uSstB;
  uniform sampler2D uMask; uniform sampler2D uLut;
  uniform float uMix; uniform float uMode;
  uniform float uHighlightActive; uniform float uHighlightMin; uniform float uHighlightMax;
  varying vec2 vUv; varying vec3 vNormalW;
  float decodeTemp(float sampleValue) { return sampleValue * 65535.0 * 0.01 - 100.0; }
  void main() {
    float land = step(0.5, texture2D(uMask, vUv).r);
    float air = mix(decodeTemp(texture2D(uAirA, vUv).r), decodeTemp(texture2D(uAirB, vUv).r), uMix);
    float sst = mix(decodeTemp(texture2D(uSstA, vUv).r), decodeTemp(texture2D(uSstB, vUv).r), uMix);
    float temp = uMode < 0.5 ? mix(sst, air, land) : (uMode < 1.5 ? air : sst);
    if (uMode > 1.5 && land > 0.5) { gl_FragColor = vec4(0.018, 0.045, 0.064, 1.0); return; }
    vec3 base = texture2D(uLut, vec2(clamp((temp + 80.0) / 140.0, 0.0, 1.0), 0.5)).rgb;
    float fresnel = pow(1.0 - abs(vNormalW.z), 2.2);
    base += vec3(0.02, 0.08, 0.1) * fresnel;
    if (uHighlightActive > 0.5) {
      float match = step(uHighlightMin, temp) * step(temp, uHighlightMax);
      base = mix(base * 0.13, min(vec3(1.0), base * 1.35 + 0.08), match);
    }
    gl_FragColor = vec4(base, 1.0);
  }
`;

function dataTexture(data, type = THREE.UnsignedShortType) {
  const texture = new THREE.DataTexture(data, 1440, 720, THREE.RedFormat, type);
  texture.needsUpdate = true;
  texture.minFilter = THREE.NearestFilter;
  texture.magFilter = THREE.NearestFilter;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  // Binary rows are north → south while sphere UVs place north at v=1.
  texture.flipY = true;
  texture.colorSpace = THREE.NoColorSpace;
  return texture;
}

function lineGeometry(geo, radius) {
  const positions = [];
  const lines = geo.type === 'MultiLineString' ? geo.coordinates : [geo.coordinates];
  for (const line of lines) {
    for (let i = 1; i < line.length; i += 1) {
      const points = [line[i - 1], line[i]];
      for (const [lon, lat] of points) {
        const phi = THREE.MathUtils.degToRad(lat);
        const lambda = THREE.MathUtils.degToRad(lon);
        positions.push(radius * Math.cos(phi) * Math.cos(lambda), radius * Math.sin(phi), -radius * Math.cos(phi) * Math.sin(lambda));
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  return geometry;
}

function VectorLayers({ countries, coastlines }) {
  const borders = useMemo(() => lineGeometry(mesh(world, world.objects.countries, (a, b) => a !== b), 1.006), []);
  const coasts = useMemo(() => lineGeometry(mesh(world, world.objects.land), 1.009), []);
  return <>
    {countries && <lineSegments geometry={borders}><lineBasicMaterial color="#b8d4d2" transparent opacity={0.27} depthWrite={false} /></lineSegments>}
    {coastlines && <lineSegments geometry={coasts}><lineBasicMaterial color="#e3f2ec" transparent opacity={0.62} depthWrite={false} /></lineSegments>}
  </>;
}

function TemperatureSphere({ frames, mask, mode, highlight, playing, onHover, onLeave, onAdvance }) {
  const materialRef = useRef();
  const mixRef = useRef(0);
  const advancedRef = useRef(false);
  const textures = useMemo(() => ({
    airA: dataTexture(frames.current.air), airB: dataTexture(frames.next.air),
    sstA: dataTexture(frames.current.sst), sstB: dataTexture(frames.next.sst),
    mask: dataTexture(mask, THREE.UnsignedByteType),
  }), [frames, mask]);
  const lut = useMemo(() => {
    const texture = new THREE.DataTexture(createLutData(), 512, 1, THREE.RGBAFormat, THREE.UnsignedByteType);
    texture.needsUpdate = true; texture.minFilter = THREE.LinearFilter; texture.magFilter = THREE.LinearFilter;
    return texture;
  }, []);
  const uniforms = useMemo(() => ({
    uAirA: { value: textures.airA }, uAirB: { value: textures.airB },
    uSstA: { value: textures.sstA }, uSstB: { value: textures.sstB },
    uMask: { value: textures.mask }, uLut: { value: lut }, uMix: { value: 0 },
    uMode: { value: 0 }, uHighlightActive: { value: 0 },
    uHighlightMin: { value: 0 }, uHighlightMax: { value: 0 },
  }), [textures, lut]);

  useEffect(() => () => Object.values(textures).forEach((texture) => texture.dispose()), [textures]);
  useEffect(() => { mixRef.current = 0; advancedRef.current = false; if (materialRef.current) materialRef.current.uniforms.uMix.value = 0; }, [frames]);
  useEffect(() => { if (materialRef.current) materialRef.current.uniforms.uMode.value = mode === 'composite' ? 0 : mode === 'air' ? 1 : 2; }, [mode]);
  useEffect(() => {
    if (!materialRef.current) return;
    materialRef.current.uniforms.uHighlightActive.value = highlight ? 1 : 0;
    if (highlight) { materialRef.current.uniforms.uHighlightMin.value = highlight.min; materialRef.current.uniforms.uHighlightMax.value = highlight.max; }
  }, [highlight]);

  useFrame((_, delta) => {
    if (!playing || !materialRef.current) return;
    mixRef.current = Math.min(1, mixRef.current + delta / 2.8);
    materialRef.current.uniforms.uMix.value = mixRef.current;
    if (mixRef.current >= 1 && !advancedRef.current) { advancedRef.current = true; onAdvance(); }
  });

  const handleMove = (event) => {
    if (!event.uv) return;
    event.stopPropagation();
    const cell = uvToCell(event.uv);
    const land = mask[cell.index] === 1;
    const source = mode === 'sst' ? frames.current.sst : mode === 'air' ? frames.current.air : land ? frames.current.air : frames.current.sst;
    onHover({ ...cellToCoordinates(cell.row, cell.column), ...cell, land, temperature: decodeTemperature(source[cell.index]), clientX: event.nativeEvent.clientX, clientY: event.nativeEvent.clientY });
  };

  return (
    <mesh onPointerMove={handleMove} onPointerOut={onLeave}>
      <sphereGeometry args={[1, 192, 96]} />
      <shaderMaterial ref={materialRef} uniforms={uniforms} vertexShader={vertexShader} fragmentShader={fragmentShader} />
    </mesh>
  );
}

export default function Globe({ frames, mask, mode, highlight, playing, vectorLayers, onHover, onLeave, onAdvance }) {
  return (
    <Canvas camera={{ position: [0, 0.18, 2.55], fov: 39 }} dpr={[1, 1.8]} gl={{ antialias: true, alpha: true }}>
      <ambientLight intensity={0.6} />
      <Stars radius={8} depth={20} count={900} factor={1.5} saturation={0} fade speed={0.25} />
      <group rotation={[0.03, -0.36, 0]}>
        <TemperatureSphere frames={frames} mask={mask} mode={mode} highlight={highlight} playing={playing} onHover={onHover} onLeave={onLeave} onAdvance={onAdvance} />
        <VectorLayers countries={vectorLayers.countries} coastlines={vectorLayers.coastlines} />
      </group>
      <OrbitControls enablePan={false} minDistance={1.45} maxDistance={4.2} rotateSpeed={0.45} zoomSpeed={0.65} dampingFactor={0.06} enableDamping />
    </Canvas>
  );
}

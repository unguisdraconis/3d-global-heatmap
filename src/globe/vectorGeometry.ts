import * as THREE from 'three';
import type { MultiLineString } from 'geojson';

export function createLineGeometry(geometry: MultiLineString, radius: number): THREE.BufferGeometry {
  const positions: number[] = [];
  for (const line of geometry.coordinates) {
    for (let index = 1; index < line.length; index += 1) {
      for (const point of [line[index - 1]!, line[index]!]) {
        const longitude = point[0]! * Math.PI / 180; const latitude = point[1]! * Math.PI / 180;
        positions.push(radius * Math.cos(latitude) * Math.cos(longitude), radius * Math.sin(latitude), -radius * Math.cos(latitude) * Math.sin(longitude));
      }
    }
  }
  const result = new THREE.BufferGeometry();
  result.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  return result;
}


import * as THREE from 'three';
import { GRID } from '../climate/constants';
import { createLutData } from '../legend/legendScale';

export function createClimateTexture(data: Uint16Array): THREE.DataTexture {
  const texture = new THREE.DataTexture(data, GRID.width, GRID.height, THREE.RedFormat, THREE.UnsignedShortType);
  texture.needsUpdate = true; texture.minFilter = THREE.NearestFilter; texture.magFilter = THREE.NearestFilter;
  texture.wrapS = THREE.RepeatWrapping; texture.wrapT = THREE.ClampToEdgeWrapping; texture.flipY = true;
  texture.colorSpace = THREE.NoColorSpace;
  return texture;
}

export function createMaskTexture(data: Uint8Array): THREE.DataTexture {
  const texture = new THREE.DataTexture(data, GRID.width, GRID.height, THREE.RedFormat, THREE.UnsignedByteType);
  texture.needsUpdate = true; texture.minFilter = THREE.NearestFilter; texture.magFilter = THREE.NearestFilter;
  texture.wrapS = THREE.RepeatWrapping; texture.wrapT = THREE.ClampToEdgeWrapping; texture.flipY = true;
  texture.colorSpace = THREE.NoColorSpace;
  return texture;
}

export function createPaletteTexture(): THREE.DataTexture {
  const texture = new THREE.DataTexture(createLutData(), 512, 1, THREE.RGBAFormat, THREE.UnsignedByteType);
  texture.needsUpdate = true; texture.minFilter = THREE.LinearFilter; texture.magFilter = THREE.LinearFilter;
  texture.colorSpace = THREE.NoColorSpace;
  return texture;
}


import * as THREE from 'three';
import {
  computeBoundsTree,
  disposeBoundsTree,
  acceleratedRaycast
} from 'three-mesh-bvh';

// ---------------------------------------------------------------------------
// Global BVH prototype injection
//
// three-mesh-bvh works by monkey-patching three.js's BufferGeometry and Mesh
// prototypes. This MUST run once, at module evaluation time, before any
// geometry.computeBoundsTree() call or any raycast against BVH-enabled
// geometry — otherwise geometries created earlier won't have the methods,
// and raycasts will silently fall back to the slow brute-force path.
//
// Because ES modules are evaluated once and cached, importing this file
// first (core.js is the first thing experience.js imports) guarantees the
// patch is in place before world.js or player.js ever touch geometry.
// ---------------------------------------------------------------------------
THREE.BufferGeometry.prototype.computeBoundsTree = computeBoundsTree;
THREE.BufferGeometry.prototype.disposeBoundsTree = disposeBoundsTree;
THREE.Mesh.prototype.raycast = acceleratedRaycast;

/**
 * Creates the renderer, scene and camera. Kept as a small factory (rather
 * than singletons) so the whole engine is testable / re-creatable, which
 * matters once you start hot-reloading world.js during development.
 */
export function createCore(canvas) {
  const scene = new THREE.Scene();

  const camera = new THREE.PerspectiveCamera(
    50,
    window.innerWidth / window.innerHeight,
    0.1,
    150
  );
  camera.position.set(0, 3, 6);

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: 'high-performance'
  });

  // Cap the pixel ratio — on a 3x DPR phone, letting it run wild tanks the
  // frame rate for no visible sharpness gain. 2x is the sweet spot.
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);

  // Shadows: PCFSoft gives cheap, gentle penumbra that matches a soft
  // "cozy" look far better than the harder default PCF shadows.
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  // Filmic-ish tone mapping + a mild exposure lift is most of what makes a
  // scene feel "golden hour" rather than "flatly lit CG scene".
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const clock = new THREE.Clock();

  function onResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  }
  window.addEventListener('resize', onResize);

  function dispose() {
    window.removeEventListener('resize', onResize);
    renderer.dispose();
  }

  return { scene, camera, renderer, clock, dispose };
}

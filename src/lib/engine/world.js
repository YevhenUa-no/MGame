import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { MeshBVHHelper } from 'three-mesh-bvh';

// Cozy, low-saturation palette shared with the HUD tokens in app.css.
const PALETTE = {
  grass: 0x8bab6f,
  grassDark: 0x769661,
  path: 0xdcc48e,
  wood: 0x9c6b4a,
  roof: 0xc9694f,
  stone: 0x9a9186,
  water: 0x6fb3b8
};

/**
 * Builds the visible, decorative scene AND a separate invisible "collider"
 * mesh used only for physics. Splitting these matters for two reasons:
 *  1. The render meshes can use flat-shaded, vertex-colored, multi-material
 *     low-poly geometry without that complexity ever touching the BVH.
 *  2. A single merged collider means player.js only ever raycasts/shapecasts
 *     against ONE BVH-accelerated geometry instead of walking N meshes,
 *     which is the single biggest performance win in this whole template.
 */
export function buildWorld(scene) {
  const group = new THREE.Group();
  group.name = 'world';
  scene.add(group);

  const collidableGeometries = [];

  // --- Ground -------------------------------------------------------------
  const groundGeo = new THREE.CylinderGeometry(36, 36, 1, 8, 1);
  const groundMesh = new THREE.Mesh(
    groundGeo,
    new THREE.MeshStandardMaterial({
      color: PALETTE.grass,
      flatShading: true,
      roughness: 1
    })
  );
  groundMesh.position.y = -0.5;
  groundMesh.receiveShadow = true;
  group.add(groundMesh);

  // A slightly raised inner disc breaks up the flat green with a two-tone
  // "clearing" look, which is a big part of the low-poly cozy read.
  const clearingGeo = new THREE.CylinderGeometry(18, 19.2, 0.01, 7, 1);
  const clearingMesh = new THREE.Mesh(
    clearingGeo,
    new THREE.MeshStandardMaterial({
      color: PALETTE.path,
      flatShading: true,
      roughness: 1
    })
  );
  clearingMesh.position.y = -0.004; // Top face at y=0.001 to prevent z-fighting with ground
  clearingMesh.receiveShadow = true;
  clearingMesh.castShadow = false;
  group.add(clearingMesh);

  // --- Obstacles: crates, walls, and rock clusters scattered across 2x larger map --
  const obstacleDefs = [
    // Original scaled obstacles
    { type: 'crate', pos: [6, 0, -4], scale: 1 },
    { type: 'crate', pos: [8.2, 0, -1.2], scale: 0.8 },
    { type: 'crate', pos: [-8, 0, 6], scale: 1.2 },
    { type: 'wall', pos: [-12, 0, -6], rot: 0.3, length: 5 },
    { type: 'wall', pos: [12, 0, 4], rot: -0.5, length: 4 },
    { type: 'rock', pos: [-5, 0, -10], scale: 1.4 },
    { type: 'rock', pos: [3, 0, 12], scale: 1.1 },
    { type: 'rock', pos: [-13, 0, 9], scale: 0.9 },
    // New obstacles to populate the expanded clearing
    { type: 'crate', pos: [14, 0, -15], scale: 1.1 },
    { type: 'crate', pos: [-16, 0, -12], scale: 0.9 },
    { type: 'crate', pos: [18, 0, 8], scale: 1 },
    { type: 'rock', pos: [22, 0, -16], scale: 1.5 },
    { type: 'rock', pos: [-20, 0, 16], scale: 1.2 },
    { type: 'rock', pos: [0, 0, -22], scale: 1.6 },
    { type: 'wall', pos: [-18, 0, -2], rot: 0.9, length: 6 },
    { type: 'wall', pos: [18, 0, -8], rot: -0.9, length: 5 }
  ];

  for (const def of obstacleDefs) {
    const mesh = createObstacle(def);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    collidableGeometries.push(prepForMerge(mesh.geometry, mesh));
  }

  // --- Merge everything walkable/collidable into one BVH collider ---------
  const mergedGeometry = mergeGeometries(collidableGeometries, false);
  mergedGeometry.computeBoundsTree(); // <- the actual BVH build call

  const collider = new THREE.Mesh(mergedGeometry);
  collider.visible = false; // physics-only, never rendered
  collider.name = 'collider';
  scene.add(collider);

  // Optional debug visualization of the BVH bounds — toggle on while tuning
  // level geometry, keep off in production (it's a lot of extra draw calls).
  const bvhHelper = new MeshBVHHelper(collider, 10);
  bvhHelper.visible = false;
  scene.add(bvhHelper);

  return { group, collider, bvhHelper };
}

/**
 * Clones + world-transforms a mesh's geometry so it can be merged into a
 * single BufferGeometry with mergeGeometries(). We strip everything but
 * position, since the collider is never rendered and only position data
 * is needed for shapecast triangle tests.
 */
function prepForMerge(geometry, mesh) {
  mesh.updateMatrixWorld(true);
  const cloned = geometry.index ? geometry.toNonIndexed() : geometry.clone();
  const positionOnly = new THREE.BufferGeometry();
  positionOnly.setAttribute('position', cloned.getAttribute('position').clone());
  positionOnly.applyMatrix4(mesh.matrixWorld);
  return positionOnly;
}

function createObstacle(def) {
  if (def.type === 'crate') {
    const size = 1.1 * def.scale;
    const geo = new THREE.BoxGeometry(size, size, size);
    const mesh = new THREE.Mesh(
      geo,
      new THREE.MeshStandardMaterial({ color: PALETTE.wood, flatShading: true, roughness: 0.9 })
    );
    mesh.position.set(def.pos[0], size / 2, def.pos[2]);
    return mesh;
  }

  if (def.type === 'wall') {
    const geo = new THREE.BoxGeometry(def.length, 1.4, 0.6);
    const mesh = new THREE.Mesh(
      geo,
      new THREE.MeshStandardMaterial({ color: PALETTE.stone, flatShading: true, roughness: 1 })
    );
    mesh.position.set(def.pos[0], 0.7, def.pos[2]);
    mesh.rotation.y = def.rot;
    return mesh;
  }

  // rock: a dodecahedron reads as "stylized boulder" at almost no geometry
  // cost, and flatShading gives it the faceted low-poly look for free.
  const geo = new THREE.DodecahedronGeometry(0.9 * def.scale, 0);
  const mesh = new THREE.Mesh(
    geo,
    new THREE.MeshStandardMaterial({ color: PALETTE.stone, flatShading: true, roughness: 1 })
  );
  mesh.position.set(def.pos[0], 0.55 * def.scale, def.pos[2]);
  mesh.rotation.set(Math.random() * 0.3, Math.random() * Math.PI, Math.random() * 0.3);
  return mesh;
}

export { PALETTE };

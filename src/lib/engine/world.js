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
  water: 0x6fb3b8,
  // Added for the new library types below.
  leaf: 0x6f9a5a,
  metal: 0x6b6f76,
  hay: 0xd9b45c
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
  const groundGeo = new THREE.CylinderGeometry(22, 18, 1, 8, 1);
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
  // Intentionally omitting groundMesh from collidableGeometries to use hard floor physics instead

  // A slightly raised inner disc breaks up the flat green with a two-tone
  // "clearing" look. It's now flattened to 2cm so the player doesn't clip
  // through it since it lacks BVH collision.
  const clearingGeo = new THREE.CylinderGeometry(9, 9.6, 0.02, 7, 1);
  const clearingMesh = new THREE.Mesh(
    clearingGeo,
    new THREE.MeshStandardMaterial({
      color: PALETTE.path,
      flatShading: true,
      roughness: 1
    })
  );
  clearingMesh.position.y = 0.01;
  clearingMesh.receiveShadow = true;
  clearingMesh.castShadow = false;
  group.add(clearingMesh);
  // Intentionally omitting clearingMesh from collidableGeometries

  // --- Obstacles: crates, a low wall ring, and a couple of rock clusters --
  // NOTE: unchanged. New library types (below) are intentionally NOT added
  // here — they only exist in OBSTACLE_LIBRARY until placed by hand.
 
  const obstacleDefs = [
    { type: 'crate', pos: [3, 0, -2], scale: 1 },
    { type: 'crate', pos: [4.1, 0, 1.04], scale: 0.8 },
    { type: 'crate', pos: [-3.25, 0, 6.05], scale: 1.81 },
    { type: 'wall', pos: [-12, 0, -3], rot: 0.59, length: 5 },
    { type: 'wall', pos: [6, 0, 3], rot: 0.3, length: 11.2 },
    { type: 'wall', pos: [6, 0, -3.87], rot: -0.5, length: 4 },
    { type: 'rock', pos: [-2.5, 0, -5], scale: 1.4 },
    { type: 'rock', pos: [-3.41, 0, 5.91], scale: 1.1 },
    { type: 'rock', pos: [-6.5, 0, -2.44], scale: 0.9 },
    { type: 'crate', pos: [-8.6, -0.44, 11.19], scale: 1 },
    { type: 'rock', pos: [9.7, -0.24, 8.57], scale: 1 },
    { type: 'barrel', pos: [6.06, -0.09, 12.33], scale: 1 },
    { type: 'bush', pos: [-1.68, -0.41, 12.57], scale: 1 },
    { type: 'tree', pos: [11, -0.15, 4.85], scale: 1 },
    { type: 'lamppost', pos: [4.65, -0.13, 9.81], scale: 1, rot: 0 },
    { type: 'bench', pos: [4.65, 0, -3.27], scale: 1, rot: 0 },
    { type: 'stump', pos: [-3.03, 0.02, 1.57], scale: 0.56 },
    { type: 'log', pos: [1.29, 0, -4.92], scale: 1, rot: 0 },
    { type: 'bench', pos: [-2.72, 0, -1.28], scale: 1, rot: 0 },
    { type: 'bench', pos: [-1.94, 0, -12.76], scale: 5.19, rot: 0 }
  ];



  for (const def of obstacleDefs) {
    const object = createObstacle(def);
    object.userData.def = def;
    
    // Only set shadow flags if it's a single mesh. Compound objects handle their own shadows.
    if (object.isMesh) {
      object.castShadow = true;
      object.receiveShadow = true;
    }
    
    group.add(object);
    
    // Support compound objects like trees/lampposts by traversing all nested meshes
    object.updateMatrixWorld(true);
    object.traverse((child) => {
      if (child.isMesh && child.geometry) {
        collidableGeometries.push(prepForMerge(child.geometry, child));
      }
    });
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
  switch (def.type) {
    case 'crate': {
      const size = 1.1 * def.scale;
      const geo = new THREE.BoxGeometry(size, size, size);
      const mesh = new THREE.Mesh(
        geo,
        new THREE.MeshStandardMaterial({ color: PALETTE.wood, flatShading: true, roughness: 0.9 })
      );
      mesh.position.set(def.pos[0], size / 2 + (def.pos[1] || 0), def.pos[2]);
      return mesh;
    }

    case 'wall': {
      const geo = new THREE.BoxGeometry(def.length, 1.4, 0.6);
      const mesh = new THREE.Mesh(
        geo,
        new THREE.MeshStandardMaterial({ color: PALETTE.stone, flatShading: true, roughness: 1 })
      );
      mesh.position.set(def.pos[0], 0.7 + (def.pos[1] || 0), def.pos[2]);
      mesh.rotation.y = def.rot;
      return mesh;
    }

    case 'log': {
      // fallen trunk: a squat cylinder laid on its side
      const radius = 0.35 * def.scale;
      const length = 2.2 * def.scale;
      const geo = new THREE.CylinderGeometry(radius, radius, length, 8);
      const mesh = new THREE.Mesh(
        geo,
        new THREE.MeshStandardMaterial({ color: PALETTE.wood, flatShading: true, roughness: 0.95 })
      );
      mesh.rotation.z = Math.PI / 2;
      mesh.rotation.y = def.rot || 0;
      mesh.position.set(def.pos[0], radius + (def.pos[1] || 0), def.pos[2]);
      return mesh;
    }

    case 'stump': {
      // short upright cylinder, slightly wider at the base
      const radius = 0.45 * def.scale;
      const height = 0.6 * def.scale;
      const geo = new THREE.CylinderGeometry(radius, radius * 1.1, height, 8);
      const mesh = new THREE.Mesh(
        geo,
        new THREE.MeshStandardMaterial({ color: PALETTE.wood, flatShading: true, roughness: 0.95 })
      );
      mesh.position.set(def.pos[0], height / 2 + (def.pos[1] || 0), def.pos[2]);
      return mesh;
    }

    case 'barrel': {
      const height = 1.0 * def.scale;
      const geo = new THREE.CylinderGeometry(0.4 * def.scale, 0.4 * def.scale, height, 10);
      const mesh = new THREE.Mesh(
        geo,
        new THREE.MeshStandardMaterial({ color: PALETTE.wood, flatShading: true, roughness: 0.85 })
      );
      mesh.position.set(def.pos[0], height / 2 + (def.pos[1] || 0), def.pos[2]);
      return mesh;
    }

    case 'bush': {
      // low-poly icosahedron reads as clipped foliage at almost no cost
      const geo = new THREE.IcosahedronGeometry(0.6 * def.scale, 0);
      const mesh = new THREE.Mesh(
        geo,
        new THREE.MeshStandardMaterial({ color: PALETTE.leaf, flatShading: true, roughness: 1 })
      );
      mesh.position.set(def.pos[0], 0.5 * def.scale + (def.pos[1] || 0), def.pos[2]);
      mesh.scale.y = 0.8; // slight squash so it doesn't read as a perfect ball
      return mesh;
    }

    case 'tree': {
      // Compound object: cylinder trunk + cone canopy in a group.
      // NOTE: this returns a THREE.Group, not a THREE.Mesh — it has no
      // .geometry of its own, so buildWorld's prepForMerge(mesh.geometry, mesh)
      // won't work on it unchanged. Shadow flags are set here per-child
      // since Group.castShadow doesn't cascade.
      const group = new THREE.Group();
      const trunkHeight = 1.4 * def.scale;
      const trunk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.18 * def.scale, 0.22 * def.scale, trunkHeight, 6),
        new THREE.MeshStandardMaterial({ color: PALETTE.wood, flatShading: true, roughness: 0.95 })
      );
      trunk.position.y = trunkHeight / 2;
      trunk.castShadow = true;
      trunk.receiveShadow = true;
      const canopy = new THREE.Mesh(
        new THREE.ConeGeometry(0.9 * def.scale, 1.6 * def.scale, 7),
        new THREE.MeshStandardMaterial({ color: PALETTE.leaf, flatShading: true, roughness: 1 })
      );
      canopy.position.y = trunkHeight + 0.6 * def.scale;
      canopy.castShadow = true;
      canopy.receiveShadow = true;
      group.add(trunk, canopy);
      group.position.set(def.pos[0], def.pos[1] || 0, def.pos[2]);
      return group;
    }

    case 'lamppost': {
      // Compound object — see the 'tree' note above re: .geometry / shadows.
      const group = new THREE.Group();
      const height = 2.0 * def.scale;
      const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.06 * def.scale, 0.06 * def.scale, height, 6),
        new THREE.MeshStandardMaterial({ color: PALETTE.metal, flatShading: true, roughness: 0.6 })
      );
      pole.position.y = height / 2;
      pole.castShadow = true;
      pole.receiveShadow = true;
      const lamp = new THREE.Mesh(
        new THREE.BoxGeometry(0.25 * def.scale, 0.3 * def.scale, 0.25 * def.scale),
        new THREE.MeshStandardMaterial({ color: PALETTE.hay, flatShading: true, roughness: 0.4 })
      );
      lamp.position.y = height + 0.1 * def.scale;
      lamp.castShadow = true;
      lamp.receiveShadow = true;
      group.add(pole, lamp);
      group.position.set(def.pos[0], def.pos[1] || 0, def.pos[2]);
      group.rotation.y = def.rot || 0;
      return group;
    }

    case 'bench': {
      // Compound object — see the 'tree' note above re: .geometry / shadows.
      const group = new THREE.Group();
      const seat = new THREE.Mesh(
        new THREE.BoxGeometry(1.4 * def.scale, 0.12 * def.scale, 0.45 * def.scale),
        new THREE.MeshStandardMaterial({ color: PALETTE.wood, flatShading: true, roughness: 0.9 })
      );
      seat.position.y = 0.45 * def.scale;
      seat.castShadow = true;
      seat.receiveShadow = true;
      const legGeo = new THREE.BoxGeometry(0.12 * def.scale, 0.45 * def.scale, 0.4 * def.scale);
      const legMat = new THREE.MeshStandardMaterial({ color: PALETTE.wood, flatShading: true, roughness: 0.9 });
      const legL = new THREE.Mesh(legGeo, legMat);
      legL.position.set(-0.6 * def.scale, 0.225 * def.scale, 0);
      legL.castShadow = true;
      legL.receiveShadow = true;
      const legR = legL.clone();
      legR.position.x = 0.6 * def.scale;
      group.add(seat, legL, legR);
      group.position.set(def.pos[0], def.pos[1] || 0, def.pos[2]);
      group.rotation.y = def.rot || 0;
      return group;
    }

    case 'signpost': {
      // Compound object — see the 'tree' note above re: .geometry / shadows.
      const group = new THREE.Group();
      const height = 1.3 * def.scale;
      const post = new THREE.Mesh(
        new THREE.CylinderGeometry(0.05 * def.scale, 0.05 * def.scale, height, 6),
        new THREE.MeshStandardMaterial({ color: PALETTE.wood, flatShading: true, roughness: 0.9 })
      );
      post.position.y = height / 2;
      post.castShadow = true;
      post.receiveShadow = true;
      const plank = new THREE.Mesh(
        new THREE.BoxGeometry(0.6 * def.scale, 0.2 * def.scale, 0.04 * def.scale),
        new THREE.MeshStandardMaterial({ color: PALETTE.wood, flatShading: true, roughness: 0.9 })
      );
      plank.position.y = height - 0.15 * def.scale;
      plank.castShadow = true;
      plank.receiveShadow = true;
      group.add(post, plank);
      group.position.set(def.pos[0], def.pos[1] || 0, def.pos[2]);
      group.rotation.y = def.rot || 0;
      return group;
    }

    case 'haybale': {
      const radius = 0.55 * def.scale;
      const length = 1.1 * def.scale;
      const geo = new THREE.CylinderGeometry(radius, radius, length, 8);
      const mesh = new THREE.Mesh(
        geo,
        new THREE.MeshStandardMaterial({ color: PALETTE.hay, flatShading: true, roughness: 1 })
      );
      mesh.rotation.z = Math.PI / 2;
      mesh.position.set(def.pos[0], radius + (def.pos[1] || 0), def.pos[2]);
      return mesh;
    }

    case 'boulder': {
      // Bigger, blockier cousin of 'rock' — icosahedron instead of dodecahedron.
      const geo = new THREE.IcosahedronGeometry(1.1 * def.scale, 0);
      const mesh = new THREE.Mesh(
        geo,
        new THREE.MeshStandardMaterial({ color: PALETTE.stone, flatShading: true, roughness: 1 })
      );
      mesh.position.set(def.pos[0], 0.8 * def.scale + (def.pos[1] || 0), def.pos[2]);
      mesh.rotation.set(Math.random() * 0.3, Math.random() * Math.PI, Math.random() * 0.3);
      return mesh;
    }

    default: {
      // rock: a dodecahedron reads as "stylized boulder" at almost no geometry
      // cost, and flatShading gives it the faceted low-poly look for free.
      const geo = new THREE.DodecahedronGeometry(0.9 * def.scale, 0);
      const mesh = new THREE.Mesh(
        geo,
        new THREE.MeshStandardMaterial({ color: PALETTE.stone, flatShading: true, roughness: 1 })
      );
      mesh.position.set(def.pos[0], 0.55 * def.scale + (def.pos[1] || 0), def.pos[2]);
      mesh.rotation.set(Math.random() * 0.3, Math.random() * Math.PI, Math.random() * 0.3);
      return mesh;
    }
  }
}

/**
 * Full catalog of placeable types for a drag-and-place editor UI.
 * This is NOT wired into buildWorld() and spawns nothing by itself —
 * it's just metadata (type + sensible default params) for each type
 * createObstacle() understands. Feed a chosen entry's `type`, merged
 * with a `pos` (and any overridden defaults), straight into
 * createObstacle() once you're ready to place one.
 */
export const OBSTACLE_LIBRARY = [
  { type: 'crate', label: 'Crate', defaults: { scale: 1 } },
  { type: 'wall', label: 'Wall', defaults: { length: 5, rot: 0 } },
  { type: 'rock', label: 'Rock', defaults: { scale: 1 } },
  { type: 'log', label: 'Log', defaults: { scale: 1, rot: 0 } },
  { type: 'stump', label: 'Stump', defaults: { scale: 1 } },
  { type: 'barrel', label: 'Barrel', defaults: { scale: 1 } },
  { type: 'bush', label: 'Bush', defaults: { scale: 1 } },
  { type: 'tree', label: 'Tree', defaults: { scale: 1 } },
  { type: 'lamppost', label: 'Lamppost', defaults: { scale: 1, rot: 0 } },
  { type: 'bench', label: 'Bench', defaults: { scale: 1, rot: 0 } },
  { type: 'signpost', label: 'Signpost', defaults: { scale: 1, rot: 0 } },
  { type: 'haybale', label: 'Hay bale', defaults: { scale: 1 } },
  { type: 'boulder', label: 'Boulder', defaults: { scale: 1 } }
];

export { PALETTE, createObstacle };
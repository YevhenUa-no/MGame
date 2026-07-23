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
    { type: 'crate', pos: [3, 0, -2] },
    { type: 'crate', pos: [4.1, 0, 1.04], scale: 0.8 },
    { type: 'crate', pos: [-3.25, 0, 6.05], scale: 1.81 },
    { type: 'wall', pos: [-12, 0, -3], rot: 0.59, length: 5 },
    { type: 'wall', pos: [6, 0, 3], rot: 0.3, length: 11.2 },
    { type: 'wall', pos: [6, 0, -3.87], rot: -0.5, length: 4 },
    { type: 'rock', pos: [-2.5, 0, -5], scale: 1.4, rot: [0.018, 0.522, 0.052] },
    { type: 'rock', pos: [-3.41, 0, 5.91], scale: 1.1, rot: [0.044, 1.821, 0.205] },
    { type: 'rock', pos: [-6.5, 0, -2.44], scale: 0.9, rot: [0.005, 2.924, 0.165] },
    { type: 'crate', pos: [-8.6, -0.44, 11.19] },
    { type: 'rock', pos: [9.7, -0.24, 8.57], rot: [0.012, 1.354, 0.129] },
    { type: 'barrel', pos: [6.06, -0.09, 12.33] },
    { type: 'bush', pos: [-1.68, -0.41, 12.57] },
    { type: 'tree', pos: [11, -0.15, 4.85] },
    { type: 'lamppost', pos: [4.65, -0.13, 9.81] },
    { type: 'bench', pos: [4.65, 0, -3.27] },
    { type: 'stump', pos: [-3.03, 0.02, 1.57], scale: 0.56 },
    { type: 'log', pos: [1.29, 0, -4.92] },
    { type: 'bench', pos: [-2.72, 0, -1.28] },
    { type: 'bench', pos: [-1.94, 0, -12.76], scale: 5.19 },
    { type: 'wall', pos: [-4.74, -0.55, 9.46], rot: -0.04, length: 4 },
    { type: 'wall', pos: [-6.64, 0, 10.07], length: 4 },
    { type: 'wall', pos: [-9.4, 0.43, 10.05], length: 4 },
    { type: 'wall', pos: [-12.56, 0.43, 11.43], rot: 0.2, length: 4 },
    { type: 'wall', pos: [-16.61, 0.43, 10.29], rot: -0.17, length: 4 },
    { type: 'bench', pos: [-7.39, 0.48, 4.17], rot: [1.404, 0.68, 0] },
    { type: 'bench', pos: [-5.88, 0.48, 2.52], rot: 0.68 }
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
  let scaleX = 1, scaleY = 1, scaleZ = 1;
  if (Array.isArray(def.scale)) {
    [scaleX, scaleY, scaleZ] = def.scale;
  } else if (def.scale !== undefined) {
    scaleX = scaleY = scaleZ = def.scale;
  }

  let isRotArray = Array.isArray(def.rot);
  let rotX = 0, rotY = 0, rotZ = 0;
  if (isRotArray) {
    [rotX, rotY, rotZ] = def.rot;
  } else if (def.rot !== undefined) {
    rotY = def.rot;
  }

  let mesh;
  let baseY = 0;

  switch (def.type) {
    case 'crate': {
      const geo = new THREE.BoxGeometry(1.1, 1.1, 1.1);
      mesh = new THREE.Mesh(
        geo,
        new THREE.MeshStandardMaterial({ color: PALETTE.wood, flatShading: true, roughness: 0.9 })
      );
      baseY = 1.1 * scaleY / 2;
      break;
    }

    case 'wall': {
      const length = def.length !== undefined ? def.length : 5;
      const geo = new THREE.BoxGeometry(length, 1.4, 0.6);
      mesh = new THREE.Mesh(
        geo,
        new THREE.MeshStandardMaterial({ color: PALETTE.stone, flatShading: true, roughness: 1 })
      );
      baseY = 0.7 * scaleY;
      break;
    }

    case 'log': {
      // fallen trunk: a squat cylinder laid on its side
      const geo = new THREE.CylinderGeometry(0.35, 0.35, 2.2, 8);
      geo.rotateZ(Math.PI / 2);
      mesh = new THREE.Mesh(
        geo,
        new THREE.MeshStandardMaterial({ color: PALETTE.wood, flatShading: true, roughness: 0.95 })
      );
      baseY = 0.35 * scaleY;
      break;
    }

    case 'stump': {
      // short upright cylinder, slightly wider at the base
      const geo = new THREE.CylinderGeometry(0.45, 0.45 * 1.1, 0.6, 8);
      mesh = new THREE.Mesh(
        geo,
        new THREE.MeshStandardMaterial({ color: PALETTE.wood, flatShading: true, roughness: 0.95 })
      );
      baseY = 0.3 * scaleY;
      break;
    }

    case 'barrel': {
      const geo = new THREE.CylinderGeometry(0.4, 0.4, 1.0, 10);
      mesh = new THREE.Mesh(
        geo,
        new THREE.MeshStandardMaterial({ color: PALETTE.wood, flatShading: true, roughness: 0.85 })
      );
      baseY = 0.5 * scaleY;
      break;
    }

    case 'bush': {
      // low-poly icosahedron reads as clipped foliage at almost no cost
      const geo = new THREE.IcosahedronGeometry(0.6, 0);
      geo.scale(1, 0.8, 1); // slight squash so it doesn't read as a perfect ball
      mesh = new THREE.Mesh(
        geo,
        new THREE.MeshStandardMaterial({ color: PALETTE.leaf, flatShading: true, roughness: 1 })
      );
      baseY = 0.5 * scaleY;
      break;
    }

    case 'tree': {
      // Compound object: cylinder trunk + cone canopy in a group.
      mesh = new THREE.Group();
      const trunkHeight = 1.4;
      const trunk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.18, 0.22, trunkHeight, 6),
        new THREE.MeshStandardMaterial({ color: PALETTE.wood, flatShading: true, roughness: 0.95 })
      );
      trunk.position.y = trunkHeight / 2;
      trunk.castShadow = true;
      trunk.receiveShadow = true;
      const canopy = new THREE.Mesh(
        new THREE.ConeGeometry(0.9, 1.6, 7),
        new THREE.MeshStandardMaterial({ color: PALETTE.leaf, flatShading: true, roughness: 1 })
      );
      canopy.position.y = trunkHeight + 0.6;
      canopy.castShadow = true;
      canopy.receiveShadow = true;
      mesh.add(trunk, canopy);
      baseY = 0;
      break;
    }

    case 'lamppost': {
      mesh = new THREE.Group();
      const height = 2.0;
      const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.06, 0.06, height, 6),
        new THREE.MeshStandardMaterial({ color: PALETTE.metal, flatShading: true, roughness: 0.6 })
      );
      pole.position.y = height / 2;
      pole.castShadow = true;
      pole.receiveShadow = true;
      const lamp = new THREE.Mesh(
        new THREE.BoxGeometry(0.25, 0.3, 0.25),
        new THREE.MeshStandardMaterial({ color: PALETTE.hay, flatShading: true, roughness: 0.4 })
      );
      lamp.position.y = height + 0.1;
      lamp.castShadow = true;
      lamp.receiveShadow = true;
      mesh.add(pole, lamp);
      baseY = 0;
      break;
    }

    case 'bench': {
      mesh = new THREE.Group();
      const seat = new THREE.Mesh(
        new THREE.BoxGeometry(1.4, 0.12, 0.45),
        new THREE.MeshStandardMaterial({ color: PALETTE.wood, flatShading: true, roughness: 0.9 })
      );
      seat.position.y = 0.45;
      seat.castShadow = true;
      seat.receiveShadow = true;
      const legGeo = new THREE.BoxGeometry(0.12, 0.45, 0.4);
      const legMat = new THREE.MeshStandardMaterial({ color: PALETTE.wood, flatShading: true, roughness: 0.9 });
      const legL = new THREE.Mesh(legGeo, legMat);
      legL.position.set(-0.6, 0.225, 0);
      legL.castShadow = true;
      legL.receiveShadow = true;
      const legR = legL.clone();
      legR.position.x = 0.6;
      mesh.add(seat, legL, legR);
      baseY = 0;
      break;
    }

    case 'signpost': {
      mesh = new THREE.Group();
      const height = 1.3;
      const post = new THREE.Mesh(
        new THREE.CylinderGeometry(0.05, 0.05, height, 6),
        new THREE.MeshStandardMaterial({ color: PALETTE.wood, flatShading: true, roughness: 0.9 })
      );
      post.position.y = height / 2;
      post.castShadow = true;
      post.receiveShadow = true;
      const plank = new THREE.Mesh(
        new THREE.BoxGeometry(0.6, 0.2, 0.04),
        new THREE.MeshStandardMaterial({ color: PALETTE.wood, flatShading: true, roughness: 0.9 })
      );
      plank.position.y = height - 0.15;
      plank.castShadow = true;
      plank.receiveShadow = true;
      mesh.add(post, plank);
      baseY = 0;
      break;
    }

    case 'haybale': {
      const geo = new THREE.CylinderGeometry(0.55, 0.55, 1.1, 8);
      geo.rotateZ(Math.PI / 2);
      mesh = new THREE.Mesh(
        geo,
        new THREE.MeshStandardMaterial({ color: PALETTE.hay, flatShading: true, roughness: 1 })
      );
      baseY = 0.55 * scaleY;
      break;
    }

    case 'boulder': {
      // Bigger, blockier cousin of 'rock' — icosahedron instead of dodecahedron.
      const geo = new THREE.IcosahedronGeometry(1.1, 0);
      mesh = new THREE.Mesh(
        geo,
        new THREE.MeshStandardMaterial({ color: PALETTE.stone, flatShading: true, roughness: 1 })
      );
      baseY = 0.8 * scaleY;
      if (!isRotArray) {
        rotX = Math.random() * 0.3;
        rotY = def.rot !== undefined ? def.rot : Math.random() * Math.PI;
        rotZ = Math.random() * 0.3;
      }
      break;
    }

    default: {
      // rock: a dodecahedron reads as "stylized boulder" at almost no geometry cost
      const geo = new THREE.DodecahedronGeometry(0.9, 0);
      mesh = new THREE.Mesh(
        geo,
        new THREE.MeshStandardMaterial({ color: PALETTE.stone, flatShading: true, roughness: 1 })
      );
      baseY = 0.55 * scaleY;
      if (!isRotArray) {
        rotX = Math.random() * 0.3;
        rotY = def.rot !== undefined ? def.rot : Math.random() * Math.PI;
        rotZ = Math.random() * 0.3;
      }
      break;
    }
  }

  mesh.scale.set(scaleX, scaleY, scaleZ);
  mesh.rotation.set(rotX, rotY, rotZ);
  mesh.position.set(def.pos[0], baseY + (def.pos[1] || 0), def.pos[2]);

  return mesh;
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
  { type: 'crate', label: 'Crate', defaults: { scale: 1, rot: 0 } },
  { type: 'wall', label: 'Wall', defaults: { length: 5, rot: 0 } },
  { type: 'rock', label: 'Rock', defaults: { scale: 1, rot: 0 } },
  { type: 'log', label: 'Log', defaults: { scale: 1, rot: 0 } },
  { type: 'stump', label: 'Stump', defaults: { scale: 1, rot: 0 } },
  { type: 'barrel', label: 'Barrel', defaults: { scale: 1, rot: 0 } },
  { type: 'bush', label: 'Bush', defaults: { scale: 1, rot: 0 } },
  { type: 'tree', label: 'Tree', defaults: { scale: 1, rot: 0 } },
  { type: 'lamppost', label: 'Lamppost', defaults: { scale: 1, rot: 0 } },
  { type: 'bench', label: 'Bench', defaults: { scale: 1, rot: 0 } },
  { type: 'signpost', label: 'Signpost', defaults: { scale: 1, rot: 0 } },
  { type: 'haybale', label: 'Hay bale', defaults: { scale: 1, rot: 0 } },
  { type: 'boulder', label: 'Boulder', defaults: { scale: 1, rot: 0 } }
];

export { PALETTE, createObstacle };
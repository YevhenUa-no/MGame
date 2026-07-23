import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { MeshBVHHelper } from 'three-mesh-bvh';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

const gltfCache = {};
const loader = new GLTFLoader();

const kenneyTex = new THREE.TextureLoader().load('/models/kenney/Textures/colormap.png');
kenneyTex.colorSpace = THREE.SRGBColorSpace;
kenneyTex.flipY = false;

const kenneyFiles = [
  'bridge.glb', 'building-platform.glb', 'building-roof.glb', 'building-structure.glb',
  'character-archer.glb', 'fence.glb', 'flag.glb', 'ladder.glb', 'patch-dirt.glb',
  'patch-grass.glb', 'plant.glb', 'platform.glb', 'rocks-high.glb', 'rocks-low.glb',
  'rocks-ramp.glb', 'stones.glb', 'target.glb', 'tent.glb', 'tree-high.glb', 'tree.glb',
  'weapon-arrow.glb', 'weapon-bow.glb'
];
for (const file of kenneyFiles) {
  try {
    const gltf = await loader.loadAsync(`/models/kenney/${file}`);
    const model = gltf.scene;
    model.traverse((child) => {
      if (child.isMesh && child.material) {
        child.material.map = kenneyTex;
        child.material.needsUpdate = true;
      }
    });
    gltfCache[file.replace('.glb', '')] = model;
  } catch (e) {
    console.warn("Could not load", file, e);
  }
}

const watercraftTex = new THREE.TextureLoader().load('/models/watercraft/Textures/colormap.png');
watercraftTex.colorSpace = THREE.SRGBColorSpace;
watercraftTex.flipY = false;

const watercraftFiles = [
  'cargo-pile-a.glb', 'cargo-pile-b.glb', 'gate.glb', 'gate-finish.glb',
  'ramp.glb', 'ramp-wide.glb', 'ship-large.glb', 'ship-ocean-liner.glb',
  'ship-ocean-liner-small.glb', 'ship-small.glb', 'ship-small-ghost.glb'
];
for (const file of watercraftFiles) {
  try {
    const gltf = await loader.loadAsync(`/models/watercraft/${file}`);
    const model = gltf.scene;
    model.traverse((child) => {
      if (child.isMesh && child.material) {
        child.material.map = watercraftTex;
        child.material.needsUpdate = true;
      }
    });
    gltfCache[file.replace('.glb', '')] = model;
  } catch (e) {
    console.warn("Could not load", file, e);
  }
}

// Cozy, low-saturation palette shared with the HUD tokens in app.css.

const pirateTex = new THREE.TextureLoader().load('/models/pirate/Textures/colormap.png');
pirateTex.colorSpace = THREE.SRGBColorSpace;
pirateTex.flipY = false;

const pirateFiles = ["barrel.glb","boat-row-large.glb","boat-row-small.glb","bottle-large.glb","bottle.glb","cannon-ball.glb","cannon-mobile.glb","cannon.glb","castle-door.glb","castle-gate.glb","castle-wall.glb","castle-window.glb","chest.glb","crate-bottles.glb","crate.glb","flag-high-pennant.glb","flag-high.glb","flag-pennant.glb","flag-pirate-high-pennant.glb","flag-pirate-high.glb","flag-pirate-pennant.glb","flag-pirate.glb","flag.glb","grass-patch.glb","grass-plant.glb","grass.glb","hole.glb","mast-ropes.glb","mast.glb","palm-bend.glb","palm-detailed-bend.glb","palm-detailed-straight.glb","palm-straight.glb","patch-grass-foliage.glb","patch-grass.glb","patch-sand-foliage.glb","patch-sand.glb","platform-planks.glb","platform.glb","rocks-a.glb","rocks-b.glb","rocks-c.glb","rocks-sand-a.glb","rocks-sand-b.glb","rocks-sand-c.glb","ship-ghost.glb","ship-large.glb","ship-medium.glb","ship-pirate-large.glb","ship-pirate-medium.glb","ship-pirate-small.glb","ship-small.glb","ship-wreck.glb","structure-fence-sides.glb","structure-fence.glb","structure-platform-dock-small.glb","structure-platform-dock.glb","structure-platform-small.glb","structure-platform.glb","structure-roof.glb","structure.glb","tool-paddle.glb","tool-shovel.glb","tower-base-door.glb","tower-base.glb","tower-complete-large.glb","tower-complete-small.glb","tower-middle-windows.glb","tower-middle.glb","tower-roof.glb","tower-top.glb","tower-watch.glb"];
for (const file of pirateFiles) {
  try {
    const gltf = await loader.loadAsync(`/models/pirate/${file}`);
    const model = gltf.scene;
    model.traverse((child) => {
      if (child.isMesh && child.material) {
        child.material.map = pirateTex;
        child.material.needsUpdate = true;
      }
    });
    gltfCache[file.replace('.glb', '')] = model;
  } catch (e) {
    console.warn("Could not load", file, e);
  }
}

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
const updatables = [];

export function buildWorld(scene) {
  // Clear any existing updatables if buildWorld is called again
  updatables.length = 0;
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
    { type: 'rock', pos: [-3.41, 0, 5.91], scale: 1.1, rot: [0.044, 1.821, 0.205] },
    { type: 'rock', pos: [-6.5, 0, -2.44], scale: 0.9, rot: [0.005, 2.924, 0.165] },
    { type: 'crate', pos: [-8.6, -0.44, 11.19] },
    { type: 'rock', pos: [9.7, -0.24, 8.57], rot: [0.012, 1.354, 0.129] },
    { type: 'barrel', pos: [6.06, -0.09, 12.33] },
    { type: 'bush', pos: [-1.68, -0.41, 12.57] },
    { type: 'tree', pos: [11, -0.15, 4.85] },
    { type: 'lamppost', pos: [4.65, -0.13, 9.81] },
    { type: 'bench', pos: [4.65, 0, -3.27] },
    { type: 'log', pos: [1.29, 0, -4.92] },
    { type: 'bench', pos: [-1.94, 0, -12.76], scale: 5.19 },
    { type: 'wall', pos: [-4.74, -0.55, 9.46], rot: -0.04, length: 4 },
    { type: 'wall', pos: [-6.64, 0, 10.07], length: 4 },
    { type: 'wall', pos: [-9.4, 0.43, 10.05], length: 4 },
    { type: 'wall', pos: [-12.56, 0.43, 11.43], rot: 0.2, length: 4 },
    { type: 'wall', pos: [-16.61, 0.43, 10.29], rot: -0.17, length: 4 },
    { type: 'rocks-ramp', pos: [1.9, 0, 1.43], scale: [1.081, 1, 1.19] },
    { type: 'building-structure', pos: [-3.7, 0, 3.28] },
    { type: 'tree-high', pos: [-4.6, 0.56, -4.23], scale: [1.095, 1.036, 1.036], rot: [-0.163, 0, 0] },
    { type: 'ladder', pos: [-6.19, -0.3, -1.71], rot: [-0.098, 0.247, 0.147] },
    { type: 'rocks-low', pos: [-7.59, 0, 3.77], rot: [0, 0, -0.032] },
    { type: 'rocks-ramp', pos: [-9.47, 0, -1.1] },
    { type: 'firing-cannon', pos: [-11.92, 0, 3.02], scale: [0.673, 0.67, 0.707] },
    { type: 'structure-platform', pos: [11.81, 0.26, -10.74], scale: [1, 1, 0.991], rot: [0.009, -0.129, 0.301] },
    { type: 'firing-cannon', pos: [13.84, 2.62, -5.74], rot: [-0.113, -0.836, -0.008] },
    { type: 'ship-pirate-large', pos: [14.99, 0, -8.93] }
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
      const geo = new THREE.IcosahedronGeometry(0.6, 0);
      geo.scale(1, 0.8, 1);
      mesh = new THREE.Mesh(
        geo,
        new THREE.MeshStandardMaterial({ color: PALETTE.leaf, flatShading: true, roughness: 1 })
      );
      baseY = 0.5 * scaleY;
      break;
    }

    case 'tree': {
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
    }    case 'firing-cannon': {
      if (gltfCache['cannon']) {
        mesh = SkeletonUtils.clone(gltfCache['cannon']);
      } else {
        mesh = new THREE.Group();
      }
      baseY = 0;

      updatables.push({
        timer: 0,
        mesh: mesh,
        prevInteract: false,
        prevJump: false,
        yaw: 0,
        pitch: 0,
        trajectoryLine: null,
        
        update: function(dt, worldScene, arr, idx, player, input, collider, touch) {
          if (this.timer > 0) this.timer -= dt;

          const interactPressed = input && input.interact;
          const jumpPressed = input && input.jump;
          const interactJustPressed = interactPressed && !this.prevInteract;
          const jumpJustPressed = jumpPressed && !this.prevJump;

          const isActive = player && player.activeCannon === this;
          
          const popup = document.getElementById('interact-popup');
          const dist = player ? this.mesh.position.distanceTo(player.mesh.position) : 999;

          if (!isActive) {
            if (this.trajectoryLine) this.trajectoryLine.visible = false;
            
            if (popup && dist < 3.0) {
                popup.style.display = 'block';
                popup.innerText = touch && touch.enabled ? 'Tap INTERACT to use' : 'Press E to use';
            } else if (popup && dist >= 3.0 && (popup.innerText.includes('use') || popup.innerText === '')) {
                popup.style.display = 'none';
            }
            
            if (interactJustPressed && player && dist < 3.0) {
                player.activeCannon = this;
                const euler = new THREE.Euler().setFromQuaternion(this.mesh.getWorldQuaternion(new THREE.Quaternion()), 'YXZ');
                this.yaw = euler.y;
                this.pitch = euler.x;
            }
          } else {
            if (popup) {
                popup.style.display = 'block';
                popup.innerText = touch && touch.enabled ? 'Tap INTERACT to exit, JUMP to fire' : 'Press E to exit, Space to fire';
            }
            
            if (input) {
              this.yaw -= input.moveX * 1.5 * dt;
              this.pitch -= input.moveZ * 1.5 * dt;
              this.pitch = Math.max(-Math.PI / 4, Math.min(Math.PI / 4, this.pitch));
            }
            
            this.mesh.rotation.order = 'YXZ';
            this.mesh.rotation.set(this.pitch, this.yaw, 0);

            // Move player to align with cannon
            if (player && player.mesh) {
               const playerOffset = new THREE.Vector3(0, 0, -1.0).applyMatrix4(new THREE.Matrix4().extractRotation(this.mesh.matrixWorld));
               player.mesh.position.copy(this.mesh.position).add(playerOffset);
               // Also push player down to ground level instead of floating at barrel height if cannon is high
               player.mesh.position.y = player.config && player.config.startPosition ? player.config.startPosition[1] : 0;
               player.mesh.rotation.y = this.yaw;
               
               // If player uses Kenney Archer, set to idle or aiming animation
               if (player.archerMixer && player.archerActions['idle'] && player.currentArcherAction !== player.archerActions['idle']) {
                   const idle = player.archerActions['idle'];
                   idle.reset().fadeIn(0.2).play();
                   if (player.currentArcherAction) player.currentArcherAction.crossFadeTo(idle, 0.2, true);
                   player.currentArcherAction = idle;
               }
            }

            if (!this.trajectoryLine) {
              const trajMat = new THREE.LineBasicMaterial({ color: 0xffaa00, linewidth: 2 });
              const trajGeo = new THREE.BufferGeometry();
              this.trajectoryLine = new THREE.Line(trajGeo, trajMat);
              worldScene.add(this.trajectoryLine);
            }
            this.trajectoryLine.visible = true;

            const points = [];
            const offset = new THREE.Vector3(0, 0.6, 0.6);
            const simPos = offset.clone().applyMatrix4(this.mesh.matrixWorld);
            const simVel = new THREE.Vector3(0, 0.5, 1).applyQuaternion(this.mesh.getWorldQuaternion(new THREE.Quaternion())).normalize().multiplyScalar(15);

            for (let i = 0; i < 60; i++) {
               points.push(simPos.clone());
               simVel.y -= 20 * 0.05;
               simPos.addScaledVector(simVel, 0.05);
               if (simPos.y < 0) { points.push(simPos.clone()); break; }
            }
            this.trajectoryLine.geometry.setFromPoints(points);

            if (jumpJustPressed && this.timer <= 0) {
              this.timer = 1.0;
              let ball;
              if (gltfCache['cannon-ball']) {
                ball = SkeletonUtils.clone(gltfCache['cannon-ball']);
              } else {
                const ballGeo = new THREE.SphereGeometry(0.18, 16, 16);
                const ballMat = new THREE.MeshStandardMaterial({ color: 0x111111, metalness: 0.9, roughness: 0.2 });
                ball = new THREE.Mesh(ballGeo, ballMat);
              }
              
              const startOffset = new THREE.Vector3(0, 0.6, 0.6);
              ball.position.copy(startOffset);
              ball.applyMatrix4(this.mesh.matrixWorld);
              
              const velocity = new THREE.Vector3(0, 0.5, 1).applyQuaternion(this.mesh.getWorldQuaternion(new THREE.Quaternion())).normalize().multiplyScalar(15);
              worldScene.add(ball);

              const maxTrailPoints = 60;
              const trailGeo = new THREE.BufferGeometry();
              const trailPositions = new Float32Array(maxTrailPoints * 3);
              trailGeo.setAttribute('position', new THREE.BufferAttribute(trailPositions, 3));
              const trailMat = new THREE.LineBasicMaterial({ color: 0xffaaaa, transparent: true, opacity: 0.6 });
              const trailLine = new THREE.Line(trailGeo, trailMat);
              worldScene.add(trailLine);
              let trailCount = 0;
              
              const tempMat = new THREE.Matrix4();
              const tempVec = new THREE.Vector3();
              const tempVec2 = new THREE.Vector3();

              updatables.push({
                life: 6,
                update: function(bdt, ws, arr, idx, p, i, bvhCollider) {
                  this.life -= bdt;
                  if (this.life <= 0) {
                    if (ball && ball.parent) ws.remove(ball);
                    ws.remove(trailLine);
                    trailGeo.dispose();
                    trailMat.dispose();
                    this.dead = true;
                    return;
                  }
                  
                  if (ball) {
                    let hit = false;
                    // Check BVH collisions
                    if (bvhCollider && bvhCollider.geometry.boundsTree) {
                       const bvh = bvhCollider.geometry.boundsTree;
                       tempMat.copy(bvhCollider.matrixWorld).invert();
                       const localPos = tempVec.copy(ball.position).applyMatrix4(tempMat);
                       bvh.shapecast({
                          intersectsBounds: box => box.distanceToPoint(localPos) <= 0.18,
                          intersectsTriangle: tri => {
                             const d = tri.closestPointToPoint(localPos, tempVec2).distanceTo(localPos);
                             if (d <= 0.18) { hit = true; return true; }
                             return false;
                          }
                       });
                    }

                    if (hit || ball.position.y < 0) {
                       // Explode
                       const expGeo = new THREE.BufferGeometry();
                       const pData = new Float32Array(50 * 3);
                       for(let p=0;p<150;p+=3) {
                          const theta = Math.random() * Math.PI * 2;
                          const phi = Math.acos((Math.random() * 2) - 1);
                          const r = Math.random();
                          pData[p] = r * Math.sin(phi) * Math.cos(theta);
                          pData[p+1] = r * Math.sin(phi) * Math.sin(theta);
                          pData[p+2] = r * Math.cos(phi);
                       }
                       expGeo.setAttribute('position', new THREE.BufferAttribute(pData, 3));
                       const expMat = new THREE.PointsMaterial({color:0xffaa00, size:0.4, transparent:true});
                       const exp = new THREE.Points(expGeo, expMat);
                       exp.position.copy(ball.position);
                       ws.add(exp);
                       
                       arr.push({
                          life: 0.5,
                          update: function(edt, ews) {
                             this.life -= edt;
                             if (this.life <= 0) {
                                ews.remove(exp); expGeo.dispose(); expMat.dispose(); this.dead = true;
                             } else {
                                const s = 1 + (0.5 - this.life) * 8;
                                exp.scale.set(s,s,s);
                                exp.material.opacity = this.life * 2;
                             }
                          }
                       });
                       
                       if (ball.parent) ws.remove(ball);
                       ball = null;
                    } else {
                       velocity.y -= 20 * bdt;
                       ball.position.addScaledVector(velocity, bdt);
                       
                       if (trailCount < maxTrailPoints) {
                         trailPositions[trailCount * 3] = ball.position.x;
                         trailPositions[trailCount * 3 + 1] = ball.position.y;
                         trailPositions[trailCount * 3 + 2] = ball.position.z;
                         trailCount++;
                         trailLine.geometry.setDrawRange(0, trailCount);
                         trailLine.geometry.attributes.position.needsUpdate = true;
                       }
                    }
                  } else {
                    trailLine.material.opacity = Math.max(0, trailLine.material.opacity - (bdt / 4));
                  }
                }
              });
            }

            if (interactJustPressed) {
              player.activeCannon = null;
              if (popup) popup.style.display = 'none';
            }
          }

          if (input) {
            this.prevInteract = interactPressed;
            this.prevJump = jumpPressed;
          }
        }
      });
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

    case 'bridge':
    case 'building-platform':
    case 'building-roof':
    case 'building-structure':
    case 'character-archer':
    case 'fence':
    case 'flag':
    case 'ladder':
    case 'patch-dirt':
    case 'patch-grass':
    case 'plant':
    case 'platform':
    case 'rocks-high':
    case 'rocks-low':
    case 'rocks-ramp':
    case 'stones':
    case 'target':
    case 'tent':
    case 'tree-high':
    case 'weapon-arrow':
    case 'weapon-bow':
    case 'cargo-pile-a':
    case 'cargo-pile-b':
    case 'gate':
    case 'gate-finish':
    case 'ramp':
    case 'ramp-wide':
    case 'ship-large':
    case 'ship-ocean-liner':
    case 'ship-ocean-liner-small':
    case 'ship-small':
    case 'ship-small-ghost':
    case 'barrel':
    case 'boat-row-large':
    case 'boat-row-small':
    case 'bottle-large':
    case 'bottle':
    case 'cannon-ball':
    case 'cannon-mobile':
    case 'cannon':
    case 'castle-door':
    case 'castle-gate':
    case 'castle-wall':
    case 'castle-window':
    case 'chest':
    case 'crate-bottles':
    case 'crate':
    case 'flag-high-pennant':
    case 'flag-high':
    case 'flag-pennant':
    case 'flag-pirate-high-pennant':
    case 'flag-pirate-high':
    case 'flag-pirate-pennant':
    case 'flag-pirate':
    case 'flag':
    case 'grass-patch':
    case 'grass-plant':
    case 'grass':
    case 'hole':
    case 'mast-ropes':
    case 'mast':
    case 'palm-bend':
    case 'palm-detailed-bend':
    case 'palm-detailed-straight':
    case 'palm-straight':
    case 'patch-grass-foliage':
    case 'patch-grass':
    case 'patch-sand-foliage':
    case 'patch-sand':
    case 'platform-planks':
    case 'platform':
    case 'rocks-a':
    case 'rocks-b':
    case 'rocks-c':
    case 'rocks-sand-a':
    case 'rocks-sand-b':
    case 'rocks-sand-c':
    case 'ship-ghost':
    case 'ship-large':
    case 'ship-medium':
    case 'ship-pirate-large':
    case 'ship-pirate-medium':
    case 'ship-pirate-small':
    case 'ship-small':
    case 'ship-wreck':
    case 'structure-fence-sides':
    case 'structure-fence':
    case 'structure-platform-dock-small':
    case 'structure-platform-dock':
    case 'structure-platform-small':
    case 'structure-platform':
    case 'structure-roof':
    case 'structure':
    case 'tool-paddle':
    case 'tool-shovel':
    case 'tower-base-door':
    case 'tower-base':
    case 'tower-complete-large':
    case 'tower-complete-small':
    case 'tower-middle-windows':
    case 'tower-middle':
    case 'tower-roof':
    case 'tower-top':
    case 'tower-watch': {
      if (!gltfCache[def.type]) {
        // Fallback if not loaded
        mesh = new THREE.Group();
        break;
      }
      const model = SkeletonUtils.clone(gltfCache[def.type]);
      model.traverse((child) => {
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });
      mesh = new THREE.Group();
      mesh.add(model);
      baseY = 0; 
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
  { type: 'boulder', label: 'Boulder', defaults: { scale: 1, rot: 0 } },
  { type: 'tent', label: 'Tent', defaults: { scale: 1, rot: 0 } },
  { type: 'bridge', label: 'Bridge', defaults: { scale: 1, rot: 0 } },
  { type: 'target', label: 'Target', defaults: { scale: 1, rot: 0 } },
  { type: 'tree-high', label: 'Tall Tree', defaults: { scale: 1, rot: 0 } },
  { type: 'building-platform', label: 'Bldg Platform', defaults: { scale: 1, rot: 0 } },
  { type: 'building-roof', label: 'Bldg Roof', defaults: { scale: 1, rot: 0 } },
  { type: 'building-structure', label: 'Bldg Structure', defaults: { scale: 1, rot: 0 } },
  { type: 'fence', label: 'Fence', defaults: { scale: 1, rot: 0 } },
  { type: 'flag', label: 'Flag', defaults: { scale: 1, rot: 0 } },
  { type: 'ladder', label: 'Ladder', defaults: { scale: 1, rot: 0 } },
  { type: 'patch-dirt', label: 'Dirt Patch', defaults: { scale: 1, rot: 0 } },
  { type: 'patch-grass', label: 'Grass Patch', defaults: { scale: 1, rot: 0 } },
  { type: 'plant', label: 'Plant', defaults: { scale: 1, rot: 0 } },
  { type: 'platform', label: 'Platform', defaults: { scale: 1, rot: 0 } },
  { type: 'rocks-high', label: 'High Rocks', defaults: { scale: 1, rot: 0 } },
  { type: 'rocks-low', label: 'Low Rocks', defaults: { scale: 1, rot: 0 } },
  { type: 'rocks-ramp', label: 'Rocks Ramp', defaults: { scale: 1, rot: 0 } },
  { type: 'stones', label: 'Stones', defaults: { scale: 1, rot: 0 } },
  { type: 'weapon-arrow', label: 'Arrow', defaults: { scale: 1, rot: 0 } },
  { type: 'weapon-bow', label: 'Bow', defaults: { scale: 1, rot: 0 } },
  { type: 'cargo-pile-a', label: 'Cargo Pile A', defaults: { scale: 1, rot: 0 } },
  { type: 'cargo-pile-b', label: 'Cargo Pile B', defaults: { scale: 1, rot: 0 } },
  { type: 'gate', label: 'Gate', defaults: { scale: 1, rot: 0 } },
  { type: 'gate-finish', label: 'Finish Gate', defaults: { scale: 1, rot: 0 } },
  { type: 'ramp', label: 'Ramp', defaults: { scale: 1, rot: 0 } },
  { type: 'ramp-wide', label: 'Wide Ramp', defaults: { scale: 1, rot: 0 } },
  { type: 'ship-large', label: 'Large Ship', defaults: { scale: 1, rot: 0 } },
  { type: 'ship-ocean-liner', label: 'Ocean Liner', defaults: { scale: 1, rot: 0 } },
  { type: 'ship-ocean-liner-small', label: 'Small Liner', defaults: { scale: 1, rot: 0 } },
  { type: 'ship-small', label: 'Small Ship', defaults: { scale: 1, rot: 0 } },
  { type: 'ship-small-ghost', label: 'Ghost Ship', defaults: { scale: 1, rot: 0 } },
  { type: 'firing-cannon', label: 'Firing Cannon', defaults: { scale: 1, rot: 0 } },
  { type: 'barrel', label: 'barrel', defaults: { scale: 1, rot: 0 } },
  { type: 'boat-row-large', label: 'boat row large', defaults: { scale: 1, rot: 0 } },
  { type: 'boat-row-small', label: 'boat row small', defaults: { scale: 1, rot: 0 } },
  { type: 'bottle-large', label: 'bottle large', defaults: { scale: 1, rot: 0 } },
  { type: 'bottle', label: 'bottle', defaults: { scale: 1, rot: 0 } },
  { type: 'cannon-ball', label: 'cannon ball', defaults: { scale: 1, rot: 0 } },
  { type: 'cannon-mobile', label: 'cannon mobile', defaults: { scale: 1, rot: 0 } },
  { type: 'cannon', label: 'cannon', defaults: { scale: 1, rot: 0 } },
  { type: 'castle-door', label: 'castle door', defaults: { scale: 1, rot: 0 } },
  { type: 'castle-gate', label: 'castle gate', defaults: { scale: 1, rot: 0 } },
  { type: 'castle-wall', label: 'castle wall', defaults: { scale: 1, rot: 0 } },
  { type: 'castle-window', label: 'castle window', defaults: { scale: 1, rot: 0 } },
  { type: 'chest', label: 'chest', defaults: { scale: 1, rot: 0 } },
  { type: 'crate-bottles', label: 'crate bottles', defaults: { scale: 1, rot: 0 } },
  { type: 'crate', label: 'crate', defaults: { scale: 1, rot: 0 } },
  { type: 'flag-high-pennant', label: 'flag high pennant', defaults: { scale: 1, rot: 0 } },
  { type: 'flag-high', label: 'flag high', defaults: { scale: 1, rot: 0 } },
  { type: 'flag-pennant', label: 'flag pennant', defaults: { scale: 1, rot: 0 } },
  { type: 'flag-pirate-high-pennant', label: 'flag pirate high pennant', defaults: { scale: 1, rot: 0 } },
  { type: 'flag-pirate-high', label: 'flag pirate high', defaults: { scale: 1, rot: 0 } },
  { type: 'flag-pirate-pennant', label: 'flag pirate pennant', defaults: { scale: 1, rot: 0 } },
  { type: 'flag-pirate', label: 'flag pirate', defaults: { scale: 1, rot: 0 } },
  { type: 'flag', label: 'flag', defaults: { scale: 1, rot: 0 } },
  { type: 'grass-patch', label: 'grass patch', defaults: { scale: 1, rot: 0 } },
  { type: 'grass-plant', label: 'grass plant', defaults: { scale: 1, rot: 0 } },
  { type: 'grass', label: 'grass', defaults: { scale: 1, rot: 0 } },
  { type: 'hole', label: 'hole', defaults: { scale: 1, rot: 0 } },
  { type: 'mast-ropes', label: 'mast ropes', defaults: { scale: 1, rot: 0 } },
  { type: 'mast', label: 'mast', defaults: { scale: 1, rot: 0 } },
  { type: 'palm-bend', label: 'palm bend', defaults: { scale: 1, rot: 0 } },
  { type: 'palm-detailed-bend', label: 'palm detailed bend', defaults: { scale: 1, rot: 0 } },
  { type: 'palm-detailed-straight', label: 'palm detailed straight', defaults: { scale: 1, rot: 0 } },
  { type: 'palm-straight', label: 'palm straight', defaults: { scale: 1, rot: 0 } },
  { type: 'patch-grass-foliage', label: 'patch grass foliage', defaults: { scale: 1, rot: 0 } },
  { type: 'patch-grass', label: 'patch grass', defaults: { scale: 1, rot: 0 } },
  { type: 'patch-sand-foliage', label: 'patch sand foliage', defaults: { scale: 1, rot: 0 } },
  { type: 'patch-sand', label: 'patch sand', defaults: { scale: 1, rot: 0 } },
  { type: 'platform-planks', label: 'platform planks', defaults: { scale: 1, rot: 0 } },
  { type: 'platform', label: 'platform', defaults: { scale: 1, rot: 0 } },
  { type: 'rocks-a', label: 'rocks a', defaults: { scale: 1, rot: 0 } },
  { type: 'rocks-b', label: 'rocks b', defaults: { scale: 1, rot: 0 } },
  { type: 'rocks-c', label: 'rocks c', defaults: { scale: 1, rot: 0 } },
  { type: 'rocks-sand-a', label: 'rocks sand a', defaults: { scale: 1, rot: 0 } },
  { type: 'rocks-sand-b', label: 'rocks sand b', defaults: { scale: 1, rot: 0 } },
  { type: 'rocks-sand-c', label: 'rocks sand c', defaults: { scale: 1, rot: 0 } },
  { type: 'ship-ghost', label: 'ship ghost', defaults: { scale: 1, rot: 0 } },
  { type: 'ship-large', label: 'ship large', defaults: { scale: 1, rot: 0 } },
  { type: 'ship-medium', label: 'ship medium', defaults: { scale: 1, rot: 0 } },
  { type: 'ship-pirate-large', label: 'ship pirate large', defaults: { scale: 1, rot: 0 } },
  { type: 'ship-pirate-medium', label: 'ship pirate medium', defaults: { scale: 1, rot: 0 } },
  { type: 'ship-pirate-small', label: 'ship pirate small', defaults: { scale: 1, rot: 0 } },
  { type: 'ship-small', label: 'ship small', defaults: { scale: 1, rot: 0 } },
  { type: 'ship-wreck', label: 'ship wreck', defaults: { scale: 1, rot: 0 } },
  { type: 'structure-fence-sides', label: 'structure fence sides', defaults: { scale: 1, rot: 0 } },
  { type: 'structure-fence', label: 'structure fence', defaults: { scale: 1, rot: 0 } },
  { type: 'structure-platform-dock-small', label: 'structure platform dock small', defaults: { scale: 1, rot: 0 } },
  { type: 'structure-platform-dock', label: 'structure platform dock', defaults: { scale: 1, rot: 0 } },
  { type: 'structure-platform-small', label: 'structure platform small', defaults: { scale: 1, rot: 0 } },
  { type: 'structure-platform', label: 'structure platform', defaults: { scale: 1, rot: 0 } },
  { type: 'structure-roof', label: 'structure roof', defaults: { scale: 1, rot: 0 } },
  { type: 'structure', label: 'structure', defaults: { scale: 1, rot: 0 } },
  { type: 'tool-paddle', label: 'tool paddle', defaults: { scale: 1, rot: 0 } },
  { type: 'tool-shovel', label: 'tool shovel', defaults: { scale: 1, rot: 0 } },
  { type: 'tower-base-door', label: 'tower base door', defaults: { scale: 1, rot: 0 } },
  { type: 'tower-base', label: 'tower base', defaults: { scale: 1, rot: 0 } },
  { type: 'tower-complete-large', label: 'tower complete large', defaults: { scale: 1, rot: 0 } },
  { type: 'tower-complete-small', label: 'tower complete small', defaults: { scale: 1, rot: 0 } },
  { type: 'tower-middle-windows', label: 'tower middle windows', defaults: { scale: 1, rot: 0 } },
  { type: 'tower-middle', label: 'tower middle', defaults: { scale: 1, rot: 0 } },
  { type: 'tower-roof', label: 'tower roof', defaults: { scale: 1, rot: 0 } },
  { type: 'tower-top', label: 'tower top', defaults: { scale: 1, rot: 0 } },
  { type: 'tower-watch', label: 'tower watch', defaults: { scale: 1, rot: 0 } }
];

export { PALETTE, createObstacle, updatables };
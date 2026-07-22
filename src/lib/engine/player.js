import * as THREE from 'three';

export const DEFAULT_PHYSICS_CONFIG = {
  gravity: -80,
  moveAccel: 55,
  moveDamping: 10,
  walkSpeed: 4.6,
  runSpeed: 8.28,
  jumpSpeed: 16.5,
  fallMultiplier: 1,
  riseMultiplier: 1,
  airMoveSpeed: 4.6,
  maxFallSpeed: -8,
  enableGravity: true,
  turnSpeed: 4.5,
  collisionRadius: 0.3,
  collisionHeight: 1.8,
  startPosition: [0, 1.0, 4]
};

// Scratch objects reused every frame — allocating Vector3/Box3/Matrix4
// inside the animation loop is one of the most common sources of GC
// hitching in a WebGL app, so every temp value below is created once here.
const _tempBox = new THREE.Box3();
const _tempMat = new THREE.Matrix4();
const _tempSegment = new THREE.Line3();
const _tempVector = new THREE.Vector3();
const _tempVector2 = new THREE.Vector3();
const _deltaVector = new THREE.Vector3();
const _moveInput = new THREE.Vector3();
const _moveDirWorld = new THREE.Vector3();
const _forward = new THREE.Vector3();
const _right = new THREE.Vector3();
const _upAxis = new THREE.Vector3(0, 1, 0);

export const DEFAULT_APPEARANCE = {
  clothingColor: '#f764ba',
  skinColor: '#e5b571',
  pantsColor: '#18365d',
  bootsColor: '#794415',
  detailsColor: '#222222',
  backpackColor: '#8a5a36',
  sleepingBagColor: '#d01616',
  heightScale: 0.96,
  headSize: 0.94,
  limbThickness: 0.9,
  torsoWidth: 1.04
};

export function buildCharacterModel(appearanceConfig = {}) {
  const config = { ...DEFAULT_APPEARANCE, ...appearanceConfig };
  const group = new THREE.Group();

  const skinMaterial = new THREE.MeshStandardMaterial({
    color: config.skinColor,
    roughness: 0.6,
    flatShading: true
  });
  
  const clothingMaterial = new THREE.MeshStandardMaterial({
    color: config.clothingColor,
    roughness: 0.7,
    flatShading: true
  });

  const pantsMaterial = new THREE.MeshStandardMaterial({
    color: config.pantsColor,
    roughness: 0.8,
    flatShading: true
  });

  const bootsMaterial = new THREE.MeshStandardMaterial({
    color: config.bootsColor,
    roughness: 0.9,
    flatShading: true
  });

  const detailsMaterial = new THREE.MeshStandardMaterial({
    color: config.detailsColor,
    roughness: 0.9,
    flatShading: true
  });

  const backpackMaterial = new THREE.MeshStandardMaterial({
    color: config.backpackColor,
    roughness: 0.9,
    flatShading: true
  });
  
  const sleepingBagMaterial = new THREE.MeshStandardMaterial({
    color: config.sleepingBagColor,
    roughness: 0.8,
    flatShading: true
  });

  const pivot = new THREE.Group();
  pivot.position.y = 0.72; // Shift up so feet rest exactly at y=0
  group.add(pivot);

  // Torso
  const torsoGeo = new THREE.BoxGeometry(0.5, 0.55, 0.3);
  const torso = new THREE.Mesh(torsoGeo, clothingMaterial);
  torso.position.y = -0.1;
  torso.castShadow = true;
  torso.receiveShadow = true;
  pivot.add(torso);

  // Head
  const headGeo = new THREE.BoxGeometry(0.38, 0.38, 0.38);
  const head = new THREE.Mesh(headGeo, skinMaterial);
  head.position.y = 0.28;
  head.castShadow = true;
  head.receiveShadow = true;
  pivot.add(head);

  // Eyes
  const eyeGeo = new THREE.BoxGeometry(0.06, 0.06, 0.04);
  
  const leftEye = new THREE.Mesh(eyeGeo, detailsMaterial);
  leftEye.position.set(-0.09, 0.3, 0.18);
  leftEye.castShadow = true;
  pivot.add(leftEye);

  const rightEye = new THREE.Mesh(eyeGeo, detailsMaterial);
  rightEye.position.set(0.09, 0.3, 0.18);
  rightEye.castShadow = true;
  pivot.add(rightEye);

  // Explorer Hat
  const hatGroup = new THREE.Group();
  hatGroup.position.set(0, 0.44, 0);
  
  const brimGeo = new THREE.CylinderGeometry(0.36, 0.38, 0.02, 10);
  const brim = new THREE.Mesh(brimGeo, clothingMaterial);
  brim.castShadow = true;
  hatGroup.add(brim);

  const crownGeo = new THREE.CylinderGeometry(0.2, 0.22, 0.16, 10);
  const crown = new THREE.Mesh(crownGeo, clothingMaterial);
  crown.position.y = 0.08;
  crown.castShadow = true;
  hatGroup.add(crown);

  const bandGeo = new THREE.CylinderGeometry(0.205, 0.225, 0.04, 10);
  const band = new THREE.Mesh(bandGeo, detailsMaterial);
  band.position.y = 0.02;
  hatGroup.add(band);

  pivot.add(hatGroup);

  // Backpack
  const backpackGeo = new THREE.BoxGeometry(0.3, 0.38, 0.16);
  const backpack = new THREE.Mesh(backpackGeo, backpackMaterial);
  backpack.position.set(0, -0.1, -0.21);
  backpack.castShadow = true;
  pivot.add(backpack);

  const bagGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.32, 8);
  const bag = new THREE.Mesh(bagGeo, sleepingBagMaterial);
  bag.rotation.z = Math.PI / 2;
  bag.position.set(0, 0.11, -0.21);
  bag.castShadow = true;
  pivot.add(bag);

  const strapGeo = new THREE.BoxGeometry(0.05, 0.42, 0.04);
  const leftStrap = new THREE.Mesh(strapGeo, backpackMaterial);
  leftStrap.position.set(-0.15, -0.1, 0.1);
  leftStrap.castShadow = true;
  pivot.add(leftStrap);
  
  const rightStrap = new THREE.Mesh(strapGeo, backpackMaterial);
  rightStrap.position.set(0.15, -0.1, 0.1);
  rightStrap.castShadow = true;
  pivot.add(rightStrap);

  // Legs (Pivoted at hip joint)
  const leftLegPivot = new THREE.Group();
  leftLegPivot.position.set(-0.15, -0.38, 0);
  pivot.add(leftLegPivot);

  const legGeo = new THREE.BoxGeometry(0.14, 0.35, 0.14);
  const leftLeg = new THREE.Mesh(legGeo, pantsMaterial);
  leftLeg.position.y = -0.175;
  leftLeg.castShadow = true;
  leftLegPivot.add(leftLeg);
  
  const bootGeo = new THREE.BoxGeometry(0.16, 0.08, 0.2);
  const leftBoot = new THREE.Mesh(bootGeo, bootsMaterial);
  leftBoot.position.set(0, -0.35, 0.02);
  leftBoot.castShadow = true;
  leftLegPivot.add(leftBoot);

  const rightLegPivot = new THREE.Group();
  rightLegPivot.position.set(0.15, -0.38, 0);
  pivot.add(rightLegPivot);

  const rightLeg = new THREE.Mesh(legGeo, pantsMaterial);
  rightLeg.position.y = -0.175;
  rightLeg.castShadow = true;
  rightLegPivot.add(rightLeg);

  const rightBoot = new THREE.Mesh(bootGeo, bootsMaterial);
  rightBoot.position.set(0, -0.35, 0.02);
  rightBoot.castShadow = true;
  rightLegPivot.add(rightBoot);

  // Arms (Pivoted at shoulder joint)
  const leftArmPivot = new THREE.Group();
  leftArmPivot.position.set(-0.3, 0.08, 0);
  pivot.add(leftArmPivot);

  const armGeo = new THREE.BoxGeometry(0.11, 0.35, 0.11);
  const leftArm = new THREE.Mesh(armGeo, clothingMaterial);
  leftArm.position.y = -0.175;
  leftArm.castShadow = true;
  leftArmPivot.add(leftArm);
  
  const handGeo = new THREE.BoxGeometry(0.11, 0.06, 0.11);
  const leftHand = new THREE.Mesh(handGeo, skinMaterial);
  leftHand.position.y = -0.36;
  leftHand.castShadow = true;
  leftArmPivot.add(leftHand);

  const rightArmPivot = new THREE.Group();
  rightArmPivot.position.set(0.3, 0.08, 0);
  pivot.add(rightArmPivot);

  const rightArm = new THREE.Mesh(armGeo, clothingMaterial);
  rightArm.position.y = -0.175;
  rightArm.castShadow = true;
  rightArmPivot.add(rightArm);

  const rightHand = new THREE.Mesh(handGeo, skinMaterial);
  rightHand.position.y = -0.36;
  rightHand.castShadow = true;
  rightArmPivot.add(rightHand);

  group.userData = {
    pivot,
    leftLegPivot,
    rightLegPivot,
    leftArmPivot,
    rightArmPivot,
    head,
    leftEye,
    rightEye,
    hatGroup,
    torso,
    backpack,
    sleepingBag: bag,
    leftArm,
    rightArm,
    leftLeg,
    rightLeg,
    materials: {
        skin: skinMaterial,
        clothing: clothingMaterial,
        pants: pantsMaterial,
        boots: bootsMaterial,
        details: detailsMaterial,
        backpack: backpackMaterial,
        sleepingBag: sleepingBagMaterial
    }
  };

  updateAppearance(group, config);

  return group;
}

export function updateAppearance(mesh, config) {
  if (!mesh.userData.materials) return;
  const { materials, head, torso, leftArm, rightArm, leftLeg, rightLeg, backpack, sleepingBag, leftEye, rightEye, hatGroup } = mesh.userData;

  materials.clothing.color.set(config.clothingColor);
  materials.skin.color.set(config.skinColor);
  materials.pants.color.set(config.pantsColor);
  materials.boots.color.set(config.bootsColor);
  materials.details.color.set(config.detailsColor);
  materials.backpack.color.set(config.backpackColor);
  materials.sleepingBag.color.set(config.sleepingBagColor);

  mesh.scale.setScalar(config.heightScale);
  torso.scale.set(config.torsoWidth, 1, config.torsoWidth);
  backpack.scale.set(config.torsoWidth, 1, config.torsoWidth);
  
  head.scale.setScalar(config.headSize);
  hatGroup.scale.setScalar(config.headSize);
  leftEye.scale.setScalar(config.headSize);
  rightEye.scale.setScalar(config.headSize);

  [leftArm, rightArm, leftLeg, rightLeg].forEach(limb => {
      limb.scale.x = config.limbThickness;
      limb.scale.z = config.limbThickness;
  });
}

export const DEFAULT_ANIMATION = {
  enableWalkAnim: true,
  walkAnimSpeed: 7,
  walkAnimAmplitude: 0.65,
  enableIdleBob: false,
  idleBobSpeed: 3.7,
  idleBobAmplitude: 0
};

export function animateAvatar(mesh, deltaTime, isGrounded, horizontalSpeed, animationConfig = {}) {
  if (!mesh.userData || !mesh.userData.pivot) return;
  const config = { ...DEFAULT_ANIMATION, ...animationConfig };
  const { pivot, leftLegPivot, rightLegPivot, leftArmPivot, rightArmPivot, head, torso, leftEye, rightEye, hatGroup, backpack, sleepingBag } = mesh.userData;

  mesh.userData.animationTime = (mesh.userData.animationTime || 0) + deltaTime;
  const time = mesh.userData.animationTime;
  const t = 1 - Math.exp(-12 * deltaTime);

  const isMoving = horizontalSpeed > 0.1;
  const speedFactor = horizontalSpeed > 6 ? 1.4 : 1;

  if (!isGrounded) {
      // JUMP / FALL STATE
      // Arms thrown up and slightly out
      leftArmPivot.rotation.x += (-Math.PI * 0.7 - leftArmPivot.rotation.x) * t;
      rightArmPivot.rotation.x += (-Math.PI * 0.7 - rightArmPivot.rotation.x) * t;
      leftArmPivot.rotation.z += (0.5 - leftArmPivot.rotation.z) * t;
      rightArmPivot.rotation.z += (-0.5 - rightArmPivot.rotation.z) * t;
      
      // Legs split (Mario style jump)
      leftLegPivot.rotation.x += (-0.4 - leftLegPivot.rotation.x) * t;
      rightLegPivot.rotation.x += (0.2 - rightLegPivot.rotation.x) * t;
      leftLegPivot.rotation.z += (0.1 - leftLegPivot.rotation.z) * t;
      rightLegPivot.rotation.z += (-0.1 - rightLegPivot.rotation.z) * t;

      // Lean slightly into the jump if moving
      const targetLean = isMoving ? 0.15 : 0;
      pivot.rotation.x += (targetLean - pivot.rotation.x) * t;

      // Snap body parts back to resting Y (no bobbing in air)
      torso.position.y += (-0.1 - torso.position.y) * t;
      head.position.y += (0.28 - head.position.y) * t;
      leftEye.position.y += (0.3 - leftEye.position.y) * t;
      rightEye.position.y += (0.3 - rightEye.position.y) * t;
      hatGroup.position.y += (0.44 - hatGroup.position.y) * t;
      leftArmPivot.position.y += (0.08 - leftArmPivot.position.y) * t;
      rightArmPivot.position.y += (0.08 - rightArmPivot.position.y) * t;
      backpack.position.y += (-0.1 - backpack.position.y) * t;
      sleepingBag.position.y += (0.11 - sleepingBag.position.y) * t;

  } else if (config.enableWalkAnim && isMoving) {
      // WALK / RUN STATE
      const swing = Math.sin(time * config.walkAnimSpeed * speedFactor) * config.walkAnimAmplitude;
      leftArmPivot.rotation.x = swing;
      rightArmPivot.rotation.x = -swing;
      leftLegPivot.rotation.x = -swing;
      rightLegPivot.rotation.x = swing;

      leftArmPivot.rotation.z += (0.08 - leftArmPivot.rotation.z) * t;
      rightArmPivot.rotation.z += (-0.08 - rightArmPivot.rotation.z) * t;
      leftLegPivot.rotation.z += (0 - leftLegPivot.rotation.z) * t;
      rightLegPivot.rotation.z += (0 - rightLegPivot.rotation.z) * t;

      pivot.rotation.x += (0 - pivot.rotation.x) * t;

      // Slight body bounce from walking
      const walkBounce = Math.abs(Math.sin(time * config.walkAnimSpeed * speedFactor)) * 0.05;
      torso.position.y += (-0.1 + walkBounce - torso.position.y) * t;
      head.position.y += (0.28 + walkBounce - head.position.y) * t;
      leftEye.position.y += (0.3 + walkBounce - leftEye.position.y) * t;
      rightEye.position.y += (0.3 + walkBounce - rightEye.position.y) * t;
      hatGroup.position.y += (0.44 + walkBounce - hatGroup.position.y) * t;
      leftArmPivot.position.y += (0.08 + walkBounce - leftArmPivot.position.y) * t;
      rightArmPivot.position.y += (0.08 + walkBounce - rightArmPivot.position.y) * t;
      backpack.position.y += (-0.1 + walkBounce - backpack.position.y) * t;
      sleepingBag.position.y += (0.11 + walkBounce - sleepingBag.position.y) * t;

  } else {
      // IDLE STATE
      leftArmPivot.rotation.x += (0 - leftArmPivot.rotation.x) * t;
      rightArmPivot.rotation.x += (0 - rightArmPivot.rotation.x) * t;
      leftLegPivot.rotation.x += (0 - leftLegPivot.rotation.x) * t;
      rightLegPivot.rotation.x += (0 - rightLegPivot.rotation.x) * t;

      leftArmPivot.rotation.z += (0.08 - leftArmPivot.rotation.z) * t;
      rightArmPivot.rotation.z += (-0.08 - rightArmPivot.rotation.z) * t;
      leftLegPivot.rotation.z += (0 - leftLegPivot.rotation.z) * t;
      rightLegPivot.rotation.z += (0 - rightLegPivot.rotation.z) * t;

      pivot.rotation.x += (0 - pivot.rotation.x) * t;

      if (config.enableIdleBob) {
          const bob = Math.sin(time * config.idleBobSpeed) * config.idleBobAmplitude;
          torso.position.y = -0.1 + bob;
          head.position.y = 0.28 + bob;
          leftEye.position.y = 0.3 + bob;
          rightEye.position.y = 0.3 + bob;
          hatGroup.position.y = 0.44 + bob;
          leftArmPivot.position.y = 0.08 + bob;
          rightArmPivot.position.y = 0.08 + bob;
          backpack.position.y = -0.1 + bob;
          sleepingBag.position.y = 0.11 + bob;
      } else {
          torso.position.y += (-0.1 - torso.position.y) * t;
          head.position.y += (0.28 - head.position.y) * t;
          leftEye.position.y += (0.3 - leftEye.position.y) * t;
          rightEye.position.y += (0.3 - rightEye.position.y) * t;
          hatGroup.position.y += (0.44 - hatGroup.position.y) * t;
          leftArmPivot.position.y += (0.08 - leftArmPivot.position.y) * t;
          rightArmPivot.position.y += (0.08 - rightArmPivot.position.y) * t;
          backpack.position.y += (-0.1 - backpack.position.y) * t;
          sleepingBag.position.y += (0.11 - sleepingBag.position.y) * t;
      }
  }
}

export function createPlayer(scene, characterConfig = {}, appearanceConfig = {}, animationConfig = {}) {
  // Build config first so startPosition/collisionRadius/collisionHeight
  // all come from ONE merged source instead of characterConfig and
  // DEFAULT_PHYSICS_CONFIG disagreeing with each other.
  const config = { ...DEFAULT_PHYSICS_CONFIG, ...characterConfig };
  const radius = config.collisionRadius;
  const cylinderLength = config.collisionHeight - (radius * 2);

  const mesh = buildCharacterModel(appearanceConfig);
  const startPos = config.startPosition;
  mesh.position.set(...startPos);
  scene.add(mesh);

  const halfLength = cylinderLength / 2;
  const capsuleInfo = {
    radius,
    segment: new THREE.Line3(
      new THREE.Vector3(0, radius, 0),
      new THREE.Vector3(0, cylinderLength + radius, 0)
    )
  };

  return {
    mesh,
    capsuleInfo,
    velocity: new THREE.Vector3(),
    isGrounded: false,
    height: cylinderLength + radius * 2,
    config,
    // Where updatePlayer()'s fall-through-world safety net sends the
    // player back to. Kept as a live Vector3 (not baked into config)
    // so callers can update it on respawn without re-creating the
    // player — see updatePlayer()'s step 5, and the tuner HTML's
    // respawn() which now keeps this in sync with the Start Position
    // GUI fields.
    spawnPosition: new THREE.Vector3(...startPos),
    animationConfig
  };
}

/**
 * Advances the player one physics step: gravity, WASD-driven acceleration
 * (camera-relative), then collision resolution against the merged BVH
 * collider from world.js.
 *
 * @param player     object returned by createPlayer()
 * @param collider   THREE.Mesh whose geometry has .boundsTree computed
 * @param input      { forward, backward, left, right, jump, run } booleans
 * @param cameraYaw  camera's current yaw (radians) so "forward" means
 *                   "away from camera", not "world +Z"
 * @param deltaTime  seconds since last frame (already clamped by caller)
 */
export function updatePlayer(player, collider, input, cameraYaw, deltaTime) {
  const { mesh, capsuleInfo, velocity, config } = player;

  const jumpSpeed = Number(config.jumpSpeed !== undefined ? config.jumpSpeed : DEFAULT_PHYSICS_CONFIG.jumpSpeed) || 8;
  const grav = Number(config.gravity !== undefined ? config.gravity : DEFAULT_PHYSICS_CONFIG.gravity) || -10;
  const fallMultiplier = Number(config.fallMultiplier !== undefined ? config.fallMultiplier : DEFAULT_PHYSICS_CONFIG.fallMultiplier) || 1;
  const riseMultiplier = Number(config.riseMultiplier !== undefined ? config.riseMultiplier : DEFAULT_PHYSICS_CONFIG.riseMultiplier) || 1;
  const maxFall = config.maxFallSpeed !== undefined ? config.maxFallSpeed : DEFAULT_PHYSICS_CONFIG.maxFallSpeed;
  const walkSpeed = config.moveSpeed !== undefined ? config.moveSpeed : DEFAULT_PHYSICS_CONFIG.walkSpeed;
  const runSpeed = (config.moveSpeed && config.sprintMultiplier) ? config.moveSpeed * config.sprintMultiplier : DEFAULT_PHYSICS_CONFIG.runSpeed;
  const airMoveSpeed = config.airMoveSpeed !== undefined ? config.airMoveSpeed : walkSpeed;
  const turnSpeed = config.turnSpeed !== undefined ? config.turnSpeed : 12;

  // --- 1. Gravity ----------------------------------------------------------
  if (config.enableGravity !== false) {
    const appliedGrav = velocity.y < 0 ? grav * fallMultiplier : grav * riseMultiplier;
    velocity.y += appliedGrav * deltaTime;
    if (velocity.y < maxFall) velocity.y = maxFall;
  }

  // --- 2. Input -> desired horizontal velocity (camera-relative) ----------
  _moveInput.set(input.moveX, 0, input.moveZ);
  const inputMagnitude = Math.min(1, _moveInput.length());

  if (inputMagnitude > 0.01) {
    _moveInput.normalize();

    _forward.set(0, 0, -1).applyAxisAngle(_upAxis, cameraYaw);
    _right.set(1, 0, 0).applyAxisAngle(_upAxis, cameraYaw);

    _moveDirWorld
      .set(0, 0, 0)
      .addScaledVector(_right, _moveInput.x)
      .addScaledVector(_forward, _moveInput.z)
      .normalize();

    const targetSpeed = (player.isGrounded ? (input.run ? runSpeed : walkSpeed) : airMoveSpeed) * inputMagnitude;
    velocity.x += (_moveDirWorld.x * targetSpeed - velocity.x) * Math.min(1, config.moveAccel * deltaTime);
    velocity.z += (_moveDirWorld.z * targetSpeed - velocity.z) * Math.min(1, config.moveAccel * deltaTime);

    const targetRotation = Math.atan2(_moveDirWorld.x, _moveDirWorld.z);
    mesh.rotation.y = lerpAngle(mesh.rotation.y, targetRotation, 1 - Math.pow(0.0001, deltaTime * (turnSpeed / 12)));
  } else {
    const damp = Math.exp(-config.moveDamping * deltaTime);
    velocity.x *= damp;
    velocity.z *= damp;
  }

  if (input.jump && player.isGrounded) {
    velocity.y = jumpSpeed;
    player.isGrounded = false;
  }

  // --- 3. Integrate position ------------------------------------------------
  mesh.position.addScaledVector(velocity, deltaTime);
  mesh.updateMatrixWorld();

  // --- 4. Collision resolution against the BVH collider --------------------
  const bvh = collider.geometry.boundsTree;
  let isCollidingWithFloor = false;
  
  if (bvh) {
    _tempBox.makeEmpty();
    _tempMat.copy(collider.matrixWorld).invert();
    
    // Crucial: We must extract only the position from mesh.matrixWorld. 
    // Applying the whole matrix scales the capsule segment if the mesh has a scale (like heightScale=0.96),
    // which creates phantom vertical offsets that instantly cancel jump velocity.
    const meshWorldPos = _tempVector.setFromMatrixPosition(mesh.matrixWorld);
    
    _tempSegment.copy(capsuleInfo.segment);
    _tempSegment.start.add(meshWorldPos).applyMatrix4(_tempMat);
    _tempSegment.end.add(meshWorldPos).applyMatrix4(_tempMat);

    _tempBox.expandByPoint(_tempSegment.start);
    _tempBox.expandByPoint(_tempSegment.end);
    _tempBox.min.addScalar(-capsuleInfo.radius);
    _tempBox.max.addScalar(capsuleInfo.radius);

    bvh.shapecast({
      intersectsBounds: (box) => box.intersectsBox(_tempBox),
      intersectsTriangle: (tri) => {
        const distance = tri.closestPointToSegment(_tempSegment, _tempVector, _tempVector2);
        if (distance < capsuleInfo.radius) {
          const depth = capsuleInfo.radius - distance;
          // _tempVector is on triangle, _tempVector2 is on segment.
          // Direction must point FROM triangle TO segment to push it away.
          const direction = _tempVector2.sub(_tempVector).normalize();
          _tempSegment.start.addScaledVector(direction, depth);
          _tempSegment.end.addScaledVector(direction, depth);
        }
      }
    });

    const newPosition = _tempVector.copy(_tempSegment.start).applyMatrix4(collider.matrixWorld);
    newPosition.y -= capsuleInfo.radius; // Crucial: subtract radius to get the true mesh origin

    _deltaVector.subVectors(newPosition, mesh.position);

    const offset = Math.max(0, _deltaVector.length() - 1e-5);
    
    if (_deltaVector.y > 0.001 && velocity.y < 0) {
        isCollidingWithFloor = true;
    }

    _deltaVector.normalize().multiplyScalar(offset);
    mesh.position.add(_deltaVector);

    if (offset > 0) {
      _deltaVector.normalize();
      velocity.addScaledVector(_deltaVector, -_deltaVector.dot(velocity));
    }
  }

  // --- Fallback Floor / Grounding ---
  const halfHeight = player.height / 2;
  const floorY = config.groundY !== undefined ? config.groundY : 0.0;
  
  // 1. Hard floor logic (always applies)
  if (mesh.position.y <= floorY) {
    mesh.position.y = floorY;
    velocity.y = 0;
    player.isGrounded = true;
  } else if (!bvh) {
    player.isGrounded = false;
  } else {
    // 2. If we have BVH and are above the floor, trust the collision flag
    player.isGrounded = isCollidingWithFloor;
    if (player.isGrounded && velocity.y < 0) {
      velocity.y = 0;
    }
  }

  // --- 5. Fallback safety net ------------------------------------------------
  if (mesh.position.y < -10) {
    mesh.position.copy(player.spawnPosition);
    velocity.set(0, 0, 0);
    player.isGrounded = false;
  }

  // --- 6. Animate Avatar ---------------------------------------------------
  const horizontalSpeed = Math.hypot(velocity.x, velocity.z);
  animateAvatar(mesh, deltaTime, player.isGrounded, horizontalSpeed, player.animationConfig);
}

function lerpAngle(current, target, t) {
  let delta = ((target - current + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (delta < -Math.PI) delta += Math.PI * 2;
  return current + delta * t;
}

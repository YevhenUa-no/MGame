import * as THREE from 'three';

const GRAVITY = -28;
const MOVE_ACCEL = 55;
const MOVE_DAMPING = 10;
const WALK_SPEED = 4.4;
const RUN_SPEED = 7.2;

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

export function buildCharacterModel(colorHexOrRGB) {
  const group = new THREE.Group();
  
  let bodyColor;
  if (Array.isArray(colorHexOrRGB)) {
    bodyColor = new THREE.Color(colorHexOrRGB[0] / 255, colorHexOrRGB[1] / 255, colorHexOrRGB[2] / 255);
  } else {
    bodyColor = new THREE.Color(colorHexOrRGB);
  }

  const skinMaterial = new THREE.MeshStandardMaterial({
    color: 0xffdbac,
    roughness: 0.8,
    flatShading: true
  });
  
  const clothingMaterial = new THREE.MeshStandardMaterial({
    color: bodyColor,
    roughness: 0.7,
    flatShading: true
  });

  const pantsMaterial = new THREE.MeshStandardMaterial({
    color: 0x3d5a80,
    roughness: 0.8,
    flatShading: true
  });

  const bootsMaterial = new THREE.MeshStandardMaterial({
    color: 0x4f3824,
    roughness: 0.9,
    flatShading: true
  });

  const detailsMaterial = new THREE.MeshStandardMaterial({
    color: 0x222222,
    roughness: 0.9,
    flatShading: true
  });

  const backpackMaterial = new THREE.MeshStandardMaterial({
    color: 0x8a5a36,
    roughness: 0.9,
    flatShading: true
  });
  
  const sleepingBagMaterial = new THREE.MeshStandardMaterial({
    color: 0xdc5a5a,
    roughness: 0.8,
    flatShading: true
  });

  const pivot = new THREE.Group();
  pivot.position.y = -0.05;
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
  group.add(leftLegPivot);

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
  group.add(rightLegPivot);

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
    torso,
    backpack,
    sleepingBag: bag
  };

  return group;
}

export function animateAvatar(mesh, deltaTime, isGrounded, horizontalSpeed) {
  if (!mesh.userData || !mesh.userData.pivot) return;
  const { pivot, leftLegPivot, rightLegPivot, leftArmPivot, rightArmPivot, head } = mesh.userData;

  mesh.userData.animationTime = (mesh.userData.animationTime || 0) + deltaTime;
  const time = mesh.userData.animationTime;
  const t = 1 - Math.exp(-12 * deltaTime);

  // Keep limbs static (flying style)
  leftLegPivot.rotation.x += (0 - leftLegPivot.rotation.x) * t;
  leftLegPivot.rotation.y += (0 - leftLegPivot.rotation.y) * t;
  leftLegPivot.rotation.z += (0 - leftLegPivot.rotation.z) * t;
  rightLegPivot.rotation.x += (0 - rightLegPivot.rotation.x) * t;
  rightLegPivot.rotation.y += (0 - rightLegPivot.rotation.y) * t;
  rightLegPivot.rotation.z += (0 - rightLegPivot.rotation.z) * t;

  leftArmPivot.rotation.x += (0 - leftArmPivot.rotation.x) * t;
  leftArmPivot.rotation.y += (0 - leftArmPivot.rotation.y) * t;
  leftArmPivot.rotation.z += (0.08 - leftArmPivot.rotation.z) * t;

  rightArmPivot.rotation.x += (0 - rightArmPivot.rotation.x) * t;
  rightArmPivot.rotation.y += (0 - rightArmPivot.rotation.y) * t;
  rightArmPivot.rotation.z += (-0.08 - rightArmPivot.rotation.z) * t;

  // Gentle floating/hover bobbing
  const bobFreq = horizontalSpeed > 0.1 ? 3.5 : 2.0;
  const bobAmp = horizontalSpeed > 0.1 ? 0.04 : 0.025;
  const bob = Math.sin(time * bobFreq) * bobAmp;
  pivot.position.y += (-0.05 + bob - pivot.position.y) * t;

  // Lean forward slightly when moving (flying look)
  const targetLean = horizontalSpeed > 0.1 ? 0.12 : 0;
  pivot.rotation.x += (targetLean - pivot.rotation.x) * t;

  head.position.y = 0.28 + Math.sin(time * bobFreq) * 0.008;
}

export function createPlayer(scene) {
  const radius = 0.35;
  const cylinderLength = 0.9;

  const mesh = buildCharacterModel(0xf4c98b);
  mesh.position.set(0, 0.8, 4);
  scene.add(mesh);

  const halfLength = cylinderLength / 2;
  const capsuleInfo = {
    radius,
    segment: new THREE.Line3(
      new THREE.Vector3(0, -halfLength, 0),
      new THREE.Vector3(0, halfLength, 0)
    )
  };

  return {
    mesh,
    capsuleInfo,
    velocity: new THREE.Vector3(),
    isGrounded: false,
    height: cylinderLength + radius * 2
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
  const { mesh, capsuleInfo, velocity } = player;

  // --- 1. Gravity ----------------------------------------------------------
  velocity.y += GRAVITY * deltaTime;
  if (velocity.y < -20) velocity.y = -20;

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

    const targetSpeed = (input.run ? RUN_SPEED : WALK_SPEED) * inputMagnitude;
    velocity.x += (_moveDirWorld.x * targetSpeed - velocity.x) * Math.min(1, MOVE_ACCEL * deltaTime);
    velocity.z += (_moveDirWorld.z * targetSpeed - velocity.z) * Math.min(1, MOVE_ACCEL * deltaTime);

    const targetRotation = Math.atan2(_moveDirWorld.x, _moveDirWorld.z);
    mesh.rotation.y = lerpAngle(mesh.rotation.y, targetRotation, 1 - Math.pow(0.0001, deltaTime));
  } else {
    const damp = Math.exp(-MOVE_DAMPING * deltaTime);
    velocity.x *= damp;
    velocity.z *= damp;
  }

  // --- 3. Integrate position ------------------------------------------------
  mesh.position.addScaledVector(velocity, deltaTime);
  mesh.updateMatrixWorld();

  // --- 4. Collision resolution against the BVH collider --------------------
  const bvh = collider.geometry.boundsTree;
  if (bvh) {
    _tempBox.makeEmpty();
    _tempMat.copy(collider.matrixWorld).invert();
    _tempSegment.copy(capsuleInfo.segment);

    _tempSegment.start.applyMatrix4(mesh.matrixWorld).applyMatrix4(_tempMat);
    _tempSegment.end.applyMatrix4(mesh.matrixWorld).applyMatrix4(_tempMat);

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
          const direction = _tempVector.sub(_tempVector2).normalize();
          _tempSegment.start.addScaledVector(direction, depth);
          _tempSegment.end.addScaledVector(direction, depth);
        }
      }
    });

    const newPosition = _tempVector.copy(_tempSegment.start).applyMatrix4(collider.matrixWorld);
    _deltaVector.subVectors(newPosition, mesh.position);

    const offset = Math.max(0, _deltaVector.length() - 1e-5);
    _deltaVector.normalize().multiplyScalar(offset);
    mesh.position.add(_deltaVector);

    player.isGrounded = _deltaVector.y > Math.abs(deltaTime * velocity.y * 0.25);

    if (player.isGrounded) {
      velocity.y = 0;
    } else if (offset > 0) {
      _deltaVector.normalize();
      velocity.addScaledVector(_deltaVector, -_deltaVector.dot(velocity));
    }
  }

  // --- 5. Fallback safety net ------------------------------------------------
  if (mesh.position.y < -10) {
    mesh.position.set(0, 0.8, 4);
    velocity.set(0, 0, 0);
  }

  // --- 6. Animate Avatar ---------------------------------------------------
  const horizontalSpeed = Math.hypot(velocity.x, velocity.z);
  animateAvatar(mesh, deltaTime, player.isGrounded, horizontalSpeed);
}

function lerpAngle(current, target, t) {
  let delta = ((target - current + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (delta < -Math.PI) delta += Math.PI * 2;
  return current + delta * t;
}

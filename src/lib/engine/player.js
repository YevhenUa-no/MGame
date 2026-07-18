import * as THREE from 'three';

const GRAVITY = -28;
const MOVE_ACCEL = 55;
const MOVE_DAMPING = 10;
const WALK_SPEED = 4.4;
const RUN_SPEED = 7.2;
const JUMP_SPEED = 9;

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

export function createPlayer(scene) {
  const radius = 0.35;
  const cylinderLength = 0.9; // straight segment between the two caps
  const geometry = new THREE.CapsuleGeometry(radius, cylinderLength, 6, 12);
  const material = new THREE.MeshStandardMaterial({
    color: 0xf4c98b,
    roughness: 0.6,
    flatShading: true
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.position.set(0, 3, 4);
  scene.add(mesh);

  // The capsule's collision "shape" is really just this central line
  // segment plus a radius — shapecast pushes it out of triangles, then we
  // read the segment's midpoint back out as the mesh position. Coordinates
  // are in the capsule's LOCAL space (segment endpoints straddle the
  // origin), matching what player.js transforms into collider space below.
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
    // total capsule half-height incl. caps, used by cameraRig for framing
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

  // --- 2. Input -> desired horizontal velocity (camera-relative) ----------
  // input.moveX / input.moveZ are analog (-1..1): keyboard always reports
  // full magnitude, a touch joystick reports partial tilt — the magnitude
  // itself scales target speed, so a half-tilted joystick walks at half
  // speed instead of snapping straight to full walk/run speed.
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

    // Face the direction of travel — a simple slerp-free lerp on Y rotation
    // reads as "cozy and soft" rather than snapping instantly.
    const targetRotation = Math.atan2(_moveDirWorld.x, _moveDirWorld.z);
    mesh.rotation.y = lerpAngle(mesh.rotation.y, targetRotation, 1 - Math.pow(0.0001, deltaTime));
  } else {
    // No input: exponentially damp horizontal velocity to a stop instead
    // of an abrupt zero-out, which feels floaty/skatey.
    const damp = Math.exp(-MOVE_DAMPING * deltaTime);
    velocity.x *= damp;
    velocity.z *= damp;
  }

  if (input.jump && player.isGrounded) {
    velocity.y = JUMP_SPEED;
    player.isGrounded = false;
  }

  // --- 3. Integrate position ------------------------------------------------
  mesh.position.addScaledVector(velocity, deltaTime);
  mesh.updateMatrixWorld();

  // --- 4. Collision resolution against the BVH collider --------------------
  // This is the standard three-mesh-bvh capsule-character pattern: transform
  // the capsule's local segment into the collider's local space, shapecast
  // for any triangle closer than `radius`, and push the segment out along
  // each contact normal. Because shapecast prunes whole BVH subtrees against
  // a bounding box first, this stays cheap even with hundreds of obstacle
  // triangles merged into the collider.
  const bvh = collider.geometry.boundsTree;
  if (bvh) {
    _tempBox.makeEmpty();
    _tempMat.copy(collider.matrixWorld).invert();
    _tempSegment.copy(capsuleInfo.segment);

    // Move the capsule's local segment into world space, then into the
    // collider's local space (they may not share a coordinate frame).
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
          const direction = _tempVector2.sub(_tempVector).normalize();
          _tempSegment.start.addScaledVector(direction, depth);
          _tempSegment.end.addScaledVector(direction, depth);
        }
      }
    });

    // Read the resolved segment back out as a world-space position delta.
    const newPosition = _tempVector.copy(_tempSegment.start).applyMatrix4(collider.matrixWorld);
    _deltaVector.subVectors(newPosition, mesh.position);

    const offset = Math.max(0, _deltaVector.length() - 1e-5);
    _deltaVector.normalize().multiplyScalar(offset);
    mesh.position.add(_deltaVector);

    // Grounded if the correction pushed us mostly upward by more than a
    // gravity-scaled epsilon — i.e. we're resting on something below us
    // rather than sliding off a wall to the side.
    player.isGrounded = _deltaVector.y > Math.abs(deltaTime * velocity.y * 0.25);

    if (player.isGrounded) {
      velocity.y = 0;
    } else if (offset > 0) {
      // Sliding contact (wall/ledge): remove the velocity component that
      // points back into the surface so the player slides along it
      // instead of sticking.
      _deltaVector.normalize();
      velocity.addScaledVector(_deltaVector, -_deltaVector.dot(velocity));
    }
  }

  // --- 5. Fallback safety net ------------------------------------------------
  // If the player somehow ends up below the world (fast fall + missed
  // frame, geometry gap, etc.) respawn them above the clearing rather than
  // letting them fall forever.
  if (mesh.position.y < -10) {
    mesh.position.set(0, 3, 4);
    velocity.set(0, 0, 0);
  }
}

function lerpAngle(current, target, t) {
  let delta = ((target - current + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (delta < -Math.PI) delta += Math.PI * 2;
  return current + delta * t;
}

import * as THREE from 'three';

const _idealOffset = new THREE.Vector3();
const _idealLookAt = new THREE.Vector3();
const _currentLookAt = new THREE.Vector3();

/**
 * A lightweight orbit-less follow camera: it keeps a fixed offset behind
 * and above the player, but arrives at that offset with critically-damped
 * lerping rather than snapping — which is what reads as "relaxed,
 * cinematic" instead of "rigidly parented to the player".
 *
 * Yaw is user-controllable (mouse drag / swipe) so the player can look
 * around the cozy scene; pitch is fixed to keep the "looking down gently
 * at the player" feeling consistent, matching the Summer Afternoon /
 * Messenger camera language.
 */
export function createCameraRig(camera, domElement) {
  const state = {
    yaw: Math.PI, // starting behind the player, facing -Z
    distance: 6.5,
    height: 3.2,
    pitch: -0.42, // fixed downward look angle, radians
    // Follow "springiness" — lower = laggier/cozier, higher = snappier.
    followLerp: 3.2,
    lookLerp: 5
  };

  const currentPosition = new THREE.Vector3();
  let initialized = false;

  let isDragging = false;
  let lastPointerX = 0;
  // Tracks which single pointer (finger/mouse button) owns the drag, so a
  // second simultaneous touch — e.g. a thumb on the joystick in
  // touchControls.js — can never hijack or jitter the look direction.
  let activePointerId = null;

  function onPointerDown(event) {
    if (activePointerId !== null) return;
    activePointerId = event.pointerId;
    isDragging = true;
    lastPointerX = event.clientX;
  }
  function onPointerUp(event) {
    if (event.pointerId !== activePointerId) return;
    isDragging = false;
    activePointerId = null;
  }
  function onPointerMove(event) {
    if (!isDragging || event.pointerId !== activePointerId) return;
    const deltaX = event.clientX - lastPointerX;
    lastPointerX = event.clientX;
    state.yaw -= deltaX * 0.005;
  }

  domElement.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('pointerup', onPointerUp);
  window.addEventListener('pointermove', onPointerMove);

  function dispose() {
    domElement.removeEventListener('pointerdown', onPointerDown);
    window.removeEventListener('pointerup', onPointerUp);
    window.removeEventListener('pointermove', onPointerMove);
  }

  /**
   * @param playerMesh  the capsule mesh to follow
   * @param deltaTime   seconds since last frame
   */
  function update(playerMesh, deltaTime) {
    // Desired camera position: fixed distance/height behind the player at
    // the rig's current yaw — an offset vector rotated around the player.
    _idealOffset
      .set(0, state.height, state.distance)
      .applyAxisAngle(new THREE.Vector3(0, 1, 0), state.yaw)
      .add(playerMesh.position);

    _idealLookAt.copy(playerMesh.position).add(new THREE.Vector3(0, 1, 0));

    if (!initialized) {
      // Snap on the very first frame so the camera doesn't fly in from
      // the origin on load.
      currentPosition.copy(_idealOffset);
      _currentLookAt.copy(_idealLookAt);
      initialized = true;
    } else {
      const followT = 1 - Math.exp(-state.followLerp * deltaTime);
      const lookT = 1 - Math.exp(-state.lookLerp * deltaTime);
      currentPosition.lerp(_idealOffset, followT);
      _currentLookAt.lerp(_idealLookAt, lookT);
    }

    camera.position.copy(currentPosition);
    camera.lookAt(_currentLookAt);
  }

  return { state, update, dispose, get yaw() { return state.yaw; } };
}

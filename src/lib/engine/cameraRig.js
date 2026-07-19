import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const _idealOffset = new THREE.Vector3();
const _idealLookAt = new THREE.Vector3();
const _currentLookAt = new THREE.Vector3();

const defaultCameraConfig = {
  mode: 'follow',
  follow: {
    offsetX: 0,
    offsetY: 3.2,
    offsetZ: 6.5,
    smoothing: 0.15,
    autoAlign: true,
    autoAlignForce: 2.0
  },
  free: {
    position: [10, 8, 10],
    lookAtCharacter: true
  }
};

export function createCameraRig(camera, domElement, config = {}) {
  const finalConfig = {
    mode: config.mode || defaultCameraConfig.mode,
    follow: { ...defaultCameraConfig.follow, ...(config.follow || {}) },
    free: { ...defaultCameraConfig.free, ...(config.free || {}) }
  };

  const state = {
    yaw: Math.PI, 
    pitch: -0.42,
  };

  const currentPosition = new THREE.Vector3();
  let initialized = false;

  let isDragging = false;
  let lastPointerX = 0;
  let activePointerId = null;

  const orbit = new OrbitControls(camera, domElement);
  orbit.enableDamping = true;
  orbit.enabled = (finalConfig.mode === 'free');

  function onPointerDown(event) {
    if (finalConfig.mode !== 'follow') return;
    if (activePointerId !== null) return;
    activePointerId = event.pointerId;
    isDragging = true;
    lastPointerX = event.clientX;
  }
  function onPointerUp(event) {
    if (finalConfig.mode !== 'follow') return;
    if (event.pointerId !== activePointerId) return;
    isDragging = false;
    activePointerId = null;
  }
  function onPointerMove(event) {
    if (finalConfig.mode !== 'follow') return;
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
    orbit.dispose();
  }

  function smoothAngle(current, target, rate) {
    let diff = target - current;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    return current + THREE.MathUtils.clamp(rate, 0, 1) * diff;
  }

  function update(playerMesh, deltaTime) {
    if (finalConfig.mode === 'follow') {
      orbit.enabled = false;
      
      if (finalConfig.follow.autoAlign && !isDragging) {
        state.yaw = smoothAngle(state.yaw, playerMesh.rotation.y + Math.PI, finalConfig.follow.autoAlignForce * deltaTime);
      }
      
      _idealOffset
        .set(finalConfig.follow.offsetX, finalConfig.follow.offsetY, finalConfig.follow.offsetZ)
        .applyAxisAngle(new THREE.Vector3(0, 1, 0), state.yaw)
        .add(playerMesh.position);

      _idealLookAt.copy(playerMesh.position).add(new THREE.Vector3(0, 1, 0));

      if (!initialized) {
        currentPosition.copy(_idealOffset);
        _currentLookAt.copy(_idealLookAt);
        initialized = true;
      } else {
        const t = 1 - Math.pow(1 - finalConfig.follow.smoothing, deltaTime * 60);
        currentPosition.lerp(_idealOffset, t);
        _currentLookAt.lerp(_idealLookAt, 1 - Math.exp(-5 * deltaTime));
      }

      camera.position.copy(currentPosition);
      camera.lookAt(_currentLookAt);

    } else if (finalConfig.mode === 'free') {
      orbit.enabled = true;
      
      if (!initialized) {
        camera.position.set(...finalConfig.free.position);
        if (finalConfig.free.lookAtCharacter) {
          orbit.target.copy(playerMesh.position);
        }
        initialized = true;
      }

      if (finalConfig.free.lookAtCharacter) {
        orbit.target.copy(playerMesh.position);
      }
      
      orbit.update();
    }
  }

  return { state, update, dispose, get yaw() { return state.yaw; } };
}

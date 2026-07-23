import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const _idealOffset = new THREE.Vector3();
const _idealLookAt = new THREE.Vector3();
const _currentLookAt = new THREE.Vector3();

const defaultCameraConfig = {
  mode: 'follow',
  follow: {
    offsetX: 0,
    offsetY: 2.6548986885658583,
    offsetZ: 3.782159877387497,
    smoothing: 0.15,
    autoAlign: true,
    autoAlignForce: 7.4
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

  function update(targetMesh, deltaTime, isCannonMode = false) {
    if (isCannonMode) {
      orbit.enabled = false;
      
      const worldQuat = targetMesh.getWorldQuaternion(new THREE.Quaternion());
      
      // Position camera behind and slightly above the cannon barrel
      const offset = new THREE.Vector3(0, 0.8, -1.2);
      offset.applyQuaternion(worldQuat);
      _idealOffset.copy(targetMesh.position).add(offset);
      
      // Look forward along the barrel
      const lookAtOffset = new THREE.Vector3(0, 0.8, 10);
      lookAtOffset.applyQuaternion(worldQuat);
      _idealLookAt.copy(targetMesh.position).add(lookAtOffset);

      // Fast interpolation to switch into cannon mode smoothly
      camera.position.lerp(_idealOffset, 1 - Math.pow(0.0001, deltaTime * 2));
      _currentLookAt.lerp(_idealLookAt, 1 - Math.pow(0.0001, deltaTime * 2));
      camera.lookAt(_currentLookAt);
      
      // Sync the follow state so returning to normal mode doesn't snap wildly
      const euler = new THREE.Euler().setFromQuaternion(worldQuat, 'YXZ');
      state.yaw = euler.y + Math.PI;
      
      return;
    }

    if (finalConfig.mode === 'follow') {
      orbit.enabled = false;
      
      if (finalConfig.follow.autoAlign && !isDragging) {
        state.yaw = smoothAngle(state.yaw, targetMesh.rotation.y + Math.PI, finalConfig.follow.autoAlignForce * deltaTime);
      }
      
      _idealOffset
        .set(finalConfig.follow.offsetX, finalConfig.follow.offsetY, finalConfig.follow.offsetZ)
        .applyAxisAngle(new THREE.Vector3(0, 1, 0), state.yaw)
        .add(targetMesh.position);

      _idealLookAt.copy(targetMesh.position).add(new THREE.Vector3(0, 1, 0));

      if (!initialized) {
        currentPosition.copy(_idealOffset);
        _currentLookAt.copy(_idealLookAt);
        initialized = true;
      } else {
        // Use a frame-rate independent lerp that precisely matches a fixed `smoothing` value applied per 60hz frame.
        // If finalConfig.follow.smoothing is 0.15, this behaves exactly like lerp(0.15) at 60fps, but smoothly scales for 144hz etc.
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

// core.js must be the first import: it performs the global three-mesh-bvh
// prototype injection (computeBoundsTree / disposeBoundsTree /
// acceleratedRaycast) as a side effect at module-evaluation time, and every
// other engine module below creates or collides against geometry that
// depends on that patch already being in place.
import { createCore } from './core.js';
import { buildWorld } from './world.js';
import { buildLighting } from './lighting.js';
import { createPlayer, updatePlayer } from './player.js';
import { createInputController } from './inputController.js';
import { createTouchControls } from './touchControls.js';
import { createCameraRig } from './cameraRig.js';
import { createNetwork, resolveServerUrl } from './network.js';
import { createRemotePlayers } from './remotePlayers.js';

const FIXED_TIMESTEP = 1 / 60;
const MAX_SUBSTEPS = 5; // avoids a spiral-of-death on a big frame hitch/tab-switch
// Sending on every physics substep (60Hz) is wasted bandwidth for how
// slowly a "cozy" character actually moves — 15Hz is plenty smooth once
// remotePlayers.js interpolates between updates.
const NETWORK_SEND_INTERVAL = 1 / 15;

export function createExperience(canvas, characterConfig = {}, cameraConfig = {}, appearanceConfig = {}, animationConfig = {}) {
  const { scene, camera, renderer, clock, dispose: disposeCore } = createCore(canvas);

  buildLighting(scene);
  const { collider } = buildWorld(scene);
  const player = createPlayer(scene, characterConfig, appearanceConfig, animationConfig);
  const input = createInputController(characterConfig.keyBindings);
  // Shares `input.state` — the touch joystick and run/jump buttons write
  // into the exact same object the keyboard controller does, so player.js
  // reads one unified contract regardless of input source. On a
  // non-touch device this returns { enabled: false, dispose(){} } and
  // mounts nothing.
  const touch = createTouchControls();
  const cameraRig = createCameraRig(camera, canvas, cameraConfig);

  // --- Multiplayer ----------------------------------------------------
  const remotePlayers = createRemotePlayers(scene);
  const network = createNetwork({
    url: resolveServerUrl(),
    onJoin: (data) => remotePlayers.addOrUpdate(data),
    onState: (data) => remotePlayers.addOrUpdate(data),
    onLeave: (id) => remotePlayers.remove(id),
    onEmoji: (id, index) => remotePlayers.showEmoji(id, index)
  });
  network.connect();

  let animationHandle = null;
  let accumulator = 0;
  let networkAccumulator = 0;

  function tick() {
    animationHandle = requestAnimationFrame(tick);

    const frameDelta = Math.min(clock.getDelta(), 0.25);
    accumulator += frameDelta;

    const mergedInput = {
      moveX: (Math.abs(touch.state.moveX) > 0.01 ? touch.state.moveX : input.state.moveX) || 0,
      moveZ: (Math.abs(touch.state.moveZ) > 0.01 ? touch.state.moveZ : input.state.moveZ) || 0,
      jump: !!(touch.state.jump || input.state.jump),
      run: !!(touch.state.run || input.state.run)
    };

    // Fixed-timestep physics substeps decoupled from render framerate: this
    // keeps capsule-vs-BVH collision resolution stable and repeatable
    // whether the browser is doing 30fps or 144fps, which matters a lot
    // for a hand-tuned "cozy" movement feel.
    let steps = 0;
    while (accumulator >= FIXED_TIMESTEP && steps < MAX_SUBSTEPS) {
      updatePlayer(player, collider, mergedInput, cameraRig.yaw, FIXED_TIMESTEP);
      accumulator -= FIXED_TIMESTEP;
      steps += 1;
    }

    cameraRig.update(player.mesh, frameDelta);
    remotePlayers.update(frameDelta);

    networkAccumulator += frameDelta;
    if (networkAccumulator >= NETWORK_SEND_INTERVAL) {
      networkAccumulator = 0;
      network.sendState(
        player.mesh.position.x,
        player.mesh.position.y,
        player.mesh.position.z,
        player.mesh.rotation.y
      );
    }

    renderer.render(scene, camera);
  }

  function start() {
    if (animationHandle === null) {
      clock.start();
      tick();
    }
  }

  function stop() {
    if (animationHandle !== null) {
      cancelAnimationFrame(animationHandle);
      animationHandle = null;
    }
  }

  function dispose() {
    stop();
    input.dispose();
    touch.dispose();
    cameraRig.dispose();
    network.dispose();
    remotePlayers.dispose();
    disposeCore();
    scene.traverse((obj) => {
      if (obj.geometry) obj.geometry.dispose?.();
      if (obj.material) {
        const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
        materials.forEach((m) => m.dispose?.());
      }
    });
  }

  return { scene, camera, renderer, start, stop, dispose, sendEmoji: network.sendEmoji };
}

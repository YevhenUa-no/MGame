import * as THREE from 'three';
import { buildCharacterModel, animateAvatar, applyArcherToMesh } from './player.js';

// Same critically-damped-feeling lerp used by cameraRig.js — remote
// avatars arrive at ~15Hz over the network but should still look like they
// glide, not tick/teleport between updates.
const LERP_RATE = 12;
const EMOJIS = ['👋', '🌿', '☀️', '🍃', '💤', '✨'];

/**
 * Owns every OTHER player's avatar mesh. The local player (player.js) is
 * never part of this — this module only exists to visualize network.js's
 * JOIN/LEAVE/STATE/EMOJI events as capsules in the scene.
 */
export function createRemotePlayers(scene) {
  const group = new THREE.Group();
  group.name = 'remotePlayers';
  scene.add(group);

  // id -> { mesh, target: {x,y,z,rotY}, emojiSprite?, emojiTimeout? }
  const players = new Map();

  function makeAvatar(color) {
    const mesh = buildCharacterModel(color || [200, 200, 200]);
    mesh.archerData = { mixer: null, actions: {}, currentAction: null };
    applyArcherToMesh(mesh, mesh.archerData);
    return mesh;
  }

  /** Used for both JOIN (new avatar) and STATE (existing avatar) events. */
  function addOrUpdate(data) {
    let entry = players.get(data.id);
    if (!entry) {
      const mesh = makeAvatar(data.color || [200, 200, 200]);
      mesh.position.set(data.x, data.y, data.z);
      group.add(mesh);
      entry = { mesh, target: { x: data.x, y: data.y, z: data.z, rotY: data.rotY } };
      players.set(data.id, entry);
    } else {
      entry.target.x = data.x;
      entry.target.y = data.y;
      entry.target.z = data.z;
      entry.target.rotY = data.rotY;
    }
  }

  function remove(id) {
    const entry = players.get(id);
    if (!entry) return;
    clearEmoji(entry);
    group.remove(entry.mesh);
    entry.mesh.traverse((child) => {
      if (child.geometry) child.geometry.dispose();
      if (child.material) {
        const materials = Array.isArray(child.material) ? child.material : [child.material];
        materials.forEach((m) => m.dispose());
      }
    });
    players.delete(id);
  }

  /** Renders a canvas-texture sprite above a remote avatar's head. */
  function showEmoji(id, emojiIndex) {
    const entry = players.get(id);
    if (!entry) return;
    clearEmoji(entry);

    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.font = '44px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(EMOJIS[emojiIndex] || '💬', 32, 34);

    const texture = new THREE.CanvasTexture(canvas);
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true }));
    sprite.scale.set(0.8, 0.8, 0.8);
    sprite.position.set(0, 1.6, 0);
    entry.mesh.add(sprite);
    entry.emojiSprite = sprite;
    entry.emojiTimeout = setTimeout(() => clearEmoji(entry), 2200);
  }

  function clearEmoji(entry) {
    if (entry.emojiTimeout) clearTimeout(entry.emojiTimeout);
    if (!entry.emojiSprite) return;
    entry.mesh.remove(entry.emojiSprite);
    entry.emojiSprite.material.map.dispose();
    entry.emojiSprite.material.dispose();
    entry.emojiSprite = null;
  }

  function update(deltaTime) {
    const t = 1 - Math.exp(-LERP_RATE * deltaTime);
    for (const { mesh, target } of players.values()) {
      const prevX = mesh.position.x;
      const prevY = mesh.position.y;
      const prevZ = mesh.position.z;

      mesh.position.x += (target.x - mesh.position.x) * t;
      mesh.position.y += (target.y - mesh.position.y) * t;
      mesh.position.z += (target.z - mesh.position.z) * t;

      let delta = ((target.rotY - mesh.rotation.y + Math.PI) % (Math.PI * 2)) - Math.PI;
      if (delta < -Math.PI) delta += Math.PI * 2;
      mesh.rotation.y += delta * t;

      const dx = mesh.position.x - prevX;
      const dy = mesh.position.y - prevY;
      const dz = mesh.position.z - prevZ;
      const speed = Math.hypot(dx, dz) / (deltaTime || 0.016);
      const verticalSpeed = Math.abs(dy) / (deltaTime || 0.016);
      const isGrounded = verticalSpeed < 2.0;

      if (mesh.archerData && mesh.archerData.mixer) {
          mesh.archerData.mixer.update(deltaTime);
          let targetActionName = 'idle';
          if (!isGrounded) {
              targetActionName = 'jump';
          } else if (speed > 4.6 + 0.1) {
              targetActionName = 'run';
          } else if (speed > 0.1) {
              targetActionName = 'walk';
          }

          const targetAction = mesh.archerData.actions[targetActionName] || mesh.archerData.actions['idle'];
          if (targetAction && targetAction !== mesh.archerData.currentAction) {
              targetAction.reset().fadeIn(0.2).play();
              if (mesh.archerData.currentAction) mesh.archerData.currentAction.crossFadeTo(targetAction, 0.2, true);
              mesh.archerData.currentAction = targetAction;
          }
      } else {
          animateAvatar(mesh, deltaTime, isGrounded, speed);
      }
    }
  }

  function dispose() {
    for (const id of [...players.keys()]) remove(id);
    scene.remove(group);
  }

  return { addOrUpdate, remove, showEmoji, update, dispose };
}

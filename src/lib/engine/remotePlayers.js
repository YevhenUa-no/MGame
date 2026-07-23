import * as THREE from 'three';
import { buildCharacterModel, animateAvatar, applyArcherToMesh } from './player.js';
import { cannons, spawnCannonball } from './world.js';

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

  // id -> { mesh, target: {x,y,z,rotY}, targetSpeed, targetVertSpeed, emojiSprite?, emojiTimeout?, cannonIndex? }
  const players = new Map();

  function makeAvatar(color) {
    const mesh = buildCharacterModel(color || [200, 200, 200]);
    mesh.multiplayerColor = color || [200, 200, 200];
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
      entry = { mesh, target: { x: data.x, y: data.y, z: data.z, rotY: data.rotY }, targetSpeed: 0, targetVertSpeed: 0, cannonIndex: 255 };
      players.set(data.id, entry);
    } else {
      const dx = data.x - entry.target.x;
      const dy = data.y - entry.target.y;
      const dz = data.z - entry.target.z;
      // data arrives roughly every 0.066 seconds (15Hz).
      entry.targetSpeed = Math.hypot(dx, dz) / 0.066;
      entry.targetVertSpeed = Math.abs(dy) / 0.066;

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

  function updateCannonState(data) {
    const entry = players.get(data.id);
    if (!entry) return;
    entry.cannonIndex = data.cannonIndex;
    if (data.cannonIndex !== 255) {
      const cannon = cannons[data.cannonIndex];
      if (cannon) {
        cannon.pitch = data.pitch;
        cannon.yaw = data.yaw;
      }
    }
  }

  function fireCannon(data) {
    const cannon = cannons[data.cannonIndex];
    if (cannon) spawnCannonball(scene, cannon);
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
    for (const entry of players.values()) {
      const { mesh, target, cannonIndex } = entry;

      if (cannonIndex !== undefined && cannonIndex !== 255) {
        const cannon = cannons[cannonIndex];
        if (cannon) {
           const playerOffset = new THREE.Vector3(0, 0, -1.0).applyMatrix4(new THREE.Matrix4().extractRotation(cannon.mesh.matrixWorld));
           mesh.position.copy(cannon.mesh.position).add(playerOffset);
           mesh.position.y = 0;
           mesh.rotation.y = cannon.yaw;
           
           if (mesh.archerData && mesh.archerData.archerMixer) {
               mesh.archerData.archerMixer.update(deltaTime);
               const targetAction = mesh.archerData.archerActions['idle'];
               if (targetAction && targetAction !== mesh.archerData.currentArcherAction) {
                   targetAction.reset().fadeIn(0.2).play();
                   if (mesh.archerData.currentArcherAction) mesh.archerData.currentArcherAction.crossFadeTo(targetAction, 0.2, true);
                   mesh.archerData.currentArcherAction = targetAction;
               }
           }
           continue;
        }
      }

      mesh.position.x += (target.x - mesh.position.x) * t;
      mesh.position.y += (target.y - mesh.position.y) * t;
      mesh.position.z += (target.z - mesh.position.z) * t;

      let delta = ((target.rotY - mesh.rotation.y + Math.PI) % (Math.PI * 2)) - Math.PI;
      if (delta < -Math.PI) delta += Math.PI * 2;
      mesh.rotation.y += delta * t;

      const speed = entry.targetSpeed || 0;
      const verticalSpeed = entry.targetVertSpeed || 0;
      const isGrounded = verticalSpeed < 2.0;

      if (mesh.archerData && mesh.archerData.archerMixer) {
          mesh.archerData.archerMixer.update(deltaTime);
          let targetActionName = 'idle';
          if (!isGrounded) {
              targetActionName = 'jump';
          } else if (speed > 4.6 + 0.1) {
              targetActionName = 'run';
          } else if (speed > 0.1) {
              targetActionName = 'walk';
          }

          const targetAction = mesh.archerData.archerActions[targetActionName] || mesh.archerData.archerActions['idle'];
          if (targetAction && targetAction !== mesh.archerData.currentArcherAction) {
              targetAction.reset().fadeIn(0.2).play();
              if (mesh.archerData.currentArcherAction) mesh.archerData.currentArcherAction.crossFadeTo(targetAction, 0.2, true);
              mesh.archerData.currentArcherAction = targetAction;
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

  return { addOrUpdate, remove, showEmoji, updateCannonState, fireCannon, update, dispose };
}

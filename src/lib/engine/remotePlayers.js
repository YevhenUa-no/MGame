import * as THREE from 'three';

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
    const geometry = new THREE.CapsuleGeometry(0.35, 0.9, 6, 12);
    const material = new THREE.MeshStandardMaterial({
      color: new THREE.Color(color[0] / 255, color[1] / 255, color[2] / 255),
      roughness: 0.6,
      flatShading: true
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
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
    entry.mesh.geometry.dispose();
    entry.mesh.material.dispose();
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
      mesh.position.x += (target.x - mesh.position.x) * t;
      mesh.position.y += (target.y - mesh.position.y) * t;
      mesh.position.z += (target.z - mesh.position.z) * t;

      let delta = ((target.rotY - mesh.rotation.y + Math.PI) % (Math.PI * 2)) - Math.PI;
      if (delta < -Math.PI) delta += Math.PI * 2;
      mesh.rotation.y += delta * t;
    }
  }

  function dispose() {
    for (const id of [...players.keys()]) remove(id);
    scene.remove(group);
  }

  return { addOrUpdate, remove, showEmoji, update, dispose };
}

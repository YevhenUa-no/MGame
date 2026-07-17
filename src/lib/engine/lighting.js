import * as THREE from 'three';

/**
 * "Summer afternoon" lighting is really just two moves done deliberately:
 *  1. A warm, fairly bright ambient/hemisphere fill so shadows never go
 *     fully black (that's what reads as "cozy" instead of "moody").
 *  2. One low, warm-tinted directional light standing in for the sun, with
 *     a *tight* shadow frustum so the shadow map resolution isn't wasted
 *     on empty space far outside the playable clearing.
 */
export function buildLighting(scene) {
  // Hemisphere light instead of flat AmbientLight: it tints the ground
  // fill slightly green/warm and the sky fill slightly warm-gold, which
  // does a lot of the "pastel, nostalgic" work almost for free.
  const hemi = new THREE.HemisphereLight(0xfff1d0, 0x6b8f71, 0.65);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight(0xffd9a0, 1.6);
  sun.position.set(-10, 14, 8);
  sun.target.position.set(0, 0, 0);
  scene.add(sun);
  scene.add(sun.target);

  sun.castShadow = true;

  // Shadow map resolution: 2048 is plenty crisp for a small clearing-sized
  // level. Going higher only pays off once the shadow frustum below is
  // also large, and doubling resolution quadruples shadow render cost.
  sun.shadow.mapSize.set(2048, 2048);

  // Tightly fit the orthographic shadow frustum to the playable area
  // (the world in world.js is an 18-unit-radius disc). A frustum that's
  // much bigger than the scene wastes shadow map texels on empty sky.
  const shadowExtent = 40;
  sun.shadow.camera.left = -shadowExtent;
  sun.shadow.camera.right = shadowExtent;
  sun.shadow.camera.top = shadowExtent;
  sun.shadow.camera.bottom = -shadowExtent;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 90;

  // A touch of bias + normal bias avoids both shadow acne and peter-panning
  // on the low-poly obstacle geometry.
  sun.shadow.bias = -0.0008;
  sun.shadow.normalBias = 0.02;

  // Soften the PCFSoft shadow edges further — larger radius reads as a
  // gentle, diffused summer-afternoon shadow rather than a hard noon shadow.
  sun.shadow.radius = 4;

  // Warm, pale fog matches the ambient tint and hides the level's hard
  // edge (the 36-unit ground disc) in a soft haze instead of a visible pop.
  scene.fog = new THREE.Fog(0xf6e3c4, 44, 84);
  scene.background = new THREE.Color(0xf6e3c4);

  return { hemi, sun };
}

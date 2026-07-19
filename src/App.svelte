<script>
  import { onMount, onDestroy } from 'svelte';
  import { createExperience } from './lib/engine/experience.js';
  import Overlay from './lib/ui/Overlay.svelte';

  const characterConfig = {
    startPosition: [0.00, 0.00, 0.00],
    keyBindings: {
      forward: 'KeyW',
      backward: 'KeyS',
      left: 'KeyA',
      right: 'KeyD',
      jump: 'Space',
      run: 'ShiftLeft'
    },
    moveSpeed: 5,
    sprintMultiplier: 1.8,
    turnSpeed: 12,
    enableGravity: true,
    gravity: -10,
    jumpForce: 8,
    maxFallSpeed: -32,
    groundY: 0,
    enableCollisions: true,
    collisionRadius: 0.3,
    collisionHeight: 1.8
  };

  const cameraConfig = {
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

  const appearanceConfig = {
    clothingColor: '#f764ba',
    skinColor: '#e5b571',
    pantsColor: '#18365d',
    bootsColor: '#794415',
    detailsColor: '#222222',
    backpackColor: '#8a5a36',
    sleepingBagColor: '#d01616',
    heightScale: 0.96,
    headSize: 0.94,
    limbThickness: 0.9,
    torsoWidth: 1.04
  };

  const animationConfig = {
    enableWalkAnim: true,
    walkAnimSpeed: 7,
    walkAnimAmplitude: 0.65,
    enableIdleBob: false,
    idleBobSpeed: 3.7,
    idleBobAmplitude: 0
  };

  let canvasEl;
  let experience;
  let ready = false; // flips true once the scene exists, used to time the HUD's GSAP intro

  onMount(() => {
    experience = createExperience(canvasEl, characterConfig, cameraConfig, appearanceConfig, animationConfig);
    experience.start();
    // A microtask tick is enough — the renderer already has a frame queued,
    // we just need `ready` to flip after the canvas is actually mounted so
    // the Overlay's GSAP timeline animates in, not on-load-instantly.
    requestAnimationFrame(() => (ready = true));
  });

  onDestroy(() => {
    experience?.dispose();
  });
</script>

<canvas class="experience-canvas" bind:this={canvasEl}></canvas>

{#if ready}
  <Overlay onEmoji={experience.sendEmoji} />
{/if}

<style>
  /* Layout-only; visual tokens live in app.css / Overlay.svelte so this
     file stays a pure mount point. */
</style>

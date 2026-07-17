<script>
  import { onMount, onDestroy } from 'svelte';
  import { createExperience } from './lib/engine/experience.js';
  import Overlay from './lib/ui/Overlay.svelte';

  let canvasEl;
  let experience;
  let ready = false; // flips true once the scene exists, used to time the HUD's GSAP intro

  onMount(() => {
    experience = createExperience(canvasEl);
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

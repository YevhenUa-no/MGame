<script>
  import { onMount } from 'svelte';
  import gsap from 'gsap';

  let isTouch = false;
  onMount(() => {
    isTouch = window.matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
  });
</script>

<div class="hud" class:touch-mode={isTouch}>
</div>

<style>
  .hud {
    position: fixed;
    inset: 0;
    pointer-events: none;
    z-index: 10;
  }

  .hud-corner {
    position: absolute;
    top: clamp(16px, 3vw, 32px);
    left: clamp(16px, 3vw, 32px);
    max-width: 320px;
    padding: 16px 20px;
    border-radius: 20px;
    background: linear-gradient(135deg, rgba(251, 240, 221, 0.12), rgba(41, 30, 23, 0.55));
    border: 1px solid rgba(251, 240, 221, 0.25);
    backdrop-filter: blur(12px);
    color: var(--cozy-cream);
    box-shadow: 0 8px 32px rgba(28, 20, 15, 0.2);
  }

  .eyebrow {
    display: block;
    font-family: var(--font-body);
    font-size: 0.72rem;
    font-weight: 800;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--cozy-amber);
    margin-bottom: 2px;
  }

  .hud-corner h1 {
    font-family: var(--font-display);
    font-weight: 600;
    font-size: 1.5rem;
    margin: 0 0 6px;
  }

  .hint {
    margin: 0;
    font-size: 0.82rem;
    line-height: 1.4;
    color: rgba(251, 240, 221, 0.78);
  }

  .bubble-layer {
    position: absolute;
    left: 50%;
    bottom: 128px;
    width: 0;
    height: 0;
    pointer-events: none;
  }

  :global(.bubble) {
    position: absolute;
    left: -14px;
    bottom: 0;
    font-size: 1.6rem;
    filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.25));
  }

  .action-arc {
    position: absolute;
    bottom: clamp(20px, 4vh, 40px);
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    align-items: flex-end;
    gap: 14px;
    pointer-events: auto;
  }

  .action-btn {
    --lift: calc(6px - (var(--i) - 1) * (var(--i) - 1) * 6px);
    transform: translateY(calc(-1 * var(--lift)));

    width: 52px;
    height: 52px;
    border-radius: 50%;
    border: 1px solid rgba(251, 240, 221, 0.25);
    background: linear-gradient(135deg, rgba(251, 240, 221, 0.12), rgba(41, 30, 23, 0.55));
    backdrop-filter: blur(12px);
    font-size: 1.35rem;
    line-height: 1;
    cursor: pointer;
    display: grid;
    place-items: center;
    color: var(--cozy-cream);
    transition: transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275), background 0.25s ease, border-color 0.25s ease, box-shadow 0.25s ease;
    box-shadow: 0 8px 32px rgba(28, 20, 15, 0.2);
  }

  .action-btn:hover {
    transform: translateY(calc(-1 * var(--lift) - 6px)) scale(1.08);
    background: rgba(232, 163, 61, 0.32);
    border-color: rgba(232, 163, 61, 0.6);
    box-shadow: 0 10px 24px rgba(232, 163, 61, 0.25), 0 0 12px rgba(232, 163, 61, 0.15);
  }

  .action-btn:active {
    transform: translateY(calc(-1 * var(--lift) - 2px)) scale(0.96);
  }

  .action-btn.primary {
    background: radial-gradient(circle at 35% 30%, #ffe1a8, var(--cozy-amber));
    color: var(--cozy-ink);
    border-color: rgba(232, 163, 61, 0.6);
  }

  .chat-menu {
    position: absolute;
    bottom: 96px;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    gap: 8px;
    padding: 10px;
    border-radius: 999px;
    background: var(--cozy-glass);
    border: 1px solid var(--cozy-glass-border);
    backdrop-filter: blur(10px);
    pointer-events: auto;
  }

  .emoji-btn {
    width: 38px;
    height: 38px;
    border-radius: 50%;
    border: none;
    background: rgba(251, 240, 221, 0.1);
    font-size: 1.05rem;
    cursor: pointer;
    display: grid;
    place-items: center;
    transition: background 0.15s ease, transform 0.15s ease;
  }

  .emoji-btn:hover {
    background: rgba(251, 240, 221, 0.22);
    transform: scale(1.08);
  }

  @media (max-width: 520px) {
    .hud-corner {
      max-width: 220px;
    }
    .hint {
      display: none;
    }
  }

  /* touchControls.js mounts a joystick (bottom-left) and RUN/JUMP buttons
     (bottom-right) at z-index 15, right at the screen edge. Lift the
     action arc and chat menu clear of that row so nothing overlaps. */
  :global(.hud.touch-mode) .action-arc {
    bottom: clamp(120px, 18vh, 150px);
  }
  :global(.hud.touch-mode) .chat-menu {
    bottom: clamp(196px, 26vh, 226px);
  }
</style>

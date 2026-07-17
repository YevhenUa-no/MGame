<script>
  import { onMount } from 'svelte';
  import gsap from 'gsap';

  // Called with the emoji's index into `emojis` whenever the local player
  // fires one off — wired to experience.sendEmoji() by App.svelte so other
  // players see it too. Defaults to a no-op so Overlay still works standalone.
  export let onEmoji = () => {};

  let cornerEl;
  let arcEl;
  let chatMenuEl;
  let bubbleLayerEl;

  let chatOpen = false;
  let isTouch = false;
  const emojis = ['👋', '🌿', '☀️', '🍃', '💤', '✨'];

  onMount(() => {
    isTouch = window.matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;


    // Entrance choreography: the title card drifts up+in first, then the
    // action arc follows with a short overlap — a single orchestrated
    // moment reads far better than every element fading in on its own.
    const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
    tl.from(cornerEl, { y: -16, opacity: 0, duration: 0.7 })
      .from(
        arcEl.children,
        { y: 24, opacity: 0, duration: 0.55, stagger: 0.08 },
        '-=0.35'
      );

    // Chat menu starts hidden but stays mounted (rather than #if-toggled)
    // so we can tween it open/closed instead of hard-cutting visibility.
    gsap.set(chatMenuEl, { opacity: 0, scale: 0.85, transformOrigin: '50% 100%', pointerEvents: 'none' });
  });

  function toggleChat() {
    chatOpen = !chatOpen;
    if (chatOpen) {
      gsap.to(chatMenuEl, {
        opacity: 1,
        scale: 1,
        duration: 0.45,
        ease: 'back.out(1.7)',
        onStart: () => (chatMenuEl.style.pointerEvents = 'auto')
      });
    } else {
      gsap.to(chatMenuEl, {
        opacity: 0,
        scale: 0.85,
        duration: 0.25,
        ease: 'power2.in',
        onComplete: () => (chatMenuEl.style.pointerEvents = 'none')
      });
    }
  }

  function sendEmoji(emoji) {
    spawnFloatingBubble(emoji);
    onEmoji(emojis.indexOf(emoji));
    toggleChat();
  }

  function wave() {
    spawnFloatingBubble('👋');
    onEmoji(emojis.indexOf('👋'));
  }

  /** A little emoji bubble that drifts up and fades out above the action arc. */
  function spawnFloatingBubble(emoji) {
    const bubble = document.createElement('span');
    bubble.className = 'bubble';
    bubble.textContent = emoji;
    bubbleLayerEl.appendChild(bubble);

    gsap.fromTo(
      bubble,
      { y: 0, opacity: 0, scale: 0.6 },
      {
        y: -90,
        opacity: 1,
        scale: 1,
        duration: 0.4,
        ease: 'back.out(2)',
        onComplete: () => {
          gsap.to(bubble, {
            y: -140,
            opacity: 0,
            duration: 0.5,
            delay: 0.4,
            ease: 'power1.in',
            onComplete: () => bubble.remove()
          });
        }
      }
    );
  }
</script>

<div class="hud" class:touch-mode={isTouch}>
  <div class="hud-corner" bind:this={cornerEl}>
    <span class="eyebrow">a quiet clearing</span>
    <h1>Cozy Explorer</h1>
    <p class="hint">
      {#if isTouch}
        Joystick to move · RUN / JUMP buttons · drag to look around
      {:else}
        WASD to move · shift to run · space to jump · drag to look around
      {/if}
    </p>
  </div>

  <div class="bubble-layer" bind:this={bubbleLayerEl}></div>

  <div class="chat-menu" bind:this={chatMenuEl} role="menu" aria-label="Emoji menu">
    {#each emojis as emoji}
      <button class="emoji-btn" on:click={() => sendEmoji(emoji)} aria-label={`Send ${emoji}`}>
        {emoji}
      </button>
    {/each}
  </div>

  <!-- The action arc is the HUD's signature element: buttons sit on a gentle
       upward curve, like a sun cresting the horizon — tying the control
       cluster back to the golden-hour lighting in lighting.js rather than
       being just another straight toolbar. -->
  <div class="action-arc" bind:this={arcEl}>
    <button
      class="action-btn"
      style="--i: 0"
      on:click={toggleChat}
      aria-label="Open emoji menu"
      aria-expanded={chatOpen}
    >
      🙂
    </button>
    <button class="action-btn primary" style="--i: 1" on:click={wave} aria-label="Wave">
      👋
    </button>
    <button class="action-btn" style="--i: 2" aria-label="Sit down"> 🧘 </button>
  </div>
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
    padding: 14px 18px;
    border-radius: 16px;
    background: var(--cozy-glass);
    border: 1px solid var(--cozy-glass-border);
    backdrop-filter: blur(10px);
    color: var(--cozy-cream);
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
    /* The --i custom property staggers each button upward along a shallow
       arc: middle button highest, outer buttons lower — like a horizon. */
    --lift: calc(6px - (var(--i) - 1) * (var(--i) - 1) * 6px);
    transform: translateY(calc(-1 * var(--lift)));

    width: 52px;
    height: 52px;
    border-radius: 50%;
    border: 1px solid var(--cozy-glass-border);
    background: var(--cozy-glass);
    backdrop-filter: blur(10px);
    font-size: 1.35rem;
    line-height: 1;
    cursor: pointer;
    display: grid;
    place-items: center;
    color: var(--cozy-cream);
    transition: transform 0.2s ease, background 0.2s ease, box-shadow 0.2s ease;
    box-shadow: 0 6px 18px rgba(28, 20, 15, 0.25);
  }

  .action-btn:hover {
    transform: translateY(calc(-1 * var(--lift) - 4px));
    background: rgba(232, 163, 61, 0.28);
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

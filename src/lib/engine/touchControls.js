const STYLE_ID = 'cozy-touch-controls-style';
const MAX_RADIUS = 44; // px the knob can travel from center before clamping

/**
 * Detects touch capability rather than screen width — a touch-capable
 * tablet at desktop-sized width should still get the joystick, and a
 * narrow desktop browser window shouldn't get one it can't use.
 */
export function isTouchDevice() {
  return window.matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
}

/**
 * Builds a virtual joystick + run/jump buttons as plain DOM (no framework
 * dependency, matching the engine/UI split used everywhere else in
 * lib/engine/) and writes straight into the SAME input state object the
 * keyboard controller uses, so player.js never needs to know which input
 * source is active.
 *
 * @param inputState  the `state` object returned by createInputController()
 */
export function createTouchControls(inputState) {
  if (!isTouchDevice()) {
    return { enabled: false, dispose() {} };
  }

  injectStylesOnce();

  const root = document.createElement('div');
  root.className = 'touch-controls';
  root.innerHTML = `
    <div class="joystick-zone" aria-hidden="true">
      <div class="joystick-base">
        <div class="joystick-knob"></div>
      </div>
    </div>
    <div class="touch-action-buttons">
      <button type="button" class="touch-btn run-btn" aria-label="Hold to run">RUN</button>
    </div>
  `;
  document.body.appendChild(root);

  const zone = root.querySelector('.joystick-zone');
  const base = root.querySelector('.joystick-base');
  const knob = root.querySelector('.joystick-knob');
  const runBtn = root.querySelector('.run-btn');

  let activeTouchId = null;
  let originX = 0;
  let originY = 0;

  function setKnobOffset(dx, dy) {
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
  }

  function resetJoystick() {
    activeTouchId = null;
    setKnobOffset(0, 0);
    inputState.moveX = 0;
    inputState.moveZ = 0;
  }

  function findTouch(touchList) {
    for (let i = 0; i < touchList.length; i++) {
      if (touchList[i].identifier === activeTouchId) return touchList[i];
    }
    return null;
  }

  function onTouchStart(event) {
    // Only claim the first touch that lands in the joystick zone — a
    // second finger elsewhere (camera look) is handled independently by
    // cameraRig.js's own pointer listeners on the canvas.
    if (activeTouchId !== null) return;
    const touch = event.changedTouches[0];
    activeTouchId = touch.identifier;

    const rect = base.getBoundingClientRect();
    originX = rect.left + rect.width / 2;
    originY = rect.top + rect.height / 2;

    updateFromTouch(touch);
  }

  function onTouchMove(event) {
    const touch = findTouch(event.changedTouches);
    if (!touch) return;
    updateFromTouch(touch);
  }

  function updateFromTouch(touch) {
    let dx = touch.clientX - originX;
    let dy = touch.clientY - originY;
    const dist = Math.hypot(dx, dy);
    if (dist > MAX_RADIUS) {
      dx = (dx / dist) * MAX_RADIUS;
      dy = (dy / dist) * MAX_RADIUS;
    }
    setKnobOffset(dx, dy);

    // Screen-space drag maps directly to the same moveX/moveZ contract
    // WASD writes: dragging the knob up (toward the horizon) should move
    // the player forward, matching KeyW's moveZ = -1.
    inputState.moveX = dx / MAX_RADIUS;
    inputState.moveZ = -dy / MAX_RADIUS;
  }

  function onTouchEnd(event) {
    const touch = findTouch(event.changedTouches);
    if (!touch) return;
    resetJoystick();
  }

  zone.addEventListener('touchstart', onTouchStart, { passive: true });
  zone.addEventListener('touchmove', onTouchMove, { passive: true });
  zone.addEventListener('touchend', onTouchEnd, { passive: true });
  zone.addEventListener('touchcancel', onTouchEnd, { passive: true });

  function bindHoldButton(button, key) {
    const press = (event) => {
      event.preventDefault();
      inputState[key] = true;
    };
    const release = () => {
      inputState[key] = false;
    };
    button.addEventListener('touchstart', press, { passive: false });
    button.addEventListener('touchend', release, { passive: true });
    button.addEventListener('touchcancel', release, { passive: true });
  }

  bindHoldButton(runBtn, 'run');

  function dispose() {
    resetJoystick();
    inputState.run = false;
    root.remove();
  }

  return { enabled: true, dispose };
}

function injectStylesOnce() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .touch-controls {
      position: fixed;
      inset: 0;
      pointer-events: none;
      z-index: 15;
    }
    .joystick-zone {
      position: absolute;
      left: 0;
      bottom: 0;
      width: 42vw;
      max-width: 260px;
      height: 42vw;
      max-height: 260px;
      pointer-events: auto;
      touch-action: none;
      display: flex;
      align-items: flex-end;
      justify-content: flex-start;
      padding: clamp(16px, 4vw, 28px);
    }
    .joystick-base {
      position: relative;
      width: 104px;
      height: 104px;
      border-radius: 50%;
      background: var(--cozy-glass, rgba(41, 30, 23, 0.42));
      border: 1px solid var(--cozy-glass-border, rgba(251, 240, 221, 0.16));
      backdrop-filter: blur(6px);
    }
    .joystick-knob {
      position: absolute;
      top: 50%;
      left: 50%;
      width: 46px;
      height: 46px;
      margin: -23px 0 0 -23px;
      border-radius: 50%;
      background: radial-gradient(circle at 35% 30%, #ffe1a8, var(--cozy-amber, #e8a33d));
      box-shadow: 0 4px 12px rgba(28, 20, 15, 0.35);
      transition: transform 0.05s linear;
    }
    .touch-action-buttons {
      position: absolute;
      right: clamp(16px, 4vw, 28px);
      bottom: clamp(20px, 4vh, 40px);
      display: flex;
      flex-direction: column;
      gap: 12px;
      pointer-events: auto;
    }
    .touch-btn {
      width: 64px;
      height: 64px;
      border-radius: 50%;
      border: 1px solid var(--cozy-glass-border, rgba(251, 240, 221, 0.16));
      background: var(--cozy-glass, rgba(41, 30, 23, 0.42));
      backdrop-filter: blur(6px);
      color: var(--cozy-cream, #fbf0dd);
      font: 700 0.68rem/1 var(--font-body, sans-serif);
      letter-spacing: 0.04em;
      -webkit-user-select: none;
      user-select: none;
      touch-action: none;
    }
    .touch-btn:active,
    .touch-btn.is-active {
      background: rgba(232, 163, 61, 0.35);
    }
  `;
  document.head.appendChild(style);
}

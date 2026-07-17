const KEY_MAP = {
  KeyW: 'forward',
  ArrowUp: 'forward',
  KeyS: 'backward',
  ArrowDown: 'backward',
  KeyA: 'left',
  ArrowLeft: 'left',
  KeyD: 'right',
  ArrowRight: 'right',
  ShiftLeft: 'run',
  ShiftRight: 'run'
};

/**
 * Small, dependency-free keyboard state tracker. Exposes an ANALOG
 * { moveX, moveZ } pair (each -1..1) rather than four separate directional
 * booleans, so this shares one input contract with touchControls.js — a
 * touch joystick can report partial tilt (0.3, -0.6, ...), and player.js
 * doesn't need to know or care whether the source was a key or a thumb.
 * Keyboard always reports full magnitude (cardinal or normalized diagonal);
 * only the touch joystick actually uses in-between values.
 */
export function createInputController() {
  const state = {
    moveX: 0,
    moveZ: 0,
    jump: false,
    run: false
  };

  // Raw WASD/arrow key state, used only to recompute moveX/moveZ.
  const keys = { forward: false, backward: false, left: false, right: false };

  function recomputeMove() {
    const x = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
    const z = (keys.forward ? 1 : 0) - (keys.backward ? 1 : 0);
    const len = Math.hypot(x, z);
    state.moveX = len > 0 ? x / len : 0;
    state.moveZ = len > 0 ? z / len : 0;
  }

  function onKeyDown(event) {
    const action = KEY_MAP[event.code];
    if (!action) return;
    if (action === 'jump') state.jump = true;
    else if (action === 'run') state.run = true;
    else {
      keys[action] = true;
      recomputeMove();
    }
  }

  function onKeyUp(event) {
    const action = KEY_MAP[event.code];
    if (!action) return;
    if (action === 'jump') state.jump = false;
    else if (action === 'run') state.run = false;
    else {
      keys[action] = false;
      recomputeMove();
    }
  }

  // Prevents the browser from doing something silly (like scrolling) with
  // WASD/arrow/space input if the user's mouse happens to be over the page
  // body rather than the canvas, and stops movement dead if the tab/window
  // loses focus mid-key-hold (otherwise a key can get "stuck" down).
  function onBlur() {
    keys.forward = keys.backward = keys.left = keys.right = false;
    state.jump = false;
    state.run = false;
    recomputeMove();
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);

  function dispose() {
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
    window.removeEventListener('blur', onBlur);
  }

  return { state, dispose };
}

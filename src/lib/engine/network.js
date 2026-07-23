// Thin transport layer: owns the WebSocket connection and the binary
// encode/decode for the protocol defined in server/server.js. Nothing in
// here touches Three.js — remotePlayers.js is what turns these callbacks
// into meshes, keeping "networking" and "rendering other players" as two
// separate, independently testable concerns.
const OPCODE = { STATE: 0, JOIN: 1, LEAVE: 2, EMOJI: 3, WELCOME: 4, CANNON_STATE: 5, CANNON_FIRE: 6 };

/**
 * @param {object} opts
 * @param {string} opts.url            ws(s):// URL to connect to
 * @param {(id:number, color:number[]) => void} [opts.onWelcome]
 * @param {(data:{id,color,x,y,z,rotY}) => void} [opts.onJoin]
 * @param {(id:number) => void} [opts.onLeave]
 * @param {(data:{id,x,y,z,rotY}) => void} [opts.onState]
 * @param {(id:number, emojiIndex:number) => void} [opts.onEmoji]
 * @param {(data:{id,cannonIndex,pitch,yaw}) => void} [opts.onCannonState]
 * @param {(data:{id,cannonIndex}) => void} [opts.onCannonFire]
 */
export function createNetwork({ url, onWelcome, onJoin, onLeave, onState, onEmoji, onCannonState, onCannonFire }) {
  let ws = null;
  let myId = null;
  let connected = false;

  function connect() {
    try {
      ws = new WebSocket(url);
    } catch (err) {
      // Bad URL, blocked by the browser, etc. — fail quietly, the game is
      // fully playable single-player without a network connection.
      console.warn('[network] could not open WebSocket:', err);
      return;
    }
    ws.binaryType = 'arraybuffer';

    ws.addEventListener('open', () => {
      connected = true;
    });
    ws.addEventListener('close', () => {
      connected = false;
    });
    ws.addEventListener('error', () => {
      connected = false;
    });

    ws.addEventListener('message', (event) => {
      if (!(event.data instanceof ArrayBuffer)) return;
      const view = new DataView(event.data);
      const opcode = view.getUint8(0);

      switch (opcode) {
        case OPCODE.WELCOME: {
          myId = view.getUint8(1);
          const color = [view.getUint8(2), view.getUint8(3), view.getUint8(4)];
          onWelcome?.(myId, color);
          break;
        }
        case OPCODE.JOIN: {
          onJoin?.({
            id: view.getUint8(1),
            color: [view.getUint8(2), view.getUint8(3), view.getUint8(4)],
            x: view.getFloat32(5, true),
            y: view.getFloat32(9, true),
            z: view.getFloat32(13, true),
            rotY: view.getFloat32(17, true)
          });
          break;
        }
        case OPCODE.LEAVE: {
          onLeave?.(view.getUint8(1));
          break;
        }
        case OPCODE.STATE: {
          onState?.({
            id: view.getUint8(1),
            x: view.getFloat32(2, true),
            y: view.getFloat32(6, true),
            z: view.getFloat32(10, true),
            rotY: view.getFloat32(14, true)
          });
          break;
        }
        case OPCODE.EMOJI: {
          onEmoji?.(view.getUint8(1), view.getUint8(2));
          break;
        }
        case OPCODE.CANNON_STATE: {
          onCannonState?.({
            id: view.getUint8(1),
            cannonIndex: view.getUint8(2),
            pitch: view.getFloat32(3, true),
            yaw: view.getFloat32(7, true)
          });
          break;
        }
        case OPCODE.CANNON_FIRE: {
          onCannonFire?.({
            id: view.getUint8(1),
            cannonIndex: view.getUint8(2)
          });
          break;
        }
      }
    });
  }

  /** Sends this client's own position — no id needed, the server tags it. */
  function sendState(x, y, z, rotY) {
    if (!connected) return;
    const buf = new ArrayBuffer(17);
    const view = new DataView(buf);
    view.setUint8(0, OPCODE.STATE);
    view.setFloat32(1, x, true);
    view.setFloat32(5, y, true);
    view.setFloat32(9, z, true);
    view.setFloat32(13, rotY, true);
    ws.send(buf);
  }

  function sendEmoji(emojiIndex) {
    if (!connected) return;
    const buf = new ArrayBuffer(2);
    const view = new DataView(buf);
    view.setUint8(0, OPCODE.EMOJI);
    view.setUint8(1, emojiIndex);
    ws.send(buf);
  }

  function sendCannonState(cannonIndex, pitch, yaw) {
    if (!connected) return;
    const buf = new ArrayBuffer(10);
    const view = new DataView(buf);
    view.setUint8(0, OPCODE.CANNON_STATE);
    view.setUint8(1, cannonIndex);
    view.setFloat32(2, pitch, true);
    view.setFloat32(6, yaw, true);
    ws.send(buf);
  }

  function sendCannonFire(cannonIndex) {
    if (!connected) return;
    const buf = new ArrayBuffer(2);
    const view = new DataView(buf);
    view.setUint8(0, OPCODE.CANNON_FIRE);
    view.setUint8(1, cannonIndex);
    ws.send(buf);
  }

  function dispose() {
    ws?.close();
  }

  return {
    connect,
    sendState,
    sendEmoji,
    sendCannonState,
    sendCannonFire,
    dispose,
    get id() {
      return myId;
    },
    get isConnected() {
      return connected;
    }
  };
}

/** Builds the default server URL from Vite env, falling back to same-host:8787. */
export function resolveServerUrl() {
  const configured = import.meta.env?.VITE_MULTIPLAYER_URL;
  if (configured) return configured;
  
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return `ws://${window.location.hostname}:8787`;
  }

  return 'wss://mgame-production-4f64.up.railway.app';
}

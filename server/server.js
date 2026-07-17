// Cozy Explorer — multiplayer relay server.
//
// Mirrors the approach described in Vicente Lucendo's "multiplayer server"
// slide: plain WebSockets (fine here since we don't need FPS-grade network
// speed), a hand-rolled Node.js server that manages virtual rooms + player
// assignment, and player data (position/rotation/color) encoded into a
// compact binary layout — smaller over the wire than JSON, and validated on
// the server before it's ever rebroadcast.
import { WebSocketServer } from 'ws';

const PORT = process.env.PORT || 8787;
const wss = new WebSocketServer({ port: PORT });

// --- Wire format --------------------------------------------------------
// Every message is a raw binary buffer. Byte 0 is always the opcode.
const OPCODE = {
  STATE: 0, // position/rotation update, either direction
  JOIN: 1, // server -> client: a player entered the room
  LEAVE: 2, // server -> client: a player left the room
  EMOJI: 3, // either direction: a one-shot emoji "wave"
  WELCOME: 4 // server -> client only, sent once on connect
};

// Session-local ids (1 byte = up to 255 concurrent players per room, plenty
// for a cozy clearing) rather than shipping full UUIDs over the wire.
let nextId = 1;

// rooms: Map<roomName, Map<ws, PlayerState>>
const rooms = new Map();

// Loosely matches the clearing radius in world.js — anything outside this
// is either a bug or a spoofed packet, so we clamp rather than trust it.
const WORLD_BOUNDS = { xz: 20, yMin: -3, yMax: 12 };

const COLOR_PALETTE = [
  [244, 201, 139], // sand
  [139, 171, 111], // moss
  [111, 179, 184], // pond
  [201, 105, 79], // clay
  [232, 163, 61], // amber
  [220, 196, 142], // wheat
  [156, 107, 74], // bark
  [154, 145, 134] // stone
];

function getRoom(name) {
  if (!rooms.has(name)) rooms.set(name, new Map());
  return rooms.get(name);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

wss.on('connection', (ws, req) => {
  const url = new URL(req.url, 'http://localhost');
  const roomName = url.searchParams.get('room') || 'default';
  const room = getRoom(roomName);

  const id = nextId++ % 256;
  const color = COLOR_PALETTE[id % COLOR_PALETTE.length];
  const player = { id, x: 0, y: 3, z: 4, rotY: 0, color };
  room.set(ws, player);

  ws.send(encodeWelcome(id, color));
  // Catch the new client up on everyone already in the room...
  for (const [otherWs, other] of room) {
    if (otherWs !== ws) ws.send(encodeJoin(other));
  }
  // ...then tell everyone else the new player arrived.
  broadcast(room, ws, encodeJoin(player));

  ws.on('message', (data) => {
    if (!(data instanceof Buffer) || data.length === 0) return;
    const opcode = data.readUInt8(0);

    if (opcode === OPCODE.STATE && data.length >= 17) {
      // Validate before trusting/rebroadcasting — this is the "validated
      // upon reception" step from the slide. A client that reports NaN or
      // wildly out-of-bounds coordinates just gets clamped, not banned;
      // good enough for a non-competitive space.
      const x = clamp(safeFloat(data.readFloatLE(1)), -WORLD_BOUNDS.xz, WORLD_BOUNDS.xz);
      const y = clamp(safeFloat(data.readFloatLE(5)), WORLD_BOUNDS.yMin, WORLD_BOUNDS.yMax);
      const z = clamp(safeFloat(data.readFloatLE(9)), -WORLD_BOUNDS.xz, WORLD_BOUNDS.xz);
      const rotY = safeFloat(data.readFloatLE(13));

      player.x = x;
      player.y = y;
      player.z = z;
      player.rotY = rotY;
      broadcast(room, ws, encodeState(player));
    } else if (opcode === OPCODE.EMOJI && data.length >= 2) {
      const emojiIndex = data.readUInt8(1);
      broadcast(room, ws, encodeEmoji(player.id, emojiIndex));
    }
  });

  ws.on('close', () => {
    room.delete(ws);
    broadcast(room, ws, encodeLeave(player.id));
    if (room.size === 0) rooms.delete(roomName);
  });

  ws.on('error', () => {
    // Swallow — 'close' fires right after and does the actual cleanup.
  });
});

function safeFloat(value) {
  return Number.isFinite(value) ? value : 0;
}

function broadcast(room, senderWs, buffer) {
  for (const [clientWs] of room) {
    if (clientWs !== senderWs && clientWs.readyState === clientWs.OPEN) {
      clientWs.send(buffer);
    }
  }
}

// --- Binary encoders ------------------------------------------------------
// All multi-byte numbers are little-endian to match DataView's default
// `littleEndian = true` reads on the client.

function encodeWelcome(id, color) {
  const buf = Buffer.alloc(5);
  buf.writeUInt8(OPCODE.WELCOME, 0);
  buf.writeUInt8(id, 1);
  buf.writeUInt8(color[0], 2);
  buf.writeUInt8(color[1], 3);
  buf.writeUInt8(color[2], 4);
  return buf;
}

function encodeJoin(p) {
  const buf = Buffer.alloc(21);
  buf.writeUInt8(OPCODE.JOIN, 0);
  buf.writeUInt8(p.id, 1);
  buf.writeUInt8(p.color[0], 2);
  buf.writeUInt8(p.color[1], 3);
  buf.writeUInt8(p.color[2], 4);
  buf.writeFloatLE(p.x, 5);
  buf.writeFloatLE(p.y, 9);
  buf.writeFloatLE(p.z, 13);
  buf.writeFloatLE(p.rotY, 17);
  return buf;
}

function encodeLeave(id) {
  const buf = Buffer.alloc(2);
  buf.writeUInt8(OPCODE.LEAVE, 0);
  buf.writeUInt8(id, 1);
  return buf;
}

function encodeState(p) {
  const buf = Buffer.alloc(18);
  buf.writeUInt8(OPCODE.STATE, 0);
  buf.writeUInt8(p.id, 1);
  buf.writeFloatLE(p.x, 2);
  buf.writeFloatLE(p.y, 6);
  buf.writeFloatLE(p.z, 10);
  buf.writeFloatLE(p.rotY, 14);
  return buf;
}

function encodeEmoji(id, emojiIndex) {
  const buf = Buffer.alloc(3);
  buf.writeUInt8(OPCODE.EMOJI, 0);
  buf.writeUInt8(id, 1);
  buf.writeUInt8(emojiIndex, 2);
  return buf;
}

console.log(`Cozy Explorer multiplayer server listening on ws://localhost:${PORT}`);

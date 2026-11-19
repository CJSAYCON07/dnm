import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { WebSocket, WebSocketServer } from 'ws';
import { resolveTurnAction } from './src/game/combatEngine.ts';
import { REGIONS, createNewHero } from './src/game/content.ts';
import { computeFOV, generateDungeonFloor } from './src/game/dungeonGen.ts';
import type {
  CombatEvent,
  DungeonFloor,
  HeroClassId,
  HeroState,
  LanPeerSummary,
  LanRoomState,
  PlayerAction,
  RegionId,
} from './src/game/types.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = Number(process.env.PORT || 3000);
const isProd = process.env.NODE_ENV === 'production';

interface ServerPeer {
  id: string;
  ws: WebSocket;
  name: string;
  classId: HeroClassId;
  ready: boolean;
}

interface ServerRoom {
  code: string;
  regionId: RegionId;
  status: 'lobby' | 'playing' | 'victory' | 'gameover';
  hostId: string;
  peers: Map<string, ServerPeer>;
  heroes: Record<string, HeroState>;
  floor: DungeonFloor | null;
  logs: string[];
  events: CombatEvent[];
}

const rooms = new Map<string, ServerRoom>();
const socketToRoom = new Map<WebSocket, { roomCode: string; peerId: string }>();

function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return rooms.has(code) ? generateRoomCode() : code;
}

function getLanAddresses(): string[] {
  const nets = os.networkInterfaces();
  const urls: string[] = [];
  for (const list of Object.values(nets)) {
    if (!list) continue;
    for (const net of list) {
      if (net.family === 'IPv4' && !net.internal) {
        urls.push(`http://${net.address}:${PORT}`);
      }
    }
  }
  return urls;
}

function buildPublicRoomState(room: ServerRoom): LanRoomState {
  const peers: LanPeerSummary[] = [];
  for (const p of room.peers.values()) {
    const hero = room.heroes[p.id];
    peers.push({
      id: p.id,
      name: p.name,
      classId: p.classId,
      level: hero?.level ?? 1,
      hp: hero?.hp ?? 40,
      maxHp: hero?.maxHp ?? 40,
      x: hero?.x ?? 0,
      y: hero?.y ?? 0,
      alive: hero?.alive ?? true,
      isHost: p.id === room.hostId,
      ready: p.ready,
    });
  }
  return {
    code: room.code,
    regionId: room.regionId,
    status: room.status,
    hostId: room.hostId,
    peers,
    heroes: room.heroes,
    floor: room.floor,
    logs: room.logs.slice(-14),
    events: room.events.slice(-16),
  };
}

function broadcastRoom(room: ServerRoom, extraSfx: string[] = []) {
  const payload = JSON.stringify({
    type: 'room:state',
    room: buildPublicRoomState(room),
    sfx: extraSfx,
  });
  for (const peer of room.peers.values()) {
    if (peer.ws.readyState === WebSocket.OPEN) {
      peer.ws.send(payload);
    }
  }
}

function removeSocketFromRoom(ws: WebSocket) {
  const info = socketToRoom.get(ws);
  if (!info) return;
  socketToRoom.delete(ws);

  const room = rooms.get(info.roomCode);
  if (!room) return;

  const peer = room.peers.get(info.peerId);
  room.peers.delete(info.peerId);
  delete room.heroes[info.peerId];

  if (peer) {
    room.logs.push(`${peer.name} left the LAN party.`);
  }

  if (room.peers.size === 0) {
    rooms.delete(room.code);
    return;
  }

  if (room.hostId === info.peerId) {
    const nextHost = room.peers.values().next().value;
    if (nextHost) {
      room.hostId = nextHost.id;
      room.logs.push(`${nextHost.name} is now party host.`);
    }
  }

  broadcastRoom(room);
}

async function startServer() {
  const app = express();
  app.use(express.json());

  app.get('/api/lan-info', (_req, res) => {
    const activeRooms = Array.from(rooms.values()).map((r) => ({
      code: r.code,
      regionId: r.regionId,
      regionName: REGIONS[r.regionId].name,
      status: r.status,
      playerCount: r.peers.size,
      hostName: r.peers.get(r.hostId)?.name ?? 'Host',
    }));
    res.json({
      port: PORT,
      lanUrls: getLanAddresses(),
      rooms: activeRooms,
    });
  });

  const server = http.createServer(app);
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (req, socket, head) => {
    const pathname = new URL(req.url ?? '/', 'http://localhost').pathname;
    if (pathname === '/ws/lan') {
      wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit('connection', ws, req);
      });
    }
  });

  wss.on('connection', (ws) => {
    const peerId = `peer_${Math.random().toString(36).slice(2, 9)}`;
    ws.send(JSON.stringify({ type: 'welcome', peerId }));

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString()) as {
          type: string;
          code?: string;
          name?: string;
          classId?: HeroClassId;
          heroSnapshot?: HeroState;
          regionId?: RegionId;
          action?: PlayerAction;
        };

        if (msg.type === 'create_room') {
          removeSocketFromRoom(ws);
          const code = generateRoomCode();
          const classId: HeroClassId = msg.classId ?? 'warden';
          const name = (msg.name || 'Host').slice(0, 18);
          const baseHero = msg.heroSnapshot
            ? { ...msg.heroSnapshot, id: peerId, name, alive: true, hp: msg.heroSnapshot.maxHp, mp: msg.heroSnapshot.maxMp }
            : createNewHero(classId, name);
          baseHero.id = peerId;

          const room: ServerRoom = {
            code,
            regionId: msg.regionId ?? 'catacombs',
            status: 'lobby',
            hostId: peerId,
            peers: new Map([[peerId, { id: peerId, ws, name, classId, ready: true }]]),
            heroes: { [peerId]: baseHero },
            floor: null,
            logs: [`${name} opened LAN room ${code}.`],
            events: [],
          };
          rooms.set(code, room);
          socketToRoom.set(ws, { roomCode: code, peerId });
          broadcastRoom(room);
          return;
        }

        if (msg.type === 'join_room') {
          const code = (msg.code || '').trim().toUpperCase();
          const room = rooms.get(code);
          if (!room) {
            ws.send(JSON.stringify({ type: 'error', message: `Room "${code}" not found on this LAN host.` }));
            return;
          }
          if (room.peers.size >= 4) {
            ws.send(JSON.stringify({ type: 'error', message: 'Party is full (max 4 LAN players).' }));
            return;
          }
          removeSocketFromRoom(ws);

          const classId: HeroClassId = msg.classId ?? 'stalker';
          const name = (msg.name || 'Delver').slice(0, 18);
          const hero = msg.heroSnapshot
            ? { ...msg.heroSnapshot, id: peerId, name, alive: true, hp: msg.heroSnapshot.maxHp, mp: msg.heroSnapshot.maxMp }
            : createNewHero(classId, name);
          hero.id = peerId;

          if (room.floor) {
            const startRoom = room.floor.rooms[0];
            hero.x = startRoom.cx;
            hero.y = startRoom.cy;
          }

          room.peers.set(peerId, { id: peerId, ws, name, classId, ready: true });
          room.heroes[peerId] = hero;
          socketToRoom.set(ws, { roomCode: code, peerId });
          room.logs.push(`${name} joined the LAN party.`);
          if (room.floor) {
            room.floor.visibility = computeFOV(room.floor, Object.values(room.heroes).filter((h) => h.alive));
          }
          broadcastRoom(room);
          return;
        }

        const conn = socketToRoom.get(ws);
        if (!conn) return;
        const room = rooms.get(conn.roomCode);
        if (!room) return;

        if (msg.type === 'set_region' && conn.peerId === room.hostId && msg.regionId) {
          room.regionId = msg.regionId;
          room.logs.push(`Destination set to ${REGIONS[msg.regionId].name}.`);
          broadcastRoom(room);
          return;
        }

        if (msg.type === 'toggle_ready') {
          const peer = room.peers.get(conn.peerId);
          if (peer) {
            peer.ready = !peer.ready;
            broadcastRoom(room);
          }
          return;
        }

        if (msg.type === 'start_run' && conn.peerId === room.hostId) {
          const heroList = Object.values(room.heroes);
          const avgLevel = Math.max(1, Math.round(heroList.reduce((acc, h) => acc + h.level, 0) / Math.max(1, heroList.length)));
          const floor = generateDungeonFloor(room.regionId, 1, Date.now(), avgLevel);
          const startRoom = floor.rooms[0];
          let idx = 0;
          for (const h of heroList) {
            h.x = startRoom.cx + (idx % 2);
            h.y = startRoom.cy + Math.floor(idx / 2);
            h.alive = true;
            h.hp = h.maxHp;
            h.mp = h.maxMp;
            idx++;
          }
          floor.visibility = computeFOV(floor, heroList);
          room.floor = floor;
          room.status = 'playing';
          room.events = [];
          room.logs = [`Party entered ${REGIONS[room.regionId].name} (Floor B1)!`];
          broadcastRoom(room, ['door']);
          return;
        }

        if (msg.type === 'return_lobby' && conn.peerId === room.hostId) {
          room.status = 'lobby';
          room.floor = null;
          for (const h of Object.values(room.heroes)) {
            h.alive = true;
            h.hp = h.maxHp;
            h.mp = h.maxMp;
          }
          room.logs.push('Party returned to LAN Sanctuary Camp.');
          broadcastRoom(room);
          return;
        }

        if (msg.type === 'player_action' && room.floor && room.status === 'playing' && msg.action) {
          const res = resolveTurnAction(room.floor, room.heroes, conn.peerId, msg.action);
          room.floor = res.floor;
          room.heroes = res.heroes;
          room.logs = [...room.logs, ...res.logs].slice(-20);
          room.events = res.events;

          if (res.regionCleared) {
            room.status = 'victory';
          } else if (Object.values(room.heroes).every((h) => !h.alive)) {
            room.status = 'gameover';
          }
          broadcastRoom(room, res.sfx);
        }
      } catch (err) {
        console.error('WS message error:', err);
      }
    });

    ws.on('close', () => {
      removeSocketFromRoom(ws);
    });
  });

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        ws: { server },
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Cryptbound LAN server running at http://0.0.0.0:${PORT}`);
  });
}

void startServer();

import { REGIONS, generateLootItem, spawnMonster } from './content.ts';
import { SeededRng, makeId } from './rng.ts';
import type {
  DungeonFloor,
  EquipSlot,
  GroundLoot,
  HeroState,
  Monster,
  RegionId,
  Room,
  TileType,
} from './types.ts';

export interface DerivedStats {
  maxHp: number;
  maxMp: number;
  atk: number;
  def: number;
  critChance: number;
  dodgeChance: number;
  spellPower: number;
}

export function getHeroDerivedStats(hero: HeroState): DerivedStats {
  const slots: EquipSlot[] = ['weapon', 'offhand', 'armor', 'helm', 'ring'];
  let eqAtk = 0;
  let eqDef = 0;
  let eqHp = 0;
  let eqMp = 0;
  let eqCrit = 0;
  let eqDodge = 0;

  for (const slot of slots) {
    const item = hero.equipment[slot];
    if (!item) continue;
    eqAtk += item.atk;
    eqDef += item.def;
    eqHp += item.hpBonus;
    eqMp += item.mpBonus;
    eqCrit += item.critBonus;
    eqDodge += item.dodgeBonus;
  }

  const maxHp = 32 + hero.stats.vitality * 5 + (hero.level - 1) * 4 + eqHp;
  const maxMp = 14 + hero.stats.arcana * 3 + (hero.level - 1) * 2 + eqMp;
  const baseAtk = 4 + Math.round(hero.stats.might * 1.4) + Math.round(hero.stats.arcana * 0.5);
  const rawDef = 1 + Math.floor(hero.stats.vitality * 0.45) + Math.floor(hero.stats.agility * 0.3) + eqDef;
  const def = hero.buffs.shieldTurns > 0 ? Math.ceil(rawDef * 1.5) : rawDef;
  const critChance = Math.min(60, 5 + hero.stats.agility * 1.5 + hero.stats.might * 0.5 + eqCrit);
  const dodgeBase = 3 + hero.stats.agility * 1.6 + eqDodge;
  const dodgeChance = Math.min(65, hero.buffs.stealthTurns > 0 ? dodgeBase + 45 : dodgeBase);
  const spellPower = 1 + hero.stats.arcana * 0.12;

  return {
    maxHp,
    maxMp,
    atk: baseAtk + eqAtk,
    def,
    critChance,
    dodgeChance,
    spellPower,
  };
}

export function syncHeroCaps(hero: HeroState): HeroState {
  const d = getHeroDerivedStats(hero);
  return {
    ...hero,
    maxHp: d.maxHp,
    maxMp: d.maxMp,
    hp: Math.min(hero.hp, d.maxHp),
    mp: Math.min(hero.mp, d.maxMp),
  };
}

export function isWalkableTile(tile: TileType): boolean {
  return (
    tile === 'floor' ||
    tile === 'corridor' ||
    tile === 'door_open' ||
    tile === 'door_closed' ||
    tile === 'stairs_down' ||
    tile === 'stairs_up' ||
    tile === 'shrine' ||
    tile === 'trap_spike' ||
    tile === 'trap_fire'
  );
}

export function blocksLight(tile: TileType): boolean {
  return tile === 'void' || tile === 'wall' || tile === 'door_closed';
}

export function generateDungeonFloor(
  regionId: RegionId,
  depth: number,
  seed: number,
  heroLevel = 1
): DungeonFloor {
  const region = REGIONS[regionId];
  const isBossFloor = depth >= region.floors;
  const width = isBossFloor ? 33 : 38;
  const height = isBossFloor ? 27 : 30;
  const rng = new SeededRng(seed + depth * 7919);

  const tiles: TileType[][] = Array.from({ length: height }, () =>
    Array.from({ length: width }, () => 'void' as TileType)
  );
  const visibility: number[][] = Array.from({ length: height }, () =>
    Array.from({ length: width }, () => 0)
  );

  const rooms: Room[] = [];
  const scale = Math.max(1, region.baseDanger * 2 - 1 + (depth - 1) + Math.floor((heroLevel - 1) * 0.35));

  if (isBossFloor) {
    // Structured grand dungeon leading to Boss Arena
    const startRoom: Room = {
      id: 0,
      x: 3,
      y: 10,
      w: 6,
      h: 7,
      cx: 6,
      cy: 13,
      kind: 'start',
    };
    const hallRoom: Room = {
      id: 1,
      x: 11,
      y: 11,
      w: 5,
      h: 5,
      cx: 13,
      cy: 13,
      kind: 'shrine',
    };
    const bossRoom: Room = {
      id: 2,
      x: 18,
      y: 5,
      w: 12,
      h: 17,
      cx: 24,
      cy: 13,
      kind: 'boss',
    };
    rooms.push(startRoom, hallRoom, bossRoom);
    for (const r of rooms) carveRoom(tiles, r);
    carveCorridor(tiles, startRoom.cx, startRoom.cy, hallRoom.cx, hallRoom.cy, rng);
    carveCorridor(tiles, hallRoom.cx, hallRoom.cy, bossRoom.cx, bossRoom.cy, rng);

    // Decorative pillars & hazards inside boss arena
    const pillarCoords = [
      [21, 8],
      [27, 8],
      [21, 18],
      [27, 18],
    ];
    for (const [px, py] of pillarCoords) {
      tiles[py][px] = 'wall';
    }
    if (regionId === 'obsidian_forge') {
      tiles[7][24] = 'lava';
      tiles[19][24] = 'lava';
    } else if (regionId === 'fungal_keep') {
      tiles[7][24] = 'water';
      tiles[19][24] = 'water';
    }

    tiles[hallRoom.cy][hallRoom.cx] = 'shrine';
    tiles[hallRoom.y + 1][hallRoom.x + 1] = 'chest';
    tiles[startRoom.cy][startRoom.cx] = 'stairs_up';
    tiles[bossRoom.cy][bossRoom.x + bossRoom.w - 2] = 'stairs_down';
  } else {
    const targetRooms = 8 + rng.int(0, 2);
    for (let attempt = 0; attempt < 90 && rooms.length < targetRooms; attempt++) {
      const w = rng.int(5, 8);
      const h = rng.int(5, 8);
      const x = rng.int(2, width - w - 3);
      const y = rng.int(2, height - h - 3);

      const overlaps = rooms.some(
        (r) => x <= r.x + r.w + 1 && x + w + 1 >= r.x && y <= r.y + r.h + 1 && y + h + 1 >= r.y
      );
      if (overlaps) continue;

      const room: Room = {
        id: rooms.length,
        x,
        y,
        w,
        h,
        cx: Math.floor(x + w / 2),
        cy: Math.floor(y + h / 2),
        kind: rooms.length === 0 ? 'start' : 'normal',
      };
      rooms.push(room);
      carveRoom(tiles, room);
    }

    // Connect all rooms sequentially + 1-2 extra loops for tactical flanking
    for (let i = 1; i < rooms.length; i++) {
      carveCorridor(tiles, rooms[i - 1].cx, rooms[i - 1].cy, rooms[i].cx, rooms[i].cy, rng);
    }
    if (rooms.length > 4) {
      carveCorridor(tiles, rooms[0].cx, rooms[0].cy, rooms[rooms.length - 2].cx, rooms[rooms.length - 2].cy, rng);
    }

    // Assign special rooms
    if (rooms.length >= 3) rooms[1].kind = 'shrine';
    if (rooms.length >= 4) rooms[rooms.length - 2].kind = 'treasure';
    rooms[rooms.length - 1].kind = 'boss'; // Exit room

    const start = rooms[0];
    const exit = rooms[rooms.length - 1];
    tiles[start.cy][start.cx] = 'stairs_up';
    tiles[exit.cy][exit.cx] = 'stairs_down';

    for (const r of rooms) {
      if (r.kind === 'shrine') {
        tiles[r.cy][r.cx] = 'shrine';
      } else if (r.kind === 'treasure') {
        tiles[r.cy][r.cx] = 'chest';
        if (r.w >= 6) tiles[r.cy][r.cx + 1] = 'crate';
      } else if (r.kind === 'normal') {
        // Place occasional crates, traps, water/lava pools
        if (rng.chance(0.55)) {
          const cx = rng.int(r.x + 1, r.x + r.w - 2);
          const cy = rng.int(r.y + 1, r.y + r.h - 2);
          if (tiles[cy][cx] === 'floor') tiles[cy][cx] = 'crate';
        }
        if (rng.chance(0.42)) {
          const tx = rng.int(r.x + 1, r.x + r.w - 2);
          const ty = rng.int(r.y + 1, r.y + r.h - 2);
          if (tiles[ty][tx] === 'floor') {
            tiles[ty][tx] = regionId === 'obsidian_forge' ? 'trap_fire' : 'trap_spike';
          }
        }
        if (rng.chance(0.3)) {
          const wx = rng.int(r.x + 1, r.x + r.w - 2);
          const wy = rng.int(r.y + 1, r.y + r.h - 2);
          if (tiles[wy][wx] === 'floor') {
            tiles[wy][wx] = regionId === 'obsidian_forge' ? 'lava' : 'water';
          }
        }
      }
    }
  }

  // Surround carved tiles with walls & add doors on narrow corridor entrances
  surroundWithWalls(tiles, width, height);
  placeDoors(tiles, rooms, rng);

  // Spawn monsters & ground loot
  const monsters: Monster[] = [];
  const loot: GroundLoot[] = [];

  if (isBossFloor) {
    const bossId = `boss_${regionId}`;
    const bossRoom = rooms[rooms.length - 1];
    const boss = spawnMonster(bossId, bossRoom.cx + 2, bossRoom.cy, scale, rng);
    monsters.push(boss);

    // 2 minions guarding the boss arena
    const guardTpl = rng.pick(region.monsters);
    monsters.push(spawnMonster(guardTpl, bossRoom.cx - 2, bossRoom.y + 2, scale, rng));
    monsters.push(spawnMonster(guardTpl, bossRoom.cx - 2, bossRoom.y + bossRoom.h - 3, scale, rng));
  } else {
    for (const r of rooms) {
      if (r.kind === 'start') continue;
      const count = r.kind === 'treasure' ? 2 : rng.int(1, 2);
      for (let i = 0; i < count; i++) {
        for (let t = 0; t < 12; t++) {
          const mx = rng.int(r.x, r.x + r.w - 1);
          const my = rng.int(r.y, r.y + r.h - 1);
          if (
            tiles[my][mx] === 'floor' &&
            !monsters.some((m) => m.x === mx && m.y === my)
          ) {
            const tpl = rng.pick(region.monsters);
            monsters.push(spawnMonster(tpl, mx, my, scale, rng));
            break;
          }
        }
      }
      if (rng.chance(0.35)) {
        const lx = rng.int(r.x, r.x + r.w - 1);
        const ly = rng.int(r.y, r.y + r.h - 1);
        if (tiles[ly][lx] === 'floor') {
          loot.push({
            id: makeId('loot'),
            x: lx,
            y: ly,
            item: rng.chance(0.55) ? generateLootItem(scale, rng) : null,
            gold: rng.int(6, 18) + scale * 3,
          });
        }
      }
    }
  }

  return {
    width,
    height,
    regionId,
    depth,
    maxDepth: region.floors,
    seed,
    tiles,
    visibility,
    rooms,
    monsters,
    loot,
    shrinesUsed: [],
    turnNumber: 1,
    bossDefeated: false,
    exitUnlocked: !isBossFloor,
  };
}

function carveRoom(tiles: TileType[][], r: Room) {
  for (let y = r.y; y < r.y + r.h; y++) {
    for (let x = r.x; x < r.x + r.w; x++) {
      tiles[y][x] = 'floor';
    }
  }
}

function carveCorridor(
  tiles: TileType[][],
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  rng: SeededRng
) {
  let x = x1;
  let y = y1;
  const horizFirst = rng.chance(0.5);
  if (horizFirst) {
    while (x !== x2) {
      if (tiles[y][x] === 'void') tiles[y][x] = 'corridor';
      x += x < x2 ? 1 : -1;
    }
    while (y !== y2) {
      if (tiles[y][x] === 'void') tiles[y][x] = 'corridor';
      y += y < y2 ? 1 : -1;
    }
  } else {
    while (y !== y2) {
      if (tiles[y][x] === 'void') tiles[y][x] = 'corridor';
      y += y < y2 ? 1 : -1;
    }
    while (x !== x2) {
      if (tiles[y][x] === 'void') tiles[y][x] = 'corridor';
      x += x < x2 ? 1 : -1;
    }
  }
  if (tiles[y2][x2] === 'void') tiles[y2][x2] = 'corridor';
}

function surroundWithWalls(tiles: TileType[][], width: number, height: number) {
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (tiles[y][x] !== 'void') continue;
      let adjacentWalkable = false;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const ny = y + dy;
          const nx = x + dx;
          if (ny >= 0 && ny < height && nx >= 0 && nx < width) {
            const t = tiles[ny][nx];
            if (t !== 'void' && t !== 'wall') {
              adjacentWalkable = true;
              break;
            }
          }
        }
        if (adjacentWalkable) break;
      }
      if (adjacentWalkable) {
        tiles[y][x] = 'wall';
      }
    }
  }
}

function placeDoors(tiles: TileType[][], rooms: Room[], rng: SeededRng) {
  for (const r of rooms) {
    if (r.kind === 'start') continue;
    for (let x = r.x; x < r.x + r.w; x++) {
      tryDoor(tiles, x, r.y - 1, rng);
      tryDoor(tiles, x, r.y + r.h, rng);
    }
    for (let y = r.y; y < r.y + r.h; y++) {
      tryDoor(tiles, r.x - 1, y, rng);
      tryDoor(tiles, r.x + r.w, y, rng);
    }
  }
}

function tryDoor(tiles: TileType[][], x: number, y: number, rng: SeededRng) {
  if (y <= 1 || y >= tiles.length - 2 || x <= 1 || x >= tiles[0].length - 2) return;
  if (tiles[y][x] !== 'corridor') return;
  const horizWall = tiles[y][x - 1] === 'wall' && tiles[y][x + 1] === 'wall';
  const vertWall = tiles[y - 1][x] === 'wall' && tiles[y + 1][x] === 'wall';
  if ((horizWall || vertWall) && rng.chance(0.55)) {
    tiles[y][x] = 'door_closed';
  }
}

export function computeFOV(
  floor: DungeonFloor,
  origins: { x: number; y: number }[],
  radius = 7
): number[][] {
  const vis = floor.visibility.map((row) => row.map((v) => (v === 2 ? 1 : v)));
  const h = floor.height;
  const w = floor.width;

  for (const origin of origins) {
    if (origin.y >= 0 && origin.y < h && origin.x >= 0 && origin.x < w) {
      vis[origin.y][origin.x] = 2;
    }
    const rays = 120;
    for (let i = 0; i < rays; i++) {
      const angle = (i / rays) * Math.PI * 2;
      const dx = Math.cos(angle);
      const dy = Math.sin(angle);
      let rx = origin.x + 0.5;
      let ry = origin.y + 0.5;
      for (let step = 0; step <= radius; step++) {
        const tx = Math.floor(rx);
        const ty = Math.floor(ry);
        if (tx < 0 || tx >= w || ty < 0 || ty >= h) break;
        vis[ty][tx] = 2;
        if (step > 0 && blocksLight(floor.tiles[ty][tx])) {
          break;
        }
        rx += dx * 0.75;
        ry += dy * 0.75;
      }
    }
  }
  return vis;
}

export function findPathAStar(
  floor: DungeonFloor,
  startX: number,
  startY: number,
  goalX: number,
  goalY: number,
  allowGoalOccupied = false
): { x: number; y: number }[] {
  if (goalX < 0 || goalX >= floor.width || goalY < 0 || goalY >= floor.height) return [];
  const goalTile = floor.tiles[goalY][goalX];
  if (!isWalkableTile(goalTile) && goalTile !== 'crate' && goalTile !== 'chest') return [];
  if (floor.visibility[goalY][goalX] === 0) return [];

  const key = (x: number, y: number) => `${x},${y}`;
  const open: { x: number; y: number; g: number; f: number }[] = [
    { x: startX, y: startY, g: 0, f: Math.abs(goalX - startX) + Math.abs(goalY - startY) },
  ];
  const cameFrom = new Map<string, { x: number; y: number }>();
  const gScore = new Map<string, number>([[key(startX, startY), 0]]);
  const closed = new Set<string>();

  const dirs = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];

  while (open.length > 0) {
    open.sort((a, b) => a.f - b.f);
    const curr = open.shift()!;
    const ck = key(curr.x, curr.y);
    if (curr.x === goalX && curr.y === goalY) {
      const path: { x: number; y: number }[] = [];
      let p: { x: number; y: number } | undefined = { x: goalX, y: goalY };
      while (p && !(p.x === startX && p.y === startY)) {
        path.unshift(p);
        p = cameFrom.get(key(p.x, p.y));
      }
      return path;
    }
    closed.add(ck);

    for (const [dx, dy] of dirs) {
      const nx = curr.x + dx;
      const ny = curr.y + dy;
      if (nx < 0 || nx >= floor.width || ny < 0 || ny >= floor.height) continue;
      const nk = key(nx, ny);
      if (closed.has(nk)) continue;
      if (floor.visibility[ny][nx] === 0) continue;

      const tile = floor.tiles[ny][nx];
      const isGoal = nx === goalX && ny === goalY;
      const blockedByTile = !isWalkableTile(tile) && !(isGoal && (tile === 'crate' || tile === 'chest'));
      if (blockedByTile) continue;

      const monsterAt = floor.monsters.some((m) => m.x === nx && m.y === ny);
      if (monsterAt && !(isGoal && allowGoalOccupied)) continue;

      const tg = curr.g + 1;
      if (tg < (gScore.get(nk) ?? Infinity)) {
        cameFrom.set(nk, { x: curr.x, y: curr.y });
        gScore.set(nk, tg);
        const h = Math.abs(goalX - nx) + Math.abs(goalY - ny);
        const existing = open.find((o) => o.x === nx && o.y === ny);
        if (existing) {
          existing.g = tg;
          existing.f = tg + h;
        } else {
          open.push({ x: nx, y: ny, g: tg, f: tg + h });
        }
      }
    }
  }
  return [];
}

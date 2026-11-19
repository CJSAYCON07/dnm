import { REGIONS, generateLootItem, spawnMonster } from './content.ts';
import {
  computeFOV,
  generateDungeonFloor,
  getHeroDerivedStats,
  isWalkableTile,
  syncHeroCaps,
} from './dungeonGen.ts';
import { SeededRng, makeId } from './rng.ts';
import type {
  CombatEvent,
  DungeonFloor,
  HeroState,
  HeroStats,
  Monster,
  PlayerAction,
  RegionId,
} from './types.ts';

export interface TurnResolution {
  floor: DungeonFloor;
  heroes: Record<string, HeroState>;
  events: CombatEvent[];
  logs: string[];
  floorChanged: boolean;
  regionCleared: boolean;
  heroDied: boolean;
  killsThisTurn: string[];
  goldGained: number;
  sfx: string[];
}

function cloneFloor(f: DungeonFloor): DungeonFloor {
  return {
    ...f,
    tiles: f.tiles.map((r) => [...r]),
    visibility: f.visibility.map((r) => [...r]),
    monsters: f.monsters.map((m) => ({
      ...m,
      telegraphTiles: m.telegraphTiles.map((t) => ({ ...t })),
    })),
    loot: f.loot.map((l) => ({ ...l })),
    shrinesUsed: [...f.shrinesUsed],
  };
}

function cloneHero(h: HeroState): HeroState {
  return {
    ...h,
    stats: { ...h.stats },
    equipment: { ...h.equipment },
    inventory: [...h.inventory],
    skills: h.skills.map((s) => ({ ...s })),
    buffs: { ...h.buffs },
  };
}

function addXp(hero: HeroState, amount: number, events: CombatEvent[], logs: string[], sfx: string[]) {
  hero.xp += amount;
  while (hero.xp >= hero.xpToNext) {
    hero.xp -= hero.xpToNext;
    hero.level += 1;
    hero.xpToNext = Math.round(hero.xpToNext * 1.45 + 15);
    hero.unspentPoints += 2;
    const d = getHeroDerivedStats(hero);
    hero.maxHp = d.maxHp;
    hero.maxMp = d.maxMp;
    hero.hp = hero.maxHp;
    hero.mp = hero.maxMp;
    events.push({
      id: makeId('evt'),
      type: 'level',
      x: hero.x,
      y: hero.y,
      text: `LEVEL ${hero.level}!`,
      color: '#fbbf24',
      ts: Date.now(),
    });
    logs.push(`${hero.name} reached Level ${hero.level}! (+2 Stat Points)`);
    sfx.push('levelUp');
  }
}

export function resolveTurnAction(
  inputFloor: DungeonFloor,
  inputHeroes: Record<string, HeroState>,
  actingHeroId: string,
  action: PlayerAction
): TurnResolution {
  let floor = cloneFloor(inputFloor);
  const heroes: Record<string, HeroState> = {};
  for (const [id, h] of Object.entries(inputHeroes)) {
    heroes[id] = cloneHero(h);
  }
  const hero = heroes[actingHeroId];
  const events: CombatEvent[] = [];
  const logs: string[] = [];
  const killsThisTurn: string[] = [];
  const sfx: string[] = [];
  let goldGained = 0;
  let floorChanged = false;
  let regionCleared = false;

  const rng = new SeededRng(floor.seed + floor.turnNumber * 131 + hero.x * 17 + hero.y * 31);

  if (!hero || !hero.alive) {
    return {
      floor,
      heroes,
      events,
      logs,
      floorChanged,
      regionCleared,
      heroDied: false,
      killsThisTurn,
      goldGained,
      sfx,
    };
  }

  // Non-turn-consuming management actions
  if (action.type === 'allocate_stat') {
    if (hero.unspentPoints > 0) {
      hero.stats[action.stat as keyof HeroStats] += 1;
      hero.unspentPoints -= 1;
      const synced = syncHeroCaps(hero);
      synced.hp = Math.min(synced.maxHp, synced.hp + 5);
      synced.mp = Math.min(synced.maxMp, synced.mp + 3);
      heroes[actingHeroId] = synced;
      sfx.push('loot');
    }
    return { floor, heroes, events, logs, floorChanged, regionCleared, heroDied: false, killsThisTurn, goldGained, sfx };
  }

  if (action.type === 'equip_item') {
    const idx = hero.inventory.findIndex((i) => i.id === action.itemId);
    if (idx >= 0) {
      const item = hero.inventory[idx];
      if (item.slot !== 'consumable') {
        const prev = hero.equipment[item.slot];
        hero.equipment[item.slot] = item;
        hero.inventory.splice(idx, 1);
        if (prev) hero.inventory.push(prev);
        heroes[actingHeroId] = syncHeroCaps(hero);
        sfx.push('equip');
        logs.push(`${hero.name} equipped ${item.name}.`);
      }
    }
    return { floor, heroes, events, logs, floorChanged, regionCleared, heroDied: false, killsThisTurn, goldGained, sfx };
  }

  if (action.type === 'unequip_slot') {
    const prev = hero.equipment[action.slot];
    if (prev && hero.inventory.length < 20) {
      hero.equipment[action.slot] = null;
      hero.inventory.push(prev);
      heroes[actingHeroId] = syncHeroCaps(hero);
      sfx.push('equip');
    }
    return { floor, heroes, events, logs, floorChanged, regionCleared, heroDied: false, killsThisTurn, goldGained, sfx };
  }

  if (action.type === 'salvage_item') {
    const idx = hero.inventory.findIndex((i) => i.id === action.itemId);
    if (idx >= 0) {
      const [item] = hero.inventory.splice(idx, 1);
      const val = Math.max(4, Math.round(item.value * 0.55));
      hero.gold += val;
      hero.shards += item.rarity === 'epic' || item.rarity === 'relic' ? 2 : item.rarity === 'rare' ? 1 : 0;
      goldGained += val;
      sfx.push('salvage');
      logs.push(`Salvaged ${item.name} for ${val} Gold.`);
    }
    return { floor, heroes, events, logs, floorChanged, regionCleared, heroDied: false, killsThisTurn, goldGained, sfx };
  }

  if (action.type === 'drop_item') {
    const idx = hero.inventory.findIndex((i) => i.id === action.itemId);
    if (idx >= 0) {
      const [item] = hero.inventory.splice(idx, 1);
      floor.loot.push({ id: makeId('loot'), x: hero.x, y: hero.y, item, gold: 0 });
      sfx.push('door');
    }
    return { floor, heroes, events, logs, floorChanged, regionCleared, heroDied: false, killsThisTurn, goldGained, sfx };
  }

  // Turn-consuming actions start here
  let consumedTurn = false;
  const derived = getHeroDerivedStats(hero);

  if (action.type === 'use_item') {
    const idx = hero.inventory.findIndex((i) => i.id === action.itemId);
    if (idx >= 0) {
      const item = hero.inventory[idx];
      if (item.slot === 'consumable') {
        hero.inventory.splice(idx, 1);
        if (item.healHp) {
          const prev = hero.hp;
          hero.hp = Math.min(derived.maxHp, hero.hp + item.healHp);
          const gained = hero.hp - prev;
          events.push({ id: makeId('evt'), type: 'heal', x: hero.x, y: hero.y, text: `+${gained} HP`, color: '#34d399', ts: Date.now() });
          logs.push(`${hero.name} drank ${item.name} (+${gained} HP).`);
        }
        if (item.healMp) {
          const prev = hero.mp;
          hero.mp = Math.min(derived.maxMp, hero.mp + item.healMp);
          const gained = hero.mp - prev;
          events.push({ id: makeId('evt'), type: 'heal', x: hero.x, y: hero.y, text: `+${gained} MP`, color: '#38bdf8', ts: Date.now() });
          logs.push(`${hero.name} used ${item.name} (+${gained} MP).`);
        }
        if (item.buffShield) {
          hero.buffs.shieldTurns += item.buffShield;
          events.push({ id: makeId('evt'), type: 'heal', x: hero.x, y: hero.y, text: 'WARDED', color: '#fbbf24', ts: Date.now() });
          logs.push(`${hero.name} activated Stoneward (+50% DEF).`);
        }
        sfx.push('heal');
        consumedTurn = true;
      }
    }
  } else if (action.type === 'wait') {
    hero.mp = Math.min(derived.maxMp, hero.mp + 1);
    consumedTurn = true;
  } else if (action.type === 'revive_ally') {
    const ally = heroes[action.targetHeroId];
    if (ally && !ally.alive && Math.abs(ally.x - hero.x) <= 1 && Math.abs(ally.y - hero.y) <= 1) {
      ally.alive = true;
      ally.hp = Math.max(10, Math.round(ally.maxHp * 0.45));
      events.push({ id: makeId('evt'), type: 'heal', x: ally.x, y: ally.y, text: 'REVIVED!', color: '#34d399', ts: Date.now() });
      logs.push(`${hero.name} revived ${ally.name}!`);
      sfx.push('heal');
      consumedTurn = true;
    }
  } else if (action.type === 'descend') {
    const tile = floor.tiles[hero.y][hero.x];
    if (tile === 'stairs_down') {
      if (!floor.exitUnlocked) {
        logs.push('Defeat the Region Boss to unseal the sanctum portal!');
        sfx.push('miss');
      } else if (floor.depth < floor.maxDepth) {
        const nextDepth = floor.depth + 1;
        floor = generateDungeonFloor(floor.regionId, nextDepth, floor.seed, hero.level);
        const startRoom = floor.rooms[0];
        let offset = 0;
        for (const h of Object.values(heroes)) {
          h.x = startRoom.cx + (offset % 2);
          h.y = startRoom.cy + Math.floor(offset / 2);
          if (!h.alive) {
            h.alive = true;
            h.hp = Math.max(10, Math.round(h.maxHp * 0.5));
          }
          offset++;
        }
        floor.visibility = computeFOV(floor, Object.values(heroes));
        floorChanged = true;
        sfx.push('stairs');
        logs.push(`Descended to Floor B${nextDepth} of ${REGIONS[floor.regionId].name}.`);
        return { floor, heroes, events, logs, floorChanged, regionCleared, heroDied: false, killsThisTurn, goldGained, sfx };
      } else {
        regionCleared = true;
        sfx.push('victory');
        logs.push(`Conquered ${REGIONS[floor.regionId].name}!`);
        return { floor, heroes, events, logs, floorChanged, regionCleared, heroDied: false, killsThisTurn, goldGained, sfx };
      }
    }
  } else if (action.type === 'move') {
    const nx = hero.x + action.dx;
    const ny = hero.y + action.dy;
    if (action.dx < 0) hero.facing = 'left';
    if (action.dx > 0) hero.facing = 'right';

    if (nx >= 0 && nx < floor.width && ny >= 0 && ny < floor.height) {
      const targetMonster = floor.monsters.find((m) => m.x === nx && m.y === ny);
      const otherAlly = Object.values(heroes).find((h) => h.id !== hero.id && h.alive && h.x === nx && h.y === ny);
      const deadAlly = Object.values(heroes).find((h) => h.id !== hero.id && !h.alive && h.x === nx && h.y === ny);

      if (deadAlly) {
        deadAlly.alive = true;
        deadAlly.hp = Math.max(10, Math.round(deadAlly.maxHp * 0.45));
        events.push({ id: makeId('evt'), type: 'heal', x: deadAlly.x, y: deadAlly.y, text: 'REVIVED!', color: '#34d399', ts: Date.now() });
        logs.push(`${hero.name} revived ${deadAlly.name}!`);
        sfx.push('heal');
        consumedTurn = true;
      } else if (targetMonster) {
        attackMonster(hero, targetMonster, 1.0, floor, events, logs, killsThisTurn, sfx, rng);
        consumedTurn = true;
      } else if (!otherAlly) {
        const tile = floor.tiles[ny][nx];
        if (tile === 'door_closed') {
          floor.tiles[ny][nx] = 'door_open';
          sfx.push('door');
          events.push({ id: makeId('evt'), type: 'door', x: nx, y: ny, text: 'OPEN', color: '#94a3b8', ts: Date.now() });
          consumedTurn = true;
        } else if (tile === 'crate') {
          floor.tiles[ny][nx] = 'floor';
          sfx.push('crate');
          if (rng.chance(0.55)) {
            const g = rng.int(5, 14);
            floor.loot.push({
              id: makeId('loot'),
              x: nx,
              y: ny,
              item: rng.chance(0.32) ? generateLootItem(Math.max(1, hero.level), rng) : null,
              gold: g,
            });
          }
          events.push({ id: makeId('evt'), type: 'damage', x: nx, y: ny, text: 'SMASH', color: '#d97706', ts: Date.now() });
          consumedTurn = true;
        } else if (tile === 'chest') {
          floor.tiles[ny][nx] = 'floor';
          const lootLevel = Math.max(1, hero.level + REGIONS[floor.regionId].baseDanger - 1);
          const rarity = rng.chance(0.25) ? 'epic' : rng.chance(0.55) ? 'rare' : 'uncommon';
          const item = generateLootItem(lootLevel, rng, rarity);
          const gold = rng.int(18, 36);
          floor.loot.push({ id: makeId('loot'), x: nx, y: ny, item, gold });
          sfx.push('chest');
          events.push({ id: makeId('evt'), type: 'loot', x: nx, y: ny, text: 'TREASURE!', color: '#fbbf24', ts: Date.now() });
          logs.push(`${hero.name} unlocked a chest!`);
          consumedTurn = true;
        } else if (isWalkableTile(tile)) {
          hero.x = nx;
          hero.y = ny;
          sfx.push('step');
          consumedTurn = true;

          // Tile triggers
          if (tile === 'shrine') {
            const sk = `${nx},${ny}`;
            if (!floor.shrinesUsed.includes(sk)) {
              floor.shrinesUsed.push(sk);
              hero.hp = derived.maxHp;
              hero.mp = derived.maxMp;
              hero.buffs.shieldTurns += 4;
              events.push({ id: makeId('evt'), type: 'heal', x: nx, y: ny, text: 'BLESSED', color: '#38bdf8', ts: Date.now() });
              logs.push(`${hero.name} prayed at a Sanctuary Shrine (Full HP/MP + Ward).`);
              sfx.push('shrine');
            }
          } else if (tile === 'trap_spike' || tile === 'trap_fire') {
            const trapDmg = Math.max(3, Math.round(4 + floor.depth * 2 + REGIONS[floor.regionId].baseDanger * 2));
            hero.hp = Math.max(0, hero.hp - trapDmg);
            floor.tiles[ny][nx] = 'floor';
            events.push({ id: makeId('evt'), type: 'trap', x: nx, y: ny, text: `-${trapDmg}`, color: '#f87171', ts: Date.now() });
            logs.push(`${hero.name} triggered a ${tile === 'trap_fire' ? 'fire' : 'spike'} trap (-${trapDmg} HP)!`);
            sfx.push('trap');
          }

          // Pick up ground loot automatically
          const lootIdx = floor.loot.findIndex((l) => l.x === nx && l.y === ny);
          if (lootIdx >= 0) {
            const drop = floor.loot[lootIdx];
            let pickedAll = true;
            if (drop.gold > 0) {
              hero.gold += drop.gold;
              goldGained += drop.gold;
              events.push({ id: makeId('evt'), type: 'loot', x: nx, y: ny, text: `+${drop.gold}g`, color: '#fbbf24', ts: Date.now() });
              drop.gold = 0;
            }
            if (drop.item) {
              if (hero.inventory.length < 20) {
                hero.inventory.push(drop.item);
                logs.push(`${hero.name} picked up ${drop.item.name}.`);
                events.push({ id: makeId('evt'), type: 'loot', x: nx, y: ny, text: drop.item.name, color: '#fbbf24', ts: Date.now() });
                drop.item = null;
              } else {
                pickedAll = false;
                logs.push(`Inventory full! Salvage or drop an item to pick up ${drop.item.name}.`);
              }
            }
            if (pickedAll) floor.loot.splice(lootIdx, 1);
            sfx.push('loot');
          }
        }
      }
    }
  } else if (action.type === 'skill') {
    const skill = hero.skills[action.skillIndex];
    if (skill && skill.currentCooldown === 0 && hero.mp >= skill.mpCost) {
      const res = executeHeroSkill(hero, skill, floor, action.targetX, action.targetY, events, logs, killsThisTurn, sfx, rng);
      if (res) {
        hero.mp -= skill.mpCost;
        skill.currentCooldown = skill.cooldown;
        consumedTurn = true;
      }
    } else if (skill) {
      logs.push(skill.currentCooldown > 0 ? `${skill.name} is on cooldown (${skill.currentCooldown}t).` : `Not enough MP for ${skill.name}.`);
      sfx.push('miss');
    }
  }

  if (!consumedTurn) {
    return { floor, heroes, events, logs, floorChanged, regionCleared, heroDied: false, killsThisTurn, goldGained, sfx };
  }

  // Cleanup dead monsters & award XP / Loot
  const survivors: Monster[] = [];
  for (const m of floor.monsters) {
    if (m.hp <= 0) {
      killsThisTurn.push(m.templateId);
      addXp(hero, m.xpReward, events, logs, sfx);
      const dropChance = m.isBoss ? 1.0 : 0.42;
      const lootLevel = Math.max(1, hero.level + REGIONS[floor.regionId].baseDanger - 1);
      const item = rng.chance(dropChance)
        ? generateLootItem(lootLevel, rng, m.isBoss ? (rng.chance(0.45) ? 'relic' : 'epic') : undefined)
        : null;
      floor.loot.push({
        id: makeId('loot'),
        x: m.x,
        y: m.y,
        item,
        gold: m.goldReward,
      });
      if (m.isBoss) {
        floor.bossDefeated = true;
        floor.exitUnlocked = true;
        hero.shards += 4;
        events.push({ id: makeId('evt'), type: 'level', x: m.x, y: m.y, text: 'BOSS SLAIN!', color: '#fbbf24', ts: Date.now() });
        logs.push(`${m.name} has fallen! The sanctum portal is now unsealed!`);
        sfx.push('victory');
      }
    } else {
      survivors.push(m);
    }
  }
  floor.monsters = survivors;

  // Tick hero buffs, cooldowns, passive regen
  for (const sk of hero.skills) {
    if (sk.currentCooldown > 0) sk.currentCooldown -= 1;
  }
  if (hero.buffs.shieldTurns > 0) {
    hero.buffs.shieldTurns -= 1;
    if (hero.classId === 'warden') {
      hero.hp = Math.min(derived.maxHp, hero.hp + 2);
    }
  }
  if (hero.buffs.stealthTurns > 0) hero.buffs.stealthTurns -= 1;
  if (hero.buffs.poisonTurns > 0) {
    hero.buffs.poisonTurns -= 1;
    hero.hp = Math.max(0, hero.hp - 2);
    sfx.push('poison');
    events.push({ id: makeId('evt'), type: 'damage', x: hero.x, y: hero.y, text: '-2 PSN', color: '#a3e635', ts: Date.now() });
  }
  if (floor.turnNumber % 3 === 0 && hero.hp > 0) {
    hero.mp = Math.min(derived.maxMp, hero.mp + 1);
  }

  // Recompute FOV before monster AI
  const aliveHeroes = Object.values(heroes).filter((h) => h.alive);
  floor.visibility = computeFOV(floor, aliveHeroes);

  // Monster & Boss AI Turn
  runMonsterTurns(floor, heroes, events, logs, sfx, rng);

  // Check hero death
  let heroDied = false;
  for (const h of Object.values(heroes)) {
    if (h.hp <= 0 && h.alive) {
      h.hp = 0;
      h.alive = false;
      heroDied = h.id === actingHeroId;
      events.push({ id: makeId('evt'), type: 'damage', x: h.x, y: h.y, text: 'FALLEN', color: '#ef4444', ts: Date.now() });
      logs.push(`${h.name} was slain in the depths!`);
      sfx.push('death');
    }
  }

  floor.turnNumber += 1;
  floor.visibility = computeFOV(floor, Object.values(heroes).filter((h) => h.alive));

  return {
    floor,
    heroes,
    events,
    logs,
    floorChanged,
    regionCleared,
    heroDied,
    killsThisTurn,
    goldGained,
    sfx,
  };
}

function attackMonster(
  hero: HeroState,
  monster: Monster,
  scale: number,
  _floor: DungeonFloor,
  events: CombatEvent[],
  logs: string[],
  _kills: string[],
  sfx: string[],
  rng: SeededRng,
  bonusPoison = 0,
  bonusStun = 0
) {
  const derived = getHeroDerivedStats(hero);
  const guaranteedCrit = hero.buffs.stealthTurns > 0;
  const isCrit = guaranteedCrit || rng.chance(derived.critChance / 100);
  const raw = derived.atk * scale * (0.9 + rng.next() * 0.2);
  const dmg = Math.max(1, Math.round((isCrit ? raw * 1.65 : raw) - monster.def * 0.55));
  monster.hp = Math.max(0, monster.hp - dmg);
  monster.alerted = true;

  if (bonusPoison > 0) monster.poisonTurns = Math.max(monster.poisonTurns, bonusPoison);
  if (bonusStun > 0) monster.stunTurns = Math.max(monster.stunTurns, bonusStun);

  events.push({
    id: makeId('evt'),
    type: isCrit ? 'crit' : 'damage',
    x: monster.x,
    y: monster.y,
    text: isCrit ? `CRIT -${dmg}!` : `-${dmg}`,
    color: isCrit ? '#fbbf24' : '#f8fafc',
    ts: Date.now(),
  });
  logs.push(`${hero.name} hit ${monster.name} for ${dmg}${isCrit ? ' (CRIT)' : ''}.`);
  sfx.push(isCrit ? 'crit' : 'hit');
}

function executeHeroSkill(
  hero: HeroState,
  skill: HeroState['skills'][number],
  floor: DungeonFloor,
  targetX: number | undefined,
  targetY: number | undefined,
  events: CombatEvent[],
  logs: string[],
  kills: string[],
  sfx: string[],
  rng: SeededRng
): boolean {
  const derived = getHeroDerivedStats(hero);
  const spellBonus = hero.classId === 'arcanist' ? derived.spellPower : 1;

  if (skill.effect === 'bulwark') {
    hero.buffs.shieldTurns += 4;
    hero.hp = Math.min(derived.maxHp, hero.hp + 6);
    events.push({ id: makeId('evt'), type: 'heal', x: hero.x, y: hero.y, text: 'BULWARK!', color: '#fbbf24', ts: Date.now() });
    logs.push(`${hero.name} raised Iron Bulwark!`);
    sfx.push('heal');
    return true;
  }

  if (skill.effect === 'smoke') {
    hero.buffs.stealthTurns += 3;
    events.push({ id: makeId('evt'), type: 'heal', x: hero.x, y: hero.y, text: 'VEIL', color: '#34d399', ts: Date.now() });
    logs.push(`${hero.name} vanished into Smoke Veil!`);
    sfx.push('spell');
    return true;
  }

  if (skill.effect === 'cleave' || skill.effect === 'nova') {
    const rad = skill.radius || 1;
    const targets = floor.monsters.filter(
      (m) => Math.abs(m.x - hero.x) <= rad && Math.abs(m.y - hero.y) <= rad
    );
    if (targets.length === 0) {
      logs.push(`No enemies within ${rad} tile(s) for ${skill.name}.`);
      sfx.push('miss');
      return false;
    }
    for (const m of targets) {
      attackMonster(hero, m, skill.damageScale * spellBonus, floor, events, logs, kills, sfx, rng);
      if (skill.effect === 'nova') m.slowTurns = Math.max(m.slowTurns, 3);
    }
    sfx.push(skill.effect === 'nova' ? 'spell' : 'crit');
    return true;
  }

  // Single-target or ranged skills: pick specified target or nearest visible enemy in range
  const visibleMonsters = floor.monsters
    .filter((m) => floor.visibility[m.y]?.[m.x] === 2)
    .map((m) => ({
      m,
      dist: Math.max(Math.abs(m.x - hero.x), Math.abs(m.y - hero.y)),
    }))
    .filter((entry) => entry.dist <= skill.range)
    .sort((a, b) => a.dist - b.dist);

  let chosen: Monster | undefined;
  if (targetX !== undefined && targetY !== undefined) {
    chosen = visibleMonsters.find((v) => v.m.x === targetX && v.m.y === targetY)?.m;
  }
  if (!chosen) chosen = visibleMonsters[0]?.m;

  if (!chosen) {
    logs.push(`No sighted target in range (${skill.range}) for ${skill.name}.`);
    sfx.push('miss');
    return false;
  }

  if (skill.effect === 'bash') {
    attackMonster(hero, chosen, skill.damageScale, floor, events, logs, kills, sfx, rng, 0, 2);
  } else if (skill.effect === 'shiv') {
    attackMonster(hero, chosen, skill.damageScale, floor, events, logs, kills, sfx, rng, 4, 0);
  } else if (skill.effect === 'dash') {
    // Move adjacent to chosen if open tile exists
    const adj = [
      [chosen.x - 1, chosen.y],
      [chosen.x + 1, chosen.y],
      [chosen.x, chosen.y - 1],
      [chosen.x, chosen.y + 1],
    ].find(([ax, ay]) => isWalkableTile(floor.tiles[ay]?.[ax]) && !floor.monsters.some((m) => m.x === ax && m.y === ay));
    if (adj) {
      hero.x = adj[0];
      hero.y = adj[1];
    }
    attackMonster(hero, chosen, skill.damageScale, floor, events, logs, kills, sfx, rng);
    sfx.push('spell');
  } else if (skill.effect === 'bolt') {
    attackMonster(hero, chosen, skill.damageScale * spellBonus, floor, events, logs, kills, sfx, rng);
    sfx.push('spell');
  } else if (skill.effect === 'meteor') {
    const cx = chosen.x;
    const cy = chosen.y;
    const hitList = floor.monsters.filter((m) => Math.abs(m.x - cx) <= 1 && Math.abs(m.y - cy) <= 1);
    for (const m of hitList) {
      attackMonster(hero, m, skill.damageScale * spellBonus, floor, events, logs, kills, sfx, rng);
    }
    events.push({ id: makeId('evt'), type: 'boss_slam', x: cx, y: cy, text: 'METEOR!', color: '#fb923c', ts: Date.now() });
    sfx.push('bossSlam');
  }

  return true;
}

function runMonsterTurns(
  floor: DungeonFloor,
  heroes: Record<string, HeroState>,
  events: CombatEvent[],
  logs: string[],
  sfx: string[],
  rng: SeededRng
) {
  const aliveHeroes = Object.values(heroes).filter((h) => h.alive);
  if (aliveHeroes.length === 0) return;

  for (const m of floor.monsters) {
    if (m.hp <= 0) continue;

    // Poison tick
    if (m.poisonTurns > 0) {
      m.poisonTurns -= 1;
      const pdmg = Math.max(2, Math.round(m.maxHp * 0.08));
      m.hp = Math.max(0, m.hp - pdmg);
      events.push({ id: makeId('evt'), type: 'damage', x: m.x, y: m.y, text: `-${pdmg} PSN`, color: '#a3e635', ts: Date.now() });
      if (m.hp <= 0) continue;
    }

    if (m.stunTurns > 0) {
      m.stunTurns -= 1;
      events.push({ id: makeId('evt'), type: 'info', x: m.x, y: m.y, text: 'STUN', color: '#fbbf24', ts: Date.now() });
      continue;
    }

    if (m.slowTurns > 0) {
      m.slowTurns -= 1;
      if (floor.turnNumber % 2 === 0) continue;
    }

    // Execute any telegraphed boss AoE from last turn!
    if (m.telegraphTiles.length > 0) {
      for (const tt of m.telegraphTiles) {
        for (const h of aliveHeroes) {
          if (h.x === tt.x && h.y === tt.y) {
            const hd = getHeroDerivedStats(h);
            const dmg = Math.max(3, Math.round(tt.damage - hd.def * 0.45));
            h.hp = Math.max(0, h.hp - dmg);
            events.push({ id: makeId('evt'), type: 'boss_slam', x: h.x, y: h.y, text: `-${dmg} ${tt.label}`, color: '#ef4444', ts: Date.now() });
            logs.push(`${m.name}'s ${tt.label} struck ${h.name} for ${dmg} DMG!`);
          }
        }
      }
      if (m.telegraphTiles.length > 0) {
        const c = m.telegraphTiles[0];
        events.push({ id: makeId('evt'), type: 'boss_slam', x: c.x, y: c.y, text: 'SLAM!', color: '#fb7185', ts: Date.now() });
        sfx.push('bossSlam');
      }
      m.telegraphTiles = [];
      continue;
    }

    const isVisible = floor.visibility[m.y]?.[m.x] === 2;
    if (isVisible) m.alerted = true;
    if (!m.alerted) continue;

    // Pick nearest alive hero
    const target = [...aliveHeroes].sort(
      (a, b) => Math.abs(a.x - m.x) + Math.abs(a.y - m.y) - (Math.abs(b.x - m.x) + Math.abs(b.y - m.y))
    )[0];
    if (!target) continue;

    const manhattan = Math.abs(target.x - m.x) + Math.abs(target.y - m.y);
    const chebyshev = Math.max(Math.abs(target.x - m.x), Math.abs(target.y - m.y));

    // Boss phase transition + telegraphed AoE
    if (m.isBoss) {
      if (m.hp < m.maxHp * 0.5 && m.bossPhase === 1) {
        m.bossPhase = 2;
        events.push({ id: makeId('evt'), type: 'boss_warn', x: m.x, y: m.y, text: 'ENRAGED!', color: '#f43f5e', ts: Date.now() });
        logs.push(`${m.name} enters Phase II!`);
      }
      if (m.cooldown > 0) m.cooldown -= 1;
      if (m.cooldown === 0 && chebyshev <= 4) {
        // Lay down telegraphed crimson AoE tiles around the target hero or boss
        const tiles: { x: number; y: number; damage: number; label: string }[] = [];
        const label = m.bossPhase === 2 ? 'DOOM NOVA' : 'CRUSH';
        const dmg = Math.round(m.atk * (m.bossPhase === 2 ? 1.8 : 1.45));
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const tx = target.x + dx;
            const ty = target.y + dy;
            if (isWalkableTile(floor.tiles[ty]?.[tx])) {
              tiles.push({ x: tx, y: ty, damage: dmg, label });
            }
          }
        }
        m.telegraphTiles = tiles;
        m.cooldown = m.bossPhase === 2 ? 2 : 3;
        events.push({ id: makeId('evt'), type: 'boss_warn', x: m.x, y: m.y, text: 'TELEGRAPH!', color: '#fb7185', ts: Date.now() });
        logs.push(`${m.name} charges ${label}! Step out of the crimson runes!`);
        sfx.push('bossWarn');
        continue;
      }
    }

    // Ranged monsters (cultist, alchemist, imp, boss_malakor)
    const isRanged = m.templateId === 'cultist' || m.templateId === 'alchemist' || m.templateId === 'imp';
    if (manhattan === 1 || (isRanged && chebyshev <= 4 && isVisible)) {
      const hd = getHeroDerivedStats(target);
      if (rng.chance(hd.dodgeChance / 100)) {
        events.push({ id: makeId('evt'), type: 'miss', x: target.x, y: target.y, text: 'DODGE', color: '#94a3b8', ts: Date.now() });
        logs.push(`${target.name} dodged ${m.name}'s attack.`);
        sfx.push('miss');
      } else {
        const dmg = Math.max(1, Math.round(m.atk * (0.85 + rng.next() * 0.3) - hd.def * 0.5));
        target.hp = Math.max(0, target.hp - dmg);
        events.push({ id: makeId('evt'), type: 'damage', x: target.x, y: target.y, text: `-${dmg}`, color: '#ef4444', ts: Date.now() });
        logs.push(`${m.name} hit ${target.name} for ${dmg} DMG.`);
        sfx.push('hit');
        if (m.templateId === 'alchemist' && rng.chance(0.35)) {
          target.buffs.poisonTurns = Math.max(target.buffs.poisonTurns, 3);
        }
      }
      continue;
    }

    // Step toward nearest hero
    const stepCandidates: [number, number][] = [];
    const dx = Math.sign(target.x - m.x);
    const dy = Math.sign(target.y - m.y);
    if (Math.abs(target.x - m.x) >= Math.abs(target.y - m.y)) {
      if (dx !== 0) stepCandidates.push([m.x + dx, m.y]);
      if (dy !== 0) stepCandidates.push([m.x, m.y + dy]);
    } else {
      if (dy !== 0) stepCandidates.push([m.x, m.y + dy]);
      if (dx !== 0) stepCandidates.push([m.x + dx, m.y]);
    }

    for (const [sx, sy] of stepCandidates) {
      const tile = floor.tiles[sy]?.[sx];
      if (!tile || !isWalkableTile(tile) || tile === 'door_closed') continue;
      if (floor.monsters.some((other) => other.id !== m.id && other.x === sx && other.y === sy)) continue;
      if (aliveHeroes.some((h) => h.x === sx && h.y === sy)) continue;
      m.x = sx;
      m.y = sy;
      break;
    }
  }
}

export function createCampRegionFloor(regionId: RegionId, heroLevel: number, seed = Date.now()): DungeonFloor {
  return generateDungeonFloor(regionId, 1, seed, heroLevel);
}

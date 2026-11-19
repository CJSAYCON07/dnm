export type HeroClassId = 'warden' | 'stalker' | 'arcanist';

export type RegionId = 'catacombs' | 'fungal_keep' | 'obsidian_forge' | 'ashen_citadel';

export type TileType =
  | 'void'
  | 'wall'
  | 'floor'
  | 'corridor'
  | 'door_closed'
  | 'door_open'
  | 'stairs_down'
  | 'stairs_up'
  | 'shrine'
  | 'trap_spike'
  | 'trap_fire'
  | 'chest'
  | 'crate'
  | 'water'
  | 'lava';

export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'relic';

export type EquipSlot = 'weapon' | 'offhand' | 'armor' | 'helm' | 'ring';
export type ItemSlot = EquipSlot | 'consumable';

export interface Item {
  id: string;
  name: string;
  slot: ItemSlot;
  spriteKey: string;
  rarity: Rarity;
  level: number;
  atk: number;
  def: number;
  hpBonus: number;
  mpBonus: number;
  critBonus: number;
  dodgeBonus: number;
  healHp?: number;
  healMp?: number;
  buffShield?: number;
  value: number;
  description: string;
}

export type SkillEffect =
  | 'cleave'
  | 'bash'
  | 'bulwark'
  | 'shiv'
  | 'dash'
  | 'smoke'
  | 'bolt'
  | 'nova'
  | 'meteor';

export interface Skill {
  id: string;
  name: string;
  keyHint: string;
  mpCost: number;
  cooldown: number;
  currentCooldown: number;
  range: number;
  radius: number;
  damageScale: number;
  effect: SkillEffect;
  description: string;
}

export interface HeroStats {
  vitality: number;
  might: number;
  agility: number;
  arcana: number;
}

export interface HeroBuffs {
  shieldTurns: number;
  stealthTurns: number;
  poisonTurns: number;
}

export interface HeroState {
  id: string;
  name: string;
  classId: HeroClassId;
  level: number;
  xp: number;
  xpToNext: number;
  unspentPoints: number;
  stats: HeroStats;
  hp: number;
  maxHp: number;
  mp: number;
  maxMp: number;
  gold: number;
  shards: number;
  x: number;
  y: number;
  facing: 'left' | 'right';
  equipment: Record<EquipSlot, Item | null>;
  inventory: Item[];
  skills: Skill[];
  buffs: HeroBuffs;
  alive: boolean;
}

export interface TelegraphTile {
  x: number;
  y: number;
  damage: number;
  label: string;
}

export interface Monster {
  id: string;
  templateId: string;
  name: string;
  spriteKey: string;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  atk: number;
  def: number;
  xpReward: number;
  goldReward: number;
  isBoss: boolean;
  bossPhase: number;
  alerted: boolean;
  telegraphTiles: TelegraphTile[];
  stunTurns: number;
  poisonTurns: number;
  slowTurns: number;
  cooldown: number;
}

export interface GroundLoot {
  id: string;
  x: number;
  y: number;
  item: Item | null;
  gold: number;
}

export interface Room {
  id: number;
  x: number;
  y: number;
  w: number;
  h: number;
  cx: number;
  cy: number;
  kind: 'start' | 'normal' | 'treasure' | 'shrine' | 'boss';
}

export interface DungeonFloor {
  width: number;
  height: number;
  regionId: RegionId;
  depth: number;
  maxDepth: number;
  seed: number;
  tiles: TileType[][];
  visibility: number[][]; // 0 = unseen, 1 = explored, 2 = visible
  rooms: Room[];
  monsters: Monster[];
  loot: GroundLoot[];
  shrinesUsed: string[];
  turnNumber: number;
  bossDefeated: boolean;
  exitUnlocked: boolean;
}

export interface CombatEvent {
  id: string;
  type:
    | 'damage'
    | 'heal'
    | 'crit'
    | 'miss'
    | 'loot'
    | 'level'
    | 'boss_warn'
    | 'boss_slam'
    | 'door'
    | 'trap'
    | 'info';
  x: number;
  y: number;
  text: string;
  color: string;
  ts: number;
}

export interface WorldProgress {
  unlockedRegions: RegionId[];
  clearedRegions: RegionId[];
  bossesDefeated: string[];
  bestDepthByRegion: Record<RegionId, number>;
  totalKills: number;
  totalGoldEarned: number;
}

export interface GameSettings {
  muted: boolean;
  showDpad: boolean;
  tapToMove: boolean;
}

export interface SaveProfile {
  version: 1;
  updatedAt: number;
  hero: HeroState;
  worldProgress: WorldProgress;
  stash: Item[];
  bestiary: Record<string, number>;
  activeRun: DungeonFloor | null;
  settings: GameSettings;
}

export type PlayerAction =
  | { type: 'move'; dx: number; dy: number }
  | { type: 'wait' }
  | { type: 'skill'; skillIndex: number; targetX?: number; targetY?: number }
  | { type: 'use_item'; itemId: string }
  | { type: 'equip_item'; itemId: string }
  | { type: 'unequip_slot'; slot: EquipSlot }
  | { type: 'salvage_item'; itemId: string }
  | { type: 'drop_item'; itemId: string }
  | { type: 'allocate_stat'; stat: keyof HeroStats }
  | { type: 'descend' }
  | { type: 'revive_ally'; targetHeroId: string };

export interface LanPeerSummary {
  id: string;
  name: string;
  classId: HeroClassId;
  level: number;
  hp: number;
  maxHp: number;
  x: number;
  y: number;
  alive: boolean;
  isHost: boolean;
  ready: boolean;
}

export interface LanRoomState {
  code: string;
  regionId: RegionId;
  status: 'lobby' | 'playing' | 'victory' | 'gameover';
  hostId: string;
  peers: LanPeerSummary[];
  heroes: Record<string, HeroState>;
  floor: DungeonFloor | null;
  logs: string[];
  events: CombatEvent[];
}

import type {
  HeroClassId,
  HeroState,
  HeroStats,
  Item,
  ItemSlot,
  Monster,
  Rarity,
  RegionId,
  Skill,
  WorldProgress,
} from './types.ts';
import { SeededRng, makeId } from './rng.ts';

export interface HeroClassDef {
  id: HeroClassId;
  name: string;
  title: string;
  description: string;
  baseStats: HeroStats;
  accentColor: string;
  skills: Skill[];
  startingWeapon: Item;
}

export const HERO_CLASSES: Record<HeroClassId, HeroClassDef> = {
  warden: {
    id: 'warden',
    name: 'Iron Warden',
    title: 'Bastion Knight',
    description: 'Armored vanguard excelling at cleave strikes, stuns, and heavy defense.',
    baseStats: { vitality: 7, might: 6, agility: 3, arcana: 2 },
    accentColor: '#f59e0b',
    skills: [
      {
        id: 'sk_cleave',
        name: 'Cleave',
        keyHint: '1',
        mpCost: 4,
        cooldown: 2,
        currentCooldown: 0,
        range: 1,
        radius: 1,
        damageScale: 1.45,
        effect: 'cleave',
        description: 'Sweep your blade to strike all adjacent foes for 145% ATK.',
      },
      {
        id: 'sk_bash',
        name: 'Shield Bash',
        keyHint: '2',
        mpCost: 5,
        cooldown: 3,
        currentCooldown: 0,
        range: 1,
        radius: 0,
        damageScale: 1.25,
        effect: 'bash',
        description: 'Crush the nearest adjacent enemy, dealing 125% ATK and stunning for 2 turns.',
      },
      {
        id: 'sk_bulwark',
        name: 'Iron Bulwark',
        keyHint: '3',
        mpCost: 6,
        cooldown: 5,
        currentCooldown: 0,
        range: 0,
        radius: 0,
        damageScale: 0,
        effect: 'bulwark',
        description: 'Raise a spectral ward (+50% DEF and +6 HP regen) for 4 turns.',
      },
    ],
    startingWeapon: {
      id: 'starter_sword',
      name: 'Tempered Shortsword',
      slot: 'weapon',
      spriteKey: 'item_sword',
      rarity: 'common',
      level: 1,
      atk: 4,
      def: 0,
      hpBonus: 0,
      mpBonus: 0,
      critBonus: 4,
      dodgeBonus: 0,
      value: 18,
      description: 'A sturdy iron blade carried by crypt wardens.',
    },
  },
  stalker: {
    id: 'stalker',
    name: 'Shadow Stalker',
    title: 'Crypt Rogue',
    description: 'Swift assassin blending poison shivs, lethal crits, and smoke evasion.',
    baseStats: { vitality: 4, might: 5, agility: 7, arcana: 2 },
    accentColor: '#10b981',
    skills: [
      {
        id: 'sk_shiv',
        name: 'Venom Shiv',
        keyHint: '1',
        mpCost: 4,
        cooldown: 2,
        currentCooldown: 0,
        range: 2,
        radius: 0,
        damageScale: 1.3,
        effect: 'shiv',
        description: 'Lunge at a foe within 2 tiles for 130% ATK and inflict 4 turns of Poison.',
      },
      {
        id: 'sk_dash',
        name: 'Shadowstep',
        keyHint: '2',
        mpCost: 5,
        cooldown: 3,
        currentCooldown: 0,
        range: 4,
        radius: 0,
        damageScale: 1.4,
        effect: 'dash',
        description: 'Blink beside a sighted enemy up to 4 tiles away and strike for 140% ATK.',
      },
      {
        id: 'sk_smoke',
        name: 'Smoke Veil',
        keyHint: '3',
        mpCost: 6,
        cooldown: 5,
        currentCooldown: 0,
        range: 0,
        radius: 0,
        damageScale: 0,
        effect: 'smoke',
        description: 'Vanish into shadow (+45% Dodge and guaranteed next crit) for 3 turns.',
      },
    ],
    startingWeapon: {
      id: 'starter_dagger',
      name: 'Serrated Dirk',
      slot: 'weapon',
      spriteKey: 'item_dagger',
      rarity: 'common',
      level: 1,
      atk: 3,
      def: 0,
      hpBonus: 0,
      mpBonus: 0,
      critBonus: 10,
      dodgeBonus: 4,
      value: 18,
      description: 'Balanced crypt dagger honed for vital strikes.',
    },
  },
  arcanist: {
    id: 'arcanist',
    name: 'Ember Arcanist',
    title: 'Rune Mage',
    description: 'Ranged spellweaver commanding arcane bolts, frost novas, and meteors.',
    baseStats: { vitality: 4, might: 2, agility: 4, arcana: 8 },
    accentColor: '#38bdf8',
    skills: [
      {
        id: 'sk_bolt',
        name: 'Arcane Bolt',
        keyHint: '1',
        mpCost: 3,
        cooldown: 1,
        currentCooldown: 0,
        range: 5,
        radius: 0,
        damageScale: 1.5,
        effect: 'bolt',
        description: 'Fire a piercing bolt at a sighted foe up to 5 tiles away.',
      },
      {
        id: 'sk_nova',
        name: 'Frost Nova',
        keyHint: '2',
        mpCost: 6,
        cooldown: 3,
        currentCooldown: 0,
        range: 0,
        radius: 2,
        damageScale: 1.15,
        effect: 'nova',
        description: 'Freeze nearby foes within 2 tiles, dealing damage and slowing them for 3 turns.',
      },
      {
        id: 'sk_meteor',
        name: 'Ember Meteor',
        keyHint: '3',
        mpCost: 9,
        cooldown: 5,
        currentCooldown: 0,
        range: 5,
        radius: 1,
        damageScale: 2.1,
        effect: 'meteor',
        description: 'Call down molten ruin on the nearest sighted enemy in a 3x3 blast.',
      },
    ],
    startingWeapon: {
      id: 'starter_staff',
      name: 'Ashwood Wand',
      slot: 'weapon',
      spriteKey: 'item_staff',
      rarity: 'common',
      level: 1,
      atk: 2,
      def: 0,
      hpBonus: 0,
      mpBonus: 8,
      critBonus: 5,
      dodgeBonus: 0,
      value: 18,
      description: 'Charred focus carved from crypt roots.',
    },
  },
};

export interface RegionDef {
  id: RegionId;
  name: string;
  subtitle: string;
  recommendedLevel: string;
  baseDanger: number;
  floors: number;
  bossName: string;
  bossTitle: string;
  unlocks: RegionId[];
  mapPos: { xPct: number; yPct: number };
  palette: {
    floorA: string;
    floorB: string;
    wallTop: string;
    wallFace: string;
    accent: string;
    fogTint: string;
  };
  monsters: string[];
}

export const REGIONS: Record<RegionId, RegionDef> = {
  catacombs: {
    id: 'catacombs',
    name: 'Whispering Catacombs',
    subtitle: 'Moss-draped burial vaults beneath the shattered gate.',
    recommendedLevel: 'Lv 1–3',
    baseDanger: 1,
    floors: 3,
    bossName: 'Vael, Bone Warden',
    bossTitle: 'Oathbound Ossuary Giant',
    unlocks: ['fungal_keep', 'obsidian_forge'],
    mapPos: { xPct: 50, yPct: 72 },
    palette: {
      floorA: '#222631',
      floorB: '#1c202a',
      wallTop: '#454e63',
      wallFace: '#2e3545',
      accent: '#f59e0b',
      fogTint: '#0b0d12',
    },
    monsters: ['skeleton', 'slime', 'spider'],
  },
  fungal_keep: {
    id: 'fungal_keep',
    name: 'Sunken Fungal Keep',
    subtitle: 'Bioluminescent grottos choked with toxic spores.',
    recommendedLevel: 'Lv 3–6',
    baseDanger: 2,
    floors: 3,
    bossName: 'Mycelia, Spore Matriarch',
    bossTitle: 'Blighted Hive Sovereign',
    unlocks: ['ashen_citadel'],
    mapPos: { xPct: 22, yPct: 48 },
    palette: {
      floorA: '#17292a',
      floorB: '#122122',
      wallTop: '#2d5355',
      wallFace: '#1c3739',
      accent: '#2dd4bf',
      fogTint: '#081213',
    },
    monsters: ['slime', 'spider', 'cultist', 'alchemist'],
  },
  obsidian_forge: {
    id: 'obsidian_forge',
    name: 'Obsidian Forge',
    subtitle: 'Volcanic foundry halls pulsing with molten slag.',
    recommendedLevel: 'Lv 4–7',
    baseDanger: 3,
    floors: 3,
    bossName: 'Ignis, Forge Colossus',
    bossTitle: 'Molten Automaton',
    unlocks: ['ashen_citadel'],
    mapPos: { xPct: 79, yPct: 46 },
    palette: {
      floorA: '#291e1e',
      floorB: '#211717',
      wallTop: '#593c3a',
      wallFace: '#3b2524',
      accent: '#fb7185',
      fogTint: '#110a0a',
    },
    monsters: ['imp', 'golem', 'alchemist', 'cultist'],
  },
  ashen_citadel: {
    id: 'ashen_citadel',
    name: 'Ashen Citadel',
    subtitle: 'High gothic sanctum of the Dread Lich Malakor.',
    recommendedLevel: 'Lv 7–10',
    baseDanger: 4,
    floors: 3,
    bossName: 'Malakor, Dread Lich',
    bossTitle: 'Sovereign of the Crypt',
    unlocks: [],
    mapPos: { xPct: 50, yPct: 25 },
    palette: {
      floorA: '#241f2e',
      floorB: '#1d1826',
      wallTop: '#4c4266',
      wallFace: '#312a45',
      accent: '#c084fc',
      fogTint: '#0c0912',
    },
    monsters: ['wraith', 'golem', 'cultist', 'imp'],
  },
};

export interface MonsterTemplate {
  id: string;
  name: string;
  spriteKey: string;
  habitat: string;
  lore: string;
  baseHp: number;
  baseAtk: number;
  baseDef: number;
  xp: number;
  gold: number;
  isBoss?: boolean;
}

export const MONSTER_TEMPLATES: Record<string, MonsterTemplate> = {
  skeleton: {
    id: 'skeleton',
    name: 'Crypt Skeleton',
    spriteKey: 'mon_skeleton',
    habitat: 'Whispering Catacombs',
    lore: 'Ancient sentries bound to rusting iron blades by Malakor’s earliest funerary oaths. They patrol corridors tirelessly even after their flesh has turned to ash.',
    baseHp: 16,
    baseAtk: 5,
    baseDef: 1,
    xp: 14,
    gold: 6,
  },
  slime: {
    id: 'slime',
    name: 'Acid Slime',
    spriteKey: 'mon_slime',
    habitat: 'Catacombs · Fungal Keep',
    lore: 'Gelatinous scavengers born from alchemy run-off seeping through cracked vault flagstones. Their caustic membrane dulls careless steel.',
    baseHp: 14,
    baseAtk: 4,
    baseDef: 2,
    xp: 12,
    gold: 5,
  },
  spider: {
    id: 'spider',
    name: 'Vault Arachnid',
    spriteKey: 'mon_spider',
    habitat: 'Catacombs · Fungal Keep',
    lore: 'Blind cave-hunters that sense footstep vibrations through silken tripwires spun across burial alcoves. Fragile of shell, yet vicious on the ambush.',
    baseHp: 13,
    baseAtk: 6,
    baseDef: 0,
    xp: 15,
    gold: 7,
  },
  cultist: {
    id: 'cultist',
    name: 'Crypt Cultist',
    spriteKey: 'mon_cultist',
    habitat: 'Fungal Keep · Forge · Citadel',
    lore: 'Sworn acolytes cloaked in crimson who chant cinder hexes from afar, sacrificing their mortal warmth for a seat beneath the Ashen Throne.',
    baseHp: 21,
    baseAtk: 8,
    baseDef: 2,
    xp: 22,
    gold: 11,
  },
  alchemist: {
    id: 'alchemist',
    name: 'Blight Alchemist',
    spriteKey: 'mon_alchemist',
    habitat: 'Fungal Keep · Obsidian Forge',
    lore: 'Exiled apothecaries wearing plague-visors packed with dried spores. They lob volatile green phials that sear armor and linger as venom.',
    baseHp: 22,
    baseAtk: 9,
    baseDef: 2,
    xp: 25,
    gold: 13,
  },
  golem: {
    id: 'golem',
    name: 'Iron Golem',
    spriteKey: 'mon_golem',
    habitat: 'Obsidian Forge · Citadel',
    lore: 'Riveted foundry guardians animated by caged furnace embers. Their heavy plate shrugs off glancing strikes and demands piercing force.',
    baseHp: 34,
    baseAtk: 10,
    baseDef: 5,
    xp: 34,
    gold: 16,
  },
  imp: {
    id: 'imp',
    name: 'Cinder Imp',
    spriteKey: 'mon_imp',
    habitat: 'Obsidian Forge · Citadel',
    lore: 'Cackling ash-spirits hatched inside slag vents. They dart between magma grates to hurl searing sparks at isolated delvers.',
    baseHp: 20,
    baseAtk: 11,
    baseDef: 1,
    xp: 28,
    gold: 14,
  },
  wraith: {
    id: 'wraith',
    name: 'Dread Wraith',
    spriteKey: 'mon_wraith',
    habitat: 'Ashen Citadel',
    lore: 'Hollowed knights of the high sanctum whose souls were distilled into cold violet mist. Their spectral blades chill breath and bone alike.',
    baseHp: 30,
    baseAtk: 13,
    baseDef: 3,
    xp: 40,
    gold: 20,
  },
  boss_catacombs: {
    id: 'boss_catacombs',
    name: 'Vael, Bone Warden',
    spriteKey: 'boss_vael',
    habitat: 'Whispering Catacombs · B3',
    lore: 'Once the mortal gatekeeper of the royal ossuary, Vael fused with fallen defenders into a towering colossus of bone and gilded plate. His telegraphed ground slams shatter stone.',
    baseHp: 105,
    baseAtk: 11,
    baseDef: 3,
    xp: 120,
    gold: 85,
    isBoss: true,
  },
  boss_fungal_keep: {
    id: 'boss_fungal_keep',
    name: 'Mycelia, Spore Matriarch',
    spriteKey: 'boss_mycelia',
    habitat: 'Sunken Fungal Keep · B3',
    lore: 'An ancient bioluminescent sovereign whose roots drank from drowned shrines for centuries. When wounded, she floods the cavern with toxic crimson spore rings.',
    baseHp: 155,
    baseAtk: 14,
    baseDef: 4,
    xp: 185,
    gold: 130,
    isBoss: true,
  },
  boss_obsidian_forge: {
    id: 'boss_obsidian_forge',
    name: 'Ignis, Forge Colossus',
    spriteKey: 'boss_ignis',
    habitat: 'Obsidian Forge · B3',
    lore: 'The masterwork furnace titan forged to smelt relic steel without rest. Its chest crucible erupts in molten shockwaves across the anvil floor.',
    baseHp: 205,
    baseAtk: 17,
    baseDef: 6,
    xp: 240,
    gold: 170,
    isBoss: true,
  },
  boss_ashen_citadel: {
    id: 'boss_ashen_citadel',
    name: 'Malakor, Dread Lich',
    spriteKey: 'boss_malakor',
    habitat: 'Ashen Citadel · B3',
    lore: 'Architect of the Cryptbound curse and keeper of the shattered crown. Commands necrotic storms from his high gothic dais until every intruder turns to cinder.',
    baseHp: 280,
    baseAtk: 21,
    baseDef: 6,
    xp: 400,
    gold: 300,
    isBoss: true,
  },
};

export function spawnMonster(templateId: string, x: number, y: number, scale: number, rng: SeededRng): Monster {
  const tpl = MONSTER_TEMPLATES[templateId] ?? MONSTER_TEMPLATES.skeleton;
  const mult = 1 + (scale - 1) * 0.28;
  const maxHp = Math.round(tpl.baseHp * mult * (0.94 + rng.next() * 0.12));
  return {
    id: makeId('mon'),
    templateId: tpl.id,
    name: tpl.name,
    spriteKey: tpl.spriteKey,
    x,
    y,
    hp: maxHp,
    maxHp,
    atk: Math.round(tpl.baseAtk * (1 + (scale - 1) * 0.22)),
    def: Math.round(tpl.baseDef * (1 + (scale - 1) * 0.18)),
    xpReward: Math.round(tpl.xp * mult),
    goldReward: Math.round(tpl.gold * mult),
    isBoss: Boolean(tpl.isBoss),
    bossPhase: 1,
    alerted: false,
    telegraphTiles: [],
    stunTurns: 0,
    poisonTurns: 0,
    slowTurns: 0,
    cooldown: 0,
  };
}

export const RARITY_CONFIG: Record<
  Rarity,
  { label: string; color: string; border: string; mult: number }
> = {
  common: { label: 'Common', color: '#cbd5e1', border: '#475569', mult: 1.0 },
  uncommon: { label: 'Uncommon', color: '#34d399', border: '#059669', mult: 1.35 },
  rare: { label: 'Rare', color: '#60a5fa', border: '#2563eb', mult: 1.75 },
  epic: { label: 'Epic', color: '#c084fc', border: '#9333ea', mult: 2.25 },
  relic: { label: 'Relic', color: '#fbbf24', border: '#d97706', mult: 2.9 },
};

const WEAPON_NAMES = [
  { name: 'Broadblade', sprite: 'item_sword' },
  { name: 'Crypt Cleaver', sprite: 'item_axe' },
  { name: 'Nightfang Dirk', sprite: 'item_dagger' },
  { name: 'Runed Scepter', sprite: 'item_staff' },
];
const OFFHAND_NAMES = [
  { name: 'Kite Shield', sprite: 'item_shield' },
  { name: 'Aegis Buckler', sprite: 'item_shield' },
  { name: 'Tome of Embers', sprite: 'item_tome' },
];
const ARMOR_NAMES = [
  { name: 'Chain Hauberk', sprite: 'item_armor' },
  { name: 'Vanguard Brigandine', sprite: 'item_armor' },
  { name: 'Shadow Cloak', sprite: 'item_cloak' },
];
const HELM_NAMES = [
  { name: 'Iron Barbute', sprite: 'item_helm' },
  { name: 'Crown of Vigil', sprite: 'item_helm' },
  { name: 'Cowl of Whispers', sprite: 'item_hood' },
];
const RING_NAMES = [
  { name: 'Band of Embers', sprite: 'item_ring' },
  { name: 'Signet of Stone', sprite: 'item_ring' },
  { name: 'Loop of Celerity', sprite: 'item_ring' },
];

const AFFIXES = [
  'of Embers',
  'of Bastion',
  'of Shadows',
  'of the Crypt',
  'of Precision',
  'of Vigor',
  'of Ruin',
];

export function generateLootItem(level: number, rng: SeededRng, forcedRarity?: Rarity): Item {
  const roll = rng.next();
  const rarity: Rarity =
    forcedRarity ??
    (roll > 0.96
      ? 'relic'
      : roll > 0.86
      ? 'epic'
      : roll > 0.65
      ? 'rare'
      : roll > 0.35
      ? 'uncommon'
      : 'common');

  const isConsumable = !forcedRarity && rng.chance(0.28);
  if (isConsumable) {
    const kind = rng.int(0, 2);
    if (kind === 0) {
      const heal = 18 + level * 6;
      return {
        id: makeId('itm'),
        name: level >= 5 ? 'Greater Crimson Vial' : 'Crimson Healing Vial',
        slot: 'consumable',
        spriteKey: 'item_potion_hp',
        rarity: level >= 5 ? 'uncommon' : 'common',
        level,
        atk: 0,
        def: 0,
        hpBonus: 0,
        mpBonus: 0,
        critBonus: 0,
        dodgeBonus: 0,
        healHp: heal,
        value: 14 + level * 4,
        description: `Restores ${heal} HP immediately.`,
      };
    }
    if (kind === 1) {
      const mp = 12 + level * 3;
      return {
        id: makeId('itm'),
        name: 'Azure Mana Draught',
        slot: 'consumable',
        spriteKey: 'item_potion_mp',
        rarity: 'common',
        level,
        atk: 0,
        def: 0,
        hpBonus: 0,
        mpBonus: 0,
        critBonus: 0,
        dodgeBonus: 0,
        healMp: mp,
        value: 12 + level * 3,
        description: `Restores ${mp} MP immediately.`,
      };
    }
    return {
      id: makeId('itm'),
      name: 'Scroll of Stoneward',
      slot: 'consumable',
      spriteKey: 'item_scroll',
      rarity: 'uncommon',
      level,
      atk: 0,
      def: 0,
      hpBonus: 0,
      mpBonus: 0,
      critBonus: 0,
      dodgeBonus: 0,
      buffShield: 5,
      value: 20 + level * 4,
      description: 'Grants +50% Defense ward for 5 turns.',
    };
  }

  const slots: ItemSlot[] = ['weapon', 'offhand', 'armor', 'helm', 'ring'];
  const slot = rng.pick(slots);
  const mult = RARITY_CONFIG[rarity].mult;
  const power = Math.max(1, Math.round((1 + level * 0.9) * mult));
  const affix = rarity === 'common' ? '' : ` ${rng.pick(AFFIXES)}`;

  let base = { name: 'Relic', sprite: 'item_sword' };
  let atk = 0;
  let def = 0;
  let hpBonus = 0;
  let mpBonus = 0;
  let critBonus = 0;
  let dodgeBonus = 0;

  if (slot === 'weapon') {
    base = rng.pick(WEAPON_NAMES);
    atk = Math.max(2, Math.round(power * 1.45));
    critBonus = rarity === 'common' ? 2 : rng.int(4, 10);
  } else if (slot === 'offhand') {
    base = rng.pick(OFFHAND_NAMES);
    def = Math.max(1, Math.round(power * 0.95));
    if (base.sprite === 'item_tome') {
      mpBonus = Math.round(power * 1.5);
      atk = Math.max(1, Math.round(power * 0.4));
    } else {
      hpBonus = Math.round(power * 2.2);
    }
  } else if (slot === 'armor') {
    base = rng.pick(ARMOR_NAMES);
    def = Math.max(2, Math.round(power * 1.1));
    hpBonus = Math.round(power * 3.0);
    if (base.sprite === 'item_cloak') dodgeBonus = rng.int(3, 8);
  } else if (slot === 'helm') {
    base = rng.pick(HELM_NAMES);
    def = Math.max(1, Math.round(power * 0.75));
    hpBonus = Math.round(power * 1.8);
    mpBonus = Math.round(power * 0.8);
  } else {
    base = rng.pick(RING_NAMES);
    atk = Math.max(1, Math.round(power * 0.55));
    critBonus = rng.int(3, 9);
    dodgeBonus = rng.int(2, 6);
  }

  return {
    id: makeId('itm'),
    name: `${RARITY_CONFIG[rarity].label} ${base.name}${affix}`,
    slot,
    spriteKey: base.sprite,
    rarity,
    level,
    atk,
    def,
    hpBonus,
    mpBonus,
    critBonus,
    dodgeBonus,
    value: Math.round((15 + level * 8) * mult),
    description: `${RARITY_CONFIG[rarity].label} Lv.${level} ${slot}.`,
  };
}

export function createNewHero(classId: HeroClassId, name = 'Delver'): HeroState {
  const def = HERO_CLASSES[classId];
  const stats = { ...def.baseStats };
  const maxHp = 32 + stats.vitality * 5;
  const maxMp = 14 + stats.arcana * 3;
  const starterPotion: Item = {
    id: makeId('itm'),
    name: 'Crimson Healing Vial',
    slot: 'consumable',
    spriteKey: 'item_potion_hp',
    rarity: 'common',
    level: 1,
    atk: 0,
    def: 0,
    hpBonus: 0,
    mpBonus: 0,
    critBonus: 0,
    dodgeBonus: 0,
    healHp: 24,
    value: 15,
    description: 'Restores 24 HP immediately.',
  };

  return {
    id: makeId('hero'),
    name: name.trim() || def.name,
    classId,
    level: 1,
    xp: 0,
    xpToNext: 45,
    unspentPoints: 0,
    stats,
    hp: maxHp,
    maxHp,
    mp: maxMp,
    maxMp,
    gold: 40,
    shards: 2,
    x: 0,
    y: 0,
    facing: 'right',
    equipment: {
      weapon: { ...def.startingWeapon, id: makeId('itm') },
      offhand: null,
      armor: null,
      helm: null,
      ring: null,
    },
    inventory: [starterPotion, { ...starterPotion, id: makeId('itm') }],
    skills: def.skills.map((s) => ({ ...s, currentCooldown: 0 })),
    buffs: {
      shieldTurns: 0,
      stealthTurns: 0,
      poisonTurns: 0,
    },
    alive: true,
  };
}

export function createInitialWorldProgress(): WorldProgress {
  return {
    unlockedRegions: ['catacombs'],
    clearedRegions: [],
    bossesDefeated: [],
    bestDepthByRegion: {
      catacombs: 0,
      fungal_keep: 0,
      obsidian_forge: 0,
      ashen_citadel: 0,
    },
    totalKills: 0,
    totalGoldEarned: 0,
  };
}

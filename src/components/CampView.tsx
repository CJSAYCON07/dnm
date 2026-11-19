import React, { useState } from 'react';
import { ArrowLeft, Flame, Hammer, Heart, Package, Sparkles } from 'lucide-react';
import { RARITY_CONFIG, generateLootItem } from '../game/content.ts';
import { getHeroDerivedStats, syncHeroCaps } from '../game/dungeonGen.ts';
import { getSpriteDataUrl } from '../game/pixelSprites.ts';
import { SeededRng, makeId } from '../game/rng.ts';
import { soundEngine } from '../game/audio.ts';
import type { Item, SaveProfile } from '../game/types.ts';
import { BestiaryView } from './BestiaryView.tsx';

interface CampViewProps {
  profile: SaveProfile;
  onUpdateProfile: (next: SaveProfile) => void;
  onBackToMap: () => void;
}

export const CampView: React.FC<CampViewProps> = ({
  profile,
  onUpdateProfile,
  onBackToMap,
}) => {
  const [tab, setTab] = useState<'services' | 'stash' | 'bestiary'>('services');
  const [notice, setNotice] = useState<string>('Rest by the bonfire or prepare gear before your next delve.');
  const hero = profile.hero;
  const derived = getHeroDerivedStats(hero);

  const restAtBonfire = () => {
    const nextHero = { ...hero, hp: derived.maxHp, mp: derived.maxMp, alive: true, buffs: { shieldTurns: 0, stealthTurns: 0, poisonTurns: 0 } };
    onUpdateProfile({ ...profile, hero: nextHero });
    soundEngine.play('heal');
    setNotice('HP and MP fully restored at the Sanctuary Bonfire.');
  };

  const buySupply = (kind: 'hp' | 'mp' | 'scroll') => {
    const cost = kind === 'hp' ? 20 : kind === 'mp' ? 18 : 28;
    if (hero.gold < cost) {
      soundEngine.play('miss');
      setNotice(`Need ${cost} Gold to purchase this supply.`);
      return;
    }
    if (hero.inventory.length >= 20) {
      soundEngine.play('miss');
      setNotice('Backpack is full (20/20). Salvage or stash items first.');
      return;
    }

    const item: Item =
      kind === 'hp'
        ? {
            id: makeId('itm'),
            name: hero.level >= 5 ? 'Greater Crimson Vial' : 'Crimson Healing Vial',
            slot: 'consumable',
            spriteKey: 'item_potion_hp',
            rarity: hero.level >= 5 ? 'uncommon' : 'common',
            level: hero.level,
            atk: 0,
            def: 0,
            hpBonus: 0,
            mpBonus: 0,
            critBonus: 0,
            dodgeBonus: 0,
            healHp: 22 + hero.level * 5,
            value: 15,
            description: `Restores ${22 + hero.level * 5} HP immediately.`,
          }
        : kind === 'mp'
        ? {
            id: makeId('itm'),
            name: 'Azure Mana Draught',
            slot: 'consumable',
            spriteKey: 'item_potion_mp',
            rarity: 'common',
            level: hero.level,
            atk: 0,
            def: 0,
            hpBonus: 0,
            mpBonus: 0,
            critBonus: 0,
            dodgeBonus: 0,
            healMp: 14 + hero.level * 3,
            value: 14,
            description: `Restores ${14 + hero.level * 3} MP immediately.`,
          }
        : {
            id: makeId('itm'),
            name: 'Scroll of Stoneward',
            slot: 'consumable',
            spriteKey: 'item_scroll',
            rarity: 'uncommon',
            level: hero.level,
            atk: 0,
            def: 0,
            hpBonus: 0,
            mpBonus: 0,
            critBonus: 0,
            dodgeBonus: 0,
            buffShield: 5,
            value: 20,
            description: 'Grants +50% Defense ward for 5 turns.',
          };

    onUpdateProfile({
      ...profile,
      hero: {
        ...hero,
        gold: hero.gold - cost,
        inventory: [...hero.inventory, item],
      },
    });
    soundEngine.play('loot');
    setNotice(`Purchased ${item.name} for ${cost} Gold.`);
  };

  const temperWeapon = () => {
    const weapon = hero.equipment.weapon;
    const costGold = 45;
    const costShards = 1;
    if (!weapon) {
      setNotice('Equip a weapon first to temper it.');
      return;
    }
    if (hero.gold < costGold || hero.shards < costShards) {
      soundEngine.play('miss');
      setNotice('Requires 45 Gold and 1 Boss Shard to temper.');
      return;
    }
    const upgraded: Item = {
      ...weapon,
      atk: weapon.atk + 2,
      critBonus: weapon.critBonus + 1,
      value: weapon.value + 15,
    };
    const nextHero = syncHeroCaps({
      ...hero,
      gold: hero.gold - costGold,
      shards: hero.shards - costShards,
      equipment: { ...hero.equipment, weapon: upgraded },
    });
    onUpdateProfile({ ...profile, hero: nextHero });
    soundEngine.play('levelUp');
    setNotice(`Tempered ${upgraded.name} (+2 ATK, +1% CRIT)!`);
  };

  const forgeMysteryRelic = () => {
    const costGold = 65;
    const costShards = 2;
    if (hero.gold < costGold || hero.shards < costShards) {
      soundEngine.play('miss');
      setNotice('Requires 65 Gold and 2 Boss Shards to forge a Relic.');
      return;
    }
    if (hero.inventory.length >= 20) {
      soundEngine.play('miss');
      setNotice('Backpack is full (20/20).');
      return;
    }
    const rng = new SeededRng(Date.now());
    const item = generateLootItem(Math.max(1, hero.level + 1), rng, rng.chance(0.35) ? 'relic' : 'epic');
    onUpdateProfile({
      ...profile,
      hero: {
        ...hero,
        gold: hero.gold - costGold,
        shards: hero.shards - costShards,
        inventory: [...hero.inventory, item],
      },
    });
    soundEngine.play('levelUp');
    setNotice(`Forged ${item.name}! Check your backpack.`);
  };

  const moveToStash = (item: Item) => {
    if (profile.stash.length >= 24) {
      setNotice('Camp Stash is full (24/24).');
      return;
    }
    onUpdateProfile({
      ...profile,
      hero: { ...hero, inventory: hero.inventory.filter((i) => i.id !== item.id) },
      stash: [...profile.stash, item],
    });
    soundEngine.play('door');
  };

  const moveFromStash = (item: Item) => {
    if (hero.inventory.length >= 20) {
      setNotice('Backpack is full (20/20).');
      return;
    }
    onUpdateProfile({
      ...profile,
      hero: { ...hero, inventory: [...hero.inventory, item] },
      stash: profile.stash.filter((i) => i.id !== item.id),
    });
    soundEngine.play('loot');
  };

  return (
    <div className="w-full h-[100dvh] bg-[#0d0f14] flex flex-col overflow-hidden">
      <header className="flex items-center justify-between gap-4 px-4 sm:px-6 h-14 border-b border-stone-800 bg-[#10131b] shrink-0">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              soundEngine.play('uiClose');
              onBackToMap();
            }}
            className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-lg border border-stone-800 bg-stone-900 hover:border-stone-600 text-stone-200"
            aria-label="Back to World Map"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="font-pixel text-sm sm:text-base text-amber-400">SANCTUARY CAMP</h1>
            <div className="text-[11px] text-stone-400 font-mono-num">
              {hero.gold} Gold · {hero.shards} Shards · HP {hero.hp}/{derived.maxHp}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1 p-1 rounded-lg bg-[#0b0d12] border border-stone-800">
          {(['services', 'stash', 'bestiary'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => {
                soundEngine.play('uiClick');
                setTab(t);
              }}
              className={`min-h-[36px] px-3 rounded-md text-xs font-medium capitalize transition-colors whitespace-nowrap ${
                tab === t ? 'bg-amber-500 text-stone-950 font-semibold' : 'text-stone-400 hover:text-stone-200'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </header>

      <div className="px-4 sm:px-6 py-2.5 bg-[#121620] border-b border-stone-800/70 text-xs sm:text-sm text-amber-200/90">
        {notice}
      </div>

      <main className="flex-1 overflow-y-auto p-4 sm:p-6 max-w-5xl w-full mx-auto">
        {tab === 'services' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Bonfire & Apothecary */}
            <section className="rounded-xl border border-stone-800 bg-[#12161f] p-5 space-y-4">
              <div className="flex items-center gap-2.5">
                <Flame className="w-5 h-5 text-amber-400" />
                <h2 className="font-pixel text-sm text-stone-100">BONFIRE &amp; APOTHECARY</h2>
              </div>

              <button
                type="button"
                onClick={restAtBonfire}
                className="w-full min-h-[48px] flex items-center justify-between px-4 py-3 rounded-lg border border-emerald-700/60 bg-emerald-950/30 hover:bg-emerald-900/40 text-stone-100 transition-colors"
              >
                <span className="flex items-center gap-2.5 text-sm font-semibold">
                  <Heart className="w-4 h-4 text-emerald-400" />
                  Rest at Bonfire
                </span>
                <span className="text-xs font-mono-num text-emerald-300">Free · Full HP/MP</span>
              </button>

              <div className="space-y-2 pt-2 border-t border-stone-800">
                <button
                  type="button"
                  onClick={() => buySupply('hp')}
                  className="w-full min-h-[48px] flex items-center justify-between px-3.5 py-2.5 rounded-lg border border-stone-800 bg-[#0d1017] hover:border-amber-500/60 transition-colors"
                >
                  <span className="flex items-center gap-3">
                    <img src={getSpriteDataUrl('item_potion_hp')} alt="" className="w-7 h-7 pixelated" />
                    <span className="text-left">
                      <span className="block text-sm font-medium text-stone-100">Crimson Healing Vial</span>
                      <span className="block text-xs text-stone-400">Restores {22 + hero.level * 5} HP</span>
                    </span>
                  </span>
                  <span className="text-xs font-mono-num text-amber-400 font-semibold">20g</span>
                </button>

                <button
                  type="button"
                  onClick={() => buySupply('mp')}
                  className="w-full min-h-[48px] flex items-center justify-between px-3.5 py-2.5 rounded-lg border border-stone-800 bg-[#0d1017] hover:border-amber-500/60 transition-colors"
                >
                  <span className="flex items-center gap-3">
                    <img src={getSpriteDataUrl('item_potion_mp')} alt="" className="w-7 h-7 pixelated" />
                    <span className="text-left">
                      <span className="block text-sm font-medium text-stone-100">Azure Mana Draught</span>
                      <span className="block text-xs text-stone-400">Restores {14 + hero.level * 3} MP</span>
                    </span>
                  </span>
                  <span className="text-xs font-mono-num text-amber-400 font-semibold">18g</span>
                </button>

                <button
                  type="button"
                  onClick={() => buySupply('scroll')}
                  className="w-full min-h-[48px] flex items-center justify-between px-3.5 py-2.5 rounded-lg border border-stone-800 bg-[#0d1017] hover:border-amber-500/60 transition-colors"
                >
                  <span className="flex items-center gap-3">
                    <img src={getSpriteDataUrl('item_scroll')} alt="" className="w-7 h-7 pixelated" />
                    <span className="text-left">
                      <span className="block text-sm font-medium text-stone-100">Scroll of Stoneward</span>
                      <span className="block text-xs text-stone-400">+50% DEF for 5 turns</span>
                    </span>
                  </span>
                  <span className="text-xs font-mono-num text-amber-400 font-semibold">28g</span>
                </button>
              </div>
            </section>

            {/* Camp Forge */}
            <section className="rounded-xl border border-stone-800 bg-[#12161f] p-5 space-y-4">
              <div className="flex items-center gap-2.5">
                <Hammer className="w-5 h-5 text-amber-400" />
                <h2 className="font-pixel text-sm text-stone-100">RELIC FORGE</h2>
              </div>

              <div className="rounded-lg border border-stone-800 bg-[#0d1017] p-3.5">
                <div className="text-xs text-stone-400">Equipped Weapon</div>
                {hero.equipment.weapon ? (
                  <div className="mt-1.5 flex items-center gap-3">
                    <img
                      src={getSpriteDataUrl(hero.equipment.weapon.spriteKey)}
                      alt=""
                      className="w-8 h-8 pixelated"
                    />
                    <div className="min-w-0">
                      <div
                        className="text-sm font-semibold truncate"
                        style={{ color: RARITY_CONFIG[hero.equipment.weapon.rarity].color }}
                      >
                        {hero.equipment.weapon.name}
                      </div>
                      <div className="text-xs font-mono-num text-stone-400">
                        ATK +{hero.equipment.weapon.atk} · CRIT +{hero.equipment.weapon.critBonus}%
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="mt-1 text-xs text-stone-500">No weapon equipped</div>
                )}
              </div>

              <button
                type="button"
                onClick={temperWeapon}
                className="w-full min-h-[48px] flex items-center justify-between px-4 py-3 rounded-lg border border-stone-700 bg-stone-900 hover:border-amber-500/70 transition-colors"
              >
                <span className="flex items-center gap-2 text-sm font-medium text-stone-100">
                  <Hammer className="w-4 h-4 text-amber-400" />
                  Temper Weapon (+2 ATK)
                </span>
                <span className="text-xs font-mono-num text-amber-300">45g · 1 Shard</span>
              </button>

              <button
                type="button"
                onClick={forgeMysteryRelic}
                className="w-full min-h-[48px] flex items-center justify-between px-4 py-3 rounded-lg bg-amber-500/15 border border-amber-500/60 hover:bg-amber-500/25 transition-colors"
              >
                <span className="flex items-center gap-2 text-sm font-semibold text-amber-300">
                  <Sparkles className="w-4 h-4" />
                  Forge Epic/Relic Gear
                </span>
                <span className="text-xs font-mono-num text-amber-200">65g · 2 Shards</span>
              </button>
            </section>
          </div>
        )}

        {tab === 'stash' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <section className="rounded-xl border border-stone-800 bg-[#12161f] p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-pixel text-xs text-stone-200">BACKPACK ({hero.inventory.length}/20)</h2>
                <span className="text-xs text-stone-400">Tap item to store</span>
              </div>
              <div className="space-y-2 max-h-[380px] overflow-y-auto">
                {hero.inventory.length === 0 && (
                  <p className="text-xs text-stone-500 py-6 text-center">Backpack is empty.</p>
                )}
                {hero.inventory.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => moveToStash(item)}
                    className="w-full min-h-[48px] flex items-center justify-between gap-3 px-3 py-2 rounded-lg border border-stone-800 bg-[#0d1017] hover:border-stone-600 text-left"
                  >
                    <span className="flex items-center gap-2.5 min-w-0">
                      <img src={getSpriteDataUrl(item.spriteKey)} alt="" className="w-7 h-7 pixelated shrink-0" />
                      <span className="min-w-0">
                        <span
                          className="block text-xs font-semibold truncate"
                          style={{ color: RARITY_CONFIG[item.rarity].color }}
                        >
                          {item.name}
                        </span>
                        <span className="block text-[11px] text-stone-400 font-mono-num">
                          {RARITY_CONFIG[item.rarity].label} · {item.slot}
                        </span>
                      </span>
                    </span>
                    <span className="text-xs text-amber-400 shrink-0">Store →</span>
                  </button>
                ))}
              </div>
            </section>

            <section className="rounded-xl border border-stone-800 bg-[#12161f] p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-pixel text-xs text-stone-200 flex items-center gap-2">
                  <Package className="w-4 h-4 text-amber-400" />
                  CAMP STASH ({profile.stash.length}/24)
                </h2>
                <span className="text-xs text-stone-400">Tap item to take</span>
              </div>
              <div className="space-y-2 max-h-[380px] overflow-y-auto">
                {profile.stash.length === 0 && (
                  <p className="text-xs text-stone-500 py-6 text-center">
                    Stash is empty. Store rare gear safely offline.
                  </p>
                )}
                {profile.stash.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => moveFromStash(item)}
                    className="w-full min-h-[48px] flex items-center justify-between gap-3 px-3 py-2 rounded-lg border border-stone-800 bg-[#0d1017] hover:border-amber-500/60 text-left"
                  >
                    <span className="flex items-center gap-2.5 min-w-0">
                      <img src={getSpriteDataUrl(item.spriteKey)} alt="" className="w-7 h-7 pixelated shrink-0" />
                      <span className="min-w-0">
                        <span
                          className="block text-xs font-semibold truncate"
                          style={{ color: RARITY_CONFIG[item.rarity].color }}
                        >
                          {item.name}
                        </span>
                        <span className="block text-[11px] text-stone-400 font-mono-num">
                          ATK {item.atk} · DEF {item.def}
                        </span>
                      </span>
                    </span>
                    <span className="text-xs text-emerald-400 shrink-0">← Take</span>
                  </button>
                ))}
              </div>
            </section>
          </div>
        )}

        {tab === 'bestiary' && (
          <BestiaryView bestiary={profile.bestiary} embedded />
        )}
      </main>
    </div>
  );
};

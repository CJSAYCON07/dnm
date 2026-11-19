import React, { useState } from 'react';
import { Plus, Shield, Swords, Trash2, X, Coins } from 'lucide-react';
import { soundEngine } from '../game/audio.ts';
import { HERO_CLASSES, RARITY_CONFIG } from '../game/content.ts';
import { getHeroDerivedStats } from '../game/dungeonGen.ts';
import { getSpriteDataUrl } from '../game/pixelSprites.ts';
import type { EquipSlot, HeroState, HeroStats, Item, PlayerAction } from '../game/types.ts';

interface InventoryModalProps {
  hero: HeroState;
  onAction: (action: PlayerAction) => void;
  onClose: () => void;
}

const EQUIP_SLOTS: { slot: EquipSlot; label: string }[] = [
  { slot: 'weapon', label: 'Weapon' },
  { slot: 'offhand', label: 'Offhand' },
  { slot: 'armor', label: 'Armor' },
  { slot: 'helm', label: 'Helm' },
  { slot: 'ring', label: 'Ring' },
];

export const InventoryModal: React.FC<InventoryModalProps> = ({
  hero,
  onAction,
  onClose,
}) => {
  const [selectedItem, setSelectedItem] = useState<Item | null>(hero.inventory[0] ?? null);
  const derived = getHeroDerivedStats(hero);

  const activeSelected =
    selectedItem && hero.inventory.some((i) => i.id === selectedItem.id)
      ? selectedItem
      : hero.inventory[0] ?? null;

  const equippedInSameSlot =
    activeSelected && activeSelected.slot !== 'consumable'
      ? hero.equipment[activeSelected.slot]
      : null;

  const statList: { key: keyof HeroStats; label: string; desc: string }[] = [
    { key: 'vitality', label: 'Vitality', desc: '+5 Max HP · DEF' },
    { key: 'might', label: 'Might', desc: '+1.4 ATK · Crit' },
    { key: 'agility', label: 'Agility', desc: '+1.6% Dodge · +1.5% Crit' },
    { key: 'arcana', label: 'Arcana', desc: '+3 MP · Spell Power' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 p-0 sm:p-4">
      <div className="w-full max-w-4xl max-h-[92dvh] rounded-t-2xl sm:rounded-xl border border-stone-700 bg-[#12151e] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-stone-800 bg-[#0e1118] shrink-0">
          <div className="flex items-center gap-3">
            <img
              src={getSpriteDataUrl(`hero_${hero.classId}`)}
              alt=""
              className="w-9 h-9 pixelated bg-stone-900 rounded p-1 border border-stone-700"
            />
            <div>
              <h2 className="font-pixel text-sm sm:text-base text-stone-100">
                {hero.name} · Lv.{hero.level} {HERO_CLASSES[hero.classId].name}
              </h2>
              <div className="text-xs font-mono-num text-stone-400">
                ATK {derived.atk} · DEF {derived.def} · CRIT {derived.critChance}% · DODGE {derived.dodgeChance}% · {hero.gold}g
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              soundEngine.play('uiClose');
              onClose();
            }}
            className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-lg border border-stone-700 bg-stone-900 text-stone-200 hover:border-stone-500"
            aria-label="Close Inventory"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Left Column: Character Stats & Equipped Gear */}
          <div className="lg:col-span-5 space-y-4">
            <section className="rounded-lg border border-stone-800 bg-[#0c0e14] p-3.5">
              <div className="flex items-center justify-between mb-2.5">
                <h3 className="font-pixel text-xs text-stone-200">ATTRIBUTES</h3>
                {hero.unspentPoints > 0 && (
                  <span className="text-xs font-mono-num font-semibold text-amber-400">
                    {hero.unspentPoints} Points Available
                  </span>
                )}
              </div>
              <div className="space-y-2">
                {statList.map((s) => (
                  <div key={s.key} className="flex items-center justify-between gap-2">
                    <div>
                      <div className="text-xs font-semibold text-stone-200">{s.label}</div>
                      <div className="text-[11px] text-stone-500">{s.desc}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono-num text-sm font-bold text-stone-100 w-7 text-right">
                        {hero.stats[s.key]}
                      </span>
                      {hero.unspentPoints > 0 && (
                        <button
                          type="button"
                          onClick={() => onAction({ type: 'allocate_stat', stat: s.key })}
                          className="min-h-[36px] min-w-[36px] inline-flex items-center justify-center rounded bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold"
                          aria-label={`Increase ${s.label}`}
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-lg border border-stone-800 bg-[#0c0e14] p-3.5">
              <h3 className="font-pixel text-xs text-stone-200 mb-2.5">EQUIPPED GEAR</h3>
              <div className="space-y-2">
                {EQUIP_SLOTS.map(({ slot, label }) => {
                  const eq = hero.equipment[slot];
                  return (
                    <div
                      key={slot}
                      className="flex items-center justify-between gap-2 px-2.5 py-2 rounded border border-stone-800/90 bg-[#12161f]"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        {eq ? (
                          <img src={getSpriteDataUrl(eq.spriteKey)} alt="" className="w-7 h-7 pixelated shrink-0" />
                        ) : (
                          <div className="w-7 h-7 rounded bg-stone-900 border border-stone-800 shrink-0" />
                        )}
                        <div className="min-w-0">
                          <div className="text-[10px] text-stone-500 uppercase tracking-wider">{label}</div>
                          <div
                            className="text-xs font-medium truncate"
                            style={{ color: eq ? RARITY_CONFIG[eq.rarity].color : '#64748b' }}
                          >
                            {eq ? eq.name : 'Empty'}
                          </div>
                        </div>
                      </div>
                      {eq && (
                        <button
                          type="button"
                          onClick={() => onAction({ type: 'unequip_slot', slot })}
                          className="min-h-[34px] px-2.5 rounded border border-stone-700 text-[11px] text-stone-300 hover:border-stone-500 shrink-0"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          </div>

          {/* Right Column: Backpack Grid & Item Inspector */}
          <div className="lg:col-span-7 flex flex-col justify-between gap-4">
            <section>
              <div className="flex items-center justify-between mb-2.5">
                <h3 className="font-pixel text-xs text-stone-200">
                  BACKPACK ({hero.inventory.length}/20)
                </h3>
                <span className="text-xs text-stone-400">Tap slot to inspect</span>
              </div>
              <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
                {Array.from({ length: 20 }).map((_, idx) => {
                  const item = hero.inventory[idx];
                  const isSel = item && activeSelected?.id === item.id;
                  if (!item) {
                    return (
                      <div
                        key={idx}
                        className="aspect-square min-h-[52px] rounded-lg border border-stone-800/70 bg-[#0b0d12]"
                      />
                    );
                  }
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        soundEngine.play('uiClick');
                        setSelectedItem(item);
                      }}
                      style={{ borderColor: isSel ? '#f59e0b' : RARITY_CONFIG[item.rarity].border }}
                      className={`relative aspect-square min-h-[52px] rounded-lg border p-1.5 flex flex-col items-center justify-center transition-transform active:scale-95 ${
                        isSel ? 'bg-amber-500/15' : 'bg-[#0e1118] hover:bg-[#161b26]'
                      }`}
                    >
                      <img src={getSpriteDataUrl(item.spriteKey)} alt={item.name} className="w-8 h-8 pixelated" />
                      <span className="mt-0.5 text-[10px] font-mono-num text-stone-300 truncate w-full text-center">
                        {item.slot === 'consumable' ? 'Use' : `L${item.level}`}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>

            {/* Inspector */}
            <section className="rounded-lg border border-stone-800 bg-[#0c0e14] p-4">
              {activeSelected ? (
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <img
                        src={getSpriteDataUrl(activeSelected.spriteKey)}
                        alt=""
                        className="w-11 h-11 pixelated bg-[#141822] rounded-lg p-1.5 border border-stone-700 shrink-0"
                      />
                      <div className="min-w-0">
                        <div
                          className="text-sm font-bold truncate"
                          style={{ color: RARITY_CONFIG[activeSelected.rarity].color }}
                        >
                          {activeSelected.name}
                        </div>
                        <div className="text-xs text-stone-400 font-mono-num">
                          {RARITY_CONFIG[activeSelected.rarity].label} · {activeSelected.slot} · Lv.{activeSelected.level}
                        </div>
                      </div>
                    </div>
                  </div>

                  <p className="mt-2.5 text-xs text-stone-300">{activeSelected.description}</p>

                  {activeSelected.slot !== 'consumable' && (
                    <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 text-xs font-mono-num text-stone-200">
                      {activeSelected.atk > 0 && (
                        <span>
                          ATK +{activeSelected.atk}
                          {equippedInSameSlot && (
                            <span className={activeSelected.atk >= equippedInSameSlot.atk ? 'text-emerald-400' : 'text-rose-400'}>
                              {' '}({activeSelected.atk - equippedInSameSlot.atk >= 0 ? '+' : ''}
                              {activeSelected.atk - equippedInSameSlot.atk})
                            </span>
                          )}
                        </span>
                      )}
                      {activeSelected.def > 0 && (
                        <span>
                          DEF +{activeSelected.def}
                          {equippedInSameSlot && (
                            <span className={activeSelected.def >= equippedInSameSlot.def ? 'text-emerald-400' : 'text-rose-400'}>
                              {' '}({activeSelected.def - equippedInSameSlot.def >= 0 ? '+' : ''}
                              {activeSelected.def - equippedInSameSlot.def})
                            </span>
                          )}
                        </span>
                      )}
                      {activeSelected.hpBonus > 0 && <span>HP +{activeSelected.hpBonus}</span>}
                      {activeSelected.mpBonus > 0 && <span>MP +{activeSelected.mpBonus}</span>}
                      {activeSelected.critBonus > 0 && <span>CRIT +{activeSelected.critBonus}%</span>}
                      {activeSelected.dodgeBonus > 0 && <span>DODGE +{activeSelected.dodgeBonus}%</span>}
                    </div>
                  )}

                  <div className="mt-4 flex flex-wrap gap-2.5">
                    {activeSelected.slot === 'consumable' ? (
                      <button
                        type="button"
                        onClick={() => onAction({ type: 'use_item', itemId: activeSelected.id })}
                        className="flex-1 min-h-[44px] inline-flex items-center justify-center gap-2 px-4 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-stone-950 font-bold text-xs sm:text-sm"
                      >
                        <Shield className="w-4 h-4" />
                        Use Now
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onAction({ type: 'equip_item', itemId: activeSelected.id })}
                        className="flex-1 min-h-[44px] inline-flex items-center justify-center gap-2 px-4 rounded-lg bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs sm:text-sm"
                      >
                        <Swords className="w-4 h-4" />
                        Equip
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => onAction({ type: 'salvage_item', itemId: activeSelected.id })}
                      className="min-h-[44px] inline-flex items-center justify-center gap-1.5 px-3.5 rounded-lg border border-stone-700 bg-stone-900 hover:border-amber-500/60 text-amber-300 text-xs font-medium"
                    >
                      <Coins className="w-3.5 h-3.5" />
                      Salvage (+{Math.max(4, Math.round(activeSelected.value * 0.55))}g)
                    </button>

                    <button
                      type="button"
                      onClick={() => onAction({ type: 'drop_item', itemId: activeSelected.id })}
                      className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-lg border border-stone-800 bg-stone-900 hover:border-rose-500/70 text-rose-400"
                      aria-label="Drop Item"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-xs text-stone-500 py-4 text-center">
                  Select an item in your backpack to inspect, equip, or salvage.
                </div>
              )}
            </section>
          </div>
        </div>
      </div>
    </div>
  );
};

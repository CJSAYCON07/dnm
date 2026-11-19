import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Backpack,
  Compass,
  Gamepad2,
  Map as MapIcon,
  Pause,
  RotateCcw,
  Skull,
  Volume2,
  VolumeX,
  Wifi,
  Download,
} from 'lucide-react';
import { soundEngine } from '../game/audio.ts';
import { REGIONS } from '../game/content.ts';
import { findPathAStar, getHeroDerivedStats } from '../game/dungeonGen.ts';
import { getSpriteDataUrl } from '../game/pixelSprites.ts';
import type {
  CombatEvent,
  DungeonFloor,
  HeroState,
  PlayerAction,
} from '../game/types.ts';
import { DungeonCanvas } from './DungeonCanvas.tsx';
import { InventoryModal } from './InventoryModal.tsx';

interface GamePlayViewProps {
  floor: DungeonFloor;
  heroes: Record<string, HeroState>;
  activeHeroId: string;
  logs: string[];
  events: CombatEvent[];
  isLan: boolean;
  lanRoomCode?: string;
  lanStatus?: string;
  muted: boolean;
  showDpad: boolean;
  gameOver: boolean;
  victory: boolean;
  onAction: (action: PlayerAction) => void;
  onToggleMute: () => void;
  onToggleDpad: () => void;
  onReturnToMap: () => void;
  onRespawnCamp: () => void;
  onExportSave: () => void;
  onRetryOrLobby: () => void;
}

export const GamePlayView: React.FC<GamePlayViewProps> = ({
  floor,
  heroes,
  activeHeroId,
  logs,
  events,
  isLan,
  lanRoomCode,
  muted,
  showDpad,
  gameOver,
  victory,
  onAction,
  onToggleMute,
  onToggleDpad,
  onReturnToMap,
  onRespawnCamp,
  onExportSave,
  onRetryOrLobby,
}) => {
  const [inventoryOpen, setInventoryOpen] = useState(false);
  const [paused, setPaused] = useState(false);
  const [autoPath, setAutoPath] = useState<{ x: number; y: number }[]>([]);

  const hero = heroes[activeHeroId] ?? Object.values(heroes)[0];
  const derived = getHeroDerivedStats(hero);
  const region = REGIONS[floor.regionId];
  const onStairsDown = floor.tiles[hero.y]?.[hero.x] === 'stairs_down';
  const visibleBoss = floor.monsters.find(
    (m) => m.isBoss && floor.visibility[m.y]?.[m.x] === 2
  );

  // Stop auto-walk whenever a visible enemy is spotted or modal opens
  const visibleEnemyCount = floor.monsters.filter(
    (m) => floor.visibility[m.y]?.[m.x] === 2
  ).length;

  const onActionRef = useRef(onAction);
  onActionRef.current = onAction;

  const prevVisibleCount = useRef(visibleEnemyCount);
  useEffect(() => {
    if (visibleEnemyCount > prevVisibleCount.current) {
      setAutoPath((prev) => (prev.length > 0 ? [] : prev));
    }
    prevVisibleCount.current = visibleEnemyCount;
  }, [visibleEnemyCount]);

  useEffect(() => {
    if (autoPath.length === 0) return;
    if (inventoryOpen || paused || gameOver || victory || !hero.alive) {
      setAutoPath((prev) => (prev.length > 0 ? [] : prev));
      return;
    }

    const timer = setTimeout(() => {
      const next = autoPath[0];
      const dx = next.x - hero.x;
      const dy = next.y - hero.y;
      if (Math.abs(dx) + Math.abs(dy) !== 1) {
        setAutoPath([]);
        return;
      }
      setAutoPath((prev) => prev.slice(1));
      onActionRef.current({ type: 'move', dx, dy });
    }, 135);

    return () => clearTimeout(timer);
  }, [autoPath, hero.x, hero.y, hero.alive, inventoryOpen, paused, gameOver, victory]);

  const dispatchMove = useCallback(
    (dx: number, dy: number) => {
      setAutoPath([]);
      onAction({ type: 'move', dx, dy });
    },
    [onAction]
  );

  const handleUseQuickPotion = useCallback(() => {
    const pot = hero.inventory.find((i) => i.slot === 'consumable' && i.healHp);
    if (pot) {
      setAutoPath([]);
      onAction({ type: 'use_item', itemId: pot.id });
    } else {
      setInventoryOpen(true);
    }
  }, [hero.inventory, onAction]);

  // Keyboard shortcuts + window blur protection
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (gameOver || victory) return;
      if (e.key === 'Escape') {
        if (inventoryOpen) setInventoryOpen(false);
        else setPaused((p) => !p);
        return;
      }
      if (e.key.toLowerCase() === 'i') {
        setInventoryOpen((v) => !v);
        return;
      }
      if (e.key.toLowerCase() === 'm' && !isLan) {
        onReturnToMap();
        return;
      }
      if (inventoryOpen || paused) return;

      const k = e.key.toLowerCase();
      if (k === 'w' || e.key === 'ArrowUp') {
        e.preventDefault();
        dispatchMove(0, -1);
      } else if (k === 's' || e.key === 'ArrowDown') {
        e.preventDefault();
        dispatchMove(0, 1);
      } else if (k === 'a' || e.key === 'ArrowLeft') {
        e.preventDefault();
        dispatchMove(-1, 0);
      } else if (k === 'd' || e.key === 'ArrowRight') {
        e.preventDefault();
        dispatchMove(1, 0);
      } else if (e.key === ' ' || e.key === '.') {
        e.preventDefault();
        setAutoPath([]);
        onAction({ type: 'wait' });
      } else if (k === '1') {
        setAutoPath([]);
        onAction({ type: 'skill', skillIndex: 0 });
      } else if (k === '2') {
        setAutoPath([]);
        onAction({ type: 'skill', skillIndex: 1 });
      } else if (k === '3') {
        setAutoPath([]);
        onAction({ type: 'skill', skillIndex: 2 });
      } else if (k === 'h') {
        handleUseQuickPotion();
      } else if ((k === 'e' || e.key === 'Enter') && onStairsDown) {
        onAction({ type: 'descend' });
      }
    };

    const onBlur = () => setAutoPath([]);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('blur', onBlur);
    };
  }, [
    inventoryOpen,
    paused,
    gameOver,
    victory,
    isLan,
    onStairsDown,
    dispatchMove,
    onAction,
    onReturnToMap,
    handleUseQuickPotion,
  ]);

  const handleTileTap = useCallback(
    (tx: number, ty: number) => {
      if (inventoryOpen || paused || gameOver || victory || !hero.alive) return;

      if (tx === hero.x && ty === hero.y) {
        if (onStairsDown) {
          onAction({ type: 'descend' });
        } else {
          setAutoPath([]);
          onAction({ type: 'wait' });
        }
        return;
      }

      const dist = Math.abs(tx - hero.x) + Math.abs(ty - hero.y);
      if (dist === 1) {
        dispatchMove(tx - hero.x, ty - hero.y);
        return;
      }

      const hasMonster = floor.monsters.some((m) => m.x === tx && m.y === ty);
      const path = findPathAStar(floor, hero.x, hero.y, tx, ty, hasMonster);
      if (path.length > 0) {
        // Step immediately once, queue remainder
        const first = path[0];
        setAutoPath(path.slice(1));
        onAction({ type: 'move', dx: first.x - hero.x, dy: first.y - hero.y });
      }
    },
    [floor, hero.x, hero.y, hero.alive, inventoryOpen, paused, gameOver, victory, onStairsDown, dispatchMove, onAction]
  );

  const hpPct = Math.max(0, Math.min(100, (hero.hp / derived.maxHp) * 100));
  const mpPct = Math.max(0, Math.min(100, (hero.mp / derived.maxMp) * 100));
  const xpPct = Math.max(0, Math.min(100, (hero.xp / hero.xpToNext) * 100));
  const hpPotions = hero.inventory.filter((i) => i.slot === 'consumable' && i.healHp);

  return (
    <div className="relative w-full h-[100dvh] overflow-hidden bg-[#090b10] select-none">
      {/* Isolated Canvas Layer */}
      <DungeonCanvas
        floor={floor}
        heroes={heroes}
        activeHeroId={activeHeroId}
        events={events}
        pathPreview={autoPath}
        onTileTap={handleTileTap}
      />

      {/* Low-Occlusion HUD Overlay (pointer-events-none wrapper) */}
      <div className="pointer-events-none fixed inset-0 z-20 flex flex-col justify-between p-2.5 sm:p-4">
        {/* Top Row: Left Status + Optional Boss Bar + Right Controls */}
        <div className="flex items-start justify-between gap-2">
          {/* Top-Left Compact Hero Meter */}
          <div className="pointer-events-auto rounded-lg border border-stone-800 bg-[#10131b]/90 px-3 py-2 min-w-[195px] sm:min-w-[230px]">
            <div className="flex items-center gap-2.5">
              <img
                src={getSpriteDataUrl(`hero_${hero.classId}`)}
                alt=""
                className="w-8 h-8 pixelated bg-[#090b10] rounded p-0.5 border border-stone-700 shrink-0"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-pixel text-[11px] text-stone-100 truncate">
                    {hero.name}
                  </span>
                  <span className="font-mono-num text-[11px] text-amber-400 shrink-0">
                    Lv.{hero.level} · {hero.gold}g
                  </span>
                </div>
                <div className="text-[10px] text-stone-400 font-mono-num truncate">
                  B{floor.depth}/{floor.maxDepth} · {region.name}
                </div>
              </div>
            </div>

            <div className="mt-2 space-y-1">
              <div className="relative h-3 rounded bg-[#090b10] overflow-hidden border border-stone-800">
                <div
                  className="h-full bg-rose-600 transition-all duration-150"
                  style={{ width: `${hpPct}%` }}
                />
                <span className="absolute inset-0 flex items-center justify-center text-[9px] font-mono-num font-bold text-white">
                  HP {hero.hp}/{derived.maxHp}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                <div className="relative h-2.5 rounded bg-[#090b10] overflow-hidden border border-stone-800">
                  <div
                    className="h-full bg-sky-500 transition-all duration-150"
                    style={{ width: `${mpPct}%` }}
                  />
                  <span className="absolute inset-0 flex items-center justify-center text-[8px] font-mono-num text-white">
                    MP {hero.mp}/{derived.maxMp}
                  </span>
                </div>
                <div className="relative h-2.5 rounded bg-[#090b10] overflow-hidden border border-stone-800">
                  <div
                    className="h-full bg-amber-400 transition-all duration-150"
                    style={{ width: `${xpPct}%` }}
                  />
                  <span className="absolute inset-0 flex items-center justify-center text-[8px] font-mono-num text-stone-200">
                    XP
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Center Boss Encounter Bar (only when Boss is visible) */}
          {visibleBoss && (
            <div className="hidden md:block rounded-lg border border-rose-800/80 bg-[#170e13]/92 px-4 py-2 min-w-[260px]">
              <div className="flex items-center justify-between gap-3">
                <span className="font-pixel text-xs text-rose-300 flex items-center gap-1.5">
                  <Skull className="w-3.5 h-3.5 text-rose-400" />
                  {visibleBoss.name}
                </span>
                <span className="text-[11px] font-mono-num text-rose-200">
                  {visibleBoss.hp}/{visibleBoss.maxHp}
                </span>
              </div>
              <div className="mt-1.5 h-2 rounded bg-black/70 overflow-hidden">
                <div
                  className="h-full bg-rose-500 transition-all duration-150"
                  style={{ width: `${(visibleBoss.hp / visibleBoss.maxHp) * 100}%` }}
                />
              </div>
            </div>
          )}

          {/* Top-Right Compact Action Cluster */}
          <div className="pointer-events-auto flex items-center gap-1.5">
            {isLan && lanRoomCode && (
              <div className="hidden sm:inline-flex items-center gap-1.5 min-h-[44px] px-3 rounded-lg border border-emerald-700/60 bg-[#0d1915]/90 text-xs font-mono-num text-emerald-300">
                <Wifi className="w-3.5 h-3.5" />
                <span>LAN {lanRoomCode}</span>
              </div>
            )}

            <button
              type="button"
              onClick={() => {
                soundEngine.play('uiClick');
                onToggleDpad();
              }}
              className={`min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-lg border transition-colors ${
                showDpad
                  ? 'border-amber-500/60 bg-[#181b24]/90 text-amber-300'
                  : 'border-stone-800 bg-[#10131b]/90 text-stone-400'
              }`}
              aria-label="Toggle Touch D-Pad"
              title="Toggle On-Screen D-Pad"
            >
              <Gamepad2 className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={onToggleMute}
              className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-lg border border-stone-800 bg-[#10131b]/90 text-stone-300 hover:border-stone-600"
              aria-label={muted ? 'Unmute Sound' : 'Mute Sound'}
            >
              {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>

            <button
              type="button"
              onClick={() => {
                soundEngine.play('uiOpen');
                setInventoryOpen(true);
              }}
              className="relative min-h-[44px] min-w-[44px] px-3 inline-flex items-center justify-center gap-1.5 rounded-lg border border-stone-700 bg-[#10131b]/90 text-stone-100 hover:border-amber-500/70 text-xs font-medium"
              aria-label="Open Inventory"
            >
              <Backpack className="w-4 h-4 text-amber-400" />
              <span className="hidden sm:inline">Bag</span>
              {hero.unspentPoints > 0 && (
                <span className="text-[10px] font-mono-num font-bold text-amber-400">
                  +{hero.unspentPoints}
                </span>
              )}
            </button>

            {!isLan && (
              <button
                type="button"
                onClick={() => {
                  soundEngine.play('uiClick');
                  onReturnToMap();
                }}
                className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-lg border border-stone-800 bg-[#10131b]/90 text-stone-300 hover:border-stone-600"
                aria-label="World Map"
                title="World Map"
              >
                <MapIcon className="w-4 h-4" />
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                soundEngine.play('uiOpen');
                setPaused(true);
              }}
              className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-lg border border-stone-800 bg-[#10131b]/90 text-stone-300 hover:border-stone-600"
              aria-label="Pause Menu"
            >
              <Pause className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Bottom Thumb Zone: Combat Feed + D-Pad (left) + Skills/Potion (right) */}
        <div className="flex flex-col gap-2">
          {/* Compact 2-line Combat Feed */}
          {logs.length > 0 && (
            <div className="max-w-md rounded-lg bg-[#0b0d12]/78 border border-stone-800/70 px-3 py-1.5 text-[11px] font-mono-num text-stone-300 space-y-0.5">
              {logs.slice(-2).map((line, i) => (
                <div key={i} className="truncate">
                  {line}
                </div>
              ))}
            </div>
          )}

          <div className="flex items-end justify-between gap-3">
            {/* Left Thumb: Pixel D-Pad (when enabled) */}
            {showDpad ? (
              <div className="pointer-events-auto grid grid-cols-3 gap-1.5 w-[156px] touch-none">
                <div />
                <button
                  type="button"
                  onClick={() => dispatchMove(0, -1)}
                  className="min-h-[48px] min-w-[48px] rounded-lg border border-stone-700 bg-[#12161f]/90 active:bg-amber-500 active:text-stone-950 flex items-center justify-center text-stone-200"
                  aria-label="Move North"
                >
                  <ArrowUp className="w-5 h-5" />
                </button>
                <div />

                <button
                  type="button"
                  onClick={() => dispatchMove(-1, 0)}
                  className="min-h-[48px] min-w-[48px] rounded-lg border border-stone-700 bg-[#12161f]/90 active:bg-amber-500 active:text-stone-950 flex items-center justify-center text-stone-200"
                  aria-label="Move West"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <button
                  type="button"
                  onClick={() => onAction({ type: 'wait' })}
                  className="min-h-[48px] min-w-[48px] rounded-lg border border-stone-700 bg-[#181c26]/90 active:bg-amber-500 active:text-stone-950 flex items-center justify-center font-pixel text-[10px] text-stone-300"
                  aria-label="Wait Turn"
                >
                  WAIT
                </button>
                <button
                  type="button"
                  onClick={() => dispatchMove(1, 0)}
                  className="min-h-[48px] min-w-[48px] rounded-lg border border-stone-700 bg-[#12161f]/90 active:bg-amber-500 active:text-stone-950 flex items-center justify-center text-stone-200"
                  aria-label="Move East"
                >
                  <ArrowRight className="w-5 h-5" />
                </button>

                <div />
                <button
                  type="button"
                  onClick={() => dispatchMove(0, 1)}
                  className="min-h-[48px] min-w-[48px] rounded-lg border border-stone-700 bg-[#12161f]/90 active:bg-amber-500 active:text-stone-950 flex items-center justify-center text-stone-200"
                  aria-label="Move South"
                >
                  <ArrowDown className="w-5 h-5" />
                </button>
                <div />
              </div>
            ) : (
              <div />
            )}

            {/* Right Thumb: Skills + Quick Potion + Descend Portal */}
            <div className="pointer-events-auto flex flex-col items-end gap-2">
              {onStairsDown && (
                <button
                  type="button"
                  onClick={() => onAction({ type: 'descend' })}
                  className={`min-h-[48px] px-4 rounded-lg border font-pixel text-xs flex items-center gap-2 transition-colors ${
                    floor.exitUnlocked
                      ? 'border-amber-400 bg-amber-500 text-stone-950 font-bold'
                      : 'border-stone-700 bg-stone-900/95 text-stone-400'
                  }`}
                >
                  <Compass className="w-4 h-4" />
                  {floor.depth < floor.maxDepth
                    ? `DESCEND B${floor.depth + 1}`
                    : floor.exitUnlocked
                    ? 'CLAIM VICTORY'
                    : 'SEALED (DEFEAT BOSS)'}
                </button>
              )}

              <div className="flex items-center gap-1.5 sm:gap-2">
                {hero.skills.map((sk, idx) => {
                  const disabled = sk.currentCooldown > 0 || hero.mp < sk.mpCost;
                  return (
                    <button
                      key={sk.id}
                      type="button"
                      onClick={() => {
                        setAutoPath([]);
                        onAction({ type: 'skill', skillIndex: idx });
                      }}
                      title={`${sk.name}: ${sk.description}`}
                      className={`min-h-[52px] min-w-[58px] sm:min-w-[74px] px-2.5 py-1.5 rounded-lg border flex flex-col items-center justify-center transition-colors ${
                        disabled
                          ? 'border-stone-800 bg-[#0d1017]/90 text-stone-500'
                          : 'border-stone-700 bg-[#12161f]/95 hover:border-amber-500 text-stone-100 active:scale-95'
                      }`}
                    >
                      <span className="text-[11px] font-semibold truncate max-w-[70px]">
                        {sk.name}
                      </span>
                      <span className="text-[10px] font-mono-num text-sky-400">
                        {sk.currentCooldown > 0 ? `CD ${sk.currentCooldown}` : `${sk.mpCost} MP`}
                      </span>
                    </button>
                  );
                })}

                <button
                  type="button"
                  onClick={handleUseQuickPotion}
                  className="min-h-[52px] min-w-[56px] px-2.5 py-1.5 rounded-lg border border-rose-800/70 bg-[#1a1014]/95 hover:border-rose-500 flex flex-col items-center justify-center text-rose-200 active:scale-95"
                  title="Use Healing Potion (H)"
                >
                  <img src={getSpriteDataUrl('item_potion_hp')} alt="" className="w-5 h-5 pixelated" />
                  <span className="text-[10px] font-mono-num">{hpPotions.length}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Inventory Modal */}
      {inventoryOpen && (
        <InventoryModal
          hero={hero}
          onAction={onAction}
          onClose={() => setInventoryOpen(false)}
        />
      )}

      {/* Pause Modal */}
      {paused && !gameOver && !victory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="w-full max-w-sm rounded-xl border border-stone-700 bg-[#12151e] p-6 space-y-3">
            <h2 className="font-pixel text-lg text-stone-100">PAUSED</h2>
            <p className="text-xs text-stone-400 font-mono-num">
              {region.name} · Floor B{floor.depth}/{floor.maxDepth} · Turn {floor.turnNumber}
            </p>
            <div className="pt-2 space-y-2.5">
              <button
                type="button"
                onClick={() => {
                  soundEngine.play('uiClose');
                  setPaused(false);
                }}
                className="w-full min-h-[48px] rounded-lg bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-sm"
              >
                Resume Delve
              </button>
              {!isLan && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      soundEngine.play('uiClick');
                      onExportSave();
                    }}
                    className="w-full min-h-[44px] inline-flex items-center justify-center gap-2 rounded-lg border border-stone-700 bg-stone-900 hover:border-stone-500 text-stone-200 text-sm"
                  >
                    <Download className="w-4 h-4" />
                    Export Offline Save (.json)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      soundEngine.play('uiClick');
                      onReturnToMap();
                    }}
                    className="w-full min-h-[44px] rounded-lg border border-stone-700 bg-stone-900 hover:border-amber-500/60 text-stone-200 text-sm"
                  >
                    Save &amp; Return to World Map
                  </button>
                </>
              )}
              {isLan && (
                <button
                  type="button"
                  onClick={() => {
                    soundEngine.play('uiClick');
                    onRetryOrLobby();
                  }}
                  className="w-full min-h-[44px] rounded-lg border border-stone-700 bg-stone-900 hover:border-rose-500/60 text-stone-200 text-sm"
                >
                  Return to LAN Lobby
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Victory Modal */}
      {victory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/82 p-4">
          <div className="w-full max-w-md rounded-xl border border-amber-500/70 bg-[#12161f] p-6 space-y-4">
            <h2 className="font-pixel text-xl text-amber-400">REGION CONQUERED</h2>
            <p className="text-sm text-stone-300 leading-relaxed">
              {region.bossName} has been vanquished and {region.name} is cleared! Your offline
              world progress and spoils have been preserved.
            </p>
            <div className="rounded-lg border border-stone-800 bg-[#0b0d12] p-3 text-xs font-mono-num text-stone-300 space-y-1">
              <div>Hero Level: {hero.level}</div>
              <div>Gold: {hero.gold} · Boss Shards: {hero.shards}</div>
              <div>Turns Elapsed: {floor.turnNumber}</div>
            </div>
            <button
              type="button"
              onClick={() => {
                soundEngine.play('uiClick');
                (isLan ? onRetryOrLobby : onReturnToMap)();
              }}
              className="w-full min-h-[48px] rounded-lg bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-sm"
            >
              {isLan ? 'Return to LAN Party Lobby' : 'Continue on World Map'}
            </button>
          </div>
        </div>
      )}

      {/* Game Over Modal */}
      {gameOver && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4">
          <div className="w-full max-w-md rounded-xl border border-rose-700/70 bg-[#151015] p-6 space-y-4">
            <h2 className="font-pixel text-xl text-rose-400">FALLEN IN THE DEPTHS</h2>
            <p className="text-sm text-stone-300 leading-relaxed">
              Your delver fell on Floor B{floor.depth} of {region.name}. Retreat to Sanctuary Camp
              with your leveled stats and equipped gear intact, or try the region anew.
            </p>
            <div className="flex flex-col sm:flex-row gap-2.5">
              <button
                type="button"
                onClick={() => {
                  soundEngine.play('uiClick');
                  (isLan ? onRetryOrLobby : onRespawnCamp)();
                }}
                className="flex-1 min-h-[48px] inline-flex items-center justify-center gap-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-sm"
              >
                <RotateCcw className="w-4 h-4" />
                {isLan ? 'Back to LAN Lobby' : 'Return to Camp'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

import React, { useEffect, useRef, useState } from 'react';
import { Wifi, Upload, Play, RotateCcw, Volume2, VolumeX } from 'lucide-react';
import { soundEngine } from '../game/audio.ts';
import { HERO_CLASSES } from '../game/content.ts';
import { getSpriteDataUrl } from '../game/pixelSprites.ts';
import type { HeroClassId, SaveProfile } from '../game/types.ts';
import { PWAInstallButton } from './PWAInstallButton.tsx';

interface TitleScreenProps {
  existingSave: SaveProfile | null;
  muted: boolean;
  onToggleMute: () => void;
  onContinue: () => void;
  onStartNew: (classId: HeroClassId, name: string) => void;
  onOpenLan: () => void;
  onImportSave: (file: File) => void;
}

export const TitleScreen: React.FC<TitleScreenProps> = ({
  existingSave,
  muted,
  onToggleMute,
  onContinue,
  onStartNew,
  onOpenLan,
  onImportSave,
}) => {
  const [creatingNew, setCreatingNew] = useState(!existingSave);
  const [selectedClass, setSelectedClass] = useState<HeroClassId>('warden');
  const [heroName, setHeroName] = useState('Kaelen');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!existingSave) setCreatingNew(true);
  }, [existingSave]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (existingSave && !creatingNew) {
          onContinue();
        } else {
          onStartNew(selectedClass, heroName);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [existingSave, creatingNew, selectedClass, heroName, onContinue, onStartNew]);

  return (
    <div className="relative w-full h-[100dvh] overflow-hidden bg-[#0d0f14] flex flex-col justify-between">
      {/* Full-bleed pixel key-art backdrop */}
      <img
        src="/src/assets/images/title_crypt_backdrop_1795096886132.jpg"
        alt="Cryptbound hooded delver standing before the ancient crypt gate"
        referrerPolicy="no-referrer"
        className="absolute inset-0 w-full h-full object-cover object-center pixelated opacity-90"
      />
      {/* Measured left contrast scrim leaving the hero & gate illuminated on the right */}
      <div className="absolute inset-0 bg-gradient-to-r from-[#0b0d12]/95 via-[#0b0d12]/78 to-[#0b0d12]/20" />
      <div className="absolute inset-0 bg-gradient-to-t from-[#0b0d12]/90 via-transparent to-[#0b0d12]/55" />

      {/* Main Content Container */}
      <div className="relative z-10 flex-1 flex flex-col justify-center px-5 sm:px-10 lg:px-16 max-w-2xl overflow-y-auto py-6">
        {/* Bespoke inline SVG crest + Pixel Title Lockup */}
        <div className="flex items-center gap-3.5 mb-3">
          <svg
            viewBox="0 0 36 36"
            className="w-10 h-10 sm:w-12 sm:h-12 shrink-0"
            shapeRendering="crispEdges"
            aria-hidden="true"
          >
            <rect width="36" height="36" rx="4" fill="#161a24" stroke="#d97706" strokeWidth="2" />
            <rect x="16" y="6" width="4" height="16" fill="#e2e8f0" />
            <rect x="11" y="20" width="14" height="3" fill="#f59e0b" />
            <rect x="16" y="23" width="4" height="6" fill="#92400e" />
            <rect x="15" y="4" width="6" height="2" fill="#fef08a" />
          </svg>
          <div>
            <h1 className="font-pixel text-3xl sm:text-5xl tracking-tight text-stone-100 leading-none">
              CRYPTBOUND
            </h1>
            <p className="mt-1.5 text-xs sm:text-sm text-stone-400">
              Turn-Based Dungeon Crawler · Persistent Realm · Offline &amp; LAN Co-op
            </p>
          </div>
        </div>

        {/* Continue existing offline save or create new delver */}
        {existingSave && !creatingNew ? (
          <div className="mt-6 rounded-xl border border-stone-800 bg-[#12161f]/90 p-5 sm:p-6">
            <div className="flex items-center gap-4">
              <img
                src={getSpriteDataUrl(`hero_${existingSave.hero.classId}`)}
                alt={existingSave.hero.name}
                className="w-14 h-14 pixelated bg-[#0d0f14] rounded-lg p-1.5 border border-stone-700"
              />
              <div className="min-w-0">
                <h2 className="font-pixel text-lg text-amber-400 truncate">
                  {existingSave.hero.name}
                </h2>
                <div className="mt-1 flex flex-wrap items-center gap-x-2 text-xs sm:text-sm text-stone-300 font-mono-num">
                  <span>{HERO_CLASSES[existingSave.hero.classId].name}</span>
                  <span aria-hidden="true">·</span>
                  <span>Lv.{existingSave.hero.level}</span>
                  <span aria-hidden="true">·</span>
                  <span>{existingSave.hero.gold} Gold</span>
                  <span aria-hidden="true">·</span>
                  <span>{existingSave.worldProgress.bossesDefeated.length}/4 Bosses</span>
                </div>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => {
                  soundEngine.play('uiClick');
                  onContinue();
                }}
                className="flex-1 min-w-[180px] min-h-[48px] inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg bg-amber-500 hover:bg-amber-400 active:scale-[0.98] text-stone-950 font-bold text-sm sm:text-base transition-all whitespace-nowrap shrink-0"
              >
                <Play className="w-4 h-4 fill-current" />
                {existingSave.activeRun ? 'Resume Active Delve' : 'Enter World Map'}
              </button>
              <button
                type="button"
                onClick={() => {
                  soundEngine.play('uiClick');
                  setCreatingNew(true);
                }}
                className="min-h-[48px] inline-flex items-center justify-center gap-2 px-4 py-3 rounded-lg border border-stone-700 bg-stone-900/90 hover:border-stone-500 text-stone-200 text-sm font-medium transition-colors whitespace-nowrap shrink-0"
              >
                <RotateCcw className="w-4 h-4" />
                New Hero
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-5 rounded-xl border border-stone-800 bg-[#12161f]/92 p-4 sm:p-5">
            <div className="flex items-center justify-between gap-3 mb-3">
              <span className="text-xs font-medium text-stone-400">Select Calling</span>
              {existingSave && (
                <button
                  type="button"
                  onClick={() => {
                    soundEngine.play('uiClick');
                    setCreatingNew(false);
                  }}
                  className="text-xs text-amber-400 hover:underline min-h-[32px] px-2"
                >
                  Back to Saved Hero
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {(Object.keys(HERO_CLASSES) as HeroClassId[]).map((cid) => {
                const cls = HERO_CLASSES[cid];
                const active = selectedClass === cid;
                return (
                  <button
                    key={cid}
                    type="button"
                    onClick={() => {
                      soundEngine.play('uiClick');
                      setSelectedClass(cid);
                    }}
                    className={`text-left rounded-lg border p-3 transition-all min-h-[48px] ${
                      active
                        ? 'border-amber-500 bg-amber-500/12'
                        : 'border-stone-800 bg-[#0d1017] hover:border-stone-700'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <img
                        src={getSpriteDataUrl(`hero_${cid}`)}
                        alt={cls.name}
                        className="w-9 h-9 pixelated shrink-0"
                      />
                      <div className="min-w-0">
                        <div className="font-pixel text-xs text-stone-100 truncate">
                          {cls.name}
                        </div>
                        <div className="text-[11px] text-stone-400 truncate">{cls.title}</div>
                      </div>
                    </div>
                    <p className="mt-2 text-xs text-stone-400 leading-snug line-clamp-2">
                      {cls.description}
                    </p>
                  </button>
                );
              })}
            </div>

            <div className="mt-4 flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                maxLength={16}
                value={heroName}
                onChange={(e) => setHeroName(e.target.value)}
                placeholder="Hero Name"
                aria-label="Hero Name"
                className="flex-1 min-h-[48px] px-3.5 rounded-lg border border-stone-700 bg-[#0b0d12] text-stone-100 text-sm focus:outline-none focus:border-amber-500"
              />
              <button
                type="button"
                onClick={() => onStartNew(selectedClass, heroName)}
                className="min-h-[48px] inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg bg-amber-500 hover:bg-amber-400 active:scale-[0.98] text-stone-950 font-bold text-sm sm:text-base transition-all whitespace-nowrap shrink-0"
              >
                <Play className="w-4 h-4 fill-current" />
                Start Expedition
              </button>
            </div>
          </div>
        )}

        {/* Secondary actions row: LAN Multiplayer, Import Offline Save, PWA Install */}
        <div className="mt-4 flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => {
              soundEngine.play('uiOpen');
              onOpenLan();
            }}
            className="min-h-[44px] inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-stone-700 bg-[#12161f]/90 hover:border-emerald-500/70 hover:text-emerald-300 text-stone-200 text-sm font-medium transition-colors whitespace-nowrap shrink-0"
          >
            <Wifi className="w-4 h-4" />
            LAN Co-op Party
          </button>

          <button
            type="button"
            onClick={() => {
              soundEngine.play('uiClick');
              fileInputRef.current?.click();
            }}
            className="min-h-[44px] inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-stone-700 bg-[#12161f]/90 hover:border-stone-500 text-stone-300 text-sm font-medium transition-colors whitespace-nowrap shrink-0"
          >
            <Upload className="w-4 h-4" />
            Import Save
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onImportSave(file);
              e.target.value = '';
            }}
          />

          <button
            type="button"
            onClick={onToggleMute}
            className="min-h-[44px] inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-lg border border-stone-700 bg-[#12161f]/90 hover:border-amber-500/60 text-stone-300 text-sm font-medium transition-colors whitespace-nowrap shrink-0"
            aria-label={muted ? 'Unmute Sound Effects' : 'Mute Sound Effects'}
          >
            {muted ? <VolumeX className="w-4 h-4 text-stone-400" /> : <Volume2 className="w-4 h-4 text-amber-400" />}
            <span>{muted ? 'Sound Off' : 'Sound On'}</span>
          </button>

          <PWAInstallButton />
        </div>
      </div>

      {/* Single flat control-hint line */}
      <div className="relative z-10 px-5 sm:px-10 lg:px-16 pb-4">
        <p className="text-xs text-stone-400/90 font-mono-num">
          Tap Tile or D-Pad Move · Bump to Attack · 1–3 Skills · I Inventory · M Map
        </p>
      </div>
    </div>
  );
};

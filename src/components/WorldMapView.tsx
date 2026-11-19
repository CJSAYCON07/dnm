import React, { useState } from 'react';
import {
  BookOpen,
  CheckCircle2,
  Compass,
  Flame,
  Lock,
  Shield,
  Skull,
  Tent,
  Volume2,
  VolumeX,
  Wifi,
  ArrowLeft,
} from 'lucide-react';
import { soundEngine } from '../game/audio.ts';
import { REGIONS } from '../game/content.ts';
import type { RegionId, SaveProfile } from '../game/types.ts';

interface WorldMapViewProps {
  profile: SaveProfile;
  muted: boolean;
  onToggleMute: () => void;
  onEnterRegion: (regionId: RegionId) => void;
  onResumeActiveRun: () => void;
  onOpenCamp: () => void;
  onOpenBestiary: () => void;
  onOpenLan: () => void;
  onBackTitle: () => void;
}

export const WorldMapView: React.FC<WorldMapViewProps> = ({
  profile,
  muted,
  onToggleMute,
  onEnterRegion,
  onResumeActiveRun,
  onOpenCamp,
  onOpenBestiary,
  onOpenLan,
  onBackTitle,
}) => {
  const [selectedRegion, setSelectedRegion] = useState<RegionId>(
    profile.activeRun?.regionId ?? 'catacombs'
  );

  const region = REGIONS[selectedRegion];
  const isUnlocked = profile.worldProgress.unlockedRegions.includes(selectedRegion);
  const isCleared = profile.worldProgress.clearedRegions.includes(selectedRegion);
  const bestDepth = profile.worldProgress.bestDepthByRegion[selectedRegion] ?? 0;

  return (
    <div className="relative w-full h-[100dvh] bg-[#0d0f14] flex flex-col overflow-hidden">
      {/* Compact Top Bar */}
      <header className="relative z-20 flex items-center justify-between gap-4 px-4 sm:px-6 h-14 border-b border-stone-800/90 bg-[#10131b]/95 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={onBackTitle}
            className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-lg border border-stone-800 bg-stone-900 hover:border-stone-600 text-stone-200 transition-colors"
            aria-label="Back to Title"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="min-w-0">
            <h1 className="font-pixel text-sm sm:text-base text-stone-100 truncate">
              REALM ATLAS
            </h1>
            <div className="text-[11px] text-stone-400 font-mono-num truncate">
              {profile.hero.name} · Lv.{profile.hero.level} · {profile.hero.gold}g ·{' '}
              {profile.worldProgress.bossesDefeated.length}/4 Bosses
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onToggleMute}
            className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-lg border border-stone-700 bg-stone-900 hover:border-amber-500/60 text-stone-200 transition-colors"
            aria-label={muted ? 'Unmute Sound' : 'Mute Sound'}
          >
            {muted ? <VolumeX className="w-4 h-4 text-stone-400" /> : <Volume2 className="w-4 h-4 text-amber-400" />}
          </button>
          <button
            type="button"
            onClick={() => {
              soundEngine.play('uiOpen');
              onOpenBestiary();
            }}
            className="min-h-[44px] inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-stone-700 bg-stone-900 hover:border-amber-500/60 text-stone-200 text-xs sm:text-sm font-medium transition-colors whitespace-nowrap"
          >
            <BookOpen className="w-4 h-4 text-amber-400" />
            <span className="hidden sm:inline">Bestiary</span>
          </button>
          <button
            type="button"
            onClick={() => {
              soundEngine.play('uiOpen');
              onOpenCamp();
            }}
            className="min-h-[44px] inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-stone-700 bg-stone-900 hover:border-amber-500/60 text-stone-200 text-xs sm:text-sm font-medium transition-colors whitespace-nowrap"
          >
            <Tent className="w-4 h-4 text-amber-400" />
            <span>Camp</span>
          </button>
          <button
            type="button"
            onClick={() => {
              soundEngine.play('uiOpen');
              onOpenLan();
            }}
            className="min-h-[44px] inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-stone-700 bg-stone-900 hover:border-emerald-500/60 text-stone-200 text-xs sm:text-sm font-medium transition-colors whitespace-nowrap"
          >
            <Wifi className="w-4 h-4 text-emerald-400" />
            <span className="hidden sm:inline">LAN Co-op</span>
          </button>
        </div>
      </header>

      {/* Main Split: Interactive Pixel Atlas + Region Briefing Panel */}
      <div className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-hidden">
        {/* Interactive Map Canvas */}
        <div className="relative flex-1 min-h-[260px] bg-[#090b0f] overflow-hidden flex items-center justify-center">
          <img
            src="/src/assets/images/world_realm_atlas_1795096886067.jpg"
            alt="Cryptbound persistent world map showing four dungeon regions"
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover pixelated select-none"
          />
          <div className="absolute inset-0 bg-black/25 pointer-events-none" />

          {/* Interactive Region Pins aligned to the four landmarks */}
          {(Object.keys(REGIONS) as RegionId[]).map((rid) => {
            const r = REGIONS[rid];
            const unlocked = profile.worldProgress.unlockedRegions.includes(rid);
            const cleared = profile.worldProgress.clearedRegions.includes(rid);
            const selected = selectedRegion === rid;
            const hasActiveRun = profile.activeRun?.regionId === rid;

            return (
              <button
                key={rid}
                type="button"
                onClick={() => {
                  soundEngine.play('uiClick');
                  setSelectedRegion(rid);
                }}
                style={{ left: `${r.mapPos.xPct}%`, top: `${r.mapPos.yPct}%` }}
                className={`absolute -translate-x-1/2 -translate-y-1/2 min-h-[44px] min-w-[44px] px-3 py-1.5 rounded-lg border flex items-center gap-2 transition-transform active:scale-95 ${
                  selected
                    ? 'border-amber-400 bg-[#121621]/95 text-stone-100 scale-105 z-20'
                    : unlocked
                    ? 'border-stone-600 bg-[#10131c]/90 text-stone-200 hover:border-amber-500/70 z-10'
                    : 'border-stone-800 bg-[#0b0d12]/90 text-stone-500 z-10'
                }`}
              >
                {cleared ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                ) : unlocked ? (
                  <Compass className="w-4 h-4 text-amber-400 shrink-0" />
                ) : (
                  <Lock className="w-4 h-4 text-stone-500 shrink-0" />
                )}
                <span className="font-pixel text-[11px] sm:text-xs whitespace-nowrap">
                  {r.name}
                </span>
                {hasActiveRun && (
                  <span className="text-[10px] font-mono-num text-amber-300">
                    (B{profile.activeRun?.depth})
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Region Briefing & Launch Panel */}
        <aside className="w-full lg:w-[380px] shrink-0 border-t lg:border-t-0 lg:border-l border-stone-800 bg-[#12151e] p-4 sm:p-6 flex flex-col justify-between overflow-y-auto">
          <div>
            <div className="flex items-center justify-between gap-2 text-xs text-stone-400 font-mono-num">
              <span>{region.recommendedLevel}</span>
              <span aria-hidden="true">·</span>
              <span>{region.floors} Floors</span>
              <span aria-hidden="true">·</span>
              <span>
                {isCleared ? 'Cleared' : isUnlocked ? 'Unlocked' : 'Locked'}
              </span>
            </div>

            <h2 className="mt-2 font-pixel text-lg sm:text-xl text-stone-100">
              {region.name}
            </h2>
            <p className="mt-1.5 text-sm text-stone-400 leading-relaxed">
              {region.subtitle}
            </p>

            <div className="mt-4 pt-4 border-t border-stone-800/80 space-y-3">
              <div className="flex items-start gap-3">
                <Skull className="w-4 h-4 text-rose-400 mt-0.5 shrink-0" />
                <div>
                  <div className="text-xs text-stone-400">Region Boss</div>
                  <div className="text-sm font-semibold text-stone-100">
                    {region.bossName}
                  </div>
                  <div className="text-xs text-stone-400">{region.bossTitle}</div>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Shield className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
                <div>
                  <div className="text-xs text-stone-400">Expedition Progress</div>
                  <div className="text-sm font-mono-num text-stone-200">
                    Deepest Floor Reached: {bestDepth > 0 ? `B${bestDepth}/${region.floors}` : 'Unexplored'}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-5 pt-4 border-t border-stone-800/80 space-y-2.5">
            {profile.activeRun && profile.activeRun.regionId === selectedRegion && (
              <button
                type="button"
                onClick={onResumeActiveRun}
                className="w-full min-h-[48px] inline-flex items-center justify-center gap-2 px-5 py-3 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-stone-950 font-bold text-sm transition-colors"
              >
                <Flame className="w-4 h-4" />
                Resume Floor B{profile.activeRun.depth}
              </button>
            )}

            <button
              type="button"
              disabled={!isUnlocked}
              onClick={() => onEnterRegion(selectedRegion)}
              className={`w-full min-h-[48px] inline-flex items-center justify-center gap-2 px-5 py-3 rounded-lg font-bold text-sm transition-colors ${
                isUnlocked
                  ? 'bg-amber-500 hover:bg-amber-400 text-stone-950'
                  : 'bg-stone-800 text-stone-500 cursor-not-allowed'
              }`}
            >
              {isUnlocked
                ? profile.activeRun?.regionId === selectedRegion
                  ? 'Start Fresh Delve (B1)'
                  : `Descend into ${region.name}`
                : 'Defeat Previous Region Boss to Unlock'}
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
};

import React, { useMemo, useState } from 'react';
import { ArrowLeft, BookOpen, Lock, Skull } from 'lucide-react';
import { soundEngine } from '../game/audio.ts';
import { MONSTER_TEMPLATES } from '../game/content.ts';
import { getSpriteDataUrl } from '../game/pixelSprites.ts';

interface BestiaryViewProps {
  bestiary: Record<string, number>;
  onBack?: () => void;
  embedded?: boolean;
}

type BestiaryFilter = 'all' | 'defeated' | 'bosses';

export const BestiaryView: React.FC<BestiaryViewProps> = ({
  bestiary,
  onBack,
  embedded = false,
}) => {
  const [filter, setFilter] = useState<BestiaryFilter>('all');

  const allMonsters = useMemo(() => Object.values(MONSTER_TEMPLATES), []);

  const stats = useMemo(() => {
    let discovered = 0;
    let bossesSlain = 0;
    let totalKills = 0;
    for (const m of allMonsters) {
      const k = bestiary[m.id] ?? 0;
      totalKills += k;
      if (k > 0) {
        discovered += 1;
        if (m.isBoss) bossesSlain += 1;
      }
    }
    return {
      discovered,
      totalSpecies: allMonsters.length,
      bossesSlain,
      totalBosses: allMonsters.filter((m) => m.isBoss).length,
      totalKills,
    };
  }, [allMonsters, bestiary]);

  const filtered = useMemo(() => {
    return allMonsters.filter((m) => {
      const kills = bestiary[m.id] ?? 0;
      if (filter === 'defeated') return kills > 0;
      if (filter === 'bosses') return Boolean(m.isBoss);
      return true;
    });
  }, [allMonsters, bestiary, filter]);

  const filterBar = (
    <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs sm:text-sm font-mono-num text-stone-300">
        <span>
          Discovered <strong className="text-amber-400">{stats.discovered}/{stats.totalSpecies}</strong>
        </span>
        <span aria-hidden="true" className="text-stone-600">·</span>
        <span>
          Bosses <strong className="text-rose-400">{stats.bossesSlain}/{stats.totalBosses}</strong>
        </span>
        <span aria-hidden="true" className="text-stone-600">·</span>
        <span>
          Total Slain <strong className="text-stone-100">{stats.totalKills}</strong>
        </span>
      </div>

      <div className="flex items-center gap-1 p-1 rounded-lg bg-[#0b0d12] border border-stone-800">
        {([
          { id: 'all', label: 'All Foes' },
          { id: 'defeated', label: 'Unlocked' },
          { id: 'bosses', label: 'Bosses' },
        ] as const).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => {
              soundEngine.play('uiClick');
              setFilter(tab.id);
            }}
            className={`min-h-[36px] px-3 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
              filter === tab.id
                ? 'bg-amber-500 text-stone-950 font-semibold'
                : 'text-stone-400 hover:text-stone-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  );

  const gridContent = (
    <div>
      {filterBar}

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-stone-800 bg-[#12161f] p-8 text-center">
          <BookOpen className="w-7 h-7 text-stone-500 mx-auto mb-2" />
          <p className="text-sm text-stone-300 font-medium">No entries unlocked in this filter yet.</p>
          <p className="mt-1 text-xs text-stone-500">
            Defeat monsters in the dungeon depths to record their pixel dossiers and lore.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((m) => {
            const kills = bestiary[m.id] ?? 0;
            const unlocked = kills > 0;

            return (
              <article
                key={m.id}
                className={`rounded-xl border p-4 flex flex-col justify-between transition-colors ${
                  m.isBoss
                    ? unlocked
                      ? 'border-rose-800/80 bg-[#171016]'
                      : 'border-rose-950/60 bg-[#110d11]'
                    : unlocked
                    ? 'border-stone-700/80 bg-[#12161f]'
                    : 'border-stone-800/70 bg-[#0d1017]'
                }`}
              >
                <div>
                  <div className="flex items-start gap-3.5">
                    {/* Pixel Art Icon Frame */}
                    <div
                      className={`relative w-14 h-14 rounded-lg border flex items-center justify-center shrink-0 ${
                        unlocked
                          ? m.isBoss
                            ? 'border-rose-700/70 bg-[#0c080c]'
                            : 'border-stone-700 bg-[#0b0d12]'
                          : 'border-stone-800 bg-[#090b0f]'
                      }`}
                    >
                      <img
                        src={getSpriteDataUrl(m.spriteKey)}
                        alt={unlocked ? m.name : 'Undiscovered enemy'}
                        className={`w-11 h-11 pixelated ${
                          unlocked ? '' : 'opacity-20 grayscale brightness-50'
                        }`}
                      />
                      {!unlocked && (
                        <Lock
                          className="w-4 h-4 text-stone-500 absolute"
                          aria-hidden="true"
                        />
                      )}
                    </div>

                    {/* Title & Kill Readout */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        {m.isBoss && (
                          <Skull
                            className={`w-3.5 h-3.5 shrink-0 ${
                              unlocked ? 'text-rose-400' : 'text-stone-600'
                            }`}
                          />
                        )}
                        <h3 className="font-pixel text-xs sm:text-sm text-stone-100 truncate">
                          {unlocked ? m.name : m.isBoss ? 'Uncharted Boss' : 'Uncharted Foe'}
                        </h3>
                      </div>

                      <div className="mt-1 text-[11px] font-mono-num text-stone-400 truncate">
                        {unlocked ? m.habitat : 'Unknown Habitat'}
                      </div>

                      <div className="mt-1.5 flex items-center gap-2 text-xs font-mono-num">
                        <span className={unlocked ? 'text-amber-400 font-semibold' : 'text-stone-500'}>
                          Slain: {kills}
                        </span>
                        {unlocked && (
                          <>
                            <span aria-hidden="true" className="text-stone-600">·</span>
                            <span className="text-stone-300">
                              HP {m.baseHp} / ATK {m.baseAtk} / DEF {m.baseDef}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Lore Description */}
                  <div className="mt-3.5 pt-3 border-t border-stone-800/80">
                    {unlocked ? (
                      <p className="text-xs sm:text-[13px] text-stone-300 leading-relaxed">
                        {m.lore}
                      </p>
                    ) : (
                      <p className="text-xs text-stone-500 italic leading-relaxed">
                        Defeat this enemy type in the dungeon depths to unlock its pixel icon and
                        field lore.
                      </p>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );

  if (embedded) {
    return gridContent;
  }

  return (
    <div className="w-full h-[100dvh] bg-[#0d0f14] flex flex-col overflow-hidden">
      <header className="flex items-center justify-between gap-4 px-4 sm:px-6 h-14 border-b border-stone-800 bg-[#10131b] shrink-0">
        <div className="flex items-center gap-3">
          {onBack && (
            <button
              type="button"
              onClick={() => {
                soundEngine.play('uiClose');
                onBack();
              }}
              className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-lg border border-stone-800 bg-stone-900 hover:border-stone-600 text-stone-200 transition-colors"
              aria-label="Back"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}
          <div>
            <h1 className="font-pixel text-sm sm:text-base text-amber-400">CRYPT BESTIARY</h1>
            <div className="text-[11px] text-stone-400 font-mono-num">
              Defeated Monster Lore &amp; Field Dossiers
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-4 sm:p-6 max-w-6xl w-full mx-auto">
        {gridContent}
      </main>
    </div>
  );
};

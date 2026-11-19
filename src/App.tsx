import { useCallback, useEffect, useRef, useState } from 'react';
import { BestiaryView } from './components/BestiaryView.tsx';
import { CampView } from './components/CampView.tsx';
import { GamePlayView } from './components/GamePlayView.tsx';
import { LanLobbyModal } from './components/LanLobbyModal.tsx';
import { TitleScreen } from './components/TitleScreen.tsx';
import { WorldMapView } from './components/WorldMapView.tsx';
import { soundEngine } from './game/audio.ts';
import { resolveTurnAction } from './game/combatEngine.ts';
import { REGIONS } from './game/content.ts';
import { computeFOV, generateDungeonFloor, getHeroDerivedStats } from './game/dungeonGen.ts';
import {
  createFreshSaveProfile,
  exportSaveAsJson,
  loadProfileOffline,
  saveProfileOffline,
} from './game/saveStorage.ts';
import type {
  CombatEvent,
  HeroClassId,
  LanRoomState,
  PlayerAction,
  RegionId,
  SaveProfile,
} from './game/types.ts';
import { LanMultiplayerClient, type LanStatus } from './network/lanClient.ts';

type ScreenState = 'TITLE_MENU' | 'WORLD_MAP' | 'CAMP' | 'BESTIARY' | 'PLAYING';

export default function App() {
  const [loaded, setLoaded] = useState(false);
  const [profile, setProfile] = useState<SaveProfile | null>(null);
  const [muted, setMuted] = useState(false);
  const [screen, setScreen] = useState<ScreenState>('TITLE_MENU');

  // Solo Play transient UI state
  const [soloLogs, setSoloLogs] = useState<string[]>([]);
  const [soloEvents, setSoloEvents] = useState<CombatEvent[]>([]);
  const [soloVictory, setSoloVictory] = useState(false);
  const [soloGameOver, setSoloGameOver] = useState(false);

  // LAN Multiplayer state
  const [lanOpen, setLanOpen] = useState(false);
  const [lanStatus, setLanStatus] = useState<LanStatus>('disconnected');
  const [lanRoom, setLanRoom] = useState<LanRoomState | null>(null);
  const [lanError, setLanError] = useState<string | null>(null);
  const lanClientRef = useRef<LanMultiplayerClient | null>(null);

  // Load offline save on startup
  useEffect(() => {
    void (async () => {
      const saved = await loadProfileOffline();
      if (saved) {
        soundEngine.muted = saved.settings.muted;
        setMuted(saved.settings.muted);
        setProfile(saved);
      }
      setLoaded(true);
    })();
  }, []);

  // Auto-persist offline save whenever profile changes
  useEffect(() => {
    if (!profile) return;
    soundEngine.muted = profile.settings.muted;
    setMuted(profile.settings.muted);
    void saveProfileOffline(profile);
  }, [profile]);

  // Initialize LAN client lazily
  const ensureLanClient = useCallback(() => {
    if (!lanClientRef.current) {
      lanClientRef.current = new LanMultiplayerClient(
        (room, sfx) => {
          setLanRoom(room);
          for (const s of sfx) soundEngine.play(s);
          if (room && room.status === 'playing' && room.floor) {
            setLanOpen(false);
            setScreen('PLAYING');
          }
        },
        (msg) => setLanError(msg),
        (st) => setLanStatus(st)
      );
    }
    return lanClientRef.current;
  }, []);

  useEffect(() => {
    return () => {
      lanClientRef.current?.disconnect();
    };
  }, []);

  const handleStartNew = useCallback((classId: HeroClassId, name: string) => {
    const fresh = createFreshSaveProfile(classId, name);
    setProfile(fresh);
    setSoloLogs([]);
    setSoloEvents([]);
    setSoloVictory(false);
    setSoloGameOver(false);
    soundEngine.play('door');
    setScreen('WORLD_MAP');
  }, []);

  const handleContinue = useCallback(() => {
    if (!profile) return;
    setSoloVictory(false);
    setSoloGameOver(false);
    if (profile.activeRun && profile.hero.alive) {
      setScreen('PLAYING');
    } else {
      setScreen('WORLD_MAP');
    }
  }, [profile]);

  const handleImportSave = useCallback(async (file: File) => {
    try {
      const txt = await file.text();
      const parsed = JSON.parse(txt) as SaveProfile;
      if (parsed && parsed.version === 1 && parsed.hero && parsed.worldProgress) {
        setProfile(parsed);
        await saveProfileOffline(parsed);
        soundEngine.play('levelUp');
        setScreen('WORLD_MAP');
      }
    } catch {
      // ignore invalid file
    }
  }, []);

  const handleEnterRegion = useCallback(
    (regionId: RegionId) => {
      if (!profile) return;
      const derived = getHeroDerivedStats(profile.hero);
      const heroCopy = {
        ...profile.hero,
        alive: true,
        hp: profile.hero.hp > 0 ? Math.min(derived.maxHp, profile.hero.hp) : derived.maxHp,
        mp: Math.min(derived.maxMp, profile.hero.mp),
      };
      const floor = generateDungeonFloor(regionId, 1, Date.now(), heroCopy.level);
      const start = floor.rooms[0];
      heroCopy.x = start.cx;
      heroCopy.y = start.cy;
      floor.visibility = computeFOV(floor, [heroCopy]);

      const best = Math.max(profile.worldProgress.bestDepthByRegion[regionId] ?? 0, 1);

      setProfile({
        ...profile,
        hero: heroCopy,
        activeRun: floor,
        worldProgress: {
          ...profile.worldProgress,
          bestDepthByRegion: {
            ...profile.worldProgress.bestDepthByRegion,
            [regionId]: best,
          },
        },
      });
      setSoloLogs([`Entered ${REGIONS[regionId].name} (Floor B1).`]);
      setSoloEvents([]);
      setSoloVictory(false);
      setSoloGameOver(false);
      soundEngine.play('door');
      setScreen('PLAYING');
    },
    [profile]
  );

  const handleSoloAction = useCallback(
    (action: PlayerAction) => {
      if (!profile || !profile.activeRun) return;

      const res = resolveTurnAction(
        profile.activeRun,
        { [profile.hero.id]: profile.hero },
        profile.hero.id,
        action
      );

      for (const s of res.sfx) soundEngine.play(s);
      if (res.logs.length > 0) {
        setSoloLogs((prev) => [...prev, ...res.logs].slice(-20));
      }
      if (res.events.length > 0) {
        setSoloEvents(res.events);
      }

      const nextHero = res.heroes[profile.hero.id];
      const regionId = res.floor.regionId;
      const nextBestiary = { ...profile.bestiary };
      for (const k of res.killsThisTurn) {
        nextBestiary[k] = (nextBestiary[k] ?? 0) + 1;
      }

      let nextProgress = {
        ...profile.worldProgress,
        totalKills: profile.worldProgress.totalKills + res.killsThisTurn.length,
        totalGoldEarned: profile.worldProgress.totalGoldEarned + res.goldGained,
        bestDepthByRegion: {
          ...profile.worldProgress.bestDepthByRegion,
          [regionId]: Math.max(
            profile.worldProgress.bestDepthByRegion[regionId] ?? 0,
            res.floor.depth
          ),
        },
      };

      if (res.floor.bossDefeated) {
        const bossId = `boss_${regionId}`;
        if (!nextProgress.bossesDefeated.includes(bossId)) {
          nextProgress.bossesDefeated = [...nextProgress.bossesDefeated, bossId];
        }
      }

      if (res.regionCleared) {
        if (!nextProgress.clearedRegions.includes(regionId)) {
          nextProgress.clearedRegions = [...nextProgress.clearedRegions, regionId];
        }
        const unlocked = new Set(nextProgress.unlockedRegions);
        for (const u of REGIONS[regionId].unlocks) unlocked.add(u);
        nextProgress.unlockedRegions = Array.from(unlocked);
        setSoloVictory(true);
      }

      if (res.heroDied) {
        setSoloGameOver(true);
      }

      setProfile({
        ...profile,
        hero: nextHero,
        bestiary: nextBestiary,
        worldProgress: nextProgress,
        activeRun: res.regionCleared ? null : res.floor,
      });
    },
    [profile]
  );

  const handleRespawnCamp = useCallback(() => {
    if (!profile) return;
    const d = getHeroDerivedStats(profile.hero);
    setProfile({
      ...profile,
      hero: {
        ...profile.hero,
        alive: true,
        hp: d.maxHp,
        mp: d.maxMp,
        buffs: { shieldTurns: 0, stealthTurns: 0, poisonTurns: 0 },
      },
      activeRun: null,
    });
    setSoloGameOver(false);
    setSoloVictory(false);
    setScreen('CAMP');
  }, [profile]);

  const handleToggleMute = useCallback(() => {
    const nextMuted = !(profile?.settings.muted ?? muted);
    soundEngine.muted = nextMuted;
    setMuted(nextMuted);
    if (!nextMuted) {
      soundEngine.play('uiClick');
    }
    if (profile) {
      setProfile({
        ...profile,
        settings: { ...profile.settings, muted: nextMuted },
      });
    }
  }, [profile, muted]);

  const handleToggleDpad = useCallback(() => {
    if (!profile) return;
    setProfile({
      ...profile,
      settings: { ...profile.settings, showDpad: !profile.settings.showDpad },
    });
  }, [profile]);

  // LAN Handlers
  const handleLanAction = useCallback((action: PlayerAction) => {
    lanClientRef.current?.sendAction(action);
  }, []);

  const handleLanCreate = useCallback(
    async (name: string, classId: HeroClassId, regionId: RegionId, customUrl?: string) => {
      setLanError(null);
      const client = ensureLanClient();
      try {
        await client.connect(customUrl);
        const snap = profile?.hero ?? createFreshSaveProfile(classId, name).hero;
        client.createRoom(name, classId, regionId, snap);
      } catch (err) {
        setLanError(err instanceof Error ? err.message : 'Failed to connect to LAN server.');
      }
    },
    [ensureLanClient, profile]
  );

  const handleLanJoin = useCallback(
    async (code: string, name: string, classId: HeroClassId, customUrl?: string) => {
      setLanError(null);
      const client = ensureLanClient();
      try {
        await client.connect(customUrl);
        const snap = profile?.hero ?? createFreshSaveProfile(classId, name).hero;
        client.joinRoom(code, name, classId, snap);
      } catch (err) {
        setLanError(err instanceof Error ? err.message : 'Failed to join LAN room.');
      }
    },
    [ensureLanClient, profile]
  );

  if (!loaded) {
    return (
      <div className="w-full h-[100dvh] bg-[#0d0f14] flex items-center justify-center">
        <span className="font-pixel text-sm text-stone-400">LOADING CRYPTBOUND...</span>
      </div>
    );
  }

  const isLanPlaying = Boolean(
    screen === 'PLAYING' && lanRoom && lanRoom.status !== 'lobby' && lanRoom.floor
  );

  return (
    <div className="w-full h-[100dvh] overflow-hidden bg-[#0d0f14]">
      {screen === 'TITLE_MENU' && (
        <TitleScreen
          existingSave={profile}
          muted={muted}
          onToggleMute={handleToggleMute}
          onContinue={handleContinue}
          onStartNew={handleStartNew}
          onOpenLan={() => setLanOpen(true)}
          onImportSave={(f) => void handleImportSave(f)}
        />
      )}

      {screen === 'WORLD_MAP' && profile && (
        <WorldMapView
          profile={profile}
          muted={muted}
          onToggleMute={handleToggleMute}
          onEnterRegion={handleEnterRegion}
          onResumeActiveRun={() => {
            setSoloVictory(false);
            setSoloGameOver(false);
            setScreen('PLAYING');
          }}
          onOpenCamp={() => setScreen('CAMP')}
          onOpenBestiary={() => setScreen('BESTIARY')}
          onOpenLan={() => setLanOpen(true)}
          onBackTitle={() => setScreen('TITLE_MENU')}
        />
      )}

      {screen === 'BESTIARY' && profile && (
        <BestiaryView
          bestiary={profile.bestiary}
          onBack={() => setScreen('WORLD_MAP')}
        />
      )}

      {screen === 'CAMP' && profile && (
        <CampView
          profile={profile}
          onUpdateProfile={setProfile}
          onBackToMap={() => setScreen('WORLD_MAP')}
        />
      )}

      {screen === 'PLAYING' && isLanPlaying && lanRoom && lanRoom.floor && (
        <GamePlayView
          floor={lanRoom.floor}
          heroes={lanRoom.heroes}
          activeHeroId={lanClientRef.current?.peerId ?? Object.keys(lanRoom.heroes)[0]}
          logs={lanRoom.logs}
          events={lanRoom.events}
          isLan={true}
          lanRoomCode={lanRoom.code}
          muted={profile?.settings.muted ?? soundEngine.muted}
          showDpad={profile?.settings.showDpad ?? true}
          gameOver={lanRoom.status === 'gameover'}
          victory={lanRoom.status === 'victory'}
          onAction={handleLanAction}
          onToggleMute={() => {
            if (profile) handleToggleMute();
            else soundEngine.muted = !soundEngine.muted;
          }}
          onToggleDpad={() => {
            if (profile) handleToggleDpad();
          }}
          onReturnToMap={() => {
            setLanOpen(true);
          }}
          onRespawnCamp={() => {
            setLanOpen(true);
          }}
          onExportSave={() => {
            if (profile) exportSaveAsJson(profile);
          }}
          onRetryOrLobby={() => {
            if (lanClientRef.current && lanRoom.hostId === lanClientRef.current.peerId) {
              lanClientRef.current.returnLobby();
            } else {
              lanClientRef.current?.disconnect();
              setLanRoom(null);
            }
            setScreen(profile ? 'WORLD_MAP' : 'TITLE_MENU');
            setLanOpen(true);
          }}
        />
      )}

      {screen === 'PLAYING' && !isLanPlaying && profile && profile.activeRun && (
        <GamePlayView
          floor={profile.activeRun}
          heroes={{ [profile.hero.id]: profile.hero }}
          activeHeroId={profile.hero.id}
          logs={soloLogs}
          events={soloEvents}
          isLan={false}
          muted={profile.settings.muted}
          showDpad={profile.settings.showDpad}
          gameOver={soloGameOver}
          victory={soloVictory}
          onAction={handleSoloAction}
          onToggleMute={handleToggleMute}
          onToggleDpad={handleToggleDpad}
          onReturnToMap={() => {
            setSoloVictory(false);
            setSoloGameOver(false);
            setScreen('WORLD_MAP');
          }}
          onRespawnCamp={handleRespawnCamp}
          onExportSave={() => exportSaveAsJson(profile)}
          onRetryOrLobby={() => setScreen('WORLD_MAP')}
        />
      )}

      {lanOpen && (
        <LanLobbyModal
          hero={profile?.hero ?? createFreshSaveProfile('warden', 'Delver').hero}
          lanStatus={lanStatus}
          lanRoom={lanRoom}
          peerId={lanClientRef.current?.peerId ?? null}
          errorMsg={lanError}
          onConnectAndCreate={(n, c, r, u) => void handleLanCreate(n, c, r, u)}
          onConnectAndJoin={(code, n, c, u) => void handleLanJoin(code, n, c, u)}
          onSetRegion={(rid) => lanClientRef.current?.setRegion(rid)}
          onToggleReady={() => lanClientRef.current?.toggleReady()}
          onStartRun={() => lanClientRef.current?.startRun()}
          onLeave={() => {
            lanClientRef.current?.disconnect();
            setLanRoom(null);
          }}
          onClose={() => setLanOpen(false)}
        />
      )}
    </div>
  );
}

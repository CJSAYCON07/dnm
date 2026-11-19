import React, { useEffect, useState } from 'react';
import { Check, Copy, Play, RefreshCw, Users, Wifi, X } from 'lucide-react';
import { soundEngine } from '../game/audio.ts';
import { HERO_CLASSES, REGIONS } from '../game/content.ts';
import { getSpriteDataUrl } from '../game/pixelSprites.ts';
import type { HeroClassId, HeroState, LanRoomState, RegionId } from '../game/types.ts';
import { fetchLanInfo, type LanHostInfo, type LanStatus } from '../network/lanClient.ts';

interface LanLobbyModalProps {
  hero: HeroState;
  lanStatus: LanStatus;
  lanRoom: LanRoomState | null;
  peerId: string | null;
  errorMsg: string | null;
  onConnectAndCreate: (name: string, classId: HeroClassId, regionId: RegionId, customUrl?: string) => void;
  onConnectAndJoin: (code: string, name: string, classId: HeroClassId, customUrl?: string) => void;
  onSetRegion: (regionId: RegionId) => void;
  onToggleReady: () => void;
  onStartRun: () => void;
  onLeave: () => void;
  onClose: () => void;
}

export const LanLobbyModal: React.FC<LanLobbyModalProps> = ({
  hero,
  lanStatus,
  lanRoom,
  peerId,
  errorMsg,
  onConnectAndCreate,
  onConnectAndJoin,
  onSetRegion,
  onToggleReady,
  onStartRun,
  onLeave,
  onClose,
}) => {
  const [name, setName] = useState(hero.name);
  const [classId, setClassId] = useState<HeroClassId>(hero.classId);
  const [roomCode, setRoomCode] = useState('');
  const [customHost, setCustomHost] = useState('');
  const [lanInfo, setLanInfo] = useState<LanHostInfo | null>(null);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);

  const refreshLan = async () => {
    const info = await fetchLanInfo(customHost);
    if (info) setLanInfo(info);
  };

  useEffect(() => {
    void refreshLan();
  }, []);

  const copyText = (txt: string) => {
    void navigator.clipboard?.writeText(txt);
    setCopiedUrl(txt);
    setTimeout(() => setCopiedUrl(null), 1600);
  };

  const isHost = Boolean(lanRoom && peerId && lanRoom.hostId === peerId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 sm:p-5">
      <div className="w-full max-w-2xl max-h-[92dvh] rounded-xl border border-stone-700 bg-[#12151e] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-stone-800 bg-[#0e1118]">
          <div className="flex items-center gap-2.5">
            <Wifi className="w-5 h-5 text-emerald-400" />
            <div>
              <h2 className="font-pixel text-sm sm:text-base text-stone-100">LAN MULTIPLAYER</h2>
              <p className="text-xs text-stone-400">
                Real-time local Wi-Fi co-op (up to 4 heroes on shared dungeon floors)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              soundEngine.play('uiClose');
              onClose();
            }}
            className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-lg border border-stone-700 bg-stone-900 text-stone-200 hover:border-stone-500"
            aria-label="Close LAN Lobby"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {errorMsg && (
            <div className="rounded-lg border border-rose-700/70 bg-rose-950/50 px-3.5 py-2.5 text-xs text-rose-200">
              {errorMsg}
            </div>
          )}

          {/* Active Room Lobby View */}
          {lanRoom ? (
            <div className="space-y-4">
              <div className="rounded-lg border border-emerald-700/50 bg-emerald-950/20 p-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-xs text-emerald-300/80">Room Code</div>
                  <div className="font-pixel text-2xl tracking-widest text-emerald-300">
                    {lanRoom.code}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-stone-400">Destination</div>
                  <div className="text-sm font-semibold text-stone-100">
                    {REGIONS[lanRoom.regionId].name}
                  </div>
                </div>
              </div>

              {lanInfo && lanInfo.lanUrls.length > 0 && (
                <div className="rounded-lg border border-stone-800 bg-[#0b0d12] p-3">
                  <div className="text-xs text-stone-400 mb-1.5">
                    Other phones on the same Wi-Fi can open:
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {lanInfo.lanUrls.map((u) => (
                      <button
                        key={u}
                        type="button"
                        onClick={() => copyText(u)}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded border border-stone-700 bg-stone-900 text-xs font-mono-num text-amber-300 hover:border-amber-500/60"
                      >
                        {copiedUrl === u ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        {u}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Region Picker (Host only) */}
              {isHost && (
                <div>
                  <div className="text-xs text-stone-400 mb-2">Select Dungeon Region</div>
                  <div className="grid grid-cols-2 gap-2">
                    {(Object.keys(REGIONS) as RegionId[]).map((rid) => (
                      <button
                        key={rid}
                        type="button"
                        onClick={() => {
                          soundEngine.play('uiClick');
                          onSetRegion(rid);
                        }}
                        className={`min-h-[44px] px-3 py-2 rounded-lg border text-left text-xs transition-colors ${
                          lanRoom.regionId === rid
                            ? 'border-amber-500 bg-amber-500/15 text-stone-100 font-semibold'
                            : 'border-stone-800 bg-[#0d1017] text-stone-400 hover:border-stone-600'
                        }`}
                      >
                        {REGIONS[rid].name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Party Roster */}
              <div>
                <div className="flex items-center gap-2 text-xs text-stone-400 mb-2">
                  <Users className="w-3.5 h-3.5" />
                  <span>Party Members ({lanRoom.peers.length}/4)</span>
                </div>
                <div className="space-y-2">
                  {lanRoom.peers.map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center justify-between px-3 py-2.5 rounded-lg border border-stone-800 bg-[#0d1017]"
                    >
                      <div className="flex items-center gap-3">
                        <img
                          src={getSpriteDataUrl(`hero_${p.classId}`)}
                          alt=""
                          className="w-8 h-8 pixelated"
                        />
                        <div>
                          <div className="text-sm font-semibold text-stone-100">
                            {p.name} {p.id === peerId ? '(You)' : ''}
                          </div>
                          <div className="text-xs text-stone-400 font-mono-num">
                            {HERO_CLASSES[p.classId].name} · Lv.{p.level} · {p.isHost ? 'Host' : 'Ally'}
                          </div>
                        </div>
                      </div>
                      <span
                        className={`text-xs font-mono-num font-semibold ${
                          p.ready ? 'text-emerald-400' : 'text-stone-500'
                        }`}
                      >
                        {p.ready ? 'READY' : 'WAITING'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap gap-3 pt-2">
                {isHost ? (
                  <button
                    type="button"
                    onClick={() => {
                      soundEngine.play('door');
                      onStartRun();
                    }}
                    className="flex-1 min-h-[48px] inline-flex items-center justify-center gap-2 px-5 rounded-lg bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-sm"
                  >
                    <Play className="w-4 h-4 fill-current" />
                    Launch Co-op Delve
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      soundEngine.play('uiClick');
                      onToggleReady();
                    }}
                    className="flex-1 min-h-[48px] inline-flex items-center justify-center gap-2 px-5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-stone-950 font-bold text-sm"
                  >
                    Toggle Ready
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    soundEngine.play('uiClose');
                    onLeave();
                  }}
                  className="min-h-[48px] px-4 rounded-lg border border-stone-700 bg-stone-900 text-stone-300 hover:border-rose-500/60 text-sm"
                >
                  Leave Party
                </button>
              </div>
            </div>
          ) : (
            /* Connect / Host / Join View */
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-stone-400 mb-1">Your Display Name</label>
                  <input
                    type="text"
                    maxLength={16}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full min-h-[44px] px-3 rounded-lg border border-stone-700 bg-[#0b0d12] text-stone-100 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-stone-400 mb-1">Party Class</label>
                  <select
                    value={classId}
                    onChange={(e) => setClassId(e.target.value as HeroClassId)}
                    className="w-full min-h-[44px] px-3 rounded-lg border border-stone-700 bg-[#0b0d12] text-stone-100 text-sm"
                  >
                    {(Object.keys(HERO_CLASSES) as HeroClassId[]).map((cid) => (
                      <option key={cid} value={cid}>
                        {HERO_CLASSES[cid].name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Host or Join */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  disabled={lanStatus === 'connecting'}
                  onClick={() => {
                    soundEngine.play('uiClick');
                    onConnectAndCreate(name, classId, 'catacombs', customHost);
                  }}
                  className="min-h-[48px] px-4 py-3 rounded-lg bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-sm transition-colors"
                >
                  {lanStatus === 'connecting' ? 'Connecting...' : 'Host New LAN Room'}
                </button>

                <div className="flex gap-2">
                  <input
                    type="text"
                    maxLength={4}
                    placeholder="Code (e.g. K7RM)"
                    value={roomCode}
                    onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                    className="flex-1 min-h-[48px] px-3 rounded-lg border border-stone-700 bg-[#0b0d12] text-stone-100 text-sm font-mono-num uppercase"
                  />
                  <button
                    type="button"
                    disabled={!roomCode.trim() || lanStatus === 'connecting'}
                    onClick={() => {
                      soundEngine.play('uiClick');
                      onConnectAndJoin(roomCode, name, classId, customHost);
                    }}
                    className="min-h-[48px] px-4 rounded-lg border border-emerald-600 bg-emerald-600/20 hover:bg-emerald-600/35 text-emerald-200 font-semibold text-sm disabled:opacity-40"
                  >
                    Join
                  </button>
                </div>
              </div>

              {/* Active LAN Rooms discovered on server */}
              <div className="rounded-lg border border-stone-800 bg-[#0b0d12] p-3.5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-stone-300">
                    Active Rooms on Local Host
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      soundEngine.play('uiClick');
                      void refreshLan();
                    }}
                    className="inline-flex items-center gap-1 text-xs text-amber-400 hover:underline min-h-[32px] px-2"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Scan LAN
                  </button>
                </div>

                {lanInfo && lanInfo.rooms.length > 0 ? (
                  <div className="space-y-2">
                    {lanInfo.rooms.map((r) => (
                      <div
                        key={r.code}
                        className="flex items-center justify-between px-3 py-2 rounded border border-stone-800 bg-[#12161f]"
                      >
                        <div>
                          <div className="text-xs font-semibold text-stone-100 font-mono-num">
                            Room {r.code} · {r.hostName} ({r.playerCount}/4)
                          </div>
                          <div className="text-[11px] text-stone-400">
                            {r.regionName} · {r.status}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => onConnectAndJoin(r.code, name, classId, customHost)}
                          className="min-h-[38px] px-3.5 rounded bg-emerald-500 hover:bg-emerald-400 text-stone-950 font-bold text-xs"
                        >
                          Join
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-stone-500">
                    No active rooms found on this host yet. Host a room to invite nearby devices.
                  </p>
                )}
              </div>

              {/* Optional Custom LAN Host URL */}
              <div>
                <label className="block text-xs text-stone-400 mb-1">
                  Optional Custom LAN Host URL (for connecting to another device&apos;s IP)
                </label>
                <input
                  type="text"
                  placeholder="Leave blank to use current host, or enter e.g. http://192.168.1.42:3000"
                  value={customHost}
                  onChange={(e) => setCustomHost(e.target.value)}
                  className="w-full min-h-[42px] px-3 rounded-lg border border-stone-800 bg-[#0b0d12] text-stone-300 text-xs font-mono-num"
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

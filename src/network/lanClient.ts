import type { HeroClassId, HeroState, LanRoomState, PlayerAction, RegionId } from '../game/types.ts';

export interface LanHostInfo {
  port: number;
  lanUrls: string[];
  rooms: {
    code: string;
    regionId: RegionId;
    regionName: string;
    status: string;
    playerCount: number;
    hostName: string;
  }[];
}

export type LanStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export class LanMultiplayerClient {
  private ws: WebSocket | null = null;
  public peerId: string | null = null;
  public status: LanStatus = 'disconnected';

  private onState: (room: LanRoomState | null, sfx: string[]) => void;
  private onError: (msg: string) => void;
  private onStatus: (status: LanStatus) => void;

  constructor(
    onState: (room: LanRoomState | null, sfx: string[]) => void,
    onError: (msg: string) => void,
    onStatus: (status: LanStatus) => void
  ) {
    this.onState = onState;
    this.onError = onError;
    this.onStatus = onStatus;
  }

  connect(customHostUrl?: string): Promise<void> {
    this.disconnect();
    this.status = 'connecting';
    this.onStatus('connecting');

    return new Promise((resolve, reject) => {
      let wsUrl: string;
      if (customHostUrl && customHostUrl.trim()) {
        const cleaned = customHostUrl.trim().replace(/^http/, 'ws').replace(/\/$/, '');
        wsUrl = cleaned.endsWith('/ws/lan') ? cleaned : `${cleaned}/ws/lan`;
      } else {
        const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        wsUrl = `${proto}//${window.location.host}/ws/lan`;
      }

      try {
        const ws = new WebSocket(wsUrl);
        this.ws = ws;

        const timer = setTimeout(() => {
          if (this.status === 'connecting') {
            ws.close();
            this.status = 'error';
            this.onStatus('error');
            reject(new Error('LAN server connection timed out.'));
          }
        }, 5000);

        ws.onopen = () => {
          clearTimeout(timer);
          this.status = 'connected';
          this.onStatus('connected');
          resolve();
        };

        ws.onmessage = (ev) => {
          try {
            const msg = JSON.parse(ev.data as string) as {
              type: string;
              peerId?: string;
              room?: LanRoomState;
              sfx?: string[];
              message?: string;
            };
            if (msg.type === 'welcome' && msg.peerId) {
              this.peerId = msg.peerId;
            } else if (msg.type === 'room:state' && msg.room) {
              this.onState(msg.room, msg.sfx ?? []);
            } else if (msg.type === 'error' && msg.message) {
              this.onError(msg.message);
            }
          } catch {
            // ignore parse failure
          }
        };

        ws.onerror = () => {
          clearTimeout(timer);
          this.status = 'error';
          this.onStatus('error');
          reject(new Error('Could not reach LAN host WebSocket.'));
        };

        ws.onclose = () => {
          clearTimeout(timer);
          if (this.ws === ws) {
            this.ws = null;
            this.status = 'disconnected';
            this.onStatus('disconnected');
          }
        };
      } catch (err) {
        this.status = 'error';
        this.onStatus('error');
        reject(err);
      }
    });
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.peerId = null;
    this.status = 'disconnected';
    this.onStatus('disconnected');
    this.onState(null, []);
  }

  private send(payload: unknown) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(payload));
    }
  }

  createRoom(name: string, classId: HeroClassId, regionId: RegionId, heroSnapshot: HeroState) {
    this.send({ type: 'create_room', name, classId, regionId, heroSnapshot });
  }

  joinRoom(code: string, name: string, classId: HeroClassId, heroSnapshot: HeroState) {
    this.send({ type: 'join_room', code, name, classId, heroSnapshot });
  }

  setRegion(regionId: RegionId) {
    this.send({ type: 'set_region', regionId });
  }

  toggleReady() {
    this.send({ type: 'toggle_ready' });
  }

  startRun() {
    this.send({ type: 'start_run' });
  }

  returnLobby() {
    this.send({ type: 'return_lobby' });
  }

  sendAction(action: PlayerAction) {
    this.send({ type: 'player_action', action });
  }
}

export async function fetchLanInfo(baseUrl = ''): Promise<LanHostInfo | null> {
  try {
    const prefix = baseUrl ? baseUrl.replace(/\/$/, '') : '';
    const res = await fetch(`${prefix}/api/lan-info`);
    if (!res.ok) return null;
    return (await res.json()) as LanHostInfo;
  } catch {
    return null;
  }
}

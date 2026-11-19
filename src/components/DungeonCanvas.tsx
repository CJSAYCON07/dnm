import React, { useEffect, useRef } from 'react';
import { REGIONS } from '../game/content.ts';
import { getPixelSprite } from '../game/pixelSprites.ts';
import type { CombatEvent, DungeonFloor, HeroState } from '../game/types.ts';

interface FloatingText {
  x: number;
  y: number;
  text: string;
  color: string;
  age: number;
  duration: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  age: number;
  life: number;
  size: number;
}

interface DungeonCanvasProps {
  floor: DungeonFloor;
  heroes: Record<string, HeroState>;
  activeHeroId: string;
  events: CombatEvent[];
  pathPreview: { x: number; y: number }[];
  onTileTap: (tx: number, ty: number) => void;
}

export const DungeonCanvas: React.FC<DungeonCanvasProps> = ({
  floor,
  heroes,
  activeHeroId,
  events,
  pathPreview,
  onTileTap,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Refs so the 60fps rAF loop never triggers React re-renders
  const stateRef = useRef({ floor, heroes, activeHeroId, pathPreview });
  stateRef.current = { floor, heroes, activeHeroId, pathPreview };

  const onTileTapRef = useRef(onTileTap);
  onTileTapRef.current = onTileTap;

  const animRef = useRef({
    camX: 0,
    camY: 0,
    camInit: false,
    shake: 0,
    tileSize: 48,
    visPos: new Map<string, { x: number; y: number }>(),
    floaters: [] as FloatingText[],
    particles: [] as Particle[],
    seenEvents: new Set<string>(),
    lastTime: 0,
  });

  // Push incoming combat events into pooled floaters & particle bursts
  useEffect(() => {
    const anim = animRef.current;
    for (const ev of events) {
      if (anim.seenEvents.has(ev.id)) continue;
      anim.seenEvents.add(ev.id);
      if (anim.seenEvents.size > 200) {
        const first = anim.seenEvents.values().next().value;
        if (first) anim.seenEvents.delete(first);
      }
      anim.floaters.push({
        x: ev.x + 0.5,
        y: ev.y + 0.15,
        text: ev.text,
        color: ev.color,
        age: 0,
        duration: 0.95,
      });

      if (ev.type === 'crit' || ev.type === 'boss_slam' || ev.type === 'level') {
        anim.shake = Math.min(10, anim.shake + (ev.type === 'boss_slam' ? 8 : 5));
      } else if (ev.type === 'damage') {
        anim.shake = Math.min(6, anim.shake + 2.5);
      }

      const burstCount = ev.type === 'boss_slam' ? 16 : ev.type === 'crit' || ev.type === 'level' ? 10 : 5;
      for (let i = 0; i < burstCount; i++) {
        const ang = (Math.PI * 2 * i) / burstCount + Math.random() * 0.4;
        const spd = 1.2 + Math.random() * 2.6;
        anim.particles.push({
          x: ev.x + 0.5,
          y: ev.y + 0.5,
          vx: Math.cos(ang) * spd,
          vy: Math.sin(ang) * spd,
          color: ev.color,
          age: 0,
          life: 0.32 + Math.random() * 0.25,
          size: ev.type === 'boss_slam' ? 4 : 3,
        });
      }
    }
  }, [events]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let rafId = 0;

    const resize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = parent.clientWidth;
      const h = parent.clientHeight;
      canvas.width = Math.max(1, Math.floor(w * dpr));
      canvas.height = Math.max(1, Math.floor(h * dpr));
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      animRef.current.tileSize = w < 640 ? 44 : 52;
    };

    resize();
    window.addEventListener('resize', resize);

    const render = (now: number) => {
      const anim = animRef.current;
      const rawDt = anim.lastTime ? (now - anim.lastTime) / 1000 : 0.016;
      const dt = Math.min(rawDt, 0.05);
      anim.lastTime = now;

      const { floor: fl, heroes: hs, activeHeroId: hid, pathPreview: path } = stateRef.current;
      const activeHero = hs[hid] ?? Object.values(hs)[0];
      const region = REGIONS[fl.regionId];
      const ts = anim.tileSize;
      const viewW = canvas.clientWidth;
      const viewH = canvas.clientHeight;

      if (activeHero) {
        const targetCamX = activeHero.x + 0.5;
        const targetCamY = activeHero.y + 0.5;
        if (!anim.camInit) {
          anim.camX = targetCamX;
          anim.camY = targetCamY;
          anim.camInit = true;
        } else {
          const lerpRate = 1 - Math.exp(-12 * dt);
          anim.camX += (targetCamX - anim.camX) * lerpRate;
          anim.camY += (targetCamY - anim.camY) * lerpRate;
        }
      }

      if (anim.shake > 0) {
        anim.shake = Math.max(0, anim.shake - dt * 28);
      }
      const shakeX = anim.shake > 0 ? (Math.random() - 0.5) * anim.shake * 2 : 0;
      const shakeY = anim.shake > 0 ? (Math.random() - 0.5) * anim.shake * 2 : 0;

      const offsetX = Math.round(viewW / 2 - anim.camX * ts + shakeX);
      const offsetY = Math.round(viewH / 2 - anim.camY * ts + shakeY);

      ctx.imageSmoothingEnabled = false;
      ctx.fillStyle = region.palette.fogTint;
      ctx.fillRect(0, 0, viewW, viewH);

      const minCol = Math.max(0, Math.floor(-offsetX / ts) - 1);
      const maxCol = Math.min(fl.width - 1, Math.ceil((viewW - offsetX) / ts) + 1);
      const minRow = Math.max(0, Math.floor(-offsetY / ts) - 1);
      const maxRow = Math.min(fl.height - 1, Math.ceil((viewH - offsetY) / ts) + 1);

      const pulse = 0.5 + 0.5 * Math.sin(now * 0.006);

      // Draw Tiles
      for (let y = minRow; y <= maxRow; y++) {
        for (let x = minCol; x <= maxCol; x++) {
          const vis = fl.visibility[y]?.[x] ?? 0;
          if (vis === 0) continue;
          const tile = fl.tiles[y][x];
          if (tile === 'void') continue;

          const px = offsetX + x * ts;
          const py = offsetY + y * ts;

          if (tile === 'wall') {
            ctx.fillStyle = region.palette.wallFace;
            ctx.fillRect(px, py, ts, ts);
            ctx.fillStyle = region.palette.wallTop;
            ctx.fillRect(px, py, ts, Math.round(ts * 0.62));
            ctx.fillStyle = 'rgba(255,255,255,0.06)';
            ctx.fillRect(px + 2, py + 2, ts - 4, 2);
            ctx.fillStyle = 'rgba(0,0,0,0.35)';
            ctx.fillRect(px, py + ts - 3, ts, 3);
          } else {
            // Checkerboard stone floor
            ctx.fillStyle = (x + y) % 2 === 0 ? region.palette.floorA : region.palette.floorB;
            ctx.fillRect(px, py, ts, ts);
            ctx.fillStyle = 'rgba(0,0,0,0.18)';
            ctx.fillRect(px, py, ts, 1);
            ctx.fillRect(px, py, 1, ts);

            if (tile === 'water') {
              ctx.fillStyle = '#0e7490';
              ctx.fillRect(px + 3, py + 3, ts - 6, ts - 6);
              ctx.fillStyle = `rgba(103,232,249,${0.25 + pulse * 0.2})`;
              ctx.fillRect(px + 8, py + Math.round(ts * 0.45), ts - 16, 3);
            } else if (tile === 'lava') {
              ctx.fillStyle = '#b91c1c';
              ctx.fillRect(px + 3, py + 3, ts - 6, ts - 6);
              ctx.fillStyle = `rgba(251,191,36,${0.4 + pulse * 0.35})`;
              ctx.fillRect(px + 8, py + 10, ts - 16, ts - 20);
            } else if (tile === 'door_closed') {
              ctx.fillStyle = '#78350f';
              ctx.fillRect(px + 4, py + 4, ts - 8, ts - 8);
              ctx.fillStyle = '#d97706';
              ctx.fillRect(px + Math.round(ts * 0.65), py + Math.round(ts * 0.45), 5, 5);
            } else if (tile === 'door_open') {
              ctx.fillStyle = '#451a03';
              ctx.fillRect(px + 4, py + 4, 6, ts - 8);
            } else if (tile === 'stairs_up') {
              ctx.fillStyle = '#334155';
              ctx.fillRect(px + 6, py + 6, ts - 12, ts - 12);
              ctx.fillStyle = '#94a3b8';
              for (let s = 0; s < 3; s++) {
                ctx.fillRect(px + 9 + s * 4, py + 10 + s * 7, ts - 18 - s * 4, 4);
              }
            } else if (tile === 'stairs_down') {
              ctx.fillStyle = '#090b10';
              ctx.fillRect(px + 5, py + 5, ts - 10, ts - 10);
              ctx.strokeStyle = fl.exitUnlocked ? '#fbbf24' : '#64748b';
              ctx.lineWidth = 2;
              ctx.strokeRect(px + 6, py + 6, ts - 12, ts - 12);
              if (fl.exitUnlocked) {
                ctx.fillStyle = `rgba(251,191,36,${0.25 + pulse * 0.35})`;
                ctx.fillRect(px + 10, py + 10, ts - 20, ts - 20);
              }
            } else if (tile === 'trap_spike') {
              ctx.fillStyle = '#475569';
              for (let sx = 0; sx < 2; sx++) {
                for (let sy = 0; sy < 2; sy++) {
                  ctx.fillRect(px + 10 + sx * 16, py + 10 + sy * 16, 6, 6);
                }
              }
            } else if (tile === 'trap_fire') {
              ctx.fillStyle = `rgba(249,115,22,${0.4 + pulse * 0.3})`;
              ctx.fillRect(px + 10, py + 10, ts - 20, ts - 20);
            } else if (tile === 'shrine') {
              const used = fl.shrinesUsed.includes(`${x},${y}`);
              ctx.drawImage(getPixelSprite('prop_shrine'), px + 4, py + 4, ts - 8, ts - 8);
              if (!used) {
                ctx.fillStyle = `rgba(56,189,248,${0.18 + pulse * 0.22})`;
                ctx.fillRect(px + 6, py + 6, ts - 12, ts - 12);
              }
            } else if (tile === 'chest') {
              ctx.drawImage(getPixelSprite('prop_chest'), px + 4, py + 4, ts - 8, ts - 8);
            } else if (tile === 'crate') {
              ctx.drawImage(getPixelSprite('prop_crate'), px + 4, py + 4, ts - 8, ts - 8);
            }
          }

          if (vis === 1) {
            ctx.fillStyle = 'rgba(9,11,16,0.62)';
            ctx.fillRect(px, py, ts, ts);
          }
        }
      }

      // Draw Tap-to-Move Path Preview
      for (let i = 0; i < path.length; i++) {
        const pt = path[i];
        const px = offsetX + pt.x * ts + ts / 2;
        const py = offsetY + pt.y * ts + ts / 2;
        ctx.fillStyle = i === path.length - 1 ? '#fbbf24' : 'rgba(251,191,36,0.55)';
        const sz = i === path.length - 1 ? 8 : 5;
        ctx.fillRect(px - sz / 2, py - sz / 2, sz, sz);
      }

      // Draw Boss Telegraph Warning Tiles
      for (const m of fl.monsters) {
        for (const tt of m.telegraphTiles) {
          if (fl.visibility[tt.y]?.[tt.x] === 0) continue;
          const px = offsetX + tt.x * ts;
          const py = offsetY + tt.y * ts;
          ctx.fillStyle = `rgba(239,68,68,${0.22 + pulse * 0.28})`;
          ctx.fillRect(px + 2, py + 2, ts - 4, ts - 4);
          ctx.strokeStyle = '#fb7185';
          ctx.lineWidth = 2;
          ctx.strokeRect(px + 3, py + 3, ts - 6, ts - 6);
        }
      }

      // Draw Ground Loot
      for (const l of fl.loot) {
        if ((fl.visibility[l.y]?.[l.x] ?? 0) < 1) continue;
        const px = offsetX + l.x * ts;
        const py = offsetY + l.y * ts;
        const spriteKey = l.item ? l.item.spriteKey : 'prop_gold';
        ctx.drawImage(getPixelSprite(spriteKey), px + 8, py + 8, ts - 16, ts - 16);
      }

      // Helper for smooth sprite position interpolation
      const stepVisPos = (id: string, tx: number, ty: number) => {
        const curr = anim.visPos.get(id);
        if (!curr) {
          anim.visPos.set(id, { x: tx, y: ty });
          return { x: tx, y: ty };
        }
        const rate = 1 - Math.exp(-18 * dt);
        curr.x += (tx - curr.x) * rate;
        curr.y += (ty - curr.y) * rate;
        return curr;
      };

      // Draw Monsters
      for (const m of fl.monsters) {
        if (fl.visibility[m.y]?.[m.x] !== 2) continue;
        const vp = stepVisPos(m.id, m.x, m.y);
        const bob = Math.sin(now * 0.005 + m.x) * 2;
        const scalePad = m.isBoss ? 0 : 4;
        const px = offsetX + vp.x * ts + scalePad;
        const py = offsetY + vp.y * ts + scalePad + bob;
        const size = ts - scalePad * 2;

        // Shadow
        ctx.fillStyle = 'rgba(0,0,0,0.45)';
        ctx.fillRect(px + 4, py + size - 4 - bob, size - 8, 4);

        ctx.drawImage(getPixelSprite(m.spriteKey), px, py, size, size);

        // Monster HP Bar
        const barW = ts - 8;
        const ratio = Math.max(0, Math.min(1, m.hp / m.maxHp));
        ctx.fillStyle = '#090b10';
        ctx.fillRect(offsetX + vp.x * ts + 4, offsetY + vp.y * ts - 4, barW, 5);
        ctx.fillStyle = m.isBoss ? '#fb7185' : '#ef4444';
        ctx.fillRect(offsetX + vp.x * ts + 5, offsetY + vp.y * ts - 3, Math.round((barW - 2) * ratio), 3);
      }

      // Draw Heroes
      for (const h of Object.values(hs)) {
        const vp = stepVisPos(h.id, h.x, h.y);
        const bob = h.alive ? Math.sin(now * 0.006 + h.y) * 1.8 : 0;
        const px = offsetX + vp.x * ts + 4;
        const py = offsetY + vp.y * ts + 4 + bob;
        const size = ts - 8;

        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(px + 4, py + size - 4 - bob, size - 8, 4);

        if (!h.alive) {
          ctx.globalAlpha = 0.45;
        } else if (h.buffs.stealthTurns > 0) {
          ctx.globalAlpha = 0.6;
        }
        ctx.drawImage(getPixelSprite(`hero_${h.classId}`), px, py, size, size);
        ctx.globalAlpha = 1;

        if (h.buffs.shieldTurns > 0) {
          ctx.strokeStyle = '#38bdf8';
          ctx.lineWidth = 2;
          ctx.strokeRect(px - 1, py - 1 - bob, size + 2, size + 2);
        }

        // Nameplate for LAN party allies
        if (Object.keys(hs).length > 1) {
          ctx.font = '600 10px "Plus Jakarta Sans", sans-serif';
          ctx.textAlign = 'center';
          ctx.fillStyle = h.id === hid ? '#fbbf24' : '#cbd5e1';
          ctx.fillText(h.name, offsetX + vp.x * ts + ts / 2, offsetY + vp.y * ts - 6);
        }
      }

      // Draw Pooled Particles
      for (let i = anim.particles.length - 1; i >= 0; i--) {
        const p = anim.particles[i];
        p.age += dt;
        if (p.age >= p.life) {
          anim.particles.splice(i, 1);
          continue;
        }
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        const alpha = 1 - p.age / p.life;
        ctx.globalAlpha = alpha;
        ctx.fillStyle = p.color;
        ctx.fillRect(
          offsetX + p.x * ts - p.size / 2,
          offsetY + p.y * ts - p.size / 2,
          p.size,
          p.size
        );
      }
      ctx.globalAlpha = 1;

      // Draw Floating Combat Text
      for (let i = anim.floaters.length - 1; i >= 0; i--) {
        const f = anim.floaters[i];
        f.age += dt;
        if (f.age >= f.duration) {
          anim.floaters.splice(i, 1);
          continue;
        }
        const progress = f.age / f.duration;
        const fx = offsetX + f.x * ts;
        const fy = offsetY + (f.y - progress * 0.9) * ts;
        ctx.globalAlpha = 1 - progress * progress;
        ctx.font = '700 13px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#090b10';
        ctx.fillText(f.text, fx + 1, fy + 1);
        ctx.fillStyle = f.color;
        ctx.fillText(f.text, fx, fy);
      }
      ctx.globalAlpha = 1;

      rafId = requestAnimationFrame(render);
    };

    rafId = requestAnimationFrame(render);
    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const anim = animRef.current;
    const ts = anim.tileSize;
    const offsetX = rect.width / 2 - anim.camX * ts;
    const offsetY = rect.height / 2 - anim.camY * ts;
    const tx = Math.floor((sx - offsetX) / ts);
    const ty = Math.floor((sy - offsetY) / ts);
    onTileTapRef.current(tx, ty);
  };

  return (
    <canvas
      ref={canvasRef}
      onPointerUp={handlePointerUp}
      className="block w-full h-full touch-none cursor-crosshair select-none"
    />
  );
};

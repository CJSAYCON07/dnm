// Procedural Web Audio API sound effects engine (100% offline, zero external assets)

class SoundEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  public muted = false;

  private ensureContext(): { ctx: AudioContext; out: AudioNode } | null {
    if (this.muted || typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AC =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      this.ctx = new AC();
      const comp = this.ctx.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.knee.value = 18;
      comp.ratio.value = 6;
      const master = this.ctx.createGain();
      master.gain.value = 0.85;
      master.connect(comp);
      comp.connect(this.ctx.destination);
      this.masterGain = master;
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
    return this.masterGain ? { ctx: this.ctx, out: this.masterGain } : null;
  }

  private getNoiseBuffer(ctx: AudioContext): AudioBuffer {
    if (this.noiseBuffer && this.noiseBuffer.sampleRate === ctx.sampleRate) {
      return this.noiseBuffer;
    }
    const len = Math.floor(ctx.sampleRate * 0.6);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    this.noiseBuffer = buf;
    return buf;
  }

  play(type: string) {
    const audio = this.ensureContext();
    if (!audio) return;
    const { ctx, out } = audio;
    const now = ctx.currentTime;

    const tone = (
      freq: number,
      endFreq: number,
      dur: number,
      wave: OscillatorType = 'square',
      gainVal = 0.08,
      delay = 0
    ) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = wave;
      osc.frequency.setValueAtTime(Math.max(20, freq), now + delay);
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), now + delay + dur);
      gain.gain.setValueAtTime(0.0001, now + delay);
      gain.gain.linearRampToValueAtTime(gainVal, now + delay + Math.min(0.008, dur * 0.2));
      gain.gain.exponentialRampToValueAtTime(0.0001, now + delay + dur);
      osc.connect(gain);
      gain.connect(out);
      osc.start(now + delay);
      osc.stop(now + delay + dur + 0.015);
    };

    const noise = (
      dur: number,
      filterFreq: number,
      filterType: BiquadFilterType = 'bandpass',
      gainVal = 0.08,
      delay = 0,
      endFilterFreq?: number
    ) => {
      const src = ctx.createBufferSource();
      src.buffer = this.getNoiseBuffer(ctx);
      const filter = ctx.createBiquadFilter();
      filter.type = filterType;
      filter.frequency.setValueAtTime(filterFreq, now + delay);
      if (endFilterFreq !== undefined) {
        filter.frequency.exponentialRampToValueAtTime(Math.max(40, endFilterFreq), now + delay + dur);
      }
      filter.Q.value = 1.4;

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, now + delay);
      gain.gain.linearRampToValueAtTime(gainVal, now + delay + 0.005);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + delay + dur);

      src.connect(filter);
      filter.connect(gain);
      gain.connect(out);
      src.start(now + delay);
      src.stop(now + delay + dur + 0.015);
    };

    const jitter = 0.94 + Math.random() * 0.12;

    switch (type) {
      case 'step':
        noise(0.045, 520 * jitter, 'lowpass', 0.05);
        tone(115 * jitter, 65, 0.04, 'triangle', 0.03);
        break;
      case 'hit':
        noise(0.08, 1200 * jitter, 'bandpass', 0.1);
        tone(185 * jitter, 58, 0.09, 'sawtooth', 0.085);
        break;
      case 'crit':
        noise(0.11, 2200, 'highpass', 0.11);
        tone(340, 88, 0.13, 'sawtooth', 0.1);
        tone(680, 340, 0.09, 'square', 0.065, 0.025);
        tone(920, 460, 0.11, 'triangle', 0.055, 0.05);
        break;
      case 'miss':
        noise(0.11, 1400, 'bandpass', 0.055, 0, 420);
        tone(260, 155, 0.07, 'sine', 0.03);
        break;
      case 'spell':
        tone(440, 880, 0.13, 'triangle', 0.075);
        tone(660, 990, 0.12, 'sine', 0.06, 0.05);
        noise(0.14, 2400, 'bandpass', 0.045, 0.02, 900);
        break;
      case 'heal':
        tone(392, 440, 0.09, 'sine', 0.065, 0);
        tone(493.88, 523.25, 0.1, 'sine', 0.065, 0.06);
        tone(587.33, 659.25, 0.16, 'triangle', 0.07, 0.12);
        break;
      case 'shrine':
        tone(261.63, 261.63, 0.24, 'sine', 0.06, 0);
        tone(329.63, 329.63, 0.26, 'triangle', 0.055, 0.05);
        tone(392.0, 523.25, 0.28, 'sine', 0.065, 0.1);
        tone(783.99, 783.99, 0.22, 'sine', 0.045, 0.16);
        break;
      case 'loot':
      case 'coin':
        tone(659.25, 659.25, 0.055, 'square', 0.045, 0);
        tone(987.77, 1318.5, 0.11, 'triangle', 0.075, 0.05);
        break;
      case 'chest':
        tone(145, 195, 0.09, 'triangle', 0.07, 0);
        tone(523.25, 523.25, 0.07, 'square', 0.055, 0.08);
        tone(659.25, 659.25, 0.07, 'square', 0.055, 0.14);
        tone(783.99, 1046.5, 0.18, 'triangle', 0.075, 0.2);
        break;
      case 'crate':
        noise(0.11, 900, 'bandpass', 0.12);
        tone(150, 55, 0.08, 'sawtooth', 0.07);
        noise(0.07, 1800, 'highpass', 0.06, 0.035);
        break;
      case 'trap':
        noise(0.09, 2600, 'highpass', 0.1);
        tone(420, 95, 0.12, 'sawtooth', 0.095);
        break;
      case 'poison':
        noise(0.14, 1700, 'bandpass', 0.06, 0, 650);
        tone(220, 140, 0.12, 'sine', 0.05, 0.02);
        break;
      case 'door':
        noise(0.08, 420, 'lowpass', 0.08);
        tone(115, 165, 0.085, 'triangle', 0.065);
        break;
      case 'stairs':
        tone(330, 294, 0.08, 'triangle', 0.06, 0);
        tone(262, 220, 0.09, 'triangle', 0.06, 0.07);
        tone(196, 165, 0.14, 'triangle', 0.06, 0.14);
        break;
      case 'equip':
        noise(0.05, 2400, 'highpass', 0.05);
        tone(392, 587, 0.065, 'triangle', 0.065, 0.01);
        break;
      case 'salvage':
        tone(480, 320, 0.06, 'square', 0.06, 0);
        tone(880, 1174, 0.09, 'triangle', 0.065, 0.06);
        break;
      case 'levelUp':
        tone(392, 392, 0.08, 'square', 0.06, 0);
        tone(493.88, 493.88, 0.08, 'square', 0.06, 0.08);
        tone(587.33, 587.33, 0.08, 'square', 0.06, 0.16);
        tone(783.99, 987.77, 0.24, 'triangle', 0.085, 0.24);
        break;
      case 'bossWarn':
        tone(146.83, 110, 0.22, 'sawtooth', 0.09, 0);
        tone(110, 82.4, 0.26, 'sawtooth', 0.095, 0.16);
        break;
      case 'bossSlam':
        noise(0.28, 360, 'lowpass', 0.16);
        tone(105, 32, 0.28, 'sawtooth', 0.13);
        tone(72, 26, 0.24, 'square', 0.09, 0.04);
        break;
      case 'victory':
        tone(523.25, 523.25, 0.09, 'square', 0.06, 0);
        tone(659.25, 659.25, 0.09, 'square', 0.06, 0.09);
        tone(783.99, 783.99, 0.09, 'square', 0.06, 0.18);
        tone(1046.5, 1046.5, 0.32, 'triangle', 0.09, 0.27);
        break;
      case 'death':
        noise(0.2, 500, 'lowpass', 0.07);
        tone(220, 146.83, 0.18, 'sawtooth', 0.085, 0);
        tone(146.83, 73.42, 0.34, 'sawtooth', 0.09, 0.16);
        break;
      case 'uiClick':
        tone(520, 420, 0.035, 'triangle', 0.035);
        break;
      case 'uiOpen':
        tone(340, 510, 0.06, 'triangle', 0.045);
        break;
      case 'uiClose':
        tone(440, 290, 0.055, 'triangle', 0.04);
        break;
    }
  }
}

export const soundEngine = new SoundEngine();

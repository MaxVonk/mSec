/**
 * Tactical SOC Audio Service
 * Synthesizes crisp, futuristic cyber sound effects using the browser's native Web Audio API.
 * Requires zero external audio assets/MP3s and persists mute state in localStorage.
 */

class AudioService {
  private ctx: AudioContext | null = null;
  private muted: boolean = false;

  constructor() {
    try {
      const stored = localStorage.getItem('msec_audio_muted');
      if (stored !== null) {
        this.muted = stored === 'true';
      }
    } catch {
      this.muted = false;
    }
  }

  private initContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public setMuted(mute: boolean): void {
    this.muted = mute;
    try {
      localStorage.setItem('msec_audio_muted', mute ? 'true' : 'false');
    } catch {}
  }

  public toggleMute(): boolean {
    this.setMuted(!this.muted);
    return this.muted;
  }

  /**
   * Subtle high-tech blip when opening command palette or modals
   */
  public playCommandOpen(): void {
    if (this.muted) return;
    const ctx = this.initContext();
    if (!ctx) return;

    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(1046.5, ctx.currentTime); // C6
      osc.frequency.exponentialRampToValueAtTime(1318.5, ctx.currentTime + 0.04); // E6

      gain.gain.setValueAtTime(0.04, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.05);
    } catch {}
  }

  /**
   * Soft affirmative chime on low/medium alert or filter actions
   */
  public playInfoChime(): void {
    if (this.muted) return;
    const ctx = this.initContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(587.33, now); // D5
      osc.frequency.exponentialRampToValueAtTime(880.0, now + 0.08); // A5

      gain.gain.setValueAtTime(0.05, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.12);
    } catch {}
  }

  /**
   * High-priority warning alert chime for High/Critical incidents
   */
  public playWarningChime(): void {
    if (this.muted) return;
    const ctx = this.initContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;

      // Dual tone pulse
      [0, 0.12].forEach((offset, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(idx === 0 ? 880 : 740, now + offset);
        osc.frequency.exponentialRampToValueAtTime(idx === 0 ? 988 : 880, now + offset + 0.08);

        gain.gain.setValueAtTime(0.06, now + offset);
        gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.1);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now + offset);
        osc.stop(now + offset + 0.1);
      });
    } catch {}
  }

  /**
   * Harmonic cyber chord when a SOAR Playbook or containment completes successfully
   */
  public playSuccessFanfare(): void {
    if (this.muted) return;
    const ctx = this.initContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const freqs = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6

      freqs.forEach((freq, idx) => {
        const delay = idx * 0.06;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + delay);

        gain.gain.setValueAtTime(0.05, now + delay);
        gain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.25);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now + delay);
        osc.stop(now + delay + 0.25);
      });
    } catch {}
  }
}

export const audioService = new AudioService();


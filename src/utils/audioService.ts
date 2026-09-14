/**
 * Tactical SOC Audio Service
 * Silenced/Disabled per design requirements: Audio cues have been decommissioned.
 * All playback methods are permanent no-ops without creating Web Audio contexts.
 */

class AudioService {
  public isMuted(): boolean {
    return true;
  }

  public setMuted(_mute: boolean): void {}

  public toggleMute(): boolean {
    return true;
  }

  public playCommandOpen(): void {}
  public playInfoChime(): void {}
  public playWarningChime(): void {}
  public playSuccessFanfare(): void {}
}

export const audioService = new AudioService();

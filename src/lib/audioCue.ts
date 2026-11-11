import type { StrikeCountdownState, TimePhase } from '../types/contracts';

type AudioContextConstructor = typeof AudioContext;

function getAudioContextConstructor(): AudioContextConstructor | null {
  if (typeof globalThis === 'undefined') {
    return null;
  }
  const win = globalThis as unknown as {
    AudioContext?: AudioContextConstructor;
    webkitAudioContext?: AudioContextConstructor;
  };
  return win.AudioContext ?? win.webkitAudioContext ?? null;
}

/**
 * Web Audio API cue generator that plays countdown ticks (T-3s, T-2s, T-1s at 880Hz, 70ms)
 * and an urgent double high-beep on entering STRIKE_NOW (1320Hz, 180ms).
 * Also exposes a MediaStream audio track via createMediaStreamDestination() so PiP video
 * streams stay active in mobile background.
 */
export class AudioCueController {
  private ctx: AudioContext | null = null;
  private streamDest: MediaStreamAudioDestinationNode | null = null;
  private enabled: boolean = true;
  private lastTickBucket: number | null = null;
  private lastPhase: TimePhase = 'IDLE';

  constructor(initialEnabled: boolean = true) {
    this.enabled = initialEnabled;
  }

  public isSupported(): boolean {
    return getAudioContextConstructor() !== null;
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) {
      this.resetTracking();
    }
  }

  public resetTracking(): void {
    this.lastTickBucket = null;
    this.lastPhase = 'IDLE';
  }

  private ensureContext(): AudioContext | null {
    if (this.ctx) {
      if (this.ctx.state === 'suspended' && typeof this.ctx.resume === 'function') {
        void this.ctx.resume().catch(() => {
          // Ignore resume errors outside user gesture
        });
      }
      return this.ctx;
    }

    const Ctor = getAudioContextConstructor();
    if (!Ctor) {
      return null;
    }

    try {
      this.ctx = new Ctor();
      if (typeof this.ctx.createMediaStreamDestination === 'function') {
        this.streamDest = this.ctx.createMediaStreamDestination();
      }
      if (this.ctx.state === 'suspended' && typeof this.ctx.resume === 'function') {
        void this.ctx.resume().catch(() => {
          // Ignore until unlocked by user gesture
        });
      }
      return this.ctx;
    } catch {
      this.ctx = null;
      this.streamDest = null;
      return null;
    }
  }

  /**
   * Unlocks the AudioContext on mobile browsers during a user tap/click gesture.
   */
  public async unlock(): Promise<boolean> {
    const ctx = this.ensureContext();
    if (!ctx) {
      return false;
    }

    try {
      if (ctx.state === 'suspended' && typeof ctx.resume === 'function') {
        await ctx.resume();
      }
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Returns the MediaStream from createMediaStreamDestination so its audio track
   * can be attached to the PiP video stream.
   */
  public getMediaStream(): MediaStream | null {
    this.ensureContext();
    return this.streamDest ? this.streamDest.stream : null;
  }

  /**
   * Returns the primary audio MediaStreamTrack if available.
   */
  public getAudioTrack(): MediaStreamTrack | null {
    const stream = this.getMediaStream();
    if (!stream || typeof stream.getAudioTracks !== 'function') {
      return null;
    }
    const tracks = stream.getAudioTracks();
    return tracks.length > 0 ? tracks[0] : null;
  }

  private scheduleTone(
    frequencyHz: number,
    durationMs: number,
    startOffsetSec: number = 0,
    gainPeak: number = 0.25,
  ): void {
    if (!this.enabled) {
      return;
    }

    const ctx = this.ensureContext();
    if (!ctx) {
      return;
    }

    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.value = frequencyHz;

      const startTime = ctx.currentTime + Math.max(0, startOffsetSec);
      const durationSec = Math.max(0.01, durationMs / 1000);
      const endTime = startTime + durationSec;

      gain.gain.setValueAtTime(0.0001, startTime);
      gain.gain.exponentialRampToValueAtTime(gainPeak, startTime + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, endTime);

      osc.connect(gain);
      gain.connect(ctx.destination);
      if (this.streamDest) {
        gain.connect(this.streamDest);
      }

      osc.start(startTime);
      osc.stop(endTime + 0.005);
    } catch {
      // Safe no-op if Web Audio calls fail in restricted/test environments
    }
  }

  /**
   * Plays a short countdown tick tone (880Hz, 70ms) for T-3s, T-2s, T-1s.
   */
  public playTick(): void {
    this.scheduleTone(880, 70, 0, 0.22);
  }

  /**
   * Plays an urgent double high-beep (1320Hz, 180ms total pattern) when entering STRIKE_NOW.
   */
  public playStrikeBeep(): void {
    // Two crisp bursts within the 180ms urgent window
    this.scheduleTone(1320, 80, 0, 0.35);
    this.scheduleTone(1320, 90, 0.09, 0.38);
  }

  /**
   * Evaluates countdown transitions and triggers tick tones at T-3s, T-2s, T-1s
   * and the urgent double high-beep upon entering STRIKE_NOW.
   */
  public handleCountdownTick(state: StrikeCountdownState): void {
    if (!this.enabled) {
      this.lastPhase = state.phase;
      return;
    }

    const { phase, effectiveStrikeRemainingMs } = state;

    if (phase === 'STRIKE_NOW' && this.lastPhase !== 'STRIKE_NOW') {
      this.playStrikeBeep();
      this.lastTickBucket = 0;
      this.lastPhase = phase;
      return;
    }

    if (
      phase === 'COUNTDOWN_3S' &&
      effectiveStrikeRemainingMs !== null &&
      effectiveStrikeRemainingMs > 0 &&
      effectiveStrikeRemainingMs <= 3000
    ) {
      const bucket = Math.ceil(effectiveStrikeRemainingMs / 1000); // 3, 2, or 1
      if (bucket >= 1 && bucket <= 3 && bucket !== this.lastTickBucket) {
        this.lastTickBucket = bucket;
        this.playTick();
      }
    } else if (phase !== 'COUNTDOWN_3S') {
      this.lastTickBucket = null;
    }

    this.lastPhase = phase;
  }

  /**
   * Alias for handleCountdownTick for convenience.
   */
  public update(state: StrikeCountdownState): void {
    this.handleCountdownTick(state);
  }

  public async dispose(): Promise<void> {
    this.resetTracking();
    if (this.ctx && typeof this.ctx.close === 'function') {
      try {
        await this.ctx.close();
      } catch {
        // Ignore close errors
      }
    }
    this.ctx = null;
    this.streamDest = null;
  }
}

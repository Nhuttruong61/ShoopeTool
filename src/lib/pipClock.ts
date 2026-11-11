import type {
  PipOverlayPayload,
  PipSupportInfo,
  TimePhase,
} from '../types/contracts';
import type { AudioCueController } from './audioCue';

const CANVAS_WIDTH = 420;
const CANVAS_HEIGHT = 220;

interface WebkitVideoElement extends HTMLVideoElement {
  webkitSupportsPresentationMode?: (mode: string) => boolean;
  webkitSetPresentationMode?: (mode: string) => void;
  webkitPresentationMode?: string;
}

interface PhaseVisualTheme {
  background: string;
  accentBar: string;
  badgeBg: string;
  badgeText: string;
  clockColor: string;
  countdownColor: string;
  defaultBanner: string;
}

const PHASE_THEMES: Record<TimePhase, PhaseVisualTheme> = {
  IDLE: {
    background: '#0f172a', // slate-900
    accentBar: '#475569',
    badgeBg: '#1e293b',
    badgeText: '#cbd5e1',
    clockColor: '#f8fafc',
    countdownColor: '#94a3b8',
    defaultBanner: 'CHỜ KHUNG GIỜ',
  },
  PREPARE_60S: {
    background: '#1e293b', // slate-800
    accentBar: '#38bdf8',
    badgeBg: '#0369a1',
    badgeText: '#e0f2fe',
    clockColor: '#f8fafc',
    countdownColor: '#7dd3fc',
    defaultBanner: 'CHUẨN BỊ THANH TOÁN',
  },
  READY_10S: {
    background: '#451a03', // deep amber
    accentBar: '#f59e0b',
    badgeBg: '#d97706',
    badgeText: '#fef3c7',
    clockColor: '#fffbeb',
    countdownColor: '#fde68a',
    defaultBanner: 'SẴN SÀNG TAY BẤM',
  },
  COUNTDOWN_3S: {
    background: '#7c2d12', // vibrant orange
    accentBar: '#f97316',
    badgeBg: '#ea580c',
    badgeText: '#ffedd5',
    clockColor: '#ffffff',
    countdownColor: '#fed7aa',
    defaultBanner: 'ĐẾM NGƯỢC 3 GIÂY!',
  },
  STRIKE_NOW: {
    background: '#064e3b', // emerald-green
    accentBar: '#10b981',
    badgeBg: '#059669',
    badgeText: '#ecfdf5',
    clockColor: '#ffffff',
    countdownColor: '#a7f3d0',
    defaultBanner: 'BẤM NGAY!',
  },
  PASSED: {
    background: '#090d16',
    accentBar: '#334155',
    badgeBg: '#1e293b',
    badgeText: '#64748b',
    clockColor: '#94a3b8',
    countdownColor: '#64748b',
    defaultBanner: 'ĐÃ QUA KHUNG GIỜ',
  },
};

/**
 * Checks runtime support for standard Video Picture-in-Picture and Safari WebKit Presentation Mode.
 */
export function detectPipSupport(): PipSupportInfo {
  if (typeof document === 'undefined') {
    return {
      canVideoPip: false,
      canWebkitPip: false,
      fallbackHudOnly: true,
    };
  }

  const probeCanvas = document.createElement('canvas');
  const hasCaptureStream = typeof probeCanvas.captureStream === 'function';

  const canVideoPip = Boolean(
    document.pictureInPictureEnabled &&
      hasCaptureStream &&
      typeof HTMLVideoElement !== 'undefined' &&
      typeof HTMLVideoElement.prototype.requestPictureInPicture === 'function',
  );

  const probeVideo = document.createElement('video') as WebkitVideoElement;
  const canWebkitPip = Boolean(
    hasCaptureStream &&
      typeof probeVideo.webkitSupportsPresentationMode === 'function' &&
      probeVideo.webkitSupportsPresentationMode('picture-in-picture'),
  );

  return {
    canVideoPip,
    canWebkitPip,
    fallbackHudOnly: !canVideoPip && !canWebkitPip,
  };
}

/**
 * Controller for an offscreen 420x220 Canvas + hidden <video playsInline> that renders
 * the high-contrast 0.1s countdown HUD into a floating Picture-in-Picture window.
 */
export class PipClockController {
  private canvas: HTMLCanvasElement | null = null;
  private video: WebkitVideoElement | null = null;
  private mediaStream: MediaStream | null = null;
  private audioController: AudioCueController | null = null;
  private active: boolean = false;
  private lastPayload: PipOverlayPayload = {
    clockText: '00:00:00.0',
    countdownText: '--:--.-',
    phase: 'IDLE',
    bannerText: 'CHỜ KHUNG GIỜ',
    voucherLabel: 'Chưa chọn ca săn mã',
  };

  constructor(audioController?: AudioCueController) {
    this.audioController = audioController ?? null;
  }

  public setAudioController(audioController: AudioCueController | null): void {
    this.audioController = audioController;
  }

  private ensureDomNodes(): { canvas: HTMLCanvasElement; video: WebkitVideoElement } | null {
    if (typeof document === 'undefined') {
      return null;
    }

    if (!this.canvas) {
      const canvas = document.createElement('canvas');
      canvas.width = CANVAS_WIDTH;
      canvas.height = CANVAS_HEIGHT;
      this.canvas = canvas;
    }

    if (!this.video) {
      const video = document.createElement('video') as WebkitVideoElement;
      video.playsInline = true;
      video.muted = false;
      video.autoplay = true;
      video.setAttribute('playsinline', 'true');
      video.setAttribute('webkit-playsinline', 'true');
      video.style.position = 'fixed';
      video.style.width = '1px';
      video.style.height = '1px';
      video.style.opacity = '0';
      video.style.pointerEvents = 'none';
      video.style.bottom = '0';
      video.style.right = '0';

      video.addEventListener('leavepictureinpicture', () => {
        this.active = false;
      });
      video.addEventListener('webkitpresentationmodechanged', () => {
        if (video.webkitPresentationMode !== 'picture-in-picture') {
          this.active = false;
        }
      });

      if (document.body) {
        document.body.appendChild(video);
      }
      this.video = video;
    }

    return { canvas: this.canvas, video: this.video };
  }

  private drawFrame(payload: PipOverlayPayload): void {
    const nodes = this.ensureDomNodes();
    if (!nodes) {
      return;
    }

    if (
      typeof navigator !== 'undefined' &&
      /jsdom/i.test(navigator.userAgent || '') &&
      !Object.prototype.hasOwnProperty.call(nodes.canvas, 'getContext')
    ) {
      return;
    }

    let ctx: CanvasRenderingContext2D | null = null;
    try {
      ctx = nodes.canvas.getContext('2d');
    } catch {
      ctx = null;
    }
    if (!ctx) {
      return;
    }

    const theme = PHASE_THEMES[payload.phase] ?? PHASE_THEMES.IDLE;
    const isStrike = payload.phase === 'STRIKE_NOW';

    // Background fill
    ctx.fillStyle = theme.background;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Top accent bar
    ctx.fillStyle = theme.accentBar;
    ctx.fillRect(0, 0, CANVAS_WIDTH, isStrike ? 10 : 6);

    // Phase status badge
    const banner = isStrike
      ? 'BẤM NGAY!'
      : payload.bannerText?.trim() || theme.defaultBanner;
    ctx.fillStyle = theme.badgeBg;
    ctx.fillRect(16, 16, CANVAS_WIDTH - 32, 34);

    ctx.fillStyle = theme.badgeText;
    ctx.font = 'bold 16px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(banner.toUpperCase(), CANVAS_WIDTH / 2, 33);

    if (isStrike) {
      // Giant "BẤM NGAY!" call-to-action on STRIKE_NOW
      ctx.fillStyle = '#ffffff';
      ctx.font = '900 44px system-ui, -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('BẤM NGAY!', CANVAS_WIDTH / 2, 92);

      ctx.fillStyle = theme.countdownColor;
      ctx.font = 'bold 26px ui-monospace, SFMono-Regular, Menlo, monospace';
      ctx.fillText(`${payload.clockText}  (${payload.countdownText})`, CANVAS_WIDTH / 2, 138);
    } else {
      // Primary synchronized clock (HH:MM:SS.d)
      ctx.fillStyle = theme.clockColor;
      ctx.font = '900 46px ui-monospace, SFMono-Regular, Menlo, monospace';
      ctx.textAlign = 'center';
      ctx.fillText(payload.clockText, CANVAS_WIDTH / 2, 92);

      // Remaining countdown
      ctx.fillStyle = theme.countdownColor;
      ctx.font = 'bold 28px ui-monospace, SFMono-Regular, Menlo, monospace';
      ctx.fillText(`CÒN: ${payload.countdownText}`, CANVAS_WIDTH / 2, 138);
    }

    // Bottom voucher strip
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.fillRect(0, 166, CANVAS_WIDTH, 54);

    ctx.fillStyle = '#f8fafc';
    ctx.font = '600 15px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'left';
    const labelText = payload.voucherLabel || 'Sẵn sàng săn mã Shopee';
    ctx.fillText(labelText.slice(0, 34), 16, 186);

    if (payload.voucherCode) {
      ctx.fillStyle = '#fbbf24';
      ctx.font = 'bold 15px ui-monospace, SFMono-Regular, Menlo, monospace';
      ctx.fillText(`MÃ: ${payload.voucherCode}`, 16, 206);
    } else {
      ctx.fillStyle = '#94a3b8';
      ctx.font = '13px system-ui, -apple-system, sans-serif';
      ctx.fillText('Đã lưu sẵn ở màn Thanh toán', 16, 206);
    }
  }

  /**
   * Updates the rendered canvas frame with the latest clock, countdown, phase, and voucher info.
   */
  public update(payload: PipOverlayPayload): void {
    this.lastPayload = payload;
    this.drawFrame(payload);
  }

  /**
   * Alias for update(payload).
   */
  public render(payload: PipOverlayPayload): void {
    this.update(payload);
  }

  /**
   * Opens the floating Picture-in-Picture window (must be invoked from a user gesture).
   */
  public async open(initialPayload?: PipOverlayPayload): Promise<boolean> {
    if (initialPayload) {
      this.lastPayload = initialPayload;
    }

    const support = detectPipSupport();
    if (support.fallbackHudOnly) {
      return false;
    }

    const nodes = this.ensureDomNodes();
    if (!nodes) {
      return false;
    }

    this.drawFrame(this.lastPayload);

    const { canvas, video } = nodes;
    if (typeof canvas.captureStream !== 'function') {
      return false;
    }

    try {
      if (!this.mediaStream) {
        const stream = canvas.captureStream(30);
        const audioTrack = this.audioController?.getAudioTrack() ?? null;
        if (audioTrack && typeof stream.addTrack === 'function') {
          const existingTracks =
            typeof stream.getAudioTracks === 'function' ? stream.getAudioTracks() : [];
          if (existingTracks.length === 0) {
            stream.addTrack(audioTrack);
          }
        }
        this.mediaStream = stream;
        video.srcObject = stream;
      }

      if (typeof video.play === 'function') {
        await video.play();
      }

      if (support.canVideoPip && typeof video.requestPictureInPicture === 'function') {
        await video.requestPictureInPicture();
        this.active = true;
        return true;
      }

      if (support.canWebkitPip && typeof video.webkitSetPresentationMode === 'function') {
        video.webkitSetPresentationMode('picture-in-picture');
        this.active = true;
        return true;
      }

      return false;
    } catch {
      this.active = false;
      return false;
    }
  }

  /**
   * Closes the active Picture-in-Picture window and cleans up media tracks.
   */
  public async close(): Promise<void> {
    this.active = false;

    if (typeof document !== 'undefined' && document.pictureInPictureElement) {
      try {
        if (typeof document.exitPictureInPicture === 'function') {
          await document.exitPictureInPicture();
        }
      } catch {
        // Ignore exit errors
      }
    }

    if (this.video && typeof this.video.webkitSetPresentationMode === 'function') {
      try {
        if (this.video.webkitPresentationMode === 'picture-in-picture') {
          this.video.webkitSetPresentationMode('inline');
        }
      } catch {
        // Ignore webkit exit errors
      }
    }
  }

  public isActive(): boolean {
    if (typeof document !== 'undefined' && this.video && document.pictureInPictureElement === this.video) {
      return true;
    }
    if (this.video && this.video.webkitPresentationMode === 'picture-in-picture') {
      return true;
    }
    return this.active;
  }

  public getCanvas(): HTMLCanvasElement | null {
    return this.canvas;
  }
}

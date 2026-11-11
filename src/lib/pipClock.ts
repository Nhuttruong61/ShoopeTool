import type {
  PipOverlayPayload,
  PipSupportInfo,
  TimePhase,
} from '../types/contracts';
import type { AudioCueController } from './audioCue';

const CANVAS_WIDTH = 420;
const CANVAS_HEIGHT = 220;
const WARMUP_FPS = 15;
const WARMUP_INTERVAL_MS = 500;
const METADATA_WAIT_TIMEOUT_MS = 600;

interface WebkitVideoElement extends HTMLVideoElement {
  webkitSupportsPresentationMode?: (mode: string) => boolean;
  webkitSetPresentationMode?: (mode: string) => void;
  webkitPresentationMode?: string;
  disablePictureInPicture?: boolean;
}

interface CanvasCaptureMediaStreamTrack extends MediaStreamTrack {
  requestFrame?: () => void;
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

function isStandalonePwaMode(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  const matchStandalone =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(display-mode: standalone)').matches;
  const iosStandalone =
    typeof navigator !== 'undefined' &&
    Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
  return Boolean(matchStandalone || iosStandalone);
}

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
 * Controller for an offscreen 420x220 Canvas + pre-warmed <video playsInline muted> that renders
 * the high-contrast 0.1s countdown HUD into a floating Picture-in-Picture window on Mobile & Desktop.
 */
export class PipClockController {
  private canvas: HTMLCanvasElement | null = null;
  private video: WebkitVideoElement | null = null;
  private mediaStream: MediaStream | null = null;
  private audioController: AudioCueController | null = null;
  private active: boolean = false;
  private lastError: string | null = null;
  private warmupInterval: ReturnType<typeof setInterval> | null = null;
  private inlineContainer: HTMLElement | null = null;
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

  public getLastError(): string | null {
    return this.lastError;
  }

  private applyHiddenVideoStyles(video: WebkitVideoElement): void {
    video.controls = false;
    video.width = 210;
    video.height = 110;
    video.style.position = 'fixed';
    video.style.width = '210px';
    video.style.height = '110px';
    video.style.maxWidth = 'none';
    video.style.bottom = '4px';
    video.style.right = '4px';
    video.style.opacity = '0.02';
    video.style.pointerEvents = 'none';
    video.style.zIndex = '-1';
    video.style.borderRadius = '0';
  }

  private applyInlineVideoStyles(video: WebkitVideoElement): void {
    video.controls = true;
    video.width = CANVAS_WIDTH;
    video.height = CANVAS_HEIGHT;
    video.style.position = 'static';
    video.style.width = '100%';
    video.style.maxWidth = '320px';
    video.style.height = 'auto';
    video.style.opacity = '1';
    video.style.pointerEvents = 'auto';
    video.style.zIndex = '1';
    video.style.borderRadius = '10px';
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
      video.muted = true;
      video.autoplay = true;
      video.disablePictureInPicture = false;
      video.setAttribute('playsinline', 'true');
      video.setAttribute('webkit-playsinline', 'true');
      video.setAttribute('muted', '');

      if (this.inlineContainer) {
        this.applyInlineVideoStyles(video);
      } else {
        this.applyHiddenVideoStyles(video);
      }

      video.addEventListener('enterpictureinpicture', () => {
        this.active = true;
        this.lastError = null;
      });
      video.addEventListener('leavepictureinpicture', () => {
        this.active = false;
      });
      video.addEventListener('webkitpresentationmodechanged', () => {
        this.active = video.webkitPresentationMode === 'picture-in-picture';
        if (this.active) {
          this.lastError = null;
        }
      });

      const targetParent = this.inlineContainer ?? document.body;
      if (targetParent) {
        targetParent.appendChild(video);
      }
      this.video = video;
    }

    return { canvas: this.canvas, video: this.video };
  }

  /**
   * Moves the <video> into a visible inline container (with native browser controls enabled)
   * so Standalone PWA / iOS Safari users can also tap the native PiP icon directly on the video.
   * Passing `null` moves the <video> back to `document.body` in hidden pre-warm mode.
   */
  public mountInlineVideo(container: HTMLElement | null): void {
    this.inlineContainer = container;
    const nodes = this.ensureDomNodes();
    if (!nodes) {
      return;
    }

    const { video } = nodes;
    if (container) {
      this.applyInlineVideoStyles(video);
      if (video.parentElement !== container) {
        container.appendChild(video);
      }
    } else {
      this.applyHiddenVideoStyles(video);
      if (typeof document !== 'undefined' && document.body && video.parentElement !== document.body) {
        document.body.appendChild(video);
      }
    }
  }

  private requestStreamFrame(): void {
    if (!this.mediaStream || typeof this.mediaStream.getVideoTracks !== 'function') {
      return;
    }
    const tracks = this.mediaStream.getVideoTracks();
    const firstTrack = tracks?.[0] as CanvasCaptureMediaStreamTrack | undefined;
    if (firstTrack && typeof firstTrack.requestFrame === 'function') {
      try {
        firstTrack.requestFrame();
      } catch {
        // Ignore track requestFrame errors on browsers that auto-push frames
      }
    }
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
   * Pre-warms the offscreen canvas stream and <video> element BEFORE the user clicks PiP:
   * 1. Creates `canvas.captureStream(15)` FIRST and binds `video.srcObject = stream`
   * 2. Paints `drawFrame(this.lastPayload)` + calls `track.requestFrame?.()` so video metadata loads
   * 3. Starts a 500ms keep-alive interval + silent `video.play()` so `video.readyState >= 2` is ready
   */
  public warmup(initialPayload?: PipOverlayPayload): void {
    if (initialPayload) {
      this.lastPayload = initialPayload;
    }

    const nodes = this.ensureDomNodes();
    if (!nodes) {
      return;
    }

    const { canvas, video } = nodes;
    video.muted = true;
    video.disablePictureInPicture = false;

    if (!this.mediaStream && typeof canvas.captureStream === 'function') {
      const stream = canvas.captureStream(WARMUP_FPS);
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

    // Paint frame AFTER captureStream is attached so the stream immediately emits its first frame
    this.drawFrame(this.lastPayload);
    this.requestStreamFrame();

    if (typeof video.play === 'function' && video.paused !== false) {
      try {
        const playResult = video.play();
        if (playResult && typeof playResult.catch === 'function') {
          void playResult.catch(() => {});
        }
      } catch {
        // Ignore synchronous play() errors during pre-warm
      }
    }

    if (!this.warmupInterval) {
      this.warmupInterval = setInterval(() => {
        this.drawFrame(this.lastPayload);
        this.requestStreamFrame();
        if (this.video && this.video.paused && typeof this.video.play === 'function') {
          try {
            const res = this.video.play();
            if (res && typeof res.catch === 'function') {
              void res.catch(() => {});
            }
          } catch {
            // Ignore background play error
          }
        }
      }, WARMUP_INTERVAL_MS);

      (this.warmupInterval as unknown as { unref?: () => void })?.unref?.();
    }
  }

  /**
   * Updates the rendered canvas frame with the latest clock, countdown, phase, and voucher info.
   */
  public update(payload: PipOverlayPayload): void {
    this.lastPayload = payload;
    this.drawFrame(payload);
    if (this.mediaStream) {
      this.requestStreamFrame();
    }
  }

  /**
   * Alias for update(payload).
   */
  public render(payload: PipOverlayPayload): void {
    this.update(payload);
  }

  private waitForMetadataOrTimeout(video: HTMLVideoElement, timeoutMs: number): Promise<void> {
    if (video.readyState >= 1) {
      return Promise.resolve();
    }

    return new Promise<void>((resolve) => {
      let settled = false;
      const finish = () => {
        if (settled) {
          return;
        }
        settled = true;
        clearTimeout(timer);
        video.removeEventListener('loadedmetadata', finish);
        video.removeEventListener('loadeddata', finish);
        video.removeEventListener('canplay', finish);
        resolve();
      };

      const timer = setTimeout(finish, timeoutMs);
      (timer as unknown as { unref?: () => void })?.unref?.();

      video.addEventListener('loadedmetadata', finish, { once: true });
      video.addEventListener('loadeddata', finish, { once: true });
      video.addEventListener('canplay', finish, { once: true });
    });
  }

  private formatVietnamesePipError(err: unknown): string {
    const standalone = isStandalonePwaMode();
    const errName = err instanceof Error ? err.name : '';
    const errMsg = err instanceof Error ? err.message : String(err ?? '');

    if (/NotAllowedError|gesture|user activation|permission/i.test(`${errName} ${errMsg}`)) {
      if (standalone) {
        return 'Chế độ App màn hình chính (Standalone PWA) chặn gọi PiP tự động. Hãy bấm trực tiếp nút PiP trên khung video đồng hồ bên dưới hoặc mở bằng Safari/Chrome.';
      }
      return 'Trình duyệt hoặc cài đặt Android/iOS đã chặn quyền Hình-trong-hình (PiP). Hãy bật quyền Picture-in-Picture cho trình duyệt hoặc bấm nút PiP trực tiếp trên khung video.';
    }

    if (/InvalidStateError|metadata|HAVE_NOTHING|readyState/i.test(`${errName} ${errMsg}`)) {
      return 'Luồng video đồng hồ đang khởi tạo metadata. Hãy bấm lại nút Bật Đồng Hồ Nổi (PiP) một lần nữa hoặc dùng nút PiP trực tiếp trên video.';
    }

    if (standalone) {
      return 'Không thể mở PiP tự động trong chế độ App màn hình chính. Hãy bấm biểu tượng PiP trực tiếp trên khung video đồng hồ bên dưới.';
    }

    return 'Không thể mở cửa sổ nổi PiP trên trình duyệt này. Bạn hãy thử bấm biểu tượng PiP trên khung video hoặc mở bằng Chrome / Safari.';
  }

  /**
   * Opens the floating Picture-in-Picture window (must be invoked from a user gesture).
   */
  public async open(initialPayload?: PipOverlayPayload): Promise<boolean> {
    this.lastError = null;
    if (initialPayload) {
      this.lastPayload = initialPayload;
    }

    const support = detectPipSupport();
    if (support.fallbackHudOnly) {
      this.lastError = isStandalonePwaMode()
        ? 'Chế độ App màn hình chính (Standalone PWA) hoặc trình duyệt hiện tại không hỗ trợ API Picture-in-Picture. Hãy mở bằng Safari / Chrome hoặc dùng HUD nổi tại chỗ.'
        : 'Trình duyệt hiện tại không hỗ trợ cửa sổ nổi Picture-in-Picture (ví dụ trình duyệt trong ứng dụng Zalo/Facebook/Shopee). Hãy mở bằng Chrome hoặc Safari.';
      return false;
    }

    const nodes = this.ensureDomNodes();
    if (!nodes) {
      this.lastError = 'Không thể khởi tạo khung hình đồng hồ PiP.';
      return false;
    }

    const { canvas, video } = nodes;
    if (typeof canvas.captureStream !== 'function') {
      this.lastError = 'Trình duyệt không hỗ trợ truyền luồng Canvas sang Video PiP.';
      return false;
    }

    // Ensure stream is created FIRST and a fresh frame is painted into the stream
    this.warmup(this.lastPayload);

    try {
      // SYNCHRONOUS FAST PATH 1: iOS Safari WebKit Presentation Mode
      // Never `await video.play()` before `webkitSetPresentationMode` or iOS expires the user gesture!
      if (support.canWebkitPip && typeof video.webkitSetPresentationMode === 'function') {
        if (typeof video.play === 'function') {
          try {
            const playPromise = video.play();
            if (playPromise && typeof playPromise.catch === 'function') {
              void playPromise.catch(() => {});
            }
          } catch {
            // Ignore play error and proceed with synchronous presentation mode switch
          }
        }
        video.webkitSetPresentationMode('picture-in-picture');
        this.active = true;
        return true;
      }

      // SYNCHRONOUS FAST PATH 2: Standard Video PiP when video metadata is already pre-warmed (readyState >= 1)
      if (
        support.canVideoPip &&
        typeof video.requestPictureInPicture === 'function' &&
        video.readyState >= 1
      ) {
        if (video.paused && typeof video.play === 'function') {
          try {
            const playPromise = video.play();
            if (playPromise && typeof playPromise.catch === 'function') {
              void playPromise.catch(() => {});
            }
          } catch {
            // Ignore play error when kicking playback synchronously
          }
        }
        await video.requestPictureInPicture();
        this.active = true;
        return true;
      }

      // COLD-START FALLBACK: Only when video.readyState === 0 (HAVE_NOTHING)
      if (support.canVideoPip && typeof video.requestPictureInPicture === 'function') {
        this.drawFrame(this.lastPayload);
        this.requestStreamFrame();

        await this.waitForMetadataOrTimeout(video, METADATA_WAIT_TIMEOUT_MS);

        if (typeof video.play === 'function') {
          await video.play();
        }

        await video.requestPictureInPicture();
        this.active = true;
        return true;
      }

      this.lastError = 'Trình duyệt không hỗ trợ mở cửa sổ nổi Picture-in-Picture.';
      return false;
    } catch (err) {
      this.active = false;
      this.lastError = this.formatVietnamesePipError(err);
      return false;
    }
  }

  /**
   * Closes the active Picture-in-Picture window.
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

  /**
   * Cleans up the pre-warm interval, closes PiP, stops media tracks, and removes DOM nodes.
   */
  public dispose(): void {
    if (this.warmupInterval) {
      clearInterval(this.warmupInterval);
      this.warmupInterval = null;
    }

    void this.close();

    if (this.mediaStream && typeof this.mediaStream.getTracks === 'function') {
      for (const track of this.mediaStream.getTracks()) {
        try {
          track.stop();
        } catch {
          // Ignore track stop errors
        }
      }
    }
    this.mediaStream = null;

    if (this.video) {
      this.video.srcObject = null;
      if (this.video.parentElement) {
        this.video.parentElement.removeChild(this.video);
      }
      this.video = null;
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

  public getVideo(): HTMLVideoElement | null {
    return this.video;
  }
}

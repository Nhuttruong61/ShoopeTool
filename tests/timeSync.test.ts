import { describe, expect, it, vi } from 'vitest';
import {
  computeSampleOffset,
  computeStrikeCountdown,
  formatClockTenths,
  formatRemainingTenths,
  getNextDropEpochMs,
  getPhaseForRemaining,
  selectMedianSample,
  syncServerTime,
} from '../src/lib/timeSync';
import { AudioCueController } from '../src/lib/audioCue';
import { detectPipSupport, PipClockController } from '../src/lib/pipClock';
import type { TimeSyncSnapshot } from '../src/types/contracts';

describe('timeSync module', () => {
  describe('computeSampleOffset (Cristian algorithm)', () => {
    it('computes rttMs and half-RTT compensated offsetMs accurately', () => {
      // Client sent at perf 1000ms, received at perf 1120ms -> rttMs = 120ms (rtt/2 = 60ms)
      // Server timestamp in body is 1_700_000_000_000, client Date.now() at recv is 1_700_000_000_010
      // Estimated server at recv = 1_700_000_000_060 -> offsetMs = +50ms
      const sample = computeSampleOffset(1000, 1120, 1_700_000_000_000, 1_700_000_000_010);
      expect(sample.rttMs).toBe(120);
      expect(sample.offsetMs).toBe(50);
    });

    it('handles negative clock offset when device clock is ahead of server', () => {
      // rtt = 80ms (rtt/2 = 40ms), estimated server at recv = 1040, client recv = 1500 -> offset = -460ms
      const sample = computeSampleOffset(200, 280, 1000, 1500);
      expect(sample.rttMs).toBe(80);
      expect(sample.offsetMs).toBe(-460);
    });
  });

  describe('selectMedianSample', () => {
    it('discards negative RTT and outlier RTT > 5000ms and picks median offset', () => {
      const samples = [
        { offsetMs: -900, rttMs: -10 }, // invalid negative RTT
        { offsetMs: 5000, rttMs: 6200 }, // outlier RTT > 5000ms
        { offsetMs: 180, rttMs: 95 },
        { offsetMs: 40, rttMs: 110 },
        { offsetMs: 115, rttMs: 85 },
      ];

      const selected = selectMedianSample(samples);
      expect(selected).toEqual({ offsetMs: 115, rttMs: 85 });
    });

    it('returns null when all samples are invalid or list is empty', () => {
      expect(selectMedianSample([])).toBeNull();
      expect(
        selectMedianSample([
          { offsetMs: 100, rttMs: -5 },
          { offsetMs: 200, rttMs: 5001 },
        ]),
      ).toBeNull();
    });
  });

  describe('syncServerTime', () => {
    it('returns synced TimeSyncSnapshot on mocked fetch success', async () => {
      const serverTimeIso = '2026-11-11T23:59:50.000+07:00';
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ dateTime: serverTimeIso }),
        headers: new Headers(),
      } as unknown as Response);

      const snapshot = await syncServerTime(150, mockFetch as unknown as typeof fetch);
      expect(snapshot.synced).toBe(true);
      expect(snapshot.source).toBe('timeapi.io');
      expect(snapshot.manualAdjustMs).toBe(150);
      expect(typeof snapshot.offsetMs).toBe('number');
      expect(snapshot.rttMs).not.toBeNull();
      expect(snapshot.lastSyncedAt).not.toBeNull();
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('falls back gracefully to device-clock when network requests fail', async () => {
      const failingFetch = vi.fn().mockRejectedValue(new Error('Network offline'));

      const snapshot = await syncServerTime(-200, failingFetch as unknown as typeof fetch);
      expect(snapshot).toEqual({
        synced: false,
        offsetMs: 0,
        rttMs: null,
        source: 'device-clock',
        lastSyncedAt: null,
        manualAdjustMs: -200,
      });
    });
  });

  describe('getPhaseForRemaining & computeStrikeCountdown across leadMs = 300 boundaries', () => {
    const targetMidnightEpoch = Date.parse('2026-11-12T00:00:00.000+07:00');
    const baseSync: TimeSyncSnapshot = {
      synced: true,
      offsetMs: 0,
      rttMs: 50,
      source: 'timeapi.io',
      lastSyncedAt: targetMidnightEpoch - 100_000,
      manualAdjustMs: 0,
    };

    it('returns IDLE when targetEpochMs is null or > 60s before effective strike', () => {
      expect(getPhaseForRemaining(null, null)).toBe('IDLE');
      expect(getPhaseForRemaining(60_001, 60_301)).toBe('IDLE');

      const stateNull = computeStrikeCountdown(targetMidnightEpoch - 90_000, baseSync, null, 300);
      expect(stateNull.phase).toBe('IDLE');
      expect(stateNull.formattedRemaining).toBe('--:--.-');
    });

    it('transitions through PREPARE_60S, READY_10S, COUNTDOWN_3S, STRIKE_NOW at 59.7s (leadMs=300), and PASSED', () => {
      // At T - 45.0s -> PREPARE_60S
      const prepState = computeStrikeCountdown(
        targetMidnightEpoch - 45_000,
        baseSync,
        targetMidnightEpoch,
        300,
      );
      expect(prepState.phase).toBe('PREPARE_60S');

      // At T - 8.0s -> READY_10S
      const readyState = computeStrikeCountdown(
        targetMidnightEpoch - 8_000,
        baseSync,
        targetMidnightEpoch,
        300,
      );
      expect(readyState.phase).toBe('READY_10S');

      // At 23:59:59.6 (T - 400ms, effectiveRemaining = 100ms) -> COUNTDOWN_3S
      const countdown3sState = computeStrikeCountdown(
        targetMidnightEpoch - 400,
        baseSync,
        targetMidnightEpoch,
        300,
      );
      expect(countdown3sState.effectiveStrikeRemainingMs).toBe(100);
      expect(countdown3sState.phase).toBe('COUNTDOWN_3S');

      // At 23:59:59.7 (T - 300ms, effectiveRemaining = 0ms with leadMs = 300) -> STRIKE_NOW!
      const strikeBoundaryState = computeStrikeCountdown(
        targetMidnightEpoch - 300,
        baseSync,
        targetMidnightEpoch,
        300,
      );
      expect(strikeBoundaryState.remainingMs).toBe(300);
      expect(strikeBoundaryState.effectiveStrikeRemainingMs).toBe(0);
      expect(strikeBoundaryState.phase).toBe('STRIKE_NOW');
      expect(strikeBoundaryState.formattedClock).toBe('23:59:59.7');
      expect(strikeBoundaryState.formattedRemaining).toBe('00:00.3');

      // At 00:00:02.5 (T + 2500ms, rawRemaining = -2500ms >= -3000ms) -> still STRIKE_NOW
      const holdStrikeState = computeStrikeCountdown(
        targetMidnightEpoch + 2500,
        baseSync,
        targetMidnightEpoch,
        300,
      );
      expect(holdStrikeState.phase).toBe('STRIKE_NOW');
      expect(holdStrikeState.formattedRemaining).toBe('-00:02.5');

      // At 00:00:03.2 (rawRemaining = -3200ms < -3000ms) -> PASSED
      const passedState = computeStrikeCountdown(
        targetMidnightEpoch + 3200,
        baseSync,
        targetMidnightEpoch,
        300,
      );
      expect(passedState.phase).toBe('PASSED');
    });
  });

  describe('formatClockTenths & formatRemainingTenths', () => {
    it('formats epoch ms to HH:MM:SS.d in Asia/Ho_Chi_Minh (UTC+7)', () => {
      const epoch = Date.parse('2026-11-11T23:59:59.740+07:00');
      expect(formatClockTenths(epoch)).toBe('23:59:59.7');

      const midnight = Date.parse('2026-11-12T00:00:00.050+07:00');
      expect(formatClockTenths(midnight)).toBe('00:00:00.0');
    });

    it('formats positive, negative, and null remaining milliseconds', () => {
      expect(formatRemainingTenths(12_400)).toBe('00:12.4');
      expect(formatRemainingTenths(-800)).toBe('-00:00.8');
      expect(formatRemainingTenths(null)).toBe('--:--.-');
    });
  });

  describe('getNextDropEpochMs', () => {
    it('returns same-day slot when reference time is earlier in UTC+7', () => {
      const ref = Date.parse('2026-11-11T11:30:00.000+07:00');
      const expected = Date.parse('2026-11-11T12:00:00.000+07:00');
      expect(getNextDropEpochMs('12:00', ref)).toBe(expected);
    });

    it('rolls over to next-day slot when slot time has already passed today in UTC+7', () => {
      const ref = Date.parse('2026-11-11T21:05:00.000+07:00');
      const expected = Date.parse('2026-11-12T21:00:00.000+07:00');
      expect(getNextDropEpochMs('21:00', ref)).toBe(expected);
    });
  });

  describe('AudioCueController & PipClockController safe jsdom behavior', () => {
    it('operates as safe no-op in jsdom when AudioContext or PiP is unavailable', async () => {
      const audio = new AudioCueController(true);
      expect(() => audio.playTick()).not.toThrow();
      expect(() => audio.playStrikeBeep()).not.toThrow();

      const support = detectPipSupport();
      expect(support.fallbackHudOnly).toBe(true);

      const pip = new PipClockController(audio);
      pip.update({
        clockText: '23:59:59.7',
        countdownText: '00:00.3',
        phase: 'STRIKE_NOW',
        bannerText: 'BẤM NGAY!',
        voucherLabel: 'Mã giảm 20% tối đa 100k',
        voucherCode: 'SHOPEE1111',
      });
      expect(await pip.open()).toBe(false);
      expect(pip.isActive()).toBe(false);
      expect(pip.getLastError()).toBeTruthy();
      pip.dispose();
    });

    it('warmup() creates captureStream BEFORE painting frame and sets video.muted = true with non-1px dimensions', () => {
      const callOrder: string[] = [];
      const requestFrameSpy = vi.fn(() => {
        callOrder.push('requestFrame');
      });
      const fakeStream = {
        getVideoTracks: () => [{ requestFrame: requestFrameSpy, stop: vi.fn() }],
        getAudioTracks: () => [],
        getTracks: () => [{ stop: vi.fn() }],
        addTrack: vi.fn(),
      } as unknown as MediaStream;

      const origCreateElement = document.createElement.bind(document);
      const createElementSpy = vi.spyOn(document, 'createElement').mockImplementation(((
        tagName: string,
      ) => {
        const el = origCreateElement(tagName);
        if (tagName.toLowerCase() === 'canvas') {
          (el as HTMLCanvasElement).captureStream = vi.fn(() => {
            callOrder.push('captureStream');
            return fakeStream;
          });
          Object.defineProperty(el, 'getContext', {
            value: vi.fn(() => ({
              fillStyle: '',
              font: '',
              textAlign: 'center',
              textBaseline: 'middle',
              fillRect: vi.fn(() => {
                if (!callOrder.includes('drawFrame')) {
                  callOrder.push('drawFrame');
                }
              }),
              fillText: vi.fn(),
            })),
            configurable: true,
          });
        }
        if (tagName.toLowerCase() === 'video') {
          (el as HTMLVideoElement).play = vi.fn().mockResolvedValue(undefined);
        }
        return el;
      }) as typeof document.createElement);

      const pip = new PipClockController();
      pip.warmup({
        clockText: '11:59:59.7',
        countdownText: '00:00.3',
        phase: 'COUNTDOWN_3S',
        bannerText: 'ĐẾM NGƯỢC 3 GIÂY!',
        voucherLabel: 'Mã Shopee Video 50%',
      });

      const video = pip.getVideo();
      expect(video).not.toBeNull();
      expect(video?.muted).toBe(true);
      expect(video?.style.width).toBe('210px');
      expect(video?.style.height).toBe('110px');
      expect(video?.style.width).not.toBe('1px');
      expect(callOrder).toEqual(['captureStream', 'drawFrame', 'requestFrame']);

      pip.dispose();
      createElementSpy.mockRestore();
    });

    it('open() succeeds via synchronous readyState >= 2 path and via webkitSetPresentationMode without awaiting play() first', async () => {
      const fakeStream = {
        getVideoTracks: () => [{ requestFrame: vi.fn(), stop: vi.fn() }],
        getAudioTracks: () => [],
        getTracks: () => [{ stop: vi.fn() }],
        addTrack: vi.fn(),
      } as unknown as MediaStream;

      const origCreateElement = document.createElement.bind(document);
      let playResolved = false;

      // 1. Test standard requestPictureInPicture synchronous readyState >= 2 fast-path
      Object.defineProperty(document, 'pictureInPictureEnabled', {
        value: true,
        configurable: true,
      });
      const origReqPip = HTMLVideoElement.prototype.requestPictureInPicture;
      const reqPipSpy = vi.fn(async () => {
        // Must be called synchronously BEFORE play() promise settles!
        expect(playResolved).toBe(false);
        return {} as PictureInPictureWindow;
      });
      HTMLVideoElement.prototype.requestPictureInPicture = reqPipSpy;

      const createElementSpy = vi.spyOn(document, 'createElement').mockImplementation(((
        tagName: string,
      ) => {
        const el = origCreateElement(tagName);
        if (tagName.toLowerCase() === 'canvas') {
          (el as HTMLCanvasElement).captureStream = vi.fn(() => fakeStream);
        }
        if (tagName.toLowerCase() === 'video') {
          Object.defineProperty(el, 'readyState', { value: 2, configurable: true });
          (el as HTMLVideoElement).play = vi.fn(
            () =>
              new Promise<void>((resolve) => {
                setTimeout(() => {
                  playResolved = true;
                  resolve();
                }, 50);
              }),
          );
          (el as HTMLVideoElement).requestPictureInPicture = reqPipSpy;
        }
        return el;
      }) as typeof document.createElement);

      const pipStandard = new PipClockController();
      const openedStandard = await pipStandard.open();
      expect(openedStandard).toBe(true);
      expect(pipStandard.isActive()).toBe(true);
      expect(reqPipSpy).toHaveBeenCalledTimes(1);
      pipStandard.dispose();

      // 2. Test iOS Safari webkitSetPresentationMode fast-path without awaiting play()
      Object.defineProperty(document, 'pictureInPictureEnabled', {
        value: false,
        configurable: true,
      });
      // @ts-expect-error cleanup prototype mock
      delete HTMLVideoElement.prototype.requestPictureInPicture;

      let webkitPlayResolved = false;
      const webkitSetModeSpy = vi.fn((mode: string) => {
        expect(mode).toBe('picture-in-picture');
        expect(webkitPlayResolved).toBe(false);
      });

      createElementSpy.mockImplementation(((tagName: string) => {
        const el = origCreateElement(tagName);
        if (tagName.toLowerCase() === 'canvas') {
          (el as HTMLCanvasElement).captureStream = vi.fn(() => fakeStream);
        }
        if (tagName.toLowerCase() === 'video') {
          const v = el as HTMLVideoElement & {
            webkitSupportsPresentationMode?: (mode: string) => boolean;
            webkitSetPresentationMode?: (mode: string) => void;
          };
          v.webkitSupportsPresentationMode = (mode: string) => mode === 'picture-in-picture';
          v.webkitSetPresentationMode = webkitSetModeSpy;
          v.play = vi.fn(
            () =>
              new Promise<void>((resolve) => {
                setTimeout(() => {
                  webkitPlayResolved = true;
                  resolve();
                }, 50);
              }),
          );
        }
        return el;
      }) as typeof document.createElement);

      const pipWebkit = new PipClockController();
      const openedWebkit = await pipWebkit.open();
      expect(openedWebkit).toBe(true);
      expect(pipWebkit.isActive()).toBe(true);
      expect(webkitSetModeSpy).toHaveBeenCalledWith('picture-in-picture');
      pipWebkit.dispose();

      if (origReqPip) {
        HTMLVideoElement.prototype.requestPictureInPicture = origReqPip;
      }
      createElementSpy.mockRestore();
    });

    it('mountInlineVideo() and getLastError() work cleanly', async () => {
      const pip = new PipClockController();
      const container = document.createElement('div');
      document.body.appendChild(container);

      pip.mountInlineVideo(container);
      const video = pip.getVideo();
      expect(video).not.toBeNull();
      expect(video?.parentElement).toBe(container);
      expect(video?.controls).toBe(true);
      expect(video?.style.position).toBe('static');
      expect(video?.style.opacity).toBe('1');

      // Unmount back to hidden body mode
      pip.mountInlineVideo(null);
      expect(video?.parentElement).toBe(document.body);
      expect(video?.controls).toBe(false);
      expect(video?.style.position).toBe('fixed');
      expect(video?.style.opacity).toBe('0.02');

      // Verify getLastError() on NotAllowedError failure
      const origCreateElement = document.createElement.bind(document);
      Object.defineProperty(document, 'pictureInPictureEnabled', {
        value: true,
        configurable: true,
      });
      const failingReqPip = vi
        .fn()
        .mockRejectedValue(Object.assign(new Error('User gesture required'), { name: 'NotAllowedError' }));
      HTMLVideoElement.prototype.requestPictureInPicture = failingReqPip;

      const createElementSpy = vi.spyOn(document, 'createElement').mockImplementation(((
        tagName: string,
      ) => {
        const el = origCreateElement(tagName);
        if (tagName.toLowerCase() === 'canvas') {
          (el as HTMLCanvasElement).captureStream = vi.fn(
            () =>
              ({
                getVideoTracks: () => [],
                getAudioTracks: () => [],
                getTracks: () => [],
              }) as unknown as MediaStream,
          );
        }
        if (tagName.toLowerCase() === 'video') {
          Object.defineProperty(el, 'readyState', { value: 2, configurable: true });
          (el as HTMLVideoElement).play = vi.fn().mockResolvedValue(undefined);
          (el as HTMLVideoElement).requestPictureInPicture = failingReqPip;
        }
        return el;
      }) as typeof document.createElement);

      const pipError = new PipClockController();
      const ok = await pipError.open();
      expect(ok).toBe(false);
      expect(pipError.getLastError()).toContain('PiP');

      pipError.dispose();
      pip.dispose();
      container.remove();
      Object.defineProperty(document, 'pictureInPictureEnabled', {
        value: false,
        configurable: true,
      });
      // @ts-expect-error cleanup prototype mock
      delete HTMLVideoElement.prototype.requestPictureInPicture;
      createElementSpy.mockRestore();
    });
  });
});

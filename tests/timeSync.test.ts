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
    });
  });
});

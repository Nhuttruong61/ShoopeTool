import type {
  StrikeCountdownState,
  TimePhase,
  TimeSyncSnapshot,
} from '../types/contracts';

export const VN_OFFSET_MS = 7 * 60 * 60 * 1000;
export const DAY_MS = 24 * 60 * 60 * 1000;
export const MAX_VALID_RTT_MS = 5000;
export const DEFAULT_SYNC_TIMEOUT_MS = 2500;
export const DEFAULT_LEAD_MS = 300;
export const STRIKE_HOLD_WINDOW_MS = 3000;

export const PUBLIC_TIME_ENDPOINTS: readonly string[] = [
  'https://timeapi.io/api/time/current/zone?timeZone=Asia/Ho_Chi_Minh',
  'https://worldtimeapi.org/api/timezone/Asia/Ho_Chi_Minh',
];

export interface TimeSample {
  offsetMs: number;
  rttMs: number;
}

/**
 * Computes clock offset and round-trip delay using Cristian's algorithm.
 * rttMs = clientRecvPerfMs - clientSendPerfMs
 * estimatedServerAtRecv = serverEpochMs + rttMs / 2
 * offsetMs = Math.round(serverEpochMs + rttMs / 2 - clientRecvEpochMs)
 */
export function computeSampleOffset(
  clientSendPerfMs: number,
  clientRecvPerfMs: number,
  serverEpochMs: number,
  clientRecvEpochMs: number,
): TimeSample {
  const rttMs = clientRecvPerfMs - clientSendPerfMs;
  const estimatedServerAtRecv = serverEpochMs + rttMs / 2;
  const offsetMs = Math.round(estimatedServerAtRecv - clientRecvEpochMs);
  return { offsetMs, rttMs };
}

/**
 * Filters out negative or outlier RTT samples (> 5000ms) and selects the median offset sample.
 */
export function selectMedianSample(
  samples: Array<{ offsetMs: number; rttMs: number }>,
): { offsetMs: number; rttMs: number } | null {
  if (!Array.isArray(samples) || samples.length === 0) {
    return null;
  }

  const valid = samples.filter(
    (s) =>
      s !== null &&
      typeof s === 'object' &&
      Number.isFinite(s.offsetMs) &&
      Number.isFinite(s.rttMs) &&
      s.rttMs >= 0 &&
      s.rttMs <= MAX_VALID_RTT_MS,
  );

  if (valid.length === 0) {
    return null;
  }

  const sorted = [...valid].sort((a, b) => a.offsetMs - b.offsetMs);
  const midIndex = Math.floor(sorted.length / 2);
  const chosen = sorted[midIndex];
  return { offsetMs: chosen.offsetMs, rttMs: chosen.rttMs };
}

function parseServerEpochFromPayload(data: unknown): number | null {
  if (!data || typeof data !== 'object') {
    return null;
  }

  const record = data as Record<string, unknown>;

  if (typeof record.serverEpochMs === 'number' && Number.isFinite(record.serverEpochMs)) {
    return record.serverEpochMs;
  }

  if (typeof record.epochMs === 'number' && Number.isFinite(record.epochMs)) {
    return record.epochMs;
  }

  // worldtimeapi.org provides `datetime` with timezone offset (e.g. 2026-11-11T12:00:00.123456+07:00)
  if (typeof record.datetime === 'string') {
    const parsed = Date.parse(record.datetime);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  if (typeof record.utc_datetime === 'string') {
    const parsed = Date.parse(record.utc_datetime);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  // timeapi.io provides `dateTime` in the requested zone (Asia/Ho_Chi_Minh) often without offset suffix
  if (typeof record.dateTime === 'string') {
    const raw = record.dateTime.trim();
    const hasZone = /([zZ]|[+-]\d{2}:\d{2})$/.test(raw);
    const normalized = hasZone ? raw : `${raw}+07:00`;
    const parsed = Date.parse(normalized);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  if (typeof record.unixtime === 'number' && Number.isFinite(record.unixtime)) {
    return record.unixtime * 1000;
  }

  return null;
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
  fetchImpl: typeof fetch,
): Promise<Response> {
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  let timer: ReturnType<typeof setTimeout> | null = null;

  try {
    const fetchPromise = fetchImpl(url, {
      ...init,
      signal: controller ? controller.signal : undefined,
    });

    const timeoutPromise = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        if (controller) {
          controller.abort();
        }
        reject(new Error(`Time sync request timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    });

    return await Promise.race([fetchPromise, timeoutPromise]);
  } finally {
    if (timer !== null) {
      clearTimeout(timer);
    }
  }
}

function nowPerf(): number {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return performance.now();
  }
  return Date.now();
}

/**
 * Synchronizes time against CORS-safe public time APIs or same-origin Date header.
 * Never calls Shopee domains. Gracefully falls back to device clock when offline/blocked.
 */
export async function syncServerTime(
  manualAdjustMs: number = 0,
  fetchImpl: typeof fetch | undefined = typeof fetch !== 'undefined' ? fetch : undefined,
): Promise<TimeSyncSnapshot> {
  const safeManualAdjust = Number.isFinite(manualAdjustMs) ? manualAdjustMs : 0;

  if (typeof fetchImpl !== 'function') {
    return {
      synced: false,
      offsetMs: 0,
      rttMs: null,
      source: 'device-clock',
      lastSyncedAt: null,
      manualAdjustMs: safeManualAdjust,
    };
  }

  for (const endpoint of PUBLIC_TIME_ENDPOINTS) {
    try {
      const sendPerf = nowPerf();
      const response = await fetchWithTimeout(
        endpoint,
        { method: 'GET', cache: 'no-store' },
        DEFAULT_SYNC_TIMEOUT_MS,
        fetchImpl,
      );
      const recvPerf = nowPerf();
      const recvEpoch = Date.now();

      if (!response.ok) {
        continue;
      }

      let serverEpochMs: number | null = null;
      try {
        const data: unknown = await response.json();
        serverEpochMs = parseServerEpochFromPayload(data);
      } catch {
        serverEpochMs = null;
      }

      if (serverEpochMs === null && response.headers && typeof response.headers.get === 'function') {
        const dateHeader = response.headers.get('date') ?? response.headers.get('Date');
        if (dateHeader) {
          const parsedHeader = Date.parse(dateHeader);
          if (Number.isFinite(parsedHeader)) {
            serverEpochMs = parsedHeader;
          }
        }
      }

      if (serverEpochMs !== null) {
        const sample = computeSampleOffset(sendPerf, recvPerf, serverEpochMs, recvEpoch);
        const validSample = selectMedianSample([sample]);
        if (validSample) {
          const sourceHost = endpoint.includes('timeapi.io')
            ? 'timeapi.io'
            : endpoint.includes('worldtimeapi.org')
              ? 'worldtimeapi.org'
              : endpoint;
          return {
            synced: true,
            offsetMs: validSample.offsetMs,
            rttMs: Math.round(validSample.rttMs),
            source: sourceHost,
            lastSyncedAt: recvEpoch,
            manualAdjustMs: safeManualAdjust,
          };
        }
      }
    } catch {
      // Try next public endpoint
    }
  }

  // Fallback attempt: same-origin HEAD request Date header
  try {
    const sendPerf = nowPerf();
    const response = await fetchWithTimeout(
      '/',
      { method: 'HEAD', cache: 'no-store' },
      DEFAULT_SYNC_TIMEOUT_MS,
      fetchImpl,
    );
    const recvPerf = nowPerf();
    const recvEpoch = Date.now();

    if (response.ok && response.headers && typeof response.headers.get === 'function') {
      const dateHeader = response.headers.get('date') ?? response.headers.get('Date');
      if (dateHeader) {
        const parsedHeader = Date.parse(dateHeader);
        if (Number.isFinite(parsedHeader)) {
          const sample = computeSampleOffset(sendPerf, recvPerf, parsedHeader, recvEpoch);
          const validSample = selectMedianSample([sample]);
          if (validSample) {
            return {
              synced: true,
              offsetMs: validSample.offsetMs,
              rttMs: Math.round(validSample.rttMs),
              source: 'same-origin-date',
              lastSyncedAt: recvEpoch,
              manualAdjustMs: safeManualAdjust,
            };
          }
        }
      }
    }
  } catch {
    // Ignore and fall back to device clock
  }

  return {
    synced: false,
    offsetMs: 0,
    rttMs: null,
    source: 'device-clock',
    lastSyncedAt: null,
    manualAdjustMs: safeManualAdjust,
  };
}

/**
 * Determines the current Strike countdown phase based on effective and raw remaining ms.
 */
export function getPhaseForRemaining(
  effectiveRemainingMs: number | null,
  rawRemainingMs: number | null = effectiveRemainingMs,
): TimePhase {
  if (effectiveRemainingMs === null || !Number.isFinite(effectiveRemainingMs)) {
    return 'IDLE';
  }

  const effectiveRaw =
    rawRemainingMs !== null && rawRemainingMs !== undefined && Number.isFinite(rawRemainingMs)
      ? rawRemainingMs
      : effectiveRemainingMs;

  if (effectiveRaw < -STRIKE_HOLD_WINDOW_MS) {
    return 'PASSED';
  }

  if (effectiveRemainingMs <= 0) {
    return 'STRIKE_NOW';
  }

  if (effectiveRemainingMs <= 3000) {
    return 'COUNTDOWN_3S';
  }

  if (effectiveRemainingMs <= 10000) {
    return 'READY_10S';
  }

  if (effectiveRemainingMs <= 60000) {
    return 'PREPARE_60S';
  }

  return 'IDLE';
}

/**
 * Formats an epoch timestamp (ms) as HH:MM:SS.d in Asia/Ho_Chi_Minh (UTC+7).
 */
export function formatClockTenths(epochMs: number): string {
  if (!Number.isFinite(epochMs)) {
    return '--:--:--.-';
  }

  const vnEpochMs = Math.floor(epochMs) + VN_OFFSET_MS;
  const msInDay = ((vnEpochMs % DAY_MS) + DAY_MS) % DAY_MS;

  const hours = Math.floor(msInDay / 3_600_000);
  const minutes = Math.floor((msInDay % 3_600_000) / 60_000);
  const seconds = Math.floor((msInDay % 60_000) / 1000);
  const tenths = Math.floor((msInDay % 1000) / 100);

  const hh = String(hours).padStart(2, '0');
  const mm = String(minutes).padStart(2, '0');
  const ss = String(seconds).padStart(2, '0');

  return `${hh}:${mm}:${ss}.${tenths}`;
}

/**
 * Formats remaining milliseconds into MM:SS.d or -MM:SS.d (or --:--.- if null).
 */
export function formatRemainingTenths(remainingMs: number | null): string {
  if (remainingMs === null || !Number.isFinite(remainingMs)) {
    return '--:--.-';
  }

  const isNegative = remainingMs < 0;
  const absMs = Math.abs(remainingMs);
  const totalTenths = Math.floor((absMs + 1e-6) / 100);

  const tenths = totalTenths % 10;
  const totalSeconds = Math.floor(totalTenths / 10);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  const sign = isNegative ? '-' : '';
  const mm = String(minutes).padStart(2, '0');
  const ss = String(seconds).padStart(2, '0');

  return `${sign}${mm}:${ss}.${tenths}`;
}

/**
 * Computes full strike countdown state given device time, sync snapshot, target slot epoch, and lead time.
 */
export function computeStrikeCountdown(
  rawNowMs: number,
  sync: TimeSyncSnapshot,
  targetEpochMs: number | null,
  leadMs: number = DEFAULT_LEAD_MS,
): StrikeCountdownState {
  const safeOffset = Number.isFinite(sync.offsetMs) ? sync.offsetMs : 0;
  const safeManual = Number.isFinite(sync.manualAdjustMs) ? sync.manualAdjustMs : 0;
  const safeLead = Number.isFinite(leadMs) ? leadMs : DEFAULT_LEAD_MS;

  const nowEpochMs = rawNowMs + safeOffset + safeManual;

  if (targetEpochMs === null || !Number.isFinite(targetEpochMs)) {
    return {
      nowEpochMs,
      targetEpochMs: null,
      remainingMs: null,
      effectiveStrikeRemainingMs: null,
      leadMs: safeLead,
      phase: 'IDLE',
      formattedClock: formatClockTenths(nowEpochMs),
      formattedRemaining: formatRemainingTenths(null),
    };
  }

  const remainingMs = targetEpochMs - nowEpochMs;
  const effectiveStrikeRemainingMs = remainingMs - safeLead;
  const phase = getPhaseForRemaining(effectiveStrikeRemainingMs, remainingMs);

  return {
    nowEpochMs,
    targetEpochMs,
    remainingMs,
    effectiveStrikeRemainingMs,
    leadMs: safeLead,
    phase,
    formattedClock: formatClockTenths(nowEpochMs),
    formattedRemaining: formatRemainingTenths(remainingMs),
  };
}

/**
 * Computes the next occurrence of HH:MM:00.000 in Asia/Ho_Chi_Minh (UTC+7) after referenceEpochMs.
 */
export function getNextDropEpochMs(
  slotHHmm: string,
  referenceEpochMs: number = Date.now(),
): number {
  const match = /^(\d{1,2}):(\d{2})$/.exec(slotHHmm.trim());
  let hours = 0;
  let minutes = 0;

  if (match) {
    const parsedH = Number(match[1]);
    const parsedM = Number(match[2]);
    if (parsedH >= 0 && parsedH <= 23 && parsedM >= 0 && parsedM <= 59) {
      hours = parsedH;
      minutes = parsedM;
    }
  }

  const refVnMs = referenceEpochMs + VN_OFFSET_MS;
  const startOfVnDayMs = Math.floor(refVnMs / DAY_MS) * DAY_MS;
  const slotOffsetInDayMs = (hours * 60 + minutes) * 60_000;

  let candidateVnMs = startOfVnDayMs + slotOffsetInDayMs;
  if (candidateVnMs <= refVnMs) {
    candidateVnMs += DAY_MS;
  }

  return candidateVnMs - VN_OFFSET_MS;
}

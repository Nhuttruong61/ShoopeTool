import type { CartItem, DealRunbookItem, VoucherRule } from '../types/contracts';
import type { OpenModePreference } from './clipboard';

export const STORAGE_KEYS = {
  RUNBOOK_ITEMS: 'shoopeetool_runbook_items_v1',
  LEAD_MS: 'shoopeetool_lead_ms_v1',
  MANUAL_ADJUST_MS: 'shoopeetool_manual_adjust_ms_v1',
  OPEN_MODE: 'shoopeetool_open_mode_v1',
} as const;

export const DEFAULT_LEAD_MS = 300;
export const DEFAULT_MANUAL_ADJUST_MS = 0;
export const DEFAULT_OPEN_MODE: OpenModePreference = 'auto-app';

export const LEGACY_FAKE_VOUCHER_CODES = new Set([
  'SHOPEE1111TS100K',
  'XTRA1111G15',
  'FLASH12H50K',
  'LIVE1111DEM',
  'MINI1111G25K',
]);

const VN_OFFSET_MS = 7 * 3600_000;
const DAY_MS = 24 * 3600_000;

/**
 * Computes the next upcoming epoch timestamp (ms) for a "HH:MM" slot time in Vietnam timezone (UTC+7),
 * keeping a 60s grace window after the slot opens.
 */
export function resolveSlotTargetEpochMs(slotTime: string, nowEpochMs = Date.now()): number {
  const match = /^(\d{1,2}):(\d{2})$/.exec(slotTime.trim());
  if (!match) {
    return nowEpochMs + 3600_000;
  }
  const hours = Math.min(23, Math.max(0, Number(match[1])));
  const minutes = Math.min(59, Math.max(0, Number(match[2])));

  const refVnMs = nowEpochMs + VN_OFFSET_MS;
  const startOfVnDayMs = Math.floor(refVnMs / DAY_MS) * DAY_MS;
  const slotOffsetInDayMs = (hours * 60 + minutes) * 60_000;

  let candidateVnMs = startOfVnDayMs + slotOffsetInDayMs;
  if (candidateVnMs <= refVnMs - 60_000) {
    candidateVnMs += DAY_MS;
  }
  return candidateVnMs - VN_OFFSET_MS;
}

export const DEFAULT_11_11_RUNBOOK: DealRunbookItem[] = [
  {
    id: 'slot-0000-toan-san',
    slotTime: '00:00',
    targetEpochMs: resolveSlotTargetEpochMs('00:00'),
    title: 'Đợt Mở Mã Toàn Sàn & Freeship 0đ',
    itemsSummary: 'Tick sẵn món cần mua từ phút :58 — Chọn mã đã lưu trong Ví Voucher',
    voucherCode: '',
    voucherNote: 'Mã lưu sẵn trong Ví Voucher / Banner Toàn Sàn — Mở lượt đúng 00:00:00',
    paymentMethod: 'ShopeePay',
    shopeeUrl: 'https://shopee.vn/cart',
    checklist: {
      itemsTickedInCart: false,
      waitingAtCheckoutScreen: false,
      paymentMethodSelected: false,
    },
    completed: false,
  },
  {
    id: 'slot-0900-voucher-xtra',
    slotTime: '09:00',
    targetEpochMs: resolveSlotTargetEpochMs('09:00'),
    title: 'Châm Lượt Voucher Xtra & Mall',
    itemsSummary: 'Tick sẵn hàng gắn nhãn Voucher Xtra / Shopee Mall trong Giỏ hàng',
    voucherCode: '',
    voucherNote: 'Mã lưu Ví Voucher Xtra 15%–20% + Mã Shop — Châm thêm lượt lúc 09:00',
    paymentMethod: 'SPayLater',
    shopeeUrl: 'https://shopee.vn/m/voucher-xtra',
    checklist: {
      itemsTickedInCart: false,
      waitingAtCheckoutScreen: false,
      paymentMethodSelected: false,
    },
    completed: false,
  },
  {
    id: 'slot-1200-flash-50k',
    slotTime: '12:00',
    targetEpochMs: resolveSlotTargetEpochMs('12:00'),
    title: 'Châm Lượt Giữa Trưa Freeship & Xtra',
    itemsSummary: 'Tick sẵn món từ phút 11:58 — Áp mã Freeship 0đ + Voucher Xtra trong Ví',
    voucherCode: '',
    voucherNote: 'Shopee châm thêm lượt Freeship 0đ, Voucher Xtra & Mã Video khung 12h trưa',
    paymentMethod: 'ShopeePay',
    shopeeUrl: 'https://shopee.vn/m/ma-giam-gia',
    checklist: {
      itemsTickedInCart: false,
      waitingAtCheckoutScreen: false,
      paymentMethodSelected: false,
    },
    completed: false,
  },
  {
    id: 'slot-2100-live-1111',
    slotTime: '21:00',
    targetEpochMs: resolveSlotTargetEpochMs('21:00'),
    title: 'Cao Điểm Voucher Shopee Live & Xả Cuối Ngày',
    itemsSummary: 'Thêm món từ Giỏ cam Livestream trước 20:58 — Chọn mã Live trong Ví',
    voucherCode: '',
    voucherNote: 'Mã độc quyền cho sản phẩm gắn tag Shopee Live (tự có trong Ví Voucher)',
    paymentMethod: 'ShopeePay',
    shopeeUrl: 'https://shopee.vn/m/shopee-live',
    checklist: {
      itemsTickedInCart: false,
      waitingAtCheckoutScreen: false,
      paymentMethodSelected: false,
    },
    completed: false,
  },
];

export const DEFAULT_SAMPLE_VOUCHERS: VoucherRule[] = [
  {
    id: 'voucher-toan-san-20p-100k',
    label: 'Mã Video 20% tối đa 100K (đơn từ 300K)',
    code: undefined,
    minSpendVnd: 300_000,
    discountType: 'percent',
    discountValue: 20,
    maxDiscountVnd: 100_000,
    paymentNote: 'ShopeePay / SPayLater',
  },
  {
    id: 'voucher-flash-50k-250k',
    label: 'Mã Khung Giờ Giảm 50K (đơn từ 250K)',
    code: undefined,
    minSpendVnd: 250_000,
    discountType: 'flat',
    discountValue: 50_000,
    maxDiscountVnd: 50_000,
    paymentNote: 'Mọi phương thức thanh toán',
  },
  {
    id: 'voucher-xtra-15p-70k',
    label: 'Voucher Xtra 15% tối đa 70K (đơn từ 200K)',
    code: undefined,
    minSpendVnd: 200_000,
    discountType: 'percent',
    discountValue: 15,
    maxDiscountVnd: 70_000,
    paymentNote: 'Áp dụng hàng nhãn Xtra',
  },
  {
    id: 'voucher-mini-25k-120k',
    label: 'Mã Shop Giảm 25K (đơn từ 120K)',
    code: undefined,
    minSpendVnd: 120_000,
    discountType: 'flat',
    discountValue: 25_000,
    maxDiscountVnd: 25_000,
    paymentNote: 'ShopeePay',
  },
];

export const DEFAULT_SAMPLE_CART_ITEMS: CartItem[] = [
  {
    id: 'sample-item-1',
    name: 'Tai nghe Bluetooth ANC 5.3',
    priceVnd: 320_000,
    quantity: 1,
    shopName: 'Phụ Kiện Số Official',
  },
  {
    id: 'sample-item-2',
    name: 'Sạc nhanh GaN 65W Type-C',
    priceVnd: 260_000,
    quantity: 1,
    shopName: 'Phụ Kiện Số Official',
  },
  {
    id: 'sample-item-3',
    name: 'Cáp bọc dù Type-C to C 100W',
    priceVnd: 130_000,
    quantity: 1,
    shopName: 'Phụ Kiện Số Official',
  },
];

function cloneDefaultRunbook(): DealRunbookItem[] {
  return DEFAULT_11_11_RUNBOOK.map((item) => ({
    ...item,
    targetEpochMs: resolveSlotTargetEpochMs(item.slotTime),
    checklist: { ...item.checklist },
  }));
}

function isValidRunbookItem(value: unknown): value is DealRunbookItem {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const obj = value as Record<string, unknown>;
  if (
    typeof obj.id !== 'string' ||
    typeof obj.slotTime !== 'string' ||
    typeof obj.targetEpochMs !== 'number' ||
    !Number.isFinite(obj.targetEpochMs) ||
    typeof obj.title !== 'string' ||
    typeof obj.itemsSummary !== 'string' ||
    typeof obj.voucherCode !== 'string' ||
    typeof obj.voucherNote !== 'string' ||
    typeof obj.paymentMethod !== 'string' ||
    typeof obj.completed !== 'boolean'
  ) {
    return false;
  }

  if (typeof obj.checklist !== 'object' || obj.checklist === null) {
    return false;
  }
  const checklist = obj.checklist as Record<string, unknown>;
  return (
    typeof checklist.itemsTickedInCart === 'boolean' &&
    typeof checklist.waitingAtCheckoutScreen === 'boolean' &&
    typeof checklist.paymentMethodSelected === 'boolean'
  );
}

/**
 * Loads DealRunbookItem[] from localStorage, falling back to DEFAULT_11_11_RUNBOOK
 * if storage is unavailable, empty, or contains malformed JSON.
 */
export function loadRunbookItems(): DealRunbookItem[] {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return cloneDefaultRunbook();
    }
    const raw = window.localStorage.getItem(STORAGE_KEYS.RUNBOOK_ITEMS);
    if (!raw) {
      return cloneDefaultRunbook();
    }
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return cloneDefaultRunbook();
    }
    const validItems = parsed.filter(isValidRunbookItem).map((item) => {
      const cleanCode = item.voucherCode.trim().toUpperCase();
      const scrubbedCode = LEGACY_FAKE_VOUCHER_CODES.has(cleanCode) ? '' : item.voucherCode;
      return {
        ...item,
        voucherCode: scrubbedCode,
        checklist: { ...item.checklist },
      };
    });
    // If parsed array had elements but none were valid objects, recover with defaults
    if (parsed.length > 0 && validItems.length === 0) {
      return cloneDefaultRunbook();
    }
    return validItems;
  } catch {
    return cloneDefaultRunbook();
  }
}

/**
 * Persists DealRunbookItem[] to localStorage safely.
 */
export function saveRunbookItems(items: DealRunbookItem[]): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return;
    }
    window.localStorage.setItem(STORAGE_KEYS.RUNBOOK_ITEMS, JSON.stringify(items));
  } catch {
    // Ignore quota or disabled storage errors
  }
}

/**
 * Loads human reaction lead time compensation in milliseconds (default 300ms).
 */
export function loadLeadMs(): number {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return DEFAULT_LEAD_MS;
    }
    const raw = window.localStorage.getItem(STORAGE_KEYS.LEAD_MS);
    if (raw === null || raw.trim() === '') {
      return DEFAULT_LEAD_MS;
    }
    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || parsed < 0 || parsed > 5000) {
      return DEFAULT_LEAD_MS;
    }
    return Math.round(parsed);
  } catch {
    return DEFAULT_LEAD_MS;
  }
}

/**
 * Saves human reaction lead time compensation in milliseconds.
 */
export function saveLeadMs(leadMs: number): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage || !Number.isFinite(leadMs)) {
      return;
    }
    const clamped = Math.max(0, Math.min(5000, Math.round(leadMs)));
    window.localStorage.setItem(STORAGE_KEYS.LEAD_MS, String(clamped));
  } catch {
    // Ignore storage errors
  }
}

/**
 * Loads manual clock offset adjustment in milliseconds (default 0ms).
 */
export function loadManualAdjustMs(): number {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return DEFAULT_MANUAL_ADJUST_MS;
    }
    const raw = window.localStorage.getItem(STORAGE_KEYS.MANUAL_ADJUST_MS);
    if (raw === null || raw.trim() === '') {
      return DEFAULT_MANUAL_ADJUST_MS;
    }
    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || parsed < -10_000 || parsed > 10_000) {
      return DEFAULT_MANUAL_ADJUST_MS;
    }
    return Math.round(parsed);
  } catch {
    return DEFAULT_MANUAL_ADJUST_MS;
  }
}

/**
 * Saves manual clock offset adjustment in milliseconds.
 */
export function saveManualAdjustMs(ms: number): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage || !Number.isFinite(ms)) {
      return;
    }
    const clamped = Math.max(-10_000, Math.min(10_000, Math.round(ms)));
    window.localStorage.setItem(STORAGE_KEYS.MANUAL_ADJUST_MS, String(clamped));
  } catch {
    // Ignore storage errors
  }
}

export function loadOpenMode(): OpenModePreference {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return DEFAULT_OPEN_MODE;
    }
    const raw = window.localStorage.getItem(STORAGE_KEYS.OPEN_MODE);
    if (raw === 'auto-app' || raw === 'force-app' || raw === 'web') {
      return raw;
    }
    return DEFAULT_OPEN_MODE;
  } catch {
    return DEFAULT_OPEN_MODE;
  }
}

export function saveOpenMode(mode: OpenModePreference): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return;
    }
    if (mode === 'auto-app' || mode === 'force-app' || mode === 'web') {
      window.localStorage.setItem(STORAGE_KEYS.OPEN_MODE, mode);
    }
  } catch {
    // Ignore storage errors
  }
}

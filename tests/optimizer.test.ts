import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  computeVoucherDiscount,
  evaluateGroupWithVouchers,
  formatVnd,
  optimizeCartSplit,
} from '../src/lib/optimizer';
import {
  DEFAULT_11_11_RUNBOOK,
  DEFAULT_LEAD_MS,
  DEFAULT_SAMPLE_VOUCHERS,
  STORAGE_KEYS,
  loadLeadMs,
  loadManualAdjustMs,
  loadRunbookItems,
  resolveSlotTargetEpochMs,
  saveLeadMs,
  saveManualAdjustMs,
  saveRunbookItems,
} from '../src/lib/storage';
import { copyVoucherCode, getShopeeCartLinks } from '../src/lib/clipboard';
import type { CartItem, VoucherRule } from '../src/types/contracts';

describe('optimizer.ts — Voucher & Cart Split Brain', () => {
  it('formats VND amounts with dot separators', () => {
    expect(formatVnd(0)).toBe('0đ');
    expect(formatVnd(15000)).toBe('15.000đ');
    expect(formatVnd(125000)).toBe('125.000đ');
    expect(formatVnd(1250000)).toBe('1.250.000đ');
  });

  it('computes flat and percentage voucher discounts with minSpend and maxDiscount caps', () => {
    const percentRule: VoucherRule = {
      id: 'v-percent',
      label: 'Giảm 20% tối đa 50K đơn từ 200K',
      minSpendVnd: 200_000,
      discountType: 'percent',
      discountValue: 20,
      maxDiscountVnd: 50_000,
    };

    const flatRule: VoucherRule = {
      id: 'v-flat',
      label: 'Giảm 40K đơn từ 150K',
      minSpendVnd: 150_000,
      discountType: 'flat',
      discountValue: 40_000,
    };

    // Below minSpendVnd or <= 0 returns 0
    expect(computeVoucherDiscount(0, percentRule)).toBe(0);
    expect(computeVoucherDiscount(-10_000, flatRule)).toBe(0);
    expect(computeVoucherDiscount(199_000, percentRule)).toBe(0);

    // Exact percentage without hitting cap (20% of 220,000 = 44,000)
    expect(computeVoucherDiscount(220_000, percentRule)).toBe(44_000);

    // Percentage hitting maxDiscountVnd cap (20% of 400,000 = 80,000 -> capped at 50,000)
    expect(computeVoucherDiscount(400_000, percentRule)).toBe(50_000);

    // Flat discount
    expect(computeVoucherDiscount(150_000, flatRule)).toBe(40_000);
    expect(computeVoucherDiscount(500_000, flatRule)).toBe(40_000);
  });

  it('evaluates group with vouchers and generates Vietnamese shortfall hint for next best voucher', () => {
    const items: CartItem[] = [
      { id: 'i1', name: 'Áo thun', priceVnd: 135_000, quantity: 1 },
      { id: 'i2', name: 'Tất cổ ngắn', priceVnd: 50_000, quantity: 2 },
    ]; // subtotal = 235,000đ

    const rules: VoucherRule[] = [
      {
        id: 'v-small',
        label: 'Giảm 20K đơn từ 150K',
        minSpendVnd: 150_000,
        discountType: 'flat',
        discountValue: 20_000,
      },
      {
        id: 'v-better',
        label: 'Giảm 50K đơn từ 250K',
        minSpendVnd: 250_000,
        discountType: 'flat',
        discountValue: 50_000,
      },
    ];

    const group = evaluateGroupWithVouchers(items, rules, 1);

    expect(group.subtotalVnd).toBe(235_000);
    expect(group.appliedVoucher?.id).toBe('v-small');
    expect(group.discountVnd).toBe(20_000);
    expect(group.finalPayableVnd).toBe(215_000);
    expect(group.shortfallToMinSpendVnd).toBe(15_000);
    expect(group.nextBestVoucherHint).toBe('Mua thêm 15.000đ để áp mã Giảm 50K đơn từ 250K');
  });

  it('respects categoryTag matching when both item and rule specify categoryTag', () => {
    const fashionItems: CartItem[] = [
      { id: 'f1', name: 'Áo khoác', priceVnd: 300_000, quantity: 1, categoryTag: 'fashion' },
    ];
    const rules: VoucherRule[] = [
      {
        id: 'v-tech',
        label: 'Mã Điện Tử Giảm 80K',
        minSpendVnd: 250_000,
        discountType: 'flat',
        discountValue: 80_000,
        categoryTag: 'electronics',
      },
      {
        id: 'v-fashion',
        label: 'Mã Thời Trang Giảm 45K',
        minSpendVnd: 250_000,
        discountType: 'flat',
        discountValue: 45_000,
        categoryTag: 'fashion',
      },
    ];

    const evaluated = evaluateGroupWithVouchers(fashionItems, rules);
    expect(evaluated.appliedVoucher?.id).toBe('v-fashion');
    expect(evaluated.discountVnd).toBe(45_000);
  });

  it('proves 2-order split beats 1 single order when voucher caps limit a single large order', () => {
    const items: CartItem[] = [
      { id: 'item-a', name: 'Tai nghe Bluetooth', priceVnd: 300_000, quantity: 1 },
      { id: 'item-b', name: 'Sạc nhanh GaN 65W', priceVnd: 280_000, quantity: 1 },
    ]; // Combined = 580,000đ

    const rules: VoucherRule[] = [
      {
        id: 'v1',
        label: 'Mã 20% tối đa 50K (đơn từ 250K)',
        minSpendVnd: 250_000,
        discountType: 'percent',
        discountValue: 20,
        maxDiscountVnd: 50_000,
      },
      {
        id: 'v2',
        label: 'Mã Giảm 45K (đơn từ 250K)',
        minSpendVnd: 250_000,
        discountType: 'flat',
        discountValue: 45_000,
      },
    ];

    // If kept in 1 order (580K): max discount from best voucher (v1) is 50,000đ.
    // If split into 2 orders (300K + 280K): Order 1 gets v1 (50,000đ) + Order 2 gets v2 (45,000đ) = 95,000đ!
    const plan = optimizeCartSplit(items, rules);

    expect(plan.groups).toHaveLength(2);
    expect(plan.totalSubtotalVnd).toBe(580_000);
    expect(plan.totalDiscountVnd).toBe(95_000);
    expect(plan.totalFinalPayableVnd).toBe(485_000);
    expect(plan.savingsVsSingleOrderVnd).toBe(45_000);
    expect(plan.strategyLabel).toBe('Tách 2 đơn lời hơn gộp chung 45.000đ');

    // Verify each voucher rule is used at most once across split groups
    const usedIds = plan.groups.map((g) => g.appliedVoucher?.id).filter(Boolean);
    expect(new Set(usedIds).size).toBe(usedIds.length);
  });

  it('keeps 1 single order when splitting does not increase total discount', () => {
    const items: CartItem[] = [
      { id: 'item-1', name: 'Bàn phím cơ', priceVnd: 160_000, quantity: 1 },
      { id: 'item-2', name: 'Chuột gaming', priceVnd: 150_000, quantity: 1 },
    ]; // Combined = 310,000đ needed to unlock 300K minSpend voucher

    const rules: VoucherRule[] = [
      {
        id: 'v-big',
        label: 'Giảm 60K đơn từ 300K',
        minSpendVnd: 300_000,
        discountType: 'flat',
        discountValue: 60_000,
      },
    ];

    const plan = optimizeCartSplit(items, rules);
    expect(plan.groups).toHaveLength(1);
    expect(plan.totalDiscountVnd).toBe(60_000);
    expect(plan.savingsVsSingleOrderVnd).toBe(0);
    expect(plan.strategyLabel).toBe('Gộp 1 đơn duy nhất tối ưu nhất');
  });

  it('gracefully falls back to greedy heuristic when cart has more than 10 items', () => {
    const manyItems: CartItem[] = Array.from({ length: 12 }, (_, idx) => ({
      id: `item-${idx + 1}`,
      name: `Món hàng #${idx + 1}`,
      priceVnd: 50_000,
      quantity: 1,
    })); // 12 * 50K = 600K

    const plan = optimizeCartSplit(manyItems, DEFAULT_SAMPLE_VOUCHERS);
    expect(plan.totalSubtotalVnd).toBe(600_000);
    expect(plan.totalDiscountVnd).toBeGreaterThan(0);
    expect(plan.groups.length).toBeGreaterThanOrEqual(1);
    expect(plan.groups.length).toBeLessThanOrEqual(3);
  });
});

describe('storage.ts — Persistence & Corrupted JSON Recovery', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('provides realistic 11/11 presets and persists runbook items', () => {
    expect(DEFAULT_11_11_RUNBOOK.length).toBeGreaterThanOrEqual(4);
    expect(DEFAULT_SAMPLE_VOUCHERS.length).toBeGreaterThanOrEqual(3);

    // Defaults when empty
    const initial = loadRunbookItems();
    expect(initial.map((i) => i.slotTime)).toEqual(['00:00', '09:00', '12:00', '21:00']);

    // Modify and save
    const updated = [
      {
        ...initial[0],
        title: 'Đã chỉnh sửa kịch bản 00:00',
        checklist: {
          itemsTickedInCart: true,
          waitingAtCheckoutScreen: true,
          paymentMethodSelected: true,
        },
      },
    ];
    saveRunbookItems(updated);

    const reloaded = loadRunbookItems();
    expect(reloaded).toHaveLength(1);
    expect(reloaded[0].title).toBe('Đã chỉnh sửa kịch bản 00:00');
    expect(reloaded[0].checklist.waitingAtCheckoutScreen).toBe(true);
  });

  it('recovers safely from corrupted JSON in localStorage', () => {
    window.localStorage.setItem(STORAGE_KEYS.RUNBOOK_ITEMS, '{corrupted-json');
    const recovered = loadRunbookItems();
    expect(recovered).toHaveLength(DEFAULT_11_11_RUNBOOK.length);

    window.localStorage.setItem(STORAGE_KEYS.RUNBOOK_ITEMS, JSON.stringify([{ invalid: true }]));
    const recoveredFromInvalidShape = loadRunbookItems();
    expect(recoveredFromInvalidShape).toHaveLength(DEFAULT_11_11_RUNBOOK.length);
  });

  it('persists and recovers leadMs and manualAdjustMs settings', () => {
    expect(loadLeadMs()).toBe(DEFAULT_LEAD_MS);
    saveLeadMs(450);
    expect(loadLeadMs()).toBe(450);

    window.localStorage.setItem(STORAGE_KEYS.LEAD_MS, 'not-a-number');
    expect(loadLeadMs()).toBe(300);

    expect(loadManualAdjustMs()).toBe(0);
    saveManualAdjustMs(-250);
    expect(loadManualAdjustMs()).toBe(-250);

    window.localStorage.setItem(STORAGE_KEYS.MANUAL_ADJUST_MS, 'invalid');
    expect(loadManualAdjustMs()).toBe(0);
  });

  it('computes resolveSlotTargetEpochMs in UTC+7 independently of device timezone (with 60s grace)', () => {
    // 2026-11-10T22:00:00+07:00 is 2026-11-10T15:00:00.000Z
    const now22hVn = Date.parse('2026-11-10T15:00:00.000Z');
    // Next '00:00' VN is 2026-11-11T00:00:00+07:00 = 2026-11-10T17:00:00.000Z
    expect(resolveSlotTargetEpochMs('00:00', now22hVn)).toBe(
      Date.parse('2026-11-10T17:00:00.000Z'),
    );

    // Within 60s grace (30s after 00:00 VN = 2026-11-10T17:00:30.000Z), keeps same slot
    const now00h00m30sVn = Date.parse('2026-11-10T17:00:30.000Z');
    expect(resolveSlotTargetEpochMs('00:00', now00h00m30sVn)).toBe(
      Date.parse('2026-11-10T17:00:00.000Z'),
    );

    // Past 60s grace (61s after 00:00 VN = 2026-11-10T17:01:01.000Z), rolls to next day 00:00 VN
    const now00h01m01sVn = Date.parse('2026-11-10T17:01:01.000Z');
    expect(resolveSlotTargetEpochMs('00:00', now00h01m01sVn)).toBe(
      Date.parse('2026-11-11T17:00:00.000Z'),
    );
  });
});

describe('clipboard.ts — Clipboard API & HTTP LAN Fallback', () => {
  const originalClipboard = navigator.clipboard;
  const originalExecCommand = document.execCommand;

  afterEach(() => {
    Object.defineProperty(navigator, 'clipboard', {
      value: originalClipboard,
      configurable: true,
      writable: true,
    });
    document.execCommand = originalExecCommand;
    vi.restoreAllMocks();
  });

  it('uses navigator.clipboard.writeText when available', async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: writeTextMock },
      configurable: true,
      writable: true,
    });

    const res = await copyVoucherCode('SHOPEE1111');
    expect(res).toEqual({ ok: true, method: 'clipboard-api' });
    expect(writeTextMock).toHaveBeenCalledWith('SHOPEE1111');
  });

  it('falls back to offscreen <textarea> and document.execCommand("copy") when Clipboard API rejects on HTTP LAN', async () => {
    const writeTextMock = vi.fn().mockRejectedValue(new Error('Insecure HTTP context'));
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: writeTextMock },
      configurable: true,
      writable: true,
    });

    const execCommandMock = vi.fn().mockReturnValue(true);
    document.execCommand = execCommandMock;

    const res = await copyVoucherCode('LANVOUCHER50K');
    expect(res).toEqual({ ok: true, method: 'exec-command' });
    expect(execCommandMock).toHaveBeenCalledWith('copy');
    // Ensure offscreen textarea was cleaned up from DOM
    expect(document.querySelectorAll('textarea').length).toBe(0);
  });

  it('returns safe official Shopee cart links', () => {
    const defaultLinks = getShopeeCartLinks();
    expect(defaultLinks).toEqual({
      webUrl: 'https://shopee.vn/cart',
      appDeepLink: 'shopeevn://reactPath?path=cart',
    });

    const customLinks = getShopeeCartLinks('https://shopee.vn/m/11-11');
    expect(customLinks.webUrl).toBe('https://shopee.vn/m/11-11');
    expect(customLinks.appDeepLink).toContain('shopeevn://reactPath?path=');
  });
});

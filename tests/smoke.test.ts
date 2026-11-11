import { createElement } from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { App } from '../src/App';
import type {
  CartItem,
  ClipboardResult,
  DealRunbookItem,
  OrderSplitPlan,
  PipOverlayPayload,
  PipSupportInfo,
  StrikeCountdownState,
  TimeSyncSnapshot,
  VoucherRule,
} from '../src/types/contracts';

describe('Foundation smoke test', () => {
  it('renders placeholder App heading', () => {
    render(createElement(App));
    expect(
      screen.getByRole('heading', {
        name: /ShoopeeTool 11\/11 — Trợ Lý Canh Nhịp Săn Mã/i,
        level: 1,
      }),
    ).toBeInTheDocument();
  });

  it('validates shared contracts compile cleanly', () => {
    const sync: TimeSyncSnapshot = {
      synced: true,
      offsetMs: -12,
      rttMs: 40,
      source: 'http-date',
      lastSyncedAt: 1762819200000,
      manualAdjustMs: 0,
    };
    const countdown: StrikeCountdownState = {
      nowEpochMs: 1762819199700,
      targetEpochMs: 1762819200000,
      remainingMs: 300,
      effectiveStrikeRemainingMs: 0,
      leadMs: 300,
      phase: 'STRIKE_NOW',
      formattedClock: '23:59:59.7',
      formattedRemaining: '00:00.3',
    };
    const pipSupport: PipSupportInfo = {
      canVideoPip: true,
      canWebkitPip: false,
      fallbackHudOnly: false,
    };
    const overlay: PipOverlayPayload = {
      clockText: '23:59:59.7',
      countdownText: '00:00.0',
      phase: countdown.phase,
      bannerText: 'BẤM NGAY!',
      voucherLabel: 'Giảm 20% tối đa 100k',
      voucherCode: 'MA1111',
    };
    const voucher: VoucherRule = {
      id: 'v1',
      label: '20% tối đa 100k',
      code: 'MA1111',
      minSpendVnd: 500_000,
      discountType: 'percent',
      discountValue: 20,
      maxDiscountVnd: 100_000,
    };
    const item: CartItem = {
      id: 'i1',
      name: 'Tai nghe Bluetooth',
      priceVnd: 550_000,
      quantity: 1,
    };
    const plan: OrderSplitPlan = {
      strategyLabel: 'Gộp 1 đơn',
      groups: [
        {
          groupIndex: 0,
          items: [item],
          subtotalVnd: 550_000,
          appliedVoucher: voucher,
          discountVnd: 100_000,
          finalPayableVnd: 450_000,
          shortfallToMinSpendVnd: 0,
        },
      ],
      totalSubtotalVnd: 550_000,
      totalDiscountVnd: 100_000,
      totalFinalPayableVnd: 450_000,
      savingsVsSingleOrderVnd: 0,
    };
    const runbook: DealRunbookItem = {
      id: 'r1',
      slotTime: '00:00',
      targetEpochMs: 1762819200000,
      title: 'Ca mở màn 0H',
      itemsSummary: 'Tai nghe Bluetooth',
      voucherCode: 'MA1111',
      voucherNote: 'Áp mã toàn sàn',
      paymentMethod: 'ShopeePay',
      checklist: {
        itemsTickedInCart: true,
        waitingAtCheckoutScreen: true,
        paymentMethodSelected: true,
      },
      completed: false,
    };
    const clip: ClipboardResult = {
      ok: true,
      method: 'clipboard-api',
    };

    expect(sync.synced).toBe(true);
    expect(pipSupport.canVideoPip).toBe(true);
    expect(overlay.phase).toBe('STRIKE_NOW');
    expect(plan.totalFinalPayableVnd).toBe(450_000);
    expect(runbook.slotTime).toBe('00:00');
    expect(clip.ok).toBe(true);
  });
});

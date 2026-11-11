import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../src/App';
import {
  DEFAULT_11_11_RUNBOOK,
  DEFAULT_SAMPLE_VOUCHERS,
  LEGACY_FAKE_VOUCHER_CODES,
  STORAGE_KEYS,
  loadRunbookItems,
} from '../src/lib/storage';
import { OFFICIAL_VOUCHER_HUBS } from '../src/lib/yearRoundDeals';

describe('v2.0 Max Voucher 365 & Native App Deep-Link Verification', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new Error('offline'))),
    );
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('purges all fake mock voucher codes from DEFAULT_11_11_RUNBOOK, DEFAULT_SAMPLE_VOUCHERS, and legacy localStorage', () => {
    for (const item of DEFAULT_11_11_RUNBOOK) {
      expect(item.voucherCode).toBe('');
      expect(LEGACY_FAKE_VOUCHER_CODES.has(item.voucherCode)).toBe(false);
    }

    for (const v of DEFAULT_SAMPLE_VOUCHERS) {
      expect(v.code).toBeUndefined();
    }

    // Verify legacy localStorage containing old fake codes is automatically scrubbed to ''
    const legacyStored = [
      {
        ...DEFAULT_11_11_RUNBOOK[0],
        voucherCode: 'SHOPEE1111TS100K',
      },
      {
        ...DEFAULT_11_11_RUNBOOK[1],
        voucherCode: 'XTRA1111G15',
      },
      {
        ...DEFAULT_11_11_RUNBOOK[2],
        voucherCode: 'USER_REAL_CODE_99K',
      },
    ];
    window.localStorage.setItem(STORAGE_KEYS.RUNBOOK_ITEMS, JSON.stringify(legacyStored));

    const scrubbed = loadRunbookItems();
    expect(scrubbed[0].voucherCode).toBe('');
    expect(scrubbed[1].voucherCode).toBe('');
    expect(scrubbed[2].voucherCode).toBe('USER_REAL_CODE_99K');
  });

  it('displays "Mã lưu trong Ví Shopee" and "Mở App Shopee" when voucherCode is empty (no misleading Copy Mã)', () => {
    render(<App />);
    expect(screen.getAllByText('Mã lưu trong Ví Shopee').length).toBeGreaterThanOrEqual(4);
    expect(screen.getAllByRole('button', { name: 'Mở App Shopee' }).length).toBeGreaterThanOrEqual(
      4,
    );
    expect(screen.queryByRole('button', { name: /^Copy Mã/ })).not.toBeInTheDocument();
  });

  it('renders VoucherMaxHub with 8 official Shopee hubs and triggers native app launcher', async () => {
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(null);
    render(<App />);

    fireEvent.click(screen.getByRole('tab', { name: '🔥 Kho Mã & 365' }));

    expect(screen.getByTestId('voucher-max-hub')).toBeInTheDocument();
    expect(screen.getByTestId('real-voucher-explainer')).toBeInTheDocument();

    for (const hub of OFFICIAL_VOUCHER_HUBS) {
      expect(screen.getByTestId(`hub-card-${hub.id}`)).toBeInTheDocument();
    }

    fireEvent.click(screen.getByTestId('open-hub-hub-shopee-video'));
    await waitFor(() => expect(openSpy).toHaveBeenCalled());
    expect(openSpy.mock.calls[0][0]).toBe('https://shopee.vn/m/shopee-video');
  });

  it('extracts real user-pasted voucher codes via Smart Paste into Runbook and shows sample syntax warning', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('tab', { name: '🔥 Kho Mã & 365' }));

    // Test sample syntax warning banner
    fireEvent.click(
      screen.getByRole('button', { name: /Xem cú pháp mẫu \(chỉ để thử máy bóc tách\)/ }),
    );
    expect(screen.getByTestId('sample-syntax-warning')).toHaveTextContent(
      /Cú pháp mẫu chỉ để thử tính năng tách chữ, KHÔNG phải mã thật/i,
    );

    // Paste real deal text
    const textarea = screen.getByTestId('smart-paste-textarea');
    fireEvent.change(textarea, {
      target: {
        value: 'Khung 12h: Mã KOL12H99K giảm 50% tối đa 99K đơn từ 199K (ShopeePay)',
      },
    });

    expect(screen.queryByTestId('sample-syntax-warning')).not.toBeInTheDocument();
    expect(screen.getByTestId('parsed-deals-preview')).toHaveTextContent('KOL12H99K');

    fireEvent.click(screen.getByTestId('import-parsed-deals-btn'));

    // Should navigate back to Runbook and show the imported real code with "Copy Mã + Mở App Shopee"
    expect(screen.getByRole('tab', { name: 'Kịch bản săn' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getAllByText('Mã: KOL12H99K').length).toBeGreaterThanOrEqual(1);
    expect(
      screen.getAllByRole('button', { name: 'Copy Mã + Mở App Shopee' }).length,
    ).toBeGreaterThanOrEqual(1);
  });

  it('renders 3-Layer Channel Stack comparison, detects winning channel & shortfall trap, and creates Runbook reminder', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('tab', { name: '🔥 Kho Mã & 365' }));

    expect(screen.getByTestId('channel-comparison-summary')).toHaveTextContent(
      /Kênh Shopee Video \(Giỏ Vàng\)/,
    );
    expect(screen.getByTestId('winning-channel-badge')).toHaveTextContent('Kênh Rẻ Nhất');

    // Trigger the Shop voucher shortfall trap on Normal channel:
    // Item price = 250,000, Shop discount = 20,000 -> afterShopVnd = 230,000 < Normal minSpend 250,000
    fireEvent.change(screen.getByTestId('stack-item-price-input'), {
      target: { value: '250000' },
    });
    expect(screen.getByTestId('shortfall-alert-normal')).toHaveTextContent(
      /Bẫy đơn tối thiểu Shopee/,
    );

    // Create Runbook reminder for winning channel
    fireEvent.click(screen.getByTestId('create-channel-reminder-btn'));
    expect(screen.getByRole('tab', { name: 'Kịch bản săn' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(
      screen.getByText(/Mua qua Kênh Shopee Video \(Giỏ Vàng\)/, { selector: 'h3' }),
    ).toBeInTheDocument();
  });
});

import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../src/App';
import { STORAGE_KEYS, loadRunbookItems } from '../src/lib/storage';
import type { DealRunbookItem } from '../src/types/contracts';

function readStoredDeals(): DealRunbookItem[] {
  return JSON.parse(window.localStorage.getItem(STORAGE_KEYS.RUNBOOK_ITEMS) ?? '[]');
}

describe('v2.1 Paired Product + Voucher 1-Tap Strike End-to-End Integration', () => {
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

  it('creates a paired deal in RunbookForm from Shopee share text + voucher link and launches exact URLs (never /cart)', async () => {
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(null);
    render(<App />);

    fireEvent.click(screen.getByRole('tab', { name: 'Thêm ca săn' }));

    const productInput = screen.getByTestId('product-url-input');
    const voucherInput = screen.getByTestId('voucher-url-input');

    fireEvent.change(productInput, {
      target: {
        value: 'Mua ngay Tai nghe ANC với giá chỉ 299K https://vn.shp.ee/SpTest1',
      },
    });
    fireEvent.change(voucherInput, {
      target: {
        value: 'https://s.shopee.vn/VcTest2',
      },
    });

    // Clean URL preview badges and auto-populated title + itemsSummary
    expect(screen.getByTestId('product-link-preview')).toHaveTextContent(
      'https://vn.shp.ee/SpTest1',
    );
    expect(screen.getByTestId('voucher-link-preview')).toHaveTextContent(
      'https://s.shopee.vn/VcTest2',
    );
    expect(screen.getByPlaceholderText('VD: Săn mã Mall 20% khung 0h')).toHaveValue(
      'Tai nghe ANC',
    );
    expect(screen.getByPlaceholderText('VD: Tai nghe Sony + Cáp sạc')).toHaveValue(
      'Tai nghe ANC',
    );

    fireEvent.click(screen.getByTestId('strike-mode-flash-product'));
    fireEvent.click(screen.getByRole('button', { name: /Thêm Vào Kịch Bản Săn Mã/ }));

    // Automatically navigates to Runbook and selects the newly created deal
    const added = readStoredDeals().find((d) => d.title === 'Tai nghe ANC');
    expect(added).toBeDefined();
    expect(added?.productUrl).toBe('https://vn.shp.ee/SpTest1');
    expect(added?.voucherUrl).toBe('https://s.shopee.vn/VcTest2');
    expect(added?.strikeMode).toBe('flash-product');

    const card = screen.getByTestId(`runbook-card-${added!.id}`);
    expect(within(card).getByText('📦 Đã gán SP')).toBeInTheDocument();
    expect(within(card).getByText('⚡ Flash SP')).toBeInTheDocument();

    // 1-tap "🎟️ Lưu Mã" opens https://s.shopee.vn/VcTest2
    const openVoucherBtn = screen.getByTestId(`open-voucher-btn-${added!.id}`);
    expect(openVoucherBtn).toHaveTextContent('🎟️ Lưu Mã');
    fireEvent.click(openVoucherBtn);
    await waitFor(() => expect(openSpy).toHaveBeenCalledTimes(1));
    expect(openSpy.mock.calls[0][0]).toBe('https://s.shopee.vn/VcTest2');

    // 1-tap "📦 Mua SP Ngay" opens https://vn.shp.ee/SpTest1 (never /cart)
    const openProductBtn = screen.getByTestId(`open-product-btn-${added!.id}`);
    expect(openProductBtn).toHaveTextContent('📦 Mua SP Ngay');
    fireEvent.click(openProductBtn);
    await waitFor(() => expect(openSpy).toHaveBeenCalledTimes(2));
    expect(openSpy.mock.calls[1][0]).toBe('https://vn.shp.ee/SpTest1');
    expect(openSpy.mock.calls[1][0]).not.toContain('/cart');

    // LiveStrikeBar also mirrors the paired buttons for the active deal
    const banner = screen.getByTestId('active-deal-banner');
    expect(within(banner).getByText('📦 Đã gán SP')).toBeInTheDocument();
    expect(screen.getByTestId('quick-open-product-btn')).toHaveTextContent('📦 Mở SP Ngay');
    expect(screen.getByTestId('quick-open-voucher-btn')).toHaveTextContent('🎟️ Lưu Mã');
  });

  it('attaches [productUrl + voucherUrl + voucherCode] inline on an existing Runbook card, updates LiveStrikeBar, and persists in localStorage', async () => {
    const writeText = vi.fn(() => Promise.resolve());
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(null);

    render(<App />);

    const firstId = readStoredDeals()[0].id;
    fireEvent.click(screen.getByTestId(`toggle-attach-${firstId}`));

    const drawer = screen.getByTestId(`inline-attach-box-${firstId}`);
    expect(drawer).toBeInTheDocument();

    fireEvent.change(screen.getByTestId(`attach-product-input-${firstId}`), {
      target: {
        value: 'Săn ngay Bàn phím cơ không dây với giá chỉ 599K https://vn.shp.ee/KbPro99!',
      },
    });
    fireEvent.change(screen.getByTestId(`attach-voucher-input-${firstId}`), {
      target: {
        value: 'https://s.shopee.vn/SaveKb50',
      },
    });
    fireEvent.change(screen.getByTestId(`attach-code-input-${firstId}`), {
      target: {
        value: 'kbpro50k',
      },
    });

    fireEvent.click(screen.getByTestId(`save-attach-${firstId}`));

    // Drawer closes and card updates immediately
    expect(screen.queryByTestId(`inline-attach-box-${firstId}`)).not.toBeInTheDocument();
    const card = screen.getByTestId(`runbook-card-${firstId}`);
    expect(within(card).getByText('Bàn phím cơ không dây', { selector: 'h3' })).toBeInTheDocument();
    expect(within(card).getByText('📦 Đã gán SP')).toBeInTheDocument();
    expect(within(card).getByText('Mã: KBPRO50K')).toBeInTheDocument();
    expect(screen.getByTestId(`open-product-btn-${firstId}`)).toHaveTextContent(
      'Copy Mã + Mở SP',
    );
    expect(screen.getByTestId(`open-voucher-btn-${firstId}`)).toHaveTextContent('🎟️ Lưu Mã');

    // LiveStrikeBar immediately reflects updated activeDeal
    const quickProductBtn = screen.getByTestId('quick-open-product-btn');
    const quickVoucherBtn = screen.getByTestId('quick-open-voucher-btn');
    expect(quickProductBtn).toHaveTextContent('Copy Mã + Mở SP');
    expect(quickVoucherBtn).toHaveTextContent('🎟️ Lưu Mã');

    // Tapping LiveStrikeBar quick-open-voucher copies code AND opens voucherUrl
    fireEvent.click(quickVoucherBtn);
    await waitFor(() => expect(writeText).toHaveBeenCalledWith('KBPRO50K'));
    await waitFor(() => expect(openSpy).toHaveBeenCalledTimes(1));
    expect(openSpy.mock.calls[0][0]).toBe('https://s.shopee.vn/SaveKb50');

    // Tapping LiveStrikeBar quick-open-product copies code AND opens productUrl
    fireEvent.click(quickProductBtn);
    await waitFor(() => expect(openSpy).toHaveBeenCalledTimes(2));
    expect(openSpy.mock.calls[1][0]).toBe('https://vn.shp.ee/KbPro99');
    expect(within(card).getByText('Đã Copy: KBPRO50K')).toBeInTheDocument();

    // Persisted cleanly in localStorage and survives reload via loadRunbookItems()
    const reloaded = loadRunbookItems();
    expect(reloaded[0].productUrl).toBe('https://vn.shp.ee/KbPro99');
    expect(reloaded[0].voucherUrl).toBe('https://s.shopee.vn/SaveKb50');
    expect(reloaded[0].voucherCode).toBe('KBPRO50K');
    expect(reloaded[0].title).toBe('Bàn phím cơ không dây');
  });

  it('imports a paired combo post via VoucherMaxHub Smart Paste and launches both productUrl and voucherUrl accurately', async () => {
    const writeText = vi.fn(() => Promise.resolve());
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(null);

    render(<App />);

    fireEvent.click(screen.getByRole('tab', { name: '🔥 Kho Mã & 365' }));

    const comboPost = [
      '🔥 KHUNG 12H:',
      '- Sạc nhanh GaN 100W giảm 50% mã GAN12H50 | Link SP: https://vn.shp.ee/Gan100W | Lưu mã: https://s.shopee.vn/ClaimGan50 (ShopeePay)',
    ].join('\n');

    fireEvent.change(screen.getByTestId('smart-paste-textarea'), {
      target: { value: comboPost },
    });

    const preview = screen.getByTestId('parsed-deals-preview');
    expect(within(preview).getByText('Mã: GAN12H50')).toBeInTheDocument();
    expect(within(preview).getByText('📦 Có Link SP')).toBeInTheDocument();
    expect(within(preview).getByText('🎟️ Có Link Mã')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('import-parsed-deals-btn'));

    // Navigates to Runbook and selects the imported combo deal
    expect(screen.getByRole('tab', { name: 'Kịch bản săn' })).toHaveAttribute(
      'aria-selected',
      'true',
    );

    const imported = readStoredDeals().find((d) => d.voucherCode === 'GAN12H50');
    expect(imported).toBeDefined();
    expect(imported?.slotTime).toBe('12:00');
    expect(imported?.productUrl).toBe('https://vn.shp.ee/Gan100W');
    expect(imported?.voucherUrl).toBe('https://s.shopee.vn/ClaimGan50');
    expect(imported?.shopeeUrl).toBe('https://vn.shp.ee/Gan100W');

    // Launch voucher link first, then product link from the Runbook card
    fireEvent.click(screen.getByTestId(`open-voucher-btn-${imported!.id}`));
    await waitFor(() => expect(openSpy).toHaveBeenCalledTimes(1));
    expect(writeText).toHaveBeenCalledWith('GAN12H50');
    expect(openSpy.mock.calls[0][0]).toBe('https://s.shopee.vn/ClaimGan50');

    fireEvent.click(screen.getByTestId(`open-product-btn-${imported!.id}`));
    await waitFor(() => expect(openSpy).toHaveBeenCalledTimes(2));
    expect(openSpy.mock.calls[1][0]).toBe('https://vn.shp.ee/Gan100W');

    // Also verify mobile guide tab includes paired [Link Sản Phẩm + Link Voucher] instructions
    fireEvent.click(screen.getByRole('tab', { name: 'Hướng dẫn ĐT' }));
    expect(screen.getByText(/\[Link Sản Phẩm \+ Link Voucher\]/)).toBeInTheDocument();
  });

  it('imports a link-only paired combo via Smart Paste and respects open-mode web vs force-app cleanly', async () => {
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(null);
    render(<App />);

    // Switch open mode to web explicitly
    fireEvent.change(screen.getByTestId('open-mode-select'), {
      target: { value: 'web' },
    });

    fireEvent.click(screen.getByRole('tab', { name: '🔥 Kho Mã & 365' }));

    const linkOnlyCombo = [
      '21:00: Deal chuột gaming không dây siêu nhẹ',
      'Link SP: https://shopee.vn/Chuot-Gaming-Sieu-Nhe-i.88888.99999',
      'Link lưu mã: https://shopee.vn/m/voucher-xtra',
    ].join('\n');

    fireEvent.change(screen.getByTestId('smart-paste-textarea'), {
      target: { value: linkOnlyCombo },
    });

    const preview = screen.getByTestId('parsed-deals-preview');
    expect(within(preview).getByText('🎟️ Kèo Link Trực Tiếp')).toBeInTheDocument();
    expect(within(preview).getByText('📦 Có Link SP')).toBeInTheDocument();
    expect(within(preview).getByText('🎟️ Có Link Mã')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('import-parsed-deals-btn'));

    const imported = readStoredDeals().find(
      (d) => d.productUrl === 'https://shopee.vn/Chuot-Gaming-Sieu-Nhe-i.88888.99999',
    );
    expect(imported).toBeDefined();
    expect(imported?.voucherCode).toBe('');
    expect(imported?.voucherUrl).toBe('https://shopee.vn/m/voucher-xtra');

    // Quick buttons on LiveStrikeBar open voucher hub and product page directly
    fireEvent.click(screen.getByTestId('quick-open-voucher-btn'));
    await waitFor(() => expect(openSpy).toHaveBeenCalledTimes(1));
    expect(openSpy.mock.calls[0][0]).toBe('https://shopee.vn/m/voucher-xtra');

    fireEvent.click(screen.getByTestId('quick-open-product-btn'));
    await waitFor(() => expect(openSpy).toHaveBeenCalledTimes(2));
    expect(openSpy.mock.calls[1][0]).toBe(
      'https://shopee.vn/Chuot-Gaming-Sieu-Nhe-i.88888.99999',
    );
  });

  it('auto-pulls the 6-item voucher list (including Shop 35% + Shop ID link) when pasting a product link and supports 1-tap Dùng luôn or Gắn vào Ca Săn', async () => {
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(null);
    render(<App />);

    // On main Runbook screen, paste a product link with "giảm 35%"
    const quickInput = screen.getByTestId('quick-product-link-input');
    fireEvent.change(quickInput, {
      target: {
        value:
          'Áo khoác chống nắng UV giảm 35% https://shopee.vn/Ao-Khoac-UV-i.123456.654321',
      },
    });

    // Automatically pulls the 6-voucher list without needing any extra click
    const quickList = screen.getByTestId('quick-auto-voucher-list');
    expect(quickList).toBeInTheDocument();
    expect(within(quickList).getByText('⚡ Mã Shop Giảm 35%')).toBeInTheDocument();
    expect(within(quickList).getByText('🏪 Kho Mã Gian Hàng')).toBeInTheDocument();
    expect(within(quickList).getByText('🏷️ Voucher Xtra 15%–25%')).toBeInTheDocument();

    // Tapping "⚡ Dùng luôn" on Shop 35% voucher launches the product URL directly
    fireEvent.click(screen.getByTestId('quick-use-voucher-auto-voucher-shop-flash'));
    await waitFor(() => expect(openSpy).toHaveBeenCalledTimes(1));
    expect(openSpy.mock.calls[0][0]).toBe('https://shopee.vn/Ao-Khoac-UV-i.123456.654321');

    // Tapping "+ Gắn vào Ca Săn" adds the paired product + shop voucher deal to the Runbook
    fireEvent.click(screen.getByTestId('quick-add-voucher-auto-voucher-shop-flash'));
    const deals = readStoredDeals();
    expect(deals[0].productUrl).toBe('https://shopee.vn/Ao-Khoac-UV-i.123456.654321');
    expect(deals[0].voucherUrl).toBe('https://shopee.vn/shop/123456');
    expect(deals[0].strikeMode).toBe('flash-product');
  });
});

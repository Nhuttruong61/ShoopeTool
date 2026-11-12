import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildShopeeLaunchTargets,
  copyAndLaunchShopee,
  extractShopeeLinkInfo,
} from '../src/lib/clipboard';
import {
  DEFAULT_11_11_RUNBOOK,
  STORAGE_KEYS,
  loadRunbookItems,
  saveRunbookItems,
} from '../src/lib/storage';
import type { DealRunbookItem } from '../src/types/contracts';

describe('extractShopeeLinkInfo — Shopee Share Text & Link Classification', () => {
  it('extracts vn.shp.ee shortlink and cleans product title from Shopee App share text', () => {
    const shareText =
      'Mua ngay Tai nghe Sony WF-1000XM5 với giá chỉ ₫3.990.000! Mua ngay trên Shopee! https://vn.shp.ee/AbCd12.';
    const info = extractShopeeLinkInfo(shareText);

    expect(info).toEqual({
      cleanUrl: 'https://vn.shp.ee/AbCd12',
      extractedTitle: 'Tai nghe Sony WF-1000XM5',
      kind: 'shortlink',
    });
  });

  it('extracts s.shopee.vn and shope.ee shortlinks and strips emojis, prefixes, and trailing boilerplate', () => {
    const share1 =
      '🔥 Săn ngay: Sạc nhanh Anker GaNPrime 65W giá chỉ ₫699.000 tại https://s.shopee.vn/7fXyZ99!';
    expect(extractShopeeLinkInfo(share1)).toEqual({
      cleanUrl: 'https://s.shopee.vn/7fXyZ99',
      extractedTitle: 'Sạc nhanh Anker GaNPrime 65W',
      kind: 'shortlink',
    });

    const share2 =
      '• Xem ngay Chuột không dây Logitech MX Master 3S (Đen) trên Shopee! (https://shope.ee/88aaBBcc)';
    expect(extractShopeeLinkInfo(share2)).toEqual({
      cleanUrl: 'https://shope.ee/88aaBBcc',
      extractedTitle: 'Chuột không dây Logitech MX Master 3S (Đen)',
      kind: 'shortlink',
    });
  });

  it('extracts shopId, itemId, and humanized slug fallback for -i.shopId.itemId product URLs', () => {
    const slugUrl = 'https://shopee.vn/Tai-nghe-Bluetooth-ANC-i.12345.67890';
    expect(extractShopeeLinkInfo(slugUrl)).toEqual({
      cleanUrl: slugUrl,
      extractedTitle: 'Tai nghe Bluetooth ANC',
      kind: 'product',
      shopId: '12345',
      itemId: '67890',
    });

    // Boilerplate-only preceding text falls back to slug humanizer
    const boilerplateOnly = `Mua ngay trên Shopee! ${slugUrl}`;
    expect(extractShopeeLinkInfo(boilerplateOnly)).toEqual({
      cleanUrl: slugUrl,
      extractedTitle: 'Tai nghe Bluetooth ANC',
      kind: 'product',
      shopId: '12345',
      itemId: '67890',
    });
  });

  it('extracts shopId and itemId from /product/ and /item/ URLs and returns null title when no slug/text', () => {
    expect(extractShopeeLinkInfo('https://shopee.vn/product/111222/333444?sp_atk=abc')).toEqual({
      cleanUrl: 'https://shopee.vn/product/111222/333444?sp_atk=abc',
      extractedTitle: null,
      kind: 'product',
      shopId: '111222',
      itemId: '333444',
    });

    expect(extractShopeeLinkInfo('https://shopee.vn/item/555666/777888')).toEqual({
      cleanUrl: 'https://shopee.vn/item/555666/777888',
      extractedTitle: null,
      kind: 'product',
      shopId: '555666',
      itemId: '777888',
    });
  });

  it('normalizes relative Shopee paths (/m/..., /cart, /product/...) and classifies voucher, hub, cart, and unknown', () => {
    expect(extractShopeeLinkInfo('/cart')).toEqual({
      cleanUrl: 'https://shopee.vn/cart',
      extractedTitle: null,
      kind: 'cart',
    });

    expect(extractShopeeLinkInfo('/m/voucher-xtra')).toEqual({
      cleanUrl: 'https://shopee.vn/m/voucher-xtra',
      extractedTitle: null,
      kind: 'voucher',
    });

    expect(
      extractShopeeLinkInfo('https://shopee.vn/voucher/details?promotionId=99887766&signature=ab'),
    ).toEqual({
      cleanUrl: 'https://shopee.vn/voucher/details?promotionId=99887766&signature=ab',
      extractedTitle: null,
      kind: 'voucher',
    });

    expect(extractShopeeLinkInfo('https://shopee.vn/m/shopee-live')).toEqual({
      cleanUrl: 'https://shopee.vn/m/shopee-live',
      extractedTitle: null,
      kind: 'hub',
    });

    expect(extractShopeeLinkInfo('/product/999/888')).toEqual({
      cleanUrl: 'https://shopee.vn/product/999/888',
      extractedTitle: null,
      kind: 'product',
      shopId: '999',
      itemId: '888',
    });

    expect(extractShopeeLinkInfo('')).toEqual({
      cleanUrl: null,
      extractedTitle: null,
      kind: 'unknown',
    });

    expect(extractShopeeLinkInfo('Không có đường dẫn nào ở đây')).toEqual({
      cleanUrl: null,
      extractedTitle: null,
      kind: 'unknown',
    });
  });

  it('allows buildShopeeLaunchTargets to extract clean URLs from surrounding share text without falling back to /cart', () => {
    const targets = buildShopeeLaunchTargets(
      'Xem ngay Bàn phím cơ với giá chỉ ₫990.000! https://shopee.vn/Ban-phim-co-i.101.202!',
    );
    expect(targets.webUrl).toBe('https://shopee.vn/Ban-phim-co-i.101.202');
    expect(targets.iosSchemeUrl).toBe(
      `shopeevn://home?navigate_url=${encodeURIComponent('https://shopee.vn/Ban-phim-co-i.101.202')}`,
    );
  });
});

describe('copyAndLaunchShopee — Shortlink Universal / App Link & Intent Routing', () => {
  const originalUserAgent = navigator.userAgent;
  const originalMaxTouchPoints = navigator.maxTouchPoints;
  const originalClipboard = navigator.clipboard;

  afterEach(() => {
    Object.defineProperty(navigator, 'userAgent', {
      value: originalUserAgent,
      configurable: true,
    });
    Object.defineProperty(navigator, 'maxTouchPoints', {
      value: originalMaxTouchPoints,
      configurable: true,
    });
    Object.defineProperty(navigator, 'clipboard', {
      value: originalClipboard,
      configurable: true,
      writable: true,
    });
    vi.restoreAllMocks();
  });

  it('launches shortlinks directly via App Links / Universal Links on Android & iOS in auto-app mode', async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: writeTextMock },
      configurable: true,
      writable: true,
    });

    const shareInput =
      'Mua ngay Tai nghe Sony WF-1000XM5 với giá chỉ ₫3.990.000! Mua ngay trên Shopee! https://vn.shp.ee/AbCd12';

    // Android auto-app -> Universal / App Link direct navigation (newTab = false), NOT shopeevn://home?navigate_url=
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) Chrome/129.0.0.0 Mobile Safari/537.36',
      configurable: true,
    });
    const androidNav = vi.fn();
    const androidRes = await copyAndLaunchShopee({
      voucherCode: 'SONY100K',
      targetUrl: shareInput,
      mode: 'auto-app',
      navigateFn: androidNav,
    });

    expect(writeTextMock).toHaveBeenCalledWith('SONY100K');
    expect(androidRes).toEqual({
      copied: { ok: true, method: 'clipboard-api' },
      launchedUrl: 'https://vn.shp.ee/AbCd12',
      usedNativeApp: true,
    });
    expect(androidNav).toHaveBeenCalledWith('https://vn.shp.ee/AbCd12', false);

    // iOS auto-app -> Universal Link direct navigation (newTab = false)
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) Mobile/15E148 Safari/604.1',
      configurable: true,
    });
    const iosNav = vi.fn();
    const iosRes = await copyAndLaunchShopee({
      targetUrl: 'https://s.shopee.vn/556677',
      mode: 'auto-app',
      navigateFn: iosNav,
    });

    expect(iosRes).toEqual({
      copied: null,
      launchedUrl: 'https://s.shopee.vn/556677',
      usedNativeApp: true,
    });
    expect(iosNav).toHaveBeenCalledWith('https://s.shopee.vn/556677', false);
  });

  it('launches shortlinks with https package intent on Android force-app and new tab on web / desktop auto-app', async () => {
    // Android force-app -> intent://<host/path>#Intent;scheme=https;package=com.shopee.vn;S.browser_fallback_url=...;end
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (Linux; Android 14; SM-S928B) Chrome/129.0.0.0 Mobile Safari/537.36',
      configurable: true,
    });
    const forceAndroidNav = vi.fn();
    const cleanShortUrl = 'https://vn.shp.ee/AbCd12';
    const expectedIntent = `intent://vn.shp.ee/AbCd12#Intent;scheme=https;package=com.shopee.vn;S.browser_fallback_url=${encodeURIComponent(cleanShortUrl)};end`;

    const forceRes = await copyAndLaunchShopee({
      targetUrl: `Mua ngay trên Shopee! ${cleanShortUrl}!`,
      mode: 'force-app',
      navigateFn: forceAndroidNav,
    });

    expect(forceRes).toEqual({
      copied: null,
      launchedUrl: expectedIntent,
      usedNativeApp: true,
    });
    expect(forceAndroidNav).toHaveBeenCalledWith(expectedIntent, false);

    // Android web mode -> opens cleanUrl in new tab
    const webAndroidNav = vi.fn();
    const webRes = await copyAndLaunchShopee({
      targetUrl: cleanShortUrl,
      mode: 'web',
      navigateFn: webAndroidNav,
    });

    expect(webRes).toEqual({
      copied: null,
      launchedUrl: cleanShortUrl,
      usedNativeApp: false,
    });
    expect(webAndroidNav).toHaveBeenCalledWith(cleanShortUrl, true);

    // Desktop auto-app -> opens cleanUrl in new tab
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/129.0.0.0 Safari/537.36',
      configurable: true,
    });
    Object.defineProperty(navigator, 'maxTouchPoints', {
      value: 0,
      configurable: true,
    });
    const desktopNav = vi.fn();
    const desktopRes = await copyAndLaunchShopee({
      targetUrl: 'https://s.shopee.vn/9988aa',
      mode: 'auto-app',
      navigateFn: desktopNav,
    });

    expect(desktopRes).toEqual({
      copied: null,
      launchedUrl: 'https://s.shopee.vn/9988aa',
      usedNativeApp: false,
    });
    expect(desktopNav).toHaveBeenCalledWith('https://s.shopee.vn/9988aa', true);
  });
});

describe('storage.ts — Paired productUrl, voucherUrl & strikeMode persistence', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('round-trips productUrl, voucherUrl, and strikeMode through saveRunbookItems / loadRunbookItems', () => {
    const customDeal: DealRunbookItem = {
      id: 'paired-deal-1',
      slotTime: '00:00',
      targetEpochMs: 1762880400000,
      title: 'Tai nghe Sony WF-1000XM5',
      itemsSummary: '1x Tai nghe chống ồn',
      voucherCode: 'ELEC200K',
      voucherNote: 'Giảm 20% tối đa 200K',
      paymentMethod: 'ShopeePay',
      shopeeUrl: 'https://shopee.vn/m/ma-giam-gia',
      productUrl: 'https://vn.shp.ee/prodSony1',
      voucherUrl: 'https://s.shopee.vn/vouchElec1',
      strikeMode: 'flash-product',
      checklist: {
        itemsTickedInCart: true,
        waitingAtCheckoutScreen: false,
        paymentMethodSelected: true,
      },
      completed: false,
    };

    saveRunbookItems([customDeal]);
    const loaded = loadRunbookItems();

    expect(loaded).toHaveLength(1);
    expect(loaded[0].productUrl).toBe('https://vn.shp.ee/prodSony1');
    expect(loaded[0].voucherUrl).toBe('https://s.shopee.vn/vouchElec1');
    expect(loaded[0].strikeMode).toBe('flash-product');
    expect(loaded[0].shopeeUrl).toBe('https://shopee.vn/m/ma-giam-gia');
  });

  it('backfills voucherUrl from non-cart shopeeUrl when voucherUrl is undefined, skips /cart, and drops invalid strikeMode', () => {
    const rawItems = [
      {
        ...DEFAULT_11_11_RUNBOOK[0],
        id: 'legacy-hub-deal',
        shopeeUrl: 'https://shopee.vn/m/voucher-xtra',
        voucherUrl: undefined,
        strikeMode: 'checkout-wait',
      },
      {
        ...DEFAULT_11_11_RUNBOOK[0],
        id: 'legacy-cart-deal',
        shopeeUrl: 'https://shopee.vn/cart',
        voucherUrl: undefined,
        strikeMode: 'invalid-mode',
      },
    ];

    window.localStorage.setItem(STORAGE_KEYS.RUNBOOK_ITEMS, JSON.stringify(rawItems));
    const loaded = loadRunbookItems();

    expect(loaded).toHaveLength(2);
    expect(loaded[0].shopeeUrl).toBe('https://shopee.vn/m/voucher-xtra');
    expect(loaded[0].voucherUrl).toBe('https://shopee.vn/m/voucher-xtra');
    expect(loaded[0].strikeMode).toBe('checkout-wait');

    expect(loaded[1].shopeeUrl).toBe('https://shopee.vn/cart');
    expect(loaded[1].voucherUrl).toBeUndefined();
    expect(loaded[1].strikeMode).toBeUndefined();
  });
});

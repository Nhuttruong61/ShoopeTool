import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  buildShopeeLaunchTargets,
  copyAndLaunchShopee,
  detectLaunchPlatform,
} from '../src/lib/clipboard';

describe('deeplink.ts — Native Shopee App Deep-Link & Platform Launch', () => {
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

  it('detects Android, iPhone, iPadOS, and Windows Desktop platforms accurately', () => {
    expect(
      detectLaunchPlatform(
        'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36',
        5,
      ),
    ).toBe('android');

    expect(
      detectLaunchPlatform(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
        5,
      ),
    ).toBe('ios');

    // iPadOS desktop-class Safari reports Macintosh with maxTouchPoints > 1
    expect(
      detectLaunchPlatform(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
        5,
      ),
    ).toBe('ios');

    // Standard macOS without multi-touch is desktop
    expect(
      detectLaunchPlatform(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
        0,
      ),
    ).toBe('desktop');

    expect(
      detectLaunchPlatform(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
        0,
      ),
    ).toBe('desktop');
  });

  it('builds valid Android intent and iOS scheme targets for /cart and /m/ma-giam-gia', () => {
    const cartTargets = buildShopeeLaunchTargets();
    const encodedCart = encodeURIComponent('https://shopee.vn/cart');

    expect(cartTargets.webUrl).toBe('https://shopee.vn/cart');
    expect(cartTargets.iosSchemeUrl).toBe(`shopeevn://home?navigate_url=${encodedCart}`);
    expect(cartTargets.androidIntentUrl).toBe(
      `intent://home?navigate_url=${encodedCart}#Intent;scheme=shopeevn;package=com.shopee.vn;S.browser_fallback_url=${encodedCart};end`,
    );

    const voucherHubTargets = buildShopeeLaunchTargets('https://shopee.vn/m/ma-giam-gia');
    const encodedHub = encodeURIComponent('https://shopee.vn/m/ma-giam-gia');

    expect(voucherHubTargets.webUrl).toBe('https://shopee.vn/m/ma-giam-gia');
    expect(voucherHubTargets.iosSchemeUrl).toBe(`shopeevn://home?navigate_url=${encodedHub}`);
    expect(voucherHubTargets.androidIntentUrl).toContain('package=com.shopee.vn');
    expect(voucherHubTargets.androidIntentUrl).toContain(
      `S.browser_fallback_url=${encodedHub}`,
    );
  });

  it('copies voucher code strictly BEFORE calling navigateFn and uses native intent/scheme on mobile', async () => {
    const callOrder: string[] = [];
    const writeTextMock = vi.fn().mockImplementation(async () => {
      callOrder.push('clipboard-write');
    });
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: writeTextMock },
      configurable: true,
      writable: true,
    });

    // Simulate Android Chrome
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (Linux; Android 14; SM-S928B) Chrome/129.0.0.0 Mobile Safari/537.36',
      configurable: true,
    });

    const navigateMock = vi.fn().mockImplementation(() => {
      callOrder.push('navigate');
    });

    const androidRes = await copyAndLaunchShopee({
      voucherCode: 'LIVE50K',
      targetUrl: 'https://shopee.vn/cart',
      navigateFn: navigateMock,
    });

    expect(callOrder).toEqual(['clipboard-write', 'navigate']);
    expect(writeTextMock).toHaveBeenCalledWith('LIVE50K');
    expect(androidRes.copied).toEqual({ ok: true, method: 'clipboard-api' });
    expect(androidRes.usedNativeApp).toBe(true);
    expect(androidRes.launchedUrl).toContain('intent://home?navigate_url=');
    expect(navigateMock).toHaveBeenCalledWith(androidRes.launchedUrl, false);

    // Simulate iPhone Safari
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) Mobile/15E148 Safari/604.1',
      configurable: true,
    });

    const iosNavigateMock = vi.fn();
    const iosRes = await copyAndLaunchShopee({
      targetUrl: 'https://shopee.vn/m/ma-giam-gia',
      navigateFn: iosNavigateMock,
    });

    expect(iosRes.copied).toBeNull();
    expect(iosRes.usedNativeApp).toBe(true);
    expect(iosRes.launchedUrl).toBe(
      `shopeevn://home?navigate_url=${encodeURIComponent('https://shopee.vn/m/ma-giam-gia')}`,
    );
    expect(iosNavigateMock).toHaveBeenCalledWith(iosRes.launchedUrl, false);

    // Simulate Windows Desktop (auto-app opens web in newTab = true, force-app opens native in newTab = false)
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/129.0.0.0 Safari/537.36',
      configurable: true,
    });
    Object.defineProperty(navigator, 'maxTouchPoints', {
      value: 0,
      configurable: true,
    });

    const desktopNavigateMock = vi.fn();
    const desktopAutoRes = await copyAndLaunchShopee({
      targetUrl: 'https://shopee.vn/cart',
      mode: 'auto-app',
      navigateFn: desktopNavigateMock,
    });

    expect(desktopAutoRes.usedNativeApp).toBe(false);
    expect(desktopAutoRes.launchedUrl).toBe('https://shopee.vn/cart');
    expect(desktopNavigateMock).toHaveBeenCalledWith('https://shopee.vn/cart', true);

    const desktopForceAppMock = vi.fn();
    const desktopForceRes = await copyAndLaunchShopee({
      targetUrl: 'https://shopee.vn/cart',
      mode: 'force-app',
      navigateFn: desktopForceAppMock,
    });

    expect(desktopForceRes.usedNativeApp).toBe(true);
    expect(desktopForceRes.launchedUrl).toBe(
      `shopeevn://home?navigate_url=${encodeURIComponent('https://shopee.vn/cart')}`,
    );
    expect(desktopForceAppMock).toHaveBeenCalledWith(desktopForceRes.launchedUrl, false);
  });
});

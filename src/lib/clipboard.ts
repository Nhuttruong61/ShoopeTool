import type { ClipboardResult } from '../types/contracts';

const DEFAULT_SHOPEE_WEB_CART = 'https://shopee.vn/cart';
const DEFAULT_SHOPEE_APP_CART = 'shopeevn://reactPath?path=cart';

export type LaunchPlatform = 'android' | 'ios' | 'desktop';
export type OpenModePreference = 'auto-app' | 'force-app' | 'web';

export interface ShopeeLaunchTargets {
  webUrl: string;
  appDeepLink: string;
  iosSchemeUrl: string;
  androidIntentUrl: string;
}

/**
 * Detects the current runtime launch platform from userAgent and maxTouchPoints.
 * - 'android': User agent contains Android
 * - 'ios': User agent contains iPhone/iPad/iPod, or iPadOS desktop-class Safari (Macintosh + maxTouchPoints > 1)
 * - 'desktop': Everything else
 */
export function detectLaunchPlatform(ua?: string, maxTouchPoints?: number): LaunchPlatform {
  const effectiveUa =
    ua !== undefined ? ua : typeof navigator !== 'undefined' ? (navigator.userAgent ?? '') : '';
  const effectiveTouchPoints =
    maxTouchPoints !== undefined
      ? maxTouchPoints
      : typeof navigator !== 'undefined'
        ? (navigator.maxTouchPoints ?? 0)
        : 0;

  if (/\bAndroid\b/i.test(effectiveUa)) {
    return 'android';
  }

  if (
    /\b(iPhone|iPad|iPod)\b/i.test(effectiveUa) ||
    (/Macintosh/i.test(effectiveUa) && effectiveTouchPoints > 1)
  ) {
    return 'ios';
  }

  return 'desktop';
}

/**
 * Normalizes a target URL or relative Shopee path into web, iOS scheme, and Android intent launch targets.
 * Uses `shopeevn://home?navigate_url=...` which works across all Shopee App routes (/cart, /m/ma-giam-gia, etc.)
 * and `intent://home?navigate_url=...#Intent;scheme=shopeevn;package=com.shopee.vn;S.browser_fallback_url=...;end`
 * on Android Chrome for zero-blank-tab native launch with automatic web fallback.
 */
export function buildShopeeLaunchTargets(customUrl?: string): ShopeeLaunchTargets {
  const trimmed = customUrl?.trim();

  if (trimmed && trimmed.toLowerCase().startsWith('shopeevn://')) {
    const encodedFallback = encodeURIComponent(DEFAULT_SHOPEE_WEB_CART);
    return {
      webUrl: DEFAULT_SHOPEE_WEB_CART,
      appDeepLink: trimmed,
      iosSchemeUrl: trimmed,
      androidIntentUrl: `intent://home?navigate_url=${encodedFallback}#Intent;scheme=shopeevn;package=com.shopee.vn;S.browser_fallback_url=${encodedFallback};end`,
    };
  }

  let webUrl = DEFAULT_SHOPEE_WEB_CART;
  if (trimmed) {
    try {
      const candidate = trimmed.startsWith('/') ? `https://shopee.vn${trimmed}` : trimmed;
      const parsed = new URL(candidate);
      if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
        webUrl = parsed.toString();
      }
    } catch {
      webUrl = DEFAULT_SHOPEE_WEB_CART;
    }
  }

  const encodedWebUrl = encodeURIComponent(webUrl);
  const iosSchemeUrl = `shopeevn://home?navigate_url=${encodedWebUrl}`;
  const androidIntentUrl = `intent://home?navigate_url=${encodedWebUrl}#Intent;scheme=shopeevn;package=com.shopee.vn;S.browser_fallback_url=${encodedWebUrl};end`;

  return {
    webUrl,
    appDeepLink: iosSchemeUrl,
    iosSchemeUrl,
    androidIntentUrl,
  };
}

/**
 * Copies a voucher code to the system clipboard.
 * 1. Attempts modern async `navigator.clipboard.writeText(text)` first.
 * 2. If unavailable or rejected (e.g. mobile browser over HTTP LAN `http://192.168.x.x`),
 *    falls back to creating an offscreen `<textarea readOnly>`, selecting with
 *    `setSelectionRange(0, text.length)` (iOS Safari compatible), and invoking
 *    `document.execCommand('copy')`.
 */
export async function copyVoucherCode(text: string): Promise<ClipboardResult> {
  const normalized = String(text ?? '');

  if (
    typeof navigator !== 'undefined' &&
    navigator.clipboard &&
    typeof navigator.clipboard.writeText === 'function'
  ) {
    try {
      await navigator.clipboard.writeText(normalized);
      return { ok: true, method: 'clipboard-api' };
    } catch {
      // Fall through to execCommand fallback for insecure HTTP LAN contexts
    }
  }

  if (typeof document === 'undefined' || !document.body) {
    return {
      ok: false,
      method: 'failed',
      error: 'Clipboard API and document.body are unavailable in this environment.',
    };
  }

  let textarea: HTMLTextAreaElement | null = null;
  try {
    textarea = document.createElement('textarea');
    textarea.value = normalized;
    textarea.readOnly = true;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.top = '-9999px';
    textarea.style.left = '-9999px';
    textarea.style.opacity = '0';
    textarea.style.pointerEvents = 'none';

    document.body.appendChild(textarea);

    textarea.focus();
    textarea.select();
    textarea.setSelectionRange(0, normalized.length);

    const canExec = typeof document.execCommand === 'function';
    const succeeded = canExec ? document.execCommand('copy') : false;

    if (succeeded) {
      return { ok: true, method: 'exec-command' };
    }

    return {
      ok: false,
      method: 'failed',
      error: 'Fallback document.execCommand("copy") returned false.',
    };
  } catch (err) {
    return {
      ok: false,
      method: 'failed',
      error: err instanceof Error ? err.message : String(err),
    };
  } finally {
    if (textarea && textarea.parentNode) {
      textarea.parentNode.removeChild(textarea);
    }
  }
}

/**
 * Returns safe, official Shopee web and mobile app deep-link URLs for user-initiated navigation.
 */
export function getShopeeCartLinks(customUrl?: string): {
  webUrl: string;
  appDeepLink: string;
} {
  const trimmed = customUrl?.trim();
  if (!trimmed) {
    return {
      webUrl: DEFAULT_SHOPEE_WEB_CART,
      appDeepLink: DEFAULT_SHOPEE_APP_CART,
    };
  }

  if (trimmed.toLowerCase().startsWith('shopeevn://')) {
    return {
      webUrl: DEFAULT_SHOPEE_WEB_CART,
      appDeepLink: trimmed,
    };
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return {
        webUrl: DEFAULT_SHOPEE_WEB_CART,
        appDeepLink: DEFAULT_SHOPEE_APP_CART,
      };
    }

    const cleanPath = parsed.pathname.replace(/^\/+/, '') || 'cart';
    const pathWithQuery = `${cleanPath}${parsed.search}`;
    const appDeepLink =
      cleanPath === 'cart' && !parsed.search
        ? DEFAULT_SHOPEE_APP_CART
        : `shopeevn://reactPath?path=${encodeURIComponent(pathWithQuery)}`;

    return {
      webUrl: parsed.toString(),
      appDeepLink,
    };
  } catch {
    return {
      webUrl: DEFAULT_SHOPEE_WEB_CART,
      appDeepLink: DEFAULT_SHOPEE_APP_CART,
    };
  }
}

function defaultNavigate(url: string, newTab: boolean): void {
  if (typeof window === 'undefined') return;
  if (newTab) {
    window.open(url, '_blank', 'noopener,noreferrer');
  } else {
    window.location.assign(url);
  }
}

/**
 * Copies optional voucher code FIRST (while document still retains focus),
 * then launches Shopee natively on Android/iOS (or web new tab on Desktop).
 */
export async function copyAndLaunchShopee(
  options: {
    voucherCode?: string;
    targetUrl?: string;
    mode?: OpenModePreference;
    navigateFn?: (url: string, newTab: boolean) => void;
  } = {},
): Promise<{
  copied: ClipboardResult | null;
  launchedUrl: string;
  usedNativeApp: boolean;
}> {
  const { voucherCode, targetUrl, mode = 'auto-app', navigateFn = defaultNavigate } = options;

  let copied: ClipboardResult | null = null;
  const trimmedCode = voucherCode?.trim();
  if (trimmedCode) {
    copied = await copyVoucherCode(trimmedCode);
  }

  const platform = detectLaunchPlatform();
  const targets = buildShopeeLaunchTargets(targetUrl);

  if (mode === 'web' || (mode !== 'force-app' && platform === 'desktop')) {
    navigateFn(targets.webUrl, true);
    return {
      copied,
      launchedUrl: targets.webUrl,
      usedNativeApp: false,
    };
  }

  if (platform === 'android') {
    navigateFn(targets.androidIntentUrl, false);
    return {
      copied,
      launchedUrl: targets.androidIntentUrl,
      usedNativeApp: true,
    };
  }

  // iOS or force-app on non-Android
  navigateFn(targets.iosSchemeUrl, false);
  return {
    copied,
    launchedUrl: targets.iosSchemeUrl,
    usedNativeApp: true,
  };
}

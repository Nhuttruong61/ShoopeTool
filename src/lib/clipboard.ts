import type {
  ClipboardResult,
  ExtractedShopeeLink,
  ShopeeLinkKind,
} from '../types/contracts';

const DEFAULT_SHOPEE_WEB_CART = 'https://shopee.vn/cart';
const DEFAULT_SHOPEE_APP_CART = 'shopeevn://reactPath?path=cart';

const SHORTLINK_HOST_RE = /(^|\.)((vn\.)?shp\.ee|s\.shopee\.vn|shope\.ee)$/i;

const VOUCHER_URL_PATTERNS = [
  '/voucher/',
  'promotionid=',
  'voucher-wallet',
  '/m/ma-giam-gia',
  '/m/voucher-xtra',
  '/m/mien-phi-van-chuyen',
  '/m/shopeepay',
  '/m/uu-dai-doi-tac',
  '/m/shopee-rewards',
];

export type LaunchPlatform = 'android' | 'ios' | 'desktop';
export type OpenModePreference = 'auto-app' | 'force-app' | 'web';

export interface ShopeeLaunchTargets {
  webUrl: string;
  appDeepLink: string;
  iosSchemeUrl: string;
  androidIntentUrl: string;
}

function cleanPrecedingShareTitle(rawBefore: string): string | null {
  let text = rawBefore.replace(/\s+/g, ' ').trim();
  if (!text) {
    return null;
  }

  for (let i = 0; i < 4; i++) {
    const prev = text;
    text = text
      .replace(
        /(?:^|\s+)(?:hãy\s+)?(?:mua\s+ngay|xem\s+ngay|săn\s+ngay)\s+trên\s+shopee(?![\p{L}\p{N}]).*$/iu,
        '',
      )
      .replace(/(?:^|\s+)trên\s+shopee(?![\p{L}\p{N}]).*$/iu, '')
      .replace(/(?:^|\s+)(?:với\s+giá|giá\s+chỉ|giá\s+ưu\s+đãi|giá\s+bán)(?![\p{L}\p{N}]).*$/iu, '')
      .replace(/(?:^|\s+)tại(?:\s+shopee|\s+đây)?\s*[:\-–—!.,]*$/iu, '')
      .trim();
    if (text === prev) break;
  }

  text = text.replace(/^[^\p{L}\p{N}[\]()]+/u, '').trim();

  for (let i = 0; i < 3; i++) {
    const prev = text;
    text = text
      .replace(
        /^(?:hãy\s+xem(?:\s+ngay|\s+sản\s+phẩm)?|xem\s+ngay|mua\s+ngay|săn\s+ngay|sản\s+phẩm)\s*[:\-–—!.,]*$/iu,
        '',
      )
      .replace(
        /^(?:hãy\s+xem(?:\s+ngay|\s+sản\s+phẩm)?|xem\s+ngay|mua\s+ngay|săn\s+ngay|sản\s+phẩm)(?:\s*[:\-–—]+\s*|\s+)/iu,
        '',
      )
      .replace(/^[^\p{L}\p{N}[\]()]+/u, '')
      .trim();
    if (text === prev) break;
  }

  text = text
    .replace(/(?:^|\s+)tại\s*[:\-–—!.,]*$/iu, '')
    .replace(/[\s\-–—|:;,.!?]+$/u, '')
    .trim();

  return text.length > 0 ? text : null;
}

function extractSlugTitle(pathname: string): string | null {
  const slugMatch = /^\/([^/]+)-i\.\d+\.\d+(?:\/|$)/.exec(pathname);
  if (!slugMatch || !slugMatch[1]) {
    return null;
  }
  let rawSlug = slugMatch[1];
  try {
    rawSlug = decodeURIComponent(rawSlug);
  } catch {
    // Keep rawSlug if percent-encoding is incomplete
  }
  const humanized = rawSlug.replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim();
  return humanized.length > 0 ? humanized : null;
}

function extractProductIds(input: string): { shopId: string; itemId: string } | null {
  const patterns = [/-i\.(\d+)\.(\d+)/, /\/product\/(\d+)\/(\d+)/, /\/item\/(\d+)\/(\d+)/];
  for (const re of patterns) {
    const match = re.exec(input);
    if (match && match[1] && match[2]) {
      return { shopId: match[1], itemId: match[2] };
    }
  }
  return null;
}

/**
 * Extracts clean URL, optional product title, link classification, and product IDs
 * from raw Shopee App share text or plain Shopee links/paths.
 */
export function extractShopeeLinkInfo(rawInput?: string): ExtractedShopeeLink {
  if (!rawInput || typeof rawInput !== 'string') {
    return { cleanUrl: null, extractedTitle: null, kind: 'unknown' };
  }

  const trimmed = rawInput.trim();
  if (!trimmed) {
    return { cleanUrl: null, extractedTitle: null, kind: 'unknown' };
  }

  let candidateUrl: string | null = null;
  let rawBefore = '';

  const schemeMatch = /(?:https?:\/\/|shopeevn:\/\/)[^\s"'<>]+/i.exec(rawInput);
  if (schemeMatch && schemeMatch[0]) {
    rawBefore = rawInput.slice(0, schemeMatch.index);
    candidateUrl = schemeMatch[0].replace(/[.,;:!?)>\]]+$/, '');
  } else if (trimmed.startsWith('/') && !trimmed.startsWith('//')) {
    const relMatch =
      /^\/(?:m\/|cart(?:[/?#]|$)|product\/|item\/|voucher\/|[A-Za-z0-9%._-]+-i\.\d+\.\d+)[^\s"'<>]*/i.exec(
        trimmed,
      );
    if (relMatch && relMatch[0]) {
      const cleanRel = relMatch[0].replace(/[.,;:!?)>\]]+$/, '');
      candidateUrl = `https://shopee.vn${cleanRel}`;
    }
  }

  if (!candidateUrl) {
    return { cleanUrl: null, extractedTitle: null, kind: 'unknown' };
  }

  let cleanUrl: string | null = null;
  let parsedUrl: URL | null = null;

  if (candidateUrl.toLowerCase().startsWith('shopeevn://')) {
    cleanUrl = candidateUrl;
  } else {
    try {
      const parsed = new URL(candidateUrl);
      if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
        parsedUrl = parsed;
        cleanUrl = candidateUrl;
      }
    } catch {
      cleanUrl = null;
    }
  }

  if (!cleanUrl) {
    return { cleanUrl: null, extractedTitle: null, kind: 'unknown' };
  }

  let ids = extractProductIds(parsedUrl ? parsedUrl.pathname : cleanUrl);
  if (!ids && cleanUrl.toLowerCase().startsWith('shopeevn://')) {
    try {
      ids = extractProductIds(decodeURIComponent(cleanUrl));
    } catch {
      ids = null;
    }
  }

  let extractedTitle = cleanPrecedingShareTitle(rawBefore);
  if (!extractedTitle && parsedUrl) {
    extractedTitle = extractSlugTitle(parsedUrl.pathname);
  }

  let kind: ShopeeLinkKind = 'unknown';
  const lowerUrl = cleanUrl.toLowerCase();
  const normalizedPathname = parsedUrl ? parsedUrl.pathname.replace(/\/+$/, '') || '/' : '';

  if (parsedUrl && SHORTLINK_HOST_RE.test(parsedUrl.hostname)) {
    kind = 'shortlink';
  } else if (ids) {
    kind = 'product';
  } else if (
    normalizedPathname === '/cart' ||
    lowerUrl === DEFAULT_SHOPEE_APP_CART.toLowerCase()
  ) {
    kind = 'cart';
  } else if (VOUCHER_URL_PATTERNS.some((pattern) => lowerUrl.includes(pattern))) {
    kind = 'voucher';
  } else if (lowerUrl.includes('/m/')) {
    kind = 'hub';
  }

  const result: ExtractedShopeeLink = {
    cleanUrl,
    extractedTitle,
    kind,
  };

  if (ids) {
    result.shopId = ids.shopId;
    result.itemId = ids.itemId;
  }

  return result;
}

/**
 * Builds the official Shopee Shop page URL for a given numeric shopId,
 * where Shop Vouchers (e.g. Giảm 10%–35%) can be claimed directly in the Shopee App.
 */
export function buildShopeeShopUrl(shopId: string): string {
  const cleanShopId = String(shopId ?? '').replace(/\D+/g, '');
  if (!cleanShopId) {
    return 'https://shopee.vn/m/ma-giam-gia';
  }
  return `https://shopee.vn/shop/${cleanShopId}`;
}

/**
 * Resolves a Shopee shortlink (`vn.shp.ee`, `s.shopee.vn`, `shp.ee`, `shope.ee`)
 * via `/api/resolve-shopee` to extract `shopId`, `itemId`, and readable product title
 * from the redirected `https://shopee.vn/...-i.<shopId>.<itemId>` URL.
 * Gracefully falls back to synchronous `extractShopeeLinkInfo` if offline or in local dev.
 */
export async function resolveShopeeShortLink(
  rawInput?: string,
  fetchImpl: typeof fetch | undefined = typeof fetch !== 'undefined' ? fetch : undefined,
): Promise<ExtractedShopeeLink> {
  const baseInfo = extractShopeeLinkInfo(rawInput);
  if (baseInfo.kind !== 'shortlink' || !baseInfo.cleanUrl || !fetchImpl) {
    return baseInfo;
  }

  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), 3500) : null;

  try {
    const endpoint = `/api/resolve-shopee?url=${encodeURIComponent(baseInfo.cleanUrl)}`;
    const response = await fetchImpl(endpoint, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller?.signal,
    });
    if (!response.ok) {
      return baseInfo;
    }
    const payload = (await response.json()) as {
      ok?: boolean;
      resolvedUrl?: string;
    };
    if (!payload?.resolvedUrl || payload.resolvedUrl === baseInfo.cleanUrl) {
      return baseInfo;
    }

    const resolvedInfo = extractShopeeLinkInfo(payload.resolvedUrl);
    if (!resolvedInfo.cleanUrl) {
      return baseInfo;
    }

    return {
      cleanUrl: resolvedInfo.cleanUrl,
      extractedTitle: baseInfo.extractedTitle ?? resolvedInfo.extractedTitle,
      kind: resolvedInfo.kind !== 'unknown' ? resolvedInfo.kind : baseInfo.kind,
      shopId: resolvedInfo.shopId ?? baseInfo.shopId,
      itemId: resolvedInfo.itemId ?? baseInfo.itemId,
      resolvedFromShortlink: true,
    };
  } catch {
    return baseInfo;
  } finally {
    if (timer) clearTimeout(timer);
  }
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
  const extracted = trimmed ? extractShopeeLinkInfo(customUrl) : null;
  const effectiveUrl = extracted?.cleanUrl ?? trimmed;

  if (effectiveUrl && effectiveUrl.toLowerCase().startsWith('shopeevn://')) {
    const encodedFallback = encodeURIComponent(DEFAULT_SHOPEE_WEB_CART);
    return {
      webUrl: DEFAULT_SHOPEE_WEB_CART,
      appDeepLink: effectiveUrl,
      iosSchemeUrl: effectiveUrl,
      androidIntentUrl: `intent://home?navigate_url=${encodedFallback}#Intent;scheme=shopeevn;package=com.shopee.vn;S.browser_fallback_url=${encodedFallback};end`,
    };
  }

  let webUrl = DEFAULT_SHOPEE_WEB_CART;
  if (effectiveUrl) {
    try {
      const candidate = effectiveUrl.startsWith('/')
        ? `https://shopee.vn${effectiveUrl}`
        : effectiveUrl;
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
  const extracted = extractShopeeLinkInfo(targetUrl);

  if (extracted.kind === 'shortlink' && extracted.cleanUrl !== null) {
    const cleanUrl = extracted.cleanUrl;
    if (mode === 'web' || (mode !== 'force-app' && platform === 'desktop')) {
      navigateFn(cleanUrl, true);
      return {
        copied,
        launchedUrl: cleanUrl,
        usedNativeApp: false,
      };
    }

    if (mode === 'force-app' && platform === 'android') {
      const urlWithoutScheme = cleanUrl.replace(/^https?:\/\//i, '');
      const intentUrl = `intent://${urlWithoutScheme}#Intent;scheme=https;package=com.shopee.vn;S.browser_fallback_url=${encodeURIComponent(cleanUrl)};end`;
      navigateFn(intentUrl, false);
      return {
        copied,
        launchedUrl: intentUrl,
        usedNativeApp: true,
      };
    }

    navigateFn(cleanUrl, false);
    return {
      copied,
      launchedUrl: cleanUrl,
      usedNativeApp: true,
    };
  }

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

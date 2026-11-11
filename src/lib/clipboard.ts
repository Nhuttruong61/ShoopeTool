import type { ClipboardResult } from '../types/contracts';

const DEFAULT_SHOPEE_WEB_CART = 'https://shopee.vn/cart';
const DEFAULT_SHOPEE_APP_CART = 'shopeevn://reactPath?path=cart';

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

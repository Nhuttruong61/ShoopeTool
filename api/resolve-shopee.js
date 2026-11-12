const ALLOWED_HOST_RE = /(^|\.)((vn\.)?shp\.ee|s\.shopee\.vn|shope\.ee|shopee\.vn)$/i;
const MAX_HOPS = 5;

function isAllowedShopeeUrl(rawUrl) {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return false;
    }
    return ALLOWED_HOST_RE.test(parsed.hostname);
  } catch {
    return false;
  }
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');

  if (req.method !== 'GET') {
    return res.status(405).json({ ok: false, error: 'Method Not Allowed' });
  }

  const rawUrl = typeof req.query?.url === 'string' ? req.query.url.trim() : '';
  if (!rawUrl || !isAllowedShopeeUrl(rawUrl)) {
    return res.status(400).json({ ok: false, error: 'Invalid or unsupported Shopee URL' });
  }

  let currentUrl = rawUrl;
  let hops = 0;

  try {
    while (hops < MAX_HOPS) {
      const response = await fetch(currentUrl, {
        method: 'GET',
        redirect: 'manual',
        headers: {
          'User-Agent':
            'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
      });

      const location = response.headers.get('location');
      if (
        location &&
        (response.status === 301 ||
          response.status === 302 ||
          response.status === 303 ||
          response.status === 307 ||
          response.status === 308)
      ) {
        const nextUrl = new URL(location, currentUrl).toString();
        if (!isAllowedShopeeUrl(nextUrl)) {
          break;
        }
        currentUrl = nextUrl;
        hops += 1;

        if (/-i\.\d+\.\d+|\/product\/\d+\/\d+|\/item\/\d+\/\d+/.test(currentUrl)) {
          break;
        }
      } else {
        break;
      }
    }

    let cleanedResolved = currentUrl;
    try {
      const parsed = new URL(currentUrl);
      // Keep universal tracking-free path if it's a product URL
      if (/-i\.\d+\.\d+|\/product\/\d+\/\d+|\/item\/\d+\/\d+/.test(parsed.pathname)) {
        cleanedResolved = `${parsed.origin}${parsed.pathname}`;
      }
    } catch {
      cleanedResolved = currentUrl;
    }

    return res.status(200).json({
      ok: true,
      originalUrl: rawUrl,
      resolvedUrl: cleanedResolved,
      hops,
    });
  } catch (err) {
    return res.status(200).json({
      ok: false,
      originalUrl: rawUrl,
      resolvedUrl: rawUrl,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

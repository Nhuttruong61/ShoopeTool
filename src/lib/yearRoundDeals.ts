import type {
  ChannelStackComparison,
  ChannelStackInput,
  ChannelVoucherSpec,
  EvaluatedChannelStack,
  ParsedDealCandidate,
  SaleCampaignEvent,
  ShoppingChannel,
  VoucherHubShortcut,
} from '../types/contracts';
import { extractShopeeLinkInfo } from './clipboard';
import { formatVnd } from './optimizer';

const VN_OFFSET_MS = 7 * 3600_000;
const DAY_MS = 24 * 3600_000;

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/**
 * Computes upcoming year-round Shopee sale campaigns in Vietnam timezone (UTC+7),
 * completely independent of the host machine's local TZ setting.
 * Sorted by `daysAway` ascending.
 */
export function getUpcomingSaleRadar(nowEpochMs = Date.now()): SaleCampaignEvent[] {
  const vnShiftedMs = nowEpochMs + VN_OFFSET_MS;
  const vnDate = new Date(vnShiftedMs);

  const year = vnDate.getUTCFullYear();
  const month0 = vnDate.getUTCMonth(); // 0..11
  const month1 = month0 + 1; // 1..12
  const day = vnDate.getUTCDate(); // 1..31
  const dayOfWeek = vnDate.getUTCDay(); // 0 (Sun) .. 6 (Sat)

  const todayVnMidnightMs = Date.UTC(year, month0, day);

  // 1. Daily Voucher Restock (always active today, daysAway = 0)
  const dailyRestockEvent: SaleCampaignEvent = {
    id: 'daily-restock',
    type: 'daily-restock',
    dateLabel: `Hôm nay (${pad2(day)}/${pad2(month1)})`,
    title: 'Làm Mới Kho Mã Hàng Ngày',
    badge: 'Mỗi ngày',
    daysAway: 0,
    peakSlots: ['00:00', '09:00', '12:00', '18:00', '21:00'],
    tip: 'Shopee châm thêm lượt Mã Toàn Sàn, Freeship & Live/Video vào 5 khung giờ cố định mỗi ngày.',
  };

  // 2. Next Double Day (1/1 .. 12/12, rolling Dec 13+ cleanly to 01/01 next year)
  let ddYear = year;
  let ddMonth1 = month1;
  if (day > month1) {
    if (month1 === 12) {
      ddYear = year + 1;
      ddMonth1 = 1;
    } else {
      ddMonth1 = month1 + 1;
    }
  }
  const ddDay = ddMonth1;
  const ddMidnightMs = Date.UTC(ddYear, ddMonth1 - 1, ddDay);
  const ddDaysAway = Math.max(0, Math.round((ddMidnightMs - todayVnMidnightMs) / DAY_MS));

  const doubleDayEvent: SaleCampaignEvent = {
    id: `double-day-${ddYear}-${pad2(ddMonth1)}-${pad2(ddDay)}`,
    type: 'double-day',
    dateLabel: `${pad2(ddDay)}/${pad2(ddMonth1)}/${ddYear}`,
    title: `Siêu Sale Ngày Đôi ${ddMonth1}/${ddMonth1}`,
    badge: ddDaysAway === 0 ? 'Đang diễn ra!' : `Còn ${ddDaysAway} ngày`,
    daysAway: ddDaysAway,
    peakSlots: ['00:00', '09:00', '12:00', '15:00', '18:00', '21:00'],
    tip: `Đợt sale lớn ${ddMonth1}/${ddMonth1}: lưu sẵn mã Voucher Xtra, Freeship 0đ và canh 00:00 + 12:00.`,
  };

  // 3. Next Mid-Month Sale (15/MM Sale Giữa Tháng)
  const midMidnightMs =
    day <= 15 ? Date.UTC(year, month0, 15) : Date.UTC(year, month0 + 1, 15);
  const midDate = new Date(midMidnightMs);
  const midYear = midDate.getUTCFullYear();
  const midMonth1 = midDate.getUTCMonth() + 1;
  const midDaysAway = Math.max(0, Math.round((midMidnightMs - todayVnMidnightMs) / DAY_MS));

  const midMonthEvent: SaleCampaignEvent = {
    id: `mid-month-${midYear}-${pad2(midMonth1)}-15`,
    type: 'mid-month',
    dateLabel: `15/${pad2(midMonth1)}/${midYear}`,
    title: `Sale Giữa Tháng 15/${pad2(midMonth1)}`,
    badge: midDaysAway === 0 ? 'Đang diễn ra!' : `Còn ${midDaysAway} ngày`,
    daysAway: midDaysAway,
    peakSlots: ['00:00', '09:00', '12:00', '21:00'],
    tip: 'Sale 15 hàng tháng: tung nhiều mã Voucher Xtra 15%–20%, Freeship Xtra và mã Live nửa đêm.',
  };

  // 4. Next Payday Sale (25/MM Sale Lương Về)
  const payMidnightMs =
    day <= 25 ? Date.UTC(year, month0, 25) : Date.UTC(year, month0 + 1, 25);
  const payDate = new Date(payMidnightMs);
  const payYear = payDate.getUTCFullYear();
  const payMonth1 = payDate.getUTCMonth() + 1;
  const payDaysAway = Math.max(0, Math.round((payMidnightMs - todayVnMidnightMs) / DAY_MS));

  const paydayEvent: SaleCampaignEvent = {
    id: `payday-${payYear}-${pad2(payMonth1)}-25`,
    type: 'payday',
    dateLabel: `25/${pad2(payMonth1)}/${payYear}`,
    title: `Sale Lương Về 25/${pad2(payMonth1)}`,
    badge: payDaysAway === 0 ? 'Đang diễn ra!' : `Còn ${payDaysAway} ngày`,
    daysAway: payDaysAway,
    peakSlots: ['00:00', '12:00', '20:00', '21:00'],
    tip: 'Sale 25 Lương Về: mã giảm sâu cho đơn giá trị cao (Điện tử, Gia dụng, Shopee Mall).',
  };

  // 5. Next Wednesday Freeship (Thứ 4 Siêu Rẻ & Freeship)
  const wedDaysAway = (3 - dayOfWeek + 7) % 7;
  const wedMidnightMs = todayVnMidnightMs + wedDaysAway * DAY_MS;
  const wedDate = new Date(wedMidnightMs);
  const wedYear = wedDate.getUTCFullYear();
  const wedMonth1 = wedDate.getUTCMonth() + 1;
  const wedDay = wedDate.getUTCDate();

  const wednesdayEvent: SaleCampaignEvent = {
    id: `wednesday-freeship-${wedYear}-${pad2(wedMonth1)}-${pad2(wedDay)}`,
    type: 'wednesday-freeship',
    dateLabel: `Thứ 4 (${pad2(wedDay)}/${pad2(wedMonth1)})`,
    title: 'Thứ 4 Siêu Rẻ & Freeship',
    badge: wedDaysAway === 0 ? 'Hôm nay!' : `Còn ${wedDaysAway} ngày`,
    daysAway: wedDaysAway,
    peakSlots: ['00:00', '09:00', '12:00', '18:00', '21:00'],
    tip: 'Thứ 4 hàng tuần: gấp đôi lượt mã Freeship 0đ và khung giờ deal đồng giá Siêu Rẻ.',
  };

  const events: SaleCampaignEvent[] = [
    dailyRestockEvent,
    doubleDayEvent,
    midMonthEvent,
    paydayEvent,
    wednesdayEvent,
  ];

  return events.sort((a, b) => a.daysAway - b.daysAway);
}

/**
 * 8 official Shopee Vietnam voucher collection shortcuts (`https://shopee.vn/m/...`).
 * Pure user-clickable official links only — no API scraping or automation.
 */
export const OFFICIAL_VOUCHER_HUBS: VoucherHubShortcut[] = [
  {
    id: 'hub-ma-toan-san',
    title: 'Mã Toàn Sàn Shopee',
    subtitle: 'Trạm lưu sớm voucher toàn sàn, mã khung giờ 0h / 9h / 12h / 21h',
    badge: 'Quan trọng nhất',
    category: 'platform',
    webUrl: 'https://shopee.vn/m/ma-giam-gia',
    bestTimeHint: 'Lưu trước 23:50 & 11:50 mỗi ngày',
  },
  {
    id: 'hub-freeship-xtra',
    title: 'Kho Mã Freeship Xtra',
    subtitle: 'Mã miễn phí vận chuyển đơn từ 0đ, 15K, 45K và Freeship Hỏa Tốc',
    badge: 'Freeship 0đ',
    category: 'freeship',
    webUrl: 'https://shopee.vn/m/mien-phi-van-chuyen',
    bestTimeHint: 'Mở mới 00:00 & 12:00, nhiều nhất Thứ 4',
  },
  {
    id: 'hub-voucher-xtra',
    title: 'Trạm Voucher Xtra',
    subtitle: 'Mã giảm 15%–25% trần cao cho sản phẩm có gắn nhãn Voucher Xtra',
    badge: 'Giảm tới 500K',
    category: 'platform',
    webUrl: 'https://shopee.vn/m/voucher-xtra',
    bestTimeHint: 'Dễ săn nhất lúc 00:00, 09:00, 12:00',
  },
  {
    id: 'hub-shopee-video',
    title: 'Kho Mã Shopee Video',
    subtitle: 'Voucher độc quyền 20%–50% khi thêm sản phẩm từ giỏ vàng Shopee Video',
    badge: 'Giảm sâu mỗi ngày',
    category: 'video-live',
    webUrl: 'https://shopee.vn/m/shopee-video',
    bestTimeHint: 'Mã tự có sẵn trong ví + châm thêm 0h, 12h',
  },
  {
    id: 'hub-shopee-live',
    title: 'Kho Mã Shopee Live',
    subtitle: 'Mã giảm 15%–30% cho món hàng thêm trực tiếp từ giỏ cam Livestream',
    badge: 'Tung liên tục',
    category: 'video-live',
    webUrl: 'https://shopee.vn/m/shopee-live',
    bestTimeHint: 'Đỉnh điểm 12:00 trưa & 20:00–22:00 tối',
  },
  {
    id: 'hub-shopeepay',
    title: 'Ưu Đãi Ví ShopeePay',
    subtitle: 'Voucher giảm thêm và mã freeship độc quyền khi thanh toán qua ShopeePay',
    badge: 'Trừ thêm tầng 3',
    category: 'payment-vip',
    webUrl: 'https://shopee.vn/m/shopeepay',
    bestTimeHint: 'Kiểm tra trước khi bấm Thanh toán',
  },
  {
    id: 'hub-uu-dai-doi-tac',
    title: 'Ưu Đãi Ngân Hàng & Đối Tác',
    subtitle: 'Giảm thẳng 50K–300K khi trả bằng thẻ tín dụng/ghi nợ Visa, Mastercard, JCB',
    badge: 'Ngân hàng',
    category: 'payment-vip',
    webUrl: 'https://shopee.vn/m/uu-dai-doi-tac',
    bestTimeHint: 'Làm mới lượt lúc 00:00 và 09:00 sáng',
  },
  {
    id: 'hub-shopee-rewards',
    title: 'Đặc Quyền Hạng Thành Viên',
    subtitle: 'Kho mã riêng cho hạng Bạc, Vàng, Kim Cương (Shopee Rewards hàng tháng)',
    badge: 'VIP / Kim Cương',
    category: 'payment-vip',
    webUrl: 'https://shopee.vn/m/shopee-rewards',
    bestTimeHint: 'Nhận đầu tháng & ngày sale đôi',
  },
];

export const SAMPLE_DEAL_PASTE_TEXT = `🔥 KHUNG 0H:
- Mã AFF1122 giảm 25% tối đa 100K đơn từ 250K (ShopeePay)
- Mã FMCG100 giảm thẳng 100K đơn từ 500K ngành Bách Hóa (Mọi TT)
⏰ KHUNG 12H:
- 12h: Mã VIDEO50K giảm 50% tối đa 50K đơn từ 99K (ShopeePay)
- 21:00: Mã LIVE80K giảm 20% tối đa 80K đơn từ 150K (SPayLater)`;

const CODE_STOPWORDS = new Set([
  'GIAM',
  'DON',
  'SHOPEE',
  'KHUNG',
  'TOAN',
  'SAN',
  'XTRA',
  'LIVE',
  'VIDEO',
  'FREESHIP',
  'SHOPEEPAY',
  'SPAYLATER',
  'VOUCHER',
  'FLASH',
  'SALE',
  'MALL',
  'NHAP',
  'LUU',
  'NGAY',
  'TRUA',
  'TOI',
  'DEM',
  'SANG',
  'TU',
  'CHO',
  'MOI',
  'NGAN',
  'HANG',
  'HOAN',
  'DINH',
  'THANG',
]);

const RAW_URL_TOKEN_RE =
  /(?:https?:\/\/|shopeevn:\/\/)[^\s"'<>]+|(?<![\w/:.])(?:(?:vn\.)?shp\.ee|s\.shopee\.vn|shope\.ee|shopee\.vn)\/[^\s"'<>]+/gi;

const LABELED_URL_CLAUSE_RE =
  /(?:\s*[|—–;,-]\s*|\s+)(?:(?:link|đường\s*dẫn)\s*(?:lưu\s*|mua\s*|săn\s*)?(?:sp|sản\s*phẩm|mua(?:\s*hàng)?|deal|mã(?:\s*giảm(?:\s*giá)?)?|voucher|kho\s*mã)|lưu\s*(?:sớm\s*)?(?:mã|voucher)(?:\s*tại)?|mua\s*(?:sp|sản\s*phẩm|ngay)(?:\s*tại)?|kho\s*(?:mã|voucher)|claim(?:\s*(?:mã|voucher))?(?:\s*tại)?|voucher\s*tại)\s*[:=-]?\s*(?:(?:https?:\/\/|shopeevn:\/\/)[^\s"'<>]+|(?<![\w/:.])(?:(?:vn\.)?shp\.ee|s\.shopee\.vn|shope\.ee|shopee\.vn)\/[^\s"'<>]+)/giu;

const IMMEDIATE_PRODUCT_LABEL_RE =
  /(?:(?:link|đường\s*dẫn)\s*(?:sp|sản\s*phẩm|mua(?:\s*hàng)?|deal)|mua\s*(?:sp|sản\s*phẩm|ngay)(?:\s*tại)?|(?:^|[\s\-*•👉▶️📌📦🛒:(])(?:sản\s*phẩm|sp))\s*[:=-]?\s*(?:tại\s*)?$/iu;

const STRONG_VOUCHER_LABEL_RE =
  /(?:(?:link|đường\s*dẫn)\s*(?:lưu\s*)?(?:mã|voucher)|lưu\s*(?:sớm\s*)?(?:mã|voucher)|kho\s*(?:mã|voucher)|claim(?:\s*(?:mã|voucher))?|lấy\s*(?:mã|voucher)|nhận\s*(?:mã|voucher)|vào\s*ví\s*voucher)/iu;

const CLAUSE_VOUCHER_LABEL_RE =
  /^(?:[\s\-*•🔥⏰📌⚡👉▶️🎟️🔗]+)?(?:(?:[01]?\d|2[0-3])\s*(?::[0-5]\d|[hgHG](?:[0-5]\d)?)\s*[:\-–—]?\s*)?(?:voucher|mã\s*giảm(?:\s*giá)?)(?:\s+[\p{L}\p{N}%]+){0,3}\s*(?:tại|ở)?\s*[:=-]?\s*$/iu;

const TAIL_VOUCHER_LABEL_RE =
  /(?:voucher|mã\s*giảm(?:\s*giá)?)\s*(?:tại(?:\s*đây)?|ở\s*đây)?\s*[:=-]?\s*$/iu;

const GENERAL_PRODUCT_CUE_RE = /\b(?:link\s*sp|link\s*mua|sản\s*phẩm|mua\s*ngay|deal)\b/iu;

const CONTINUATION_LABEL_PIECE_RE =
  /^(?:(?:link|đường\s*dẫn)\s*(?:lưu\s*|mua\s*|săn\s*)?(?:sp|sản\s*phẩm|hàng|deal|mã(?:\s*giảm(?:\s*giá)?)?|voucher|kho\s*mã)?|(?:lưu|lấy|nhận|săn|claim)\s*(?:sớm\s*)?(?:mã(?:\s*giảm(?:\s*giá)?)?|voucher)?|(?:mua|xem|đặt)\s*(?:ngay|sp|sản\s*phẩm|hàng|deal)?|sp|sản\s*phẩm|kho\s*(?:mã|voucher)|voucher(?:\s*xtra|\s*shopee|\s*live|\s*video)?|mã\s*giảm(?:\s*giá)?)(?:\s*(?:tại(?:\s*đây)?|ở\s*đây|ngay|nhé))?$/iu;

interface ClassifiedDealUrl {
  cleanUrl: string;
  role: 'product' | 'voucher';
  explicit: boolean;
  extractedTitle: string | null;
}

function stripUrlsFromText(text: string): string {
  return text
    .replace(RAW_URL_TOKEN_RE, ' ')
    .replace(/\(\s*\)|\[\s*\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extracts a normalized "HH:MM" slot time from a line (after stripping URLs) if present.
 */
function extractSlotTimeFromText(lineWithoutUrls: string): string | null {
  // 1. Check explicit HH:MM format (e.g. 00:00, 9:00, 12:30, 21:00)
  const colonMatch = /(?:^|[^\d])([01]?\d|2[0-3]):([0-5]\d)(?!\d)/.exec(lineWithoutUrls);
  if (colonMatch) {
    const h = Number(colonMatch[1]);
    const m = Number(colonMatch[2]);
    return `${pad2(h)}:${pad2(m)}`;
  }

  // 2. Check Vietnamese hour shorthand (e.g. "KHUNG 0H", "12h:", "9h30", "21g")
  const hourMatch = /(?:^|[^\p{L}\d])([01]?\d|2[0-3])\s*[hgHG](?:([0-5]\d))?(?=$|[^\p{L}\d])/u.exec(
    lineWithoutUrls,
  );
  if (hourMatch) {
    const h = Number(hourMatch[1]);
    const m = hourMatch[2] ? Number(hourMatch[2]) : 0;
    return `${pad2(h)}:${pad2(m)}`;
  }

  return null;
}

/**
 * Checks whether an uppercase ASCII token is a price/amount token (e.g., 100K, 250K, 0D, 50TR),
 * a time token (e.g., 0H, 12H, 12H30, 21G), or a hardware/volume spec token (e.g., 100W, 256GB, 500ML)
 * rather than a voucher code.
 */
function isPriceOrTimeToken(upperToken: string): boolean {
  // Price tokens: 100K, 250K, 50D, 500VND, 1TR, etc.
  if (/^\d+(?:K|TR|D|VND)$/i.test(upperToken)) {
    return true;
  }
  // Time tokens: 0H, 9H, 12H, 12H00, 21H30, 9G, etc.
  if (/^(?:[01]?\d|2[0-3])[HG](?:[0-5]\d)?(?:P)?$/i.test(upperToken)) {
    return true;
  }
  // Product spec / measurement unit tokens: 100W, 65W, 20000MAH, 256GB, 500ML, 144HZ, 1080P, etc.
  if (
    /^\d+(?:W|KW|MW|MAH|AH|WH|V|KV|A|MA|HZ|KHZ|MHZ|GHZ|GB|TB|MB|KB|ML|L|CL|KG|GR|MG|CM|MM|M|KM|INCH|MP|FPS|DPI|PCS|OZ)$/i.test(
      upperToken,
    ) ||
    /^(?:480|720|1080|1440|2160)P$/i.test(upperToken)
  ) {
    return true;
  }
  // Pure digits: 100, 250, 2026
  if (/^\d+$/.test(upperToken)) {
    return true;
  }
  return false;
}

/**
 * Extracts a Shopee voucher code from a deal line (stripping URLs first so shortlink slugs
 * or -i.shopId.itemId IDs are never misread) while ignoring Vietnamese words, spec units,
 * and price/time tokens like 100K, 250K, 100W, GIAM, DON, SHOPEE.
 */
function extractVoucherCodeFromLine(rawLine: string): string | null {
  const line = stripUrlsFromText(rawLine);
  if (!line) {
    return null;
  }

  // Priority 1: Explicit "Mã <CODE>" / "Nhập mã <CODE>" / "Code: <CODE>" with letter + digit
  const explicitAlnumRe =
    /(?:nhập\s+mã|mã\s+code|mã|code)\s*[:=-]?\s*(?<![\p{L}\p{N}_])([A-Za-z0-9]{4,20})(?![\p{L}\p{N}_])/giu;
  for (const match of line.matchAll(explicitAlnumRe)) {
    const upper = match[1].toUpperCase();
    if (CODE_STOPWORDS.has(upper) || isPriceOrTimeToken(upper)) {
      continue;
    }
    if (/[A-Z]/.test(upper) && /\d/.test(upper)) {
      return upper;
    }
  }

  // Priority 2: Explicit "Mã CODE" / "Code: CODE" with all-uppercase ASCII >= 5 chars not in stopwords
  const explicitUpperRe =
    /(?:nhập\s+mã|Nhập\s+mã|NHẬP\s+MÃ|mã|Mã|MÃ|code|Code|CODE)\s*[:=-]?\s*(?<![\p{L}\p{N}_])([A-Z0-9]{5,20})(?![\p{L}\p{N}_])/gu;
  for (const match of line.matchAll(explicitUpperRe)) {
    const upper = match[1].toUpperCase();
    if (!CODE_STOPWORDS.has(upper) && !isPriceOrTimeToken(upper)) {
      return upper;
    }
  }

  // Priority 3: Standalone uppercase ASCII alphanumeric tokens (not hyphen-attached like WF-1000XM5)
  const standaloneUpperRe = /(?<![\p{L}\p{N}_-])([A-Z0-9]{4,20})(?![\p{L}\p{N}_-])/gu;
  for (const match of line.matchAll(standaloneUpperRe)) {
    const upper = match[1];
    if (CODE_STOPWORDS.has(upper) || isPriceOrTimeToken(upper)) {
      continue;
    }
    if (/[A-Z]/.test(upper) && /\d/.test(upper)) {
      return upper;
    }
  }

  return null;
}

function classifySingleUrl(
  rawUrlToken: string,
  segmentBefore: string,
): ClassifiedDealUrl | null {
  const normalizedToken = /^(?:https?:\/\/|shopeevn:\/\/)/i.test(rawUrlToken)
    ? rawUrlToken
    : `https://${rawUrlToken}`;

  const info = extractShopeeLinkInfo(normalizedToken);
  if (!info.cleanUrl || info.kind === 'cart') {
    return null;
  }

  const contextualInfo = extractShopeeLinkInfo(`${segmentBefore} ${normalizedToken}`);
  const extractedTitle = info.extractedTitle ?? contextualInfo.extractedTitle;

  if (info.kind === 'voucher' || info.kind === 'hub') {
    return {
      cleanUrl: info.cleanUrl,
      role: 'voucher',
      explicit: true,
      extractedTitle,
    };
  }

  if (info.kind === 'product') {
    return {
      cleanUrl: info.cleanUrl,
      role: 'product',
      explicit: true,
      extractedTitle,
    };
  }

  const clauses = segmentBefore
    .split(/[|—–;\n]/)
    .map((c) => c.trim())
    .filter(Boolean);
  const lastClause = clauses.length > 0 ? clauses[clauses.length - 1] : segmentBefore;

  if (IMMEDIATE_PRODUCT_LABEL_RE.test(lastClause)) {
    return {
      cleanUrl: info.cleanUrl,
      role: 'product',
      explicit: true,
      extractedTitle,
    };
  }

  if (
    STRONG_VOUCHER_LABEL_RE.test(lastClause) ||
    CLAUSE_VOUCHER_LABEL_RE.test(lastClause) ||
    TAIL_VOUCHER_LABEL_RE.test(lastClause)
  ) {
    return {
      cleanUrl: info.cleanUrl,
      role: 'voucher',
      explicit: true,
      extractedTitle,
    };
  }

  if (GENERAL_PRODUCT_CUE_RE.test(lastClause)) {
    return {
      cleanUrl: info.cleanUrl,
      role: 'product',
      explicit: true,
      extractedTitle,
    };
  }

  return {
    cleanUrl: info.cleanUrl,
    role: 'product',
    explicit: false,
    extractedTitle,
  };
}

function extractClassifiedUrlsFromLine(rawLine: string): ClassifiedDealUrl[] {
  const extracted: ClassifiedDealUrl[] = [];
  let prevEnd = 0;

  for (const match of rawLine.matchAll(RAW_URL_TOKEN_RE)) {
    const matchIndex = match.index ?? 0;
    const rawToken = match[0];
    const segmentBefore = rawLine.slice(prevEnd, matchIndex);
    prevEnd = matchIndex + rawToken.length;

    const classified = classifySingleUrl(rawToken, segmentBefore);
    if (classified) {
      extracted.push(classified);
    }
  }

  return extracted;
}

function assignClassifiedUrls(
  target: { productUrl?: string; voucherUrl?: string },
  urls: ClassifiedDealUrl[],
): void {
  for (const item of urls) {
    if (item.role === 'voucher') {
      if (!target.voucherUrl) {
        target.voucherUrl = item.cleanUrl;
      } else if (!item.explicit && !target.productUrl) {
        target.productUrl = item.cleanUrl;
      }
    } else {
      if (!target.productUrl) {
        target.productUrl = item.cleanUrl;
      } else if (!item.explicit && !target.voucherUrl) {
        target.voucherUrl = item.cleanUrl;
      }
    }
  }
}

function isContinuationLabelOrBareUrl(rawLine: string): boolean {
  const withoutUrls = stripUrlsFromText(rawLine);
  if (!withoutUrls) {
    return true;
  }

  const pieces = withoutUrls
    .split(/[|—–;]/)
    .map((piece) =>
      piece
        .replace(/^[\s\-*•🔥⏰📌⚡👉▶️🎟️📦🛒🔗+]+/u, '')
        .replace(/[\s:=-]+$/u, '')
        .trim(),
    )
    .filter(Boolean);

  if (pieces.length === 0) {
    return true;
  }

  return pieces.every((piece) => CONTINUATION_LABEL_PIECE_RE.test(piece));
}

function extractPaymentMethod(line: string): string {
  const hasShopeePay = /shopeepay|ví\s*spp|airpay/i.test(line);
  const hasSPayLater = /spaylater/i.test(line);

  if (hasShopeePay && hasSPayLater) {
    return 'ShopeePay / SPayLater';
  }
  if (hasShopeePay) {
    return 'ShopeePay';
  }
  if (hasSPayLater) {
    return 'SPayLater';
  }
  if (/thẻ\s*tín\s*dụng|visa|mastercard|jcb|ngân\s*hàng/i.test(line)) {
    return 'Thẻ ngân hàng';
  }
  return 'Mọi TT';
}

function stripUrlsAndLinkLabels(rawLine: string): string {
  let text = rawLine.replace(LABELED_URL_CLAUSE_RE, ' ');
  text = stripUrlsFromText(text);
  // Strip any leftover leading/trailing link label fragments or separators
  text = text
    .replace(
      /(?:\s*[|—–;-]\s*)(?:(?:link|đường\s*dẫn)\s*(?:lưu\s*)?(?:sp|sản\s*phẩm|mua|mã|voucher)|lưu\s*(?:mã|voucher)(?:\s*tại)?|mua\s*(?:sp|ngay)(?:\s*tại)?|kho\s*mã|claim)\s*[:=-]?\s*$/iu,
      '',
    )
    .replace(/[\s|—–;,-]+$/u, '')
    .replace(/\s+/g, ' ')
    .trim();
  return text;
}

function stripLeadingPrefixAndSlot(line: string): string {
  return line
    .replace(/^[\s\-*•🔥⏰📌⚡👉▶️🎧🎟️📦🛒🔗]+/u, '')
    .replace(
      /^(?:khung(?:\s*giờ)?\s*)?(?:[01]?\d|2[0-3])\s*(?::[0-5]\d|[hgHG](?:[0-5]\d)?)(?:\s*(?:sáng|trưa|chiều|tối|đêm))?\s*[:\-–—]?\s*/iu,
      '',
    )
    .trim();
}

function capitalizeFirst(text: string): string {
  if (!text) return '';
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function extractDiscountNote(rawLine: string, voucherCode: string, hasUrls = false): string {
  const baseLine = hasUrls ? stripUrlsAndLinkLabels(rawLine) : rawLine;

  // Remove leading bullet/time prefix and extract the human-readable condition summary
  let cleaned = stripLeadingPrefixAndSlot(baseLine);

  if (voucherCode) {
    // Remove the leading "Mã <CODE>" prefix if present so voucherNote focuses on discount & min-spend
    const codePattern = new RegExp(
      `^(?:nhập\\s+mã|mã|code|voucher)?\\s*[:=-]?\\s*${voucherCode}\\s*[:\\-–]?\\s*`,
      'iu',
    );
    cleaned = cleaned.replace(codePattern, '').trim();
  }

  if (!cleaned) {
    return (hasUrls ? baseLine : rawLine).trim();
  }
  return capitalizeFirst(cleaned);
}

function buildCodeDealTitleAndNote(
  rawLine: string,
  voucherCode: string,
  hasUrls: boolean,
  headline: string | null,
): { title: string; voucherNote: string } {
  const lineNote = extractDiscountNote(rawLine, voucherCode, hasUrls);

  let voucherNote = lineNote;
  if (headline) {
    const cleanHead = capitalizeFirst(headline);
    const strippedLineNote = lineNote.replace(/^[\s•\-–—:]+/u, '').trim();
    const isJustCodeEcho =
      !strippedLineNote ||
      new RegExp(`^(?:mã|code)?\\s*[:=-]?\\s*${voucherCode}$`, 'iu').test(strippedLineNote);
    if (isJustCodeEcho) {
      voucherNote = cleanHead;
    } else if (strippedLineNote.startsWith('(')) {
      voucherNote = `${cleanHead} ${strippedLineNote}`;
    } else {
      voucherNote = `${cleanHead} • ${strippedLineNote}`;
    }
  }

  let summaryWithoutPayment = voucherNote.replace(/\s*\([^)]*\)\s*$/, '').trim();
  if (voucherCode) {
    const inlineCodeRe = new RegExp(
      `\\s*(?:nhập\\s+mã|mã|code)\\s*[:=-]?\\s*${voucherCode}\\b`,
      'giu',
    );
    summaryWithoutPayment = summaryWithoutPayment
      .replace(inlineCodeRe, '')
      .replace(/[\s•\-–—:|]+$/u, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  const title = summaryWithoutPayment
    ? `Mã ${voucherCode} — ${capitalizeFirst(summaryWithoutPayment)}`
    : `Săn mã ${voucherCode}`;

  return { title, voucherNote };
}

function buildLinkOnlyTitleAndNote(
  rawLine: string,
  slotTime: string,
  urls: ClassifiedDealUrl[],
  links: { productUrl?: string; voucherUrl?: string },
  headline: string | null,
): { title: string; voucherNote: string } {
  const cleanedLineText = stripLeadingPrefixAndSlot(stripUrlsAndLinkLabels(rawLine))
    .replace(/(?:^|\s+)(?:hãy\s+)?(?:mua\s+ngay|xem\s+ngay|săn\s+ngay)\s+trên\s+shopee.*$/iu, '')
    .replace(/^(?:(?:link|đường\s*dẫn)\s*(?:lưu\s*)?(?:sp|sản\s*phẩm|mua|mã|voucher)|lưu\s*(?:mã|voucher)|kho\s*mã|claim)\s*[:=-]?\s*$/iu, '')
    .trim();

  const bestExtractedTitle =
    urls.find((u) => u.role === 'product' && u.extractedTitle)?.extractedTitle ??
    urls.find((u) => u.extractedTitle)?.extractedTitle ??
    null;

  const isShareBoilerplate = /(?:mua\s+ngay|xem\s+ngay|săn\s+ngay)\s+trên\s+shopee|với\s+giá\s+chỉ/iu.test(
    rawLine,
  );

  let title = '';
  if (headline) {
    title = capitalizeFirst(headline);
  } else if (isShareBoilerplate && bestExtractedTitle) {
    title = capitalizeFirst(bestExtractedTitle);
  } else if (cleanedLineText) {
    title = capitalizeFirst(cleanedLineText.replace(/\s*\([^)]*\)\s*$/, '').trim() || cleanedLineText);
  } else if (bestExtractedTitle) {
    title = capitalizeFirst(bestExtractedTitle);
  } else if (links.productUrl && links.voucherUrl) {
    title = `Combo Sản phẩm & Voucher (${slotTime})`;
  } else if (links.productUrl) {
    title = `Deal sản phẩm theo link (${slotTime})`;
  } else {
    title = `Lưu voucher theo link (${slotTime})`;
  }

  let voucherNote = '';
  if (headline && cleanedLineText && cleanedLineText.toLowerCase() !== headline.toLowerCase()) {
    voucherNote = `${capitalizeFirst(headline)} • ${capitalizeFirst(cleanedLineText)}`;
  } else if (cleanedLineText) {
    voucherNote = capitalizeFirst(cleanedLineText);
  } else if (headline) {
    voucherNote = capitalizeFirst(headline);
  } else if (bestExtractedTitle) {
    voucherNote = `Săn trực tiếp qua link Shopee: ${capitalizeFirst(bestExtractedTitle)}`;
  } else if (links.productUrl && links.voucherUrl) {
    voucherNote = 'Mở trực tiếp link sản phẩm & lưu voucher đi kèm';
  } else if (links.productUrl) {
    voucherNote = 'Mở trực tiếp link sản phẩm Shopee';
  } else {
    voucherNote = 'Mở trực tiếp trạm lưu voucher Shopee';
  }

  return { title, voucherNote };
}

/**
 * Parses multi-line Vietnamese deal group posts (Zalo / Telegram / Facebook)
 * into structured `ParsedDealCandidate[]` items ready to add to the Runbook.
 * Supports text voucher codes, paired `[productUrl + voucherUrl]` combos,
 * multi-line grouped blocks, and link-only deals (`voucherCode: ''`).
 */
export function parseDealTextPaste(rawText: string): ParsedDealCandidate[] {
  if (!rawText || typeof rawText !== 'string') {
    return [];
  }

  const lines = rawText.split(/\r?\n/);
  const results: ParsedDealCandidate[] = [];
  let activeSlotTime = '00:00';
  let pendingHeadline: string | null = null;
  let canAttachContinuation = false;
  let lastDealFromHeadline = false;
  let lastDealHeadline: string | null = null;

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i].trim();
    if (!rawLine) {
      pendingHeadline = null;
      canAttachContinuation = false;
      lastDealFromHeadline = false;
      continue;
    }

    const urls = extractClassifiedUrlsFromLine(rawLine);
    const lineWithoutUrls = stripUrlsFromText(rawLine);
    const lineSlotTime = extractSlotTimeFromText(lineWithoutUrls);
    const voucherCode = extractVoucherCodeFromLine(rawLine);

    // Case 1: Line has NO voucher code and NO URLs
    if (voucherCode === null && urls.length === 0) {
      if (lineSlotTime !== null) {
        activeSlotTime = lineSlotTime;
        const startsWithKhung = /^[\s\-*•🔥⏰📌⚡👉▶️]*khung\b/iu.test(lineWithoutUrls);
        const remainder = startsWithKhung ? '' : stripLeadingPrefixAndSlot(lineWithoutUrls);
        pendingHeadline = remainder.length > 0 ? remainder : null;
        canAttachContinuation = false;
        lastDealFromHeadline = false;
        continue;
      }

      // Sub-bullet note inside an active deal block (e.g. "- Đơn từ 200K, ShopeePay"):
      // keep continuation attachment alive and capture payment hint if still default.
      const isBulletLine = /^[\s]*[\-*•👉▶️📌]/u.test(rawLine);
      if (canAttachContinuation && isBulletLine && results.length > 0) {
        const lastDeal = results[results.length - 1];
        const notePayment = extractPaymentMethod(lineWithoutUrls);
        if (lastDeal.paymentMethod === 'Mọi TT' && notePayment !== 'Mọi TT') {
          lastDeal.paymentMethod = notePayment;
        }
        continue;
      }

      // Standalone non-bullet headline before indented/bulleted sub-lines
      const isAllCapsBanner =
        lineWithoutUrls.length > 15 && lineWithoutUrls === lineWithoutUrls.toUpperCase();
      if (!isBulletLine && !isAllCapsBanner && /\p{L}/u.test(lineWithoutUrls)) {
        pendingHeadline = stripLeadingPrefixAndSlot(lineWithoutUrls) || null;
        canAttachContinuation = false;
        lastDealFromHeadline = false;
      }
      continue;
    }

    // Case 2: Continuation line attaching URLs onto the immediately preceding deal
    if (
      canAttachContinuation &&
      results.length > 0 &&
      urls.length > 0 &&
      lineSlotTime === null
    ) {
      const lastDeal = results[results.length - 1];
      const hasNoConflictingCode =
        voucherCode === null || voucherCode === lastDeal.voucherCode;

      if (hasNoConflictingCode) {
        const updatedLinks = {
          productUrl: lastDeal.productUrl,
          voucherUrl: lastDeal.voucherUrl,
        };
        assignClassifiedUrls(updatedLinks, urls);
        const actuallyAddedNewLink =
          updatedLinks.productUrl !== lastDeal.productUrl ||
          updatedLinks.voucherUrl !== lastDeal.voucherUrl;

        const isLabelOrBare = isContinuationLabelOrBareUrl(rawLine);
        const attachesToCodeOnlyDeal =
          lastDeal.voucherCode !== '' && !lastDeal.productUrl && !lastDeal.voucherUrl;

        if (
          actuallyAddedNewLink &&
          (isLabelOrBare || lastDealFromHeadline || attachesToCodeOnlyDeal)
        ) {
          if (updatedLinks.productUrl) lastDeal.productUrl = updatedLinks.productUrl;
          if (updatedLinks.voucherUrl) lastDeal.voucherUrl = updatedLinks.voucherUrl;

          const contPayment = extractPaymentMethod(lineWithoutUrls);
          if (lastDeal.paymentMethod === 'Mọi TT' && contPayment !== 'Mọi TT') {
            lastDeal.paymentMethod = contPayment;
          }

          // Upgrade generic fallback link-only title if product slug provided a real title
          const slugTitle = urls.find((u) => u.extractedTitle)?.extractedTitle;
          if (
            slugTitle &&
            lastDeal.voucherCode === '' &&
            /^(?:Deal sản phẩm|Combo Sản phẩm|Lưu voucher) theo link/u.test(lastDeal.title)
          ) {
            lastDeal.title = capitalizeFirst(slugTitle);
          }

          lastDeal.rawLine = `${lastDeal.rawLine}\n${rawLine}`;
          continue;
        }
      }
    }

    // Case 3: Headline block where Link SP appeared before "- Mã: CODE"
    if (
      canAttachContinuation &&
      lastDealFromHeadline &&
      results.length > 0 &&
      voucherCode !== null &&
      lineSlotTime === null
    ) {
      const lastDeal = results[results.length - 1];
      const hasConflictingProduct =
        Boolean(lastDeal.productUrl) && urls.some((u) => u.role === 'product' && u.explicit);
      if (lastDeal.voucherCode === '' && !hasConflictingProduct) {
        lastDeal.voucherCode = voucherCode;
        lastDeal.id = `parsed-deal-${results.length}-${voucherCode.toLowerCase()}`;

        const updatedLinks = {
          productUrl: lastDeal.productUrl,
          voucherUrl: lastDeal.voucherUrl,
        };
        assignClassifiedUrls(updatedLinks, urls);
        if (updatedLinks.productUrl) lastDeal.productUrl = updatedLinks.productUrl;
        if (updatedLinks.voucherUrl) lastDeal.voucherUrl = updatedLinks.voucherUrl;

        const codePayment = extractPaymentMethod(lineWithoutUrls);
        if (codePayment !== 'Mọi TT') {
          lastDeal.paymentMethod = codePayment;
        }

        const { title, voucherNote } = buildCodeDealTitleAndNote(
          rawLine,
          voucherCode,
          urls.length > 0,
          lastDealHeadline,
        );
        lastDeal.title = title;
        lastDeal.voucherNote = voucherNote;
        lastDeal.rawLine = `${lastDeal.rawLine}\n${rawLine}`;
        continue;
      }
    }

    // Case 4: Create a new ParsedDealCandidate (code deal, combo deal, or link-only deal)
    const slotTime = lineSlotTime ?? activeSlotTime;
    if (lineSlotTime !== null) {
      activeSlotTime = lineSlotTime;
    }

    const isBulletSubLine = /^[\s]*[\-*•👉▶️📌🎟️📦🛒🔗]/u.test(rawLine);
    const consumedHeadline =
      pendingHeadline && (isBulletSubLine || lineSlotTime === null) ? pendingHeadline : null;
    pendingHeadline = null;

    const links: { productUrl?: string; voucherUrl?: string } = {};
    assignClassifiedUrls(links, urls);

    const paymentMethod = extractPaymentMethod(
      consumedHeadline ? `${consumedHeadline} ${lineWithoutUrls}` : lineWithoutUrls,
    );

    const effectiveCode = voucherCode ?? '';
    const { title, voucherNote } = effectiveCode
      ? buildCodeDealTitleAndNote(rawLine, effectiveCode, urls.length > 0, consumedHeadline)
      : buildLinkOnlyTitleAndNote(rawLine, slotTime, urls, links, consumedHeadline);

    const idSuffix = effectiveCode ? effectiveCode.toLowerCase() : 'link';
    const candidate: ParsedDealCandidate = {
      id: `parsed-deal-${results.length + 1}-${idSuffix}`,
      slotTime,
      voucherCode: effectiveCode,
      title,
      voucherNote,
      paymentMethod,
      rawLine,
      ...(links.productUrl ? { productUrl: links.productUrl } : {}),
      ...(links.voucherUrl ? { voucherUrl: links.voucherUrl } : {}),
    };

    results.push(candidate);
    canAttachContinuation = true;
    lastDealFromHeadline = consumedHeadline !== null;
    lastDealHeadline = consumedHeadline;
  }

  return results;
}

/**
 * Computes the discount in VND for a `ChannelVoucherSpec` against a given base amount.
 */
function computeChannelSpecDiscount(baseAmountVnd: number, spec: ChannelVoucherSpec | null): number {
  if (!spec || baseAmountVnd <= 0 || baseAmountVnd < spec.minSpendVnd || spec.discountValue <= 0) {
    return 0;
  }

  const raw =
    spec.discountType === 'flat'
      ? Math.floor(spec.discountValue)
      : Math.floor((baseAmountVnd * spec.discountValue) / 100);

  const capped =
    spec.maxDiscountVnd !== undefined && spec.maxDiscountVnd >= 0
      ? Math.min(raw, Math.floor(spec.maxDiscountVnd))
      : raw;

  return Math.max(0, Math.min(capped, Math.floor(baseAmountVnd)));
}

export const DEFAULT_STACK_INPUT: ChannelStackInput = {
  itemPriceVnd: 300_000,
  shopVoucher: {
    label: 'Mã Shop giảm 20K (đơn từ 200K)',
    discountType: 'flat',
    discountValue: 20_000,
    maxDiscountVnd: 20_000,
    minSpendVnd: 200_000,
  },
  normalVoucher: {
    label: 'Voucher Xtra 15% tối đa 40K (đơn từ 250K)',
    discountType: 'percent',
    discountValue: 15,
    maxDiscountVnd: 40_000,
    minSpendVnd: 250_000,
  },
  videoVoucher: {
    label: 'Mã Shopee Video 25% tối đa 70K (đơn từ 200K)',
    discountType: 'percent',
    discountValue: 25,
    maxDiscountVnd: 70_000,
    minSpendVnd: 200_000,
  },
  liveVoucher: {
    label: 'Mã Shopee Live 20% tối đa 60K (đơn từ 200K)',
    discountType: 'percent',
    discountValue: 20,
    maxDiscountVnd: 60_000,
    minSpendVnd: 200_000,
  },
  shippingFeeVnd: 30_000,
  freeshipCapVnd: 30_000,
  coinsVnd: 10_000,
  paymentDiscountVnd: 15_000,
};

const CHANNEL_META: Record<
  ShoppingChannel,
  { label: string; baseGuide: string }
> = {
  normal: {
    label: 'Giỏ Hàng Thường (Mã Sàn / Xtra)',
    baseGuide:
      'Bước 1: Lưu Mã Shop & Mã Toàn Sàn/Xtra → Bước 2: Tick món từ Giỏ hàng thường → Bước 3: Áp đồng thời Mã Shop + Mã Sàn + Freeship + Xu ở màn Thanh toán.',
  },
  video: {
    label: 'Kênh Shopee Video (Giỏ Vàng)',
    baseGuide:
      'Bước 1: Mở Shopee Video của Shop/KOL có gắn sản phẩm → Bước 2: Bấm Thêm vào giỏ từ biểu tượng Giỏ vàng trên Video → Bước 3: Ra Giỏ hàng (có nhãn Video) áp Mã Shop + Mã Video + Freeship.',
  },
  live: {
    label: 'Kênh Shopee Live (Giỏ Cam)',
    baseGuide:
      'Bước 1: Vào phiên Livestream đang gắn sản phẩm → Bước 2: Thêm sản phẩm trực tiếp từ Giỏ cam Live → Bước 3: Ra Giỏ hàng (có nhãn Live) áp Mã Shop + Mã Live + Freeship.',
  },
};

function evaluateSingleChannel(
  channel: ShoppingChannel,
  channelVoucher: ChannelVoucherSpec | null,
  input: ChannelStackInput,
): EvaluatedChannelStack {
  const itemPriceVnd = Math.max(0, Math.floor(input.itemPriceVnd || 0));
  const shippingFeeVnd = Math.max(0, Math.floor(input.shippingFeeVnd || 0));
  const freeshipCapVnd = Math.max(0, Math.floor(input.freeshipCapVnd || 0));
  const rawCoinsVnd = Math.max(0, Math.floor(input.coinsVnd || 0));
  const rawPaymentDiscountVnd = Math.max(0, Math.floor(input.paymentDiscountVnd || 0));

  // Layer 1: Shop Voucher deducts from itemPriceVnd -> afterShopVnd
  const shopDiscountVnd = computeChannelSpecDiscount(itemPriceVnd, input.shopVoucher);
  const afterShopVnd = Math.max(0, itemPriceVnd - shopDiscountVnd);

  // Layer 2: Platform / Video / Live Voucher checks afterShopVnd >= minSpendVnd
  let platformEligible = false;
  let platformShortfallVnd = 0;
  let platformDiscountVnd = 0;

  if (channelVoucher !== null) {
    if (afterShopVnd >= channelVoucher.minSpendVnd && afterShopVnd > 0) {
      platformEligible = true;
      platformShortfallVnd = 0;
      platformDiscountVnd = computeChannelSpecDiscount(afterShopVnd, channelVoucher);
    } else {
      platformEligible = false;
      platformShortfallVnd = Math.max(0, channelVoucher.minSpendVnd - afterShopVnd);
      platformDiscountVnd = 0;
    }
  }

  // Layer 3: Shipping net + Coins + Payment Discount
  const shippingNetVnd = Math.max(0, shippingFeeVnd - freeshipCapVnd);
  const subtotalBeforeCoinsAndPayment = Math.max(0, afterShopVnd - platformDiscountVnd) + shippingNetVnd;

  const coinsUsedVnd = Math.min(rawCoinsVnd, subtotalBeforeCoinsAndPayment);
  const paymentDiscountVnd = Math.min(
    rawPaymentDiscountVnd,
    Math.max(0, subtotalBeforeCoinsAndPayment - coinsUsedVnd),
  );

  const finalPayableVnd = Math.max(
    0,
    afterShopVnd - platformDiscountVnd + shippingNetVnd - coinsUsedVnd - paymentDiscountVnd,
  );

  const baselineTotalVnd = itemPriceVnd + shippingFeeVnd;
  const totalSavedVnd = Math.max(0, baselineTotalVnd - finalPayableVnd);

  const meta = CHANNEL_META[channel];
  let actionGuide = meta.baseGuide;

  if (channelVoucher !== null && !platformEligible && platformShortfallVnd > 0) {
    const trappedByShopVoucher =
      itemPriceVnd >= channelVoucher.minSpendVnd && afterShopVnd < channelVoucher.minSpendVnd;
    if (trappedByShopVoucher) {
      actionGuide = `⚠️ Bẫy đơn tối thiểu Shopee: Giá gốc ${formatVnd(itemPriceVnd)} đủ điều kiện, nhưng sau khi trừ Mã Shop (${formatVnd(shopDiscountVnd)}) còn ${formatVnd(afterShopVnd)} — bị thiếu ${formatVnd(platformShortfallVnd)} để áp ${channelVoucher.label}. Hãy mua kèm món phụ >= ${formatVnd(platformShortfallVnd)} hoặc bỏ chọn Mã Shop!`;
    } else {
      actionGuide = `⚠️ Chưa đủ đơn tối thiểu: Còn thiếu ${formatVnd(platformShortfallVnd)} (sau trừ Mã Shop còn ${formatVnd(afterShopVnd)}) để áp ${channelVoucher.label}. ${meta.baseGuide}`;
    }
  }

  return {
    channel,
    channelLabel: meta.label,
    itemPriceVnd,
    shopDiscountVnd,
    afterShopVnd,
    platformDiscountVnd,
    platformEligible,
    platformShortfallVnd,
    shippingNetVnd,
    coinsUsedVnd,
    paymentDiscountVnd,
    finalPayableVnd,
    totalSavedVnd,
    actionGuide,
  };
}

/**
 * Models real Shopee 3-layer voucher stacking across Normal, Shopee Video, and Shopee Live channels:
 * (1) Shop voucher deducts from `itemPriceVnd` -> `afterShopVnd`;
 * (2) Platform/Video/Live voucher checks `afterShopVnd >= minSpendVnd` (flagging `platformEligible`
 *     and `platformShortfallVnd` if Shop voucher dropped `afterShopVnd` below platform `minSpendVnd`);
 * (3) Adds net shipping `Math.max(0, shippingFeeVnd - freeshipCapVnd)` and subtracts `coinsVnd` + `paymentDiscountVnd`.
 */
export function compareChannelStacks(input: ChannelStackInput): ChannelStackComparison {
  const normalEval = evaluateSingleChannel('normal', input.normalVoucher, input);
  const videoEval = evaluateSingleChannel('video', input.videoVoucher, input);
  const liveEval = evaluateSingleChannel('live', input.liveVoucher, input);

  const evaluations: EvaluatedChannelStack[] = [normalEval, videoEval, liveEval];

  let bestEval = normalEval;
  for (const candidate of evaluations) {
    if (candidate.finalPayableVnd < bestEval.finalPayableVnd) {
      bestEval = candidate;
    }
  }

  const extraSavedVsNormalVnd = Math.max(0, normalEval.finalPayableVnd - bestEval.finalPayableVnd);

  let summaryTip: string;
  if (bestEval.channel === 'normal' || extraSavedVsNormalVnd === 0) {
    summaryTip = `Mua tại ${normalEval.channelLabel} đang tối ưu nhất: thanh toán ${formatVnd(normalEval.finalPayableVnd)} (tiết kiệm tổng ${formatVnd(normalEval.totalSavedVnd)}).`;
  } else {
    summaryTip = `Chuyển sang ${bestEval.channelLabel} giúp trả ít hơn Giỏ thường ${formatVnd(extraSavedVsNormalVnd)} (chỉ còn ${formatVnd(bestEval.finalPayableVnd)}, tiết kiệm tổng ${formatVnd(bestEval.totalSavedVnd)}).`;
  }

  return {
    evaluations,
    bestChannel: bestEval.channel,
    extraSavedVsNormalVnd,
    summaryTip,
  };
}

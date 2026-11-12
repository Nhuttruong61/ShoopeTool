import { describe, expect, it } from 'vitest';
import {
  DEFAULT_STACK_INPUT,
  OFFICIAL_VOUCHER_HUBS,
  SAMPLE_DEAL_PASTE_TEXT,
  compareChannelStacks,
  getUpcomingSaleRadar,
  parseDealTextPaste,
} from '../src/lib/yearRoundDeals';
import type { ChannelStackInput } from '../src/types/contracts';

describe('getUpcomingSaleRadar (Year-Round 365 Sale Radar in UTC+7)', () => {
  it('computes 5 upcoming events sorted by daysAway ascending on Nov 11, 2026 (VN time)', () => {
    // 2026-11-11 10:00:00 UTC+7 = 2026-11-11 03:00:00 UTC (Wednesday!)
    const nov11VnMs = Date.UTC(2026, 10, 11, 3, 0, 0);
    const radar = getUpcomingSaleRadar(nov11VnMs);

    expect(radar).toHaveLength(5);

    // Sorted by daysAway ascending
    for (let i = 1; i < radar.length; i++) {
      expect(radar[i].daysAway).toBeGreaterThanOrEqual(radar[i - 1].daysAway);
    }

    const daily = radar.find((e) => e.type === 'daily-restock')!;
    const doubleDay = radar.find((e) => e.type === 'double-day')!;
    const wednesday = radar.find((e) => e.type === 'wednesday-freeship')!;
    const midMonth = radar.find((e) => e.type === 'mid-month')!;
    const payday = radar.find((e) => e.type === 'payday')!;

    expect(daily.daysAway).toBe(0);
    expect(daily.peakSlots).toEqual(['00:00', '09:00', '12:00', '18:00', '21:00']);

    // On 11/11 itself, Double Day 11/11 is 0 days away
    expect(doubleDay.daysAway).toBe(0);
    expect(doubleDay.dateLabel).toBe('11/11/2026');
    expect(doubleDay.title).toContain('11/11');

    // Nov 11, 2026 is a Wednesday -> 0 days away
    expect(wednesday.daysAway).toBe(0);
    expect(wednesday.dateLabel).toContain('11/11');

    // Mid-month 15/11 is 4 days away
    expect(midMonth.daysAway).toBe(4);
    expect(midMonth.dateLabel).toBe('15/11/2026');

    // Payday 25/11 is 14 days away
    expect(payday.daysAway).toBe(14);
    expect(payday.dateLabel).toBe('25/11/2026');
  });

  it('rolls Double Day from Dec 13+ cleanly to 01/01 of next year and rolls 15/MM & 25/MM across months', () => {
    // 2026-12-26 01:30:00 UTC+7 = 2026-12-25 18:30:00 UTC
    // Note: in UTC it is still Dec 25, but in Vietnam (UTC+7) it is already Dec 26!
    const dec26VnMs = Date.UTC(2026, 11, 25, 18, 30, 0);
    const radar = getUpcomingSaleRadar(dec26VnMs);

    const doubleDay = radar.find((e) => e.type === 'double-day')!;
    const midMonth = radar.find((e) => e.type === 'mid-month')!;
    const payday = radar.find((e) => e.type === 'payday')!;

    // Dec 26 -> Jan 1, 2027 is 6 days away
    expect(doubleDay.dateLabel).toBe('01/01/2027');
    expect(doubleDay.title).toContain('1/1');
    expect(doubleDay.daysAway).toBe(6);

    // Dec 26 -> Jan 15, 2027 is 20 days away
    expect(midMonth.dateLabel).toBe('15/01/2027');
    expect(midMonth.daysAway).toBe(20);

    // Dec 26 -> Jan 25, 2027 is 30 days away
    expect(payday.dateLabel).toBe('25/01/2027');
    expect(payday.daysAway).toBe(30);
  });

  it('advances Double Day to next month when current day > current month (e.g. Nov 12 -> 12/12)', () => {
    // 2026-11-12 08:00:00 UTC+7 = 2026-11-12 01:00:00 UTC (Thursday)
    const nov12VnMs = Date.UTC(2026, 10, 12, 1, 0, 0);
    const radar = getUpcomingSaleRadar(nov12VnMs);

    const doubleDay = radar.find((e) => e.type === 'double-day')!;
    const wednesday = radar.find((e) => e.type === 'wednesday-freeship')!;

    expect(doubleDay.dateLabel).toBe('12/12/2026');
    expect(doubleDay.daysAway).toBe(30);
    // Thursday -> next Wednesday is 6 days away (18/11)
    expect(wednesday.daysAway).toBe(6);
    expect(wednesday.dateLabel).toContain('18/11');
  });
});

describe('OFFICIAL_VOUCHER_HUBS (1-Tap Official Collection Shortcuts)', () => {
  it('exposes 8 official https://shopee.vn/m/... shortcuts covering all 4 categories', () => {
    expect(OFFICIAL_VOUCHER_HUBS).toHaveLength(8);

    const categories = new Set(OFFICIAL_VOUCHER_HUBS.map((h) => h.category));
    expect(categories).toEqual(new Set(['platform', 'video-live', 'freeship', 'payment-vip']));

    for (const hub of OFFICIAL_VOUCHER_HUBS) {
      expect(hub.webUrl.startsWith('https://shopee.vn/m/')).toBe(true);
      expect(hub.title.length).toBeGreaterThan(3);
      expect(hub.bestTimeHint.length).toBeGreaterThan(3);
    }
  });
});

describe('parseDealTextPaste (Smart Paste Deal Parser for Zalo/Telegram/FB)', () => {
  it('parses SAMPLE_DEAL_PASTE_TEXT with section headers and inline slot times', () => {
    const parsed = parseDealTextPaste(SAMPLE_DEAL_PASTE_TEXT);

    expect(parsed).toHaveLength(4);

    expect(parsed[0]).toMatchObject({
      slotTime: '00:00',
      voucherCode: 'AFF1122',
      paymentMethod: 'ShopeePay',
    });
    expect(parsed[0].voucherNote).toContain('25%');

    expect(parsed[1]).toMatchObject({
      slotTime: '00:00',
      voucherCode: 'FMCG100',
      paymentMethod: 'Mọi TT',
    });

    expect(parsed[2]).toMatchObject({
      slotTime: '12:00',
      voucherCode: 'VIDEO50K',
      paymentMethod: 'ShopeePay',
    });

    expect(parsed[3]).toMatchObject({
      slotTime: '21:00',
      voucherCode: 'LIVE80K',
      paymentMethod: 'SPayLater',
    });
  });

  it('ignores Vietnamese words and price tokens (100K, 250K, GIAM, DON, SHOPEE) when finding voucher codes', () => {
    const noisyPost = `
      📢 TỔNG HỢP DEAL SHOPEE HÔM NAY GIAM 100K DON 250K
      🔥 KHUNG 9H SÁNG:
      • Đơn 250K GIAM 100K nhập mã COSM99K áp ngành Mỹ Phẩm (Ví ShopeePay)
      • 15h30: GIAM 50K DON 200K mã XTRA15H50 thanh toán SPayLater
      • Dòng không có mã chỉ ghi giảm 100K đơn 250K SHOPEE LIVE VIDEO
    `;

    const parsed = parseDealTextPaste(noisyPost);
    expect(parsed).toHaveLength(2);

    expect(parsed[0].slotTime).toBe('09:00');
    expect(parsed[0].voucherCode).toBe('COSM99K');
    expect(parsed[0].paymentMethod).toBe('ShopeePay');

    expect(parsed[1].slotTime).toBe('15:30');
    expect(parsed[1].voucherCode).toBe('XTRA15H50');
    expect(parsed[1].paymentMethod).toBe('SPayLater');
  });

  it('returns empty array on blank or non-deal text', () => {
    expect(parseDealTextPaste('')).toEqual([]);
    expect(parseDealTextPaste('   \n  🔥 KHUNG 0H: \n  Chúc các bạn ngủ ngon! ')).toEqual([]);
  });

  it('parses single-line paired combos [productUrl + voucherUrl + voucherCode] in any label order', () => {
    const singleLine =
      '12:00: Săn Tai nghe Sony giảm 50% mã AFFSONY50 mua SP: https://vn.shp.ee/Sp123 | Lưu mã: https://s.shopee.vn/Vc456 (ShopeePay)';

    const parsed = parseDealTextPaste(singleLine);
    expect(parsed).toHaveLength(1);
    expect(parsed[0]).toMatchObject({
      slotTime: '12:00',
      voucherCode: 'AFFSONY50',
      productUrl: 'https://vn.shp.ee/Sp123',
      voucherUrl: 'https://s.shopee.vn/Vc456',
      paymentMethod: 'ShopeePay',
    });
    expect(parsed[0].title).toContain('AFFSONY50');
    expect(parsed[0].title).toContain('Tai nghe Sony');

    // Reversed URL order (voucher link first, product link second) + unlabeled second URL fallback
    const reversedAndUnlabeled = `
      09:00: Lưu mã trước: https://s.shopee.vn/Claim9H | Mua SP Bàn phím cơ mã KEY9H50: https://vn.shp.ee/Key999
      15:00: Chuột Logitech giảm 30% mã LOGI30K https://vn.shp.ee/LogiSp1 https://s.shopee.vn/LogiVc2
    `;
    const multiSingle = parseDealTextPaste(reversedAndUnlabeled);
    expect(multiSingle).toHaveLength(2);
    expect(multiSingle[0]).toMatchObject({
      slotTime: '09:00',
      voucherCode: 'KEY9H50',
      productUrl: 'https://vn.shp.ee/Key999',
      voucherUrl: 'https://s.shopee.vn/Claim9H',
    });
    expect(multiSingle[1]).toMatchObject({
      slotTime: '15:00',
      voucherCode: 'LOGI30K',
      productUrl: 'https://vn.shp.ee/LogiSp1',
      voucherUrl: 'https://s.shopee.vn/LogiVc2',
    });
  });

  it('merges multi-line grouped combo blocks and continuation link lines onto a single ParsedDealCandidate', () => {
    const multiLineBlock = `
🔥 12h: Tai nghe Bluetooth ANC giảm 50%
- Mã: AFFSONY50 (đơn từ 200K, ShopeePay)
- Link SP: https://vn.shp.ee/Sp123
- Link lưu mã: https://s.shopee.vn/Vc456

⏰ 18h: Sạc dự phòng Anker 20000mAh
- Link SP: https://vn.shp.ee/AnkerSp88
- Mã: ANKER18H (SPayLater)
👉 https://shopee.vn/m/voucher-xtra
    `;

    const parsed = parseDealTextPaste(multiLineBlock);
    expect(parsed).toHaveLength(2);

    expect(parsed[0]).toMatchObject({
      slotTime: '12:00',
      voucherCode: 'AFFSONY50',
      productUrl: 'https://vn.shp.ee/Sp123',
      voucherUrl: 'https://s.shopee.vn/Vc456',
      paymentMethod: 'ShopeePay',
    });
    expect(parsed[0].title).toContain('Tai nghe Bluetooth ANC');
    expect(parsed[0].voucherNote).toContain('200K');

    expect(parsed[1]).toMatchObject({
      slotTime: '18:00',
      voucherCode: 'ANKER18H',
      productUrl: 'https://vn.shp.ee/AnkerSp88',
      voucherUrl: 'https://shopee.vn/m/voucher-xtra',
      paymentMethod: 'SPayLater',
    });
    expect(parsed[1].title).toContain('Sạc dự phòng Anker');
  });

  it('supports link-only deals (voucherCode = "") with clear title & voucherNote and keeps distinct link-only bullets separate', () => {
    const linkOnlyPost = `
⏰ 21:00: Deal 1K Cáp sạc nhanh 100W https://vn.shp.ee/Deal1K99 — Lưu voucher tại https://shopee.vn/m/voucher-xtra

🔥 KHUNG 0H:
- Deal 9K Chuột không dây Silent https://vn.shp.ee/Mouse9K
- Mua ngay Tai nghe Sony WF-1000XM5 với giá chỉ ₫3.990.000! Mua ngay trên Shopee! https://vn.shp.ee/AbCd12
- https://shopee.vn/Ban-phim-co-RGB-i.12345.67890
- Lưu sớm kho mã toàn sàn: https://shopee.vn/m/ma-giam-gia
    `;

    const parsed = parseDealTextPaste(linkOnlyPost);
    expect(parsed).toHaveLength(5);

    // 1. Paired link-only deal (100W & Deal1K99 must NOT be misread as voucherCode)
    expect(parsed[0]).toMatchObject({
      slotTime: '21:00',
      voucherCode: '',
      productUrl: 'https://vn.shp.ee/Deal1K99',
      voucherUrl: 'https://shopee.vn/m/voucher-xtra',
    });
    expect(parsed[0].title).toContain('Deal 1K Cáp sạc nhanh 100W');
    expect(parsed[0].voucherNote.length).toBeGreaterThan(5);

    // 2. Product shortlink-only deal #1
    expect(parsed[1]).toMatchObject({
      slotTime: '00:00',
      voucherCode: '',
      productUrl: 'https://vn.shp.ee/Mouse9K',
    });
    expect(parsed[1].voucherUrl).toBeUndefined();
    expect(parsed[1].title).toContain('Deal 9K Chuột không dây Silent');

    // 3. Shopee App share text link-only deal (WF-1000XM5 & AbCd12 NOT misread as voucherCode)
    expect(parsed[2]).toMatchObject({
      slotTime: '00:00',
      voucherCode: '',
      productUrl: 'https://vn.shp.ee/AbCd12',
      title: 'Tai nghe Sony WF-1000XM5',
    });

    // 4. Bare product slug URL (-i.12345.67890 humanized title, NOT misread as voucherCode)
    expect(parsed[3]).toMatchObject({
      slotTime: '00:00',
      voucherCode: '',
      productUrl: 'https://shopee.vn/Ban-phim-co-RGB-i.12345.67890',
      title: 'Ban phim co RGB',
    });

    // 5. Voucher-hub-only deal
    expect(parsed[4]).toMatchObject({
      slotTime: '00:00',
      voucherCode: '',
      voucherUrl: 'https://shopee.vn/m/ma-giam-gia',
    });
    expect(parsed[4].productUrl).toBeUndefined();

    // 6. Multi-line link-only block (headline + Link SP + Link mã without text voucherCode)
    const multiLineLinkOnly = `
🔥 09h: Nồi chiên không dầu Lock&Lock 5L giảm sâu
- Link SP: https://vn.shp.ee/Lock5L
- Link mã: https://s.shopee.vn/LockVc9H
    `;
    const parsedMultiLink = parseDealTextPaste(multiLineLinkOnly);
    expect(parsedMultiLink).toHaveLength(1);
    expect(parsedMultiLink[0]).toMatchObject({
      slotTime: '09:00',
      voucherCode: '',
      productUrl: 'https://vn.shp.ee/Lock5L',
      voucherUrl: 'https://s.shopee.vn/LockVc9H',
    });
    expect(parsedMultiLink[0].title).toContain('Nồi chiên không dầu Lock&Lock');
  });

  it('never mistakes shortlink slugs, shopeevn:// schemes, or product IDs for alphanumeric voucherCode tokens', () => {
    const trickyUrls = `
      09:00: Săn deal hot https://vn.shp.ee/AbCd12 | Claim voucher https://s.shopee.vn/9zXy88
      12:00: Mở app shopeevn://home?navigate_url=https%3A%2F%2Fshopee.vn%2Fproduct%2F12345%2F67890
      15:00: Link SP https://shopee.vn/Tai-nghe-i.123.456?sp_atk=Zz99Xx88
    `;

    const parsed = parseDealTextPaste(trickyUrls);
    expect(parsed).toHaveLength(3);
    for (const item of parsed) {
      expect(item.voucherCode).toBe('');
    }
    expect(parsed[0].productUrl).toBe('https://vn.shp.ee/AbCd12');
    expect(parsed[0].voucherUrl).toBe('https://s.shopee.vn/9zXy88');
    expect(parsed[1].productUrl).toContain('shopeevn://');
    expect(parsed[2].productUrl).toBe('https://shopee.vn/Tai-nghe-i.123.456?sp_atk=Zz99Xx88');
  });
});

describe('compareChannelStacks (3-Layer Stack & Normal vs Video vs Live Calculator)', () => {
  it('evaluates DEFAULT_STACK_INPUT across normal, video, and live channels and picks video as best', () => {
    const comparison = compareChannelStacks(DEFAULT_STACK_INPUT);

    expect(comparison.evaluations).toHaveLength(3);
    const [normal, video, live] = comparison.evaluations;

    // Item = 300k, Shop voucher = -20k -> afterShopVnd = 280k
    expect(normal.afterShopVnd).toBe(280_000);
    // Normal: 15% of 280k = 42k, capped at 40k -> 40k. Net ship = 0, coins = 10k, payment = 15k -> 280 - 40 - 10 - 15 = 215k
    expect(normal.platformEligible).toBe(true);
    expect(normal.platformDiscountVnd).toBe(40_000);
    expect(normal.finalPayableVnd).toBe(215_000);

    // Video: 25% of 280k = 70k (capped at 70k) -> 280 - 70 - 10 - 15 = 185k
    expect(video.platformEligible).toBe(true);
    expect(video.platformDiscountVnd).toBe(70_000);
    expect(video.finalPayableVnd).toBe(185_000);

    // Live: 20% of 280k = 56k (capped at 60k) -> 280 - 56 - 10 - 15 = 199k
    expect(live.platformEligible).toBe(true);
    expect(live.platformDiscountVnd).toBe(56_000);
    expect(live.finalPayableVnd).toBe(199_000);

    expect(comparison.bestChannel).toBe('video');
    expect(comparison.extraSavedVsNormalVnd).toBe(30_000);
    expect(comparison.summaryTip).toContain('30.000đ');
  });

  it('detects the classic Shopee trap where Shop voucher drops afterShopVnd below platform minSpendVnd', () => {
    // Item is 205,000đ. Platform voucher requires minSpend 200,000đ.
    // Shop voucher deducts 15,000đ -> afterShopVnd = 190,000đ (< 200,000đ!).
    const trapInput: ChannelStackInput = {
      itemPriceVnd: 205_000,
      shopVoucher: {
        label: 'Mã Shop giảm 15K',
        discountType: 'flat',
        discountValue: 15_000,
        minSpendVnd: 150_000,
      },
      normalVoucher: {
        label: 'Mã Toàn Sàn giảm 40K đơn 200K',
        discountType: 'flat',
        discountValue: 40_000,
        minSpendVnd: 200_000,
      },
      videoVoucher: {
        label: 'Mã Video 25% đơn từ 150K',
        discountType: 'percent',
        discountValue: 25,
        maxDiscountVnd: 50_000,
        minSpendVnd: 150_000,
      },
      liveVoucher: null,
      shippingFeeVnd: 25_000,
      freeshipCapVnd: 15_000,
      coinsVnd: 5_000,
      paymentDiscountVnd: 0,
    };

    const result = compareChannelStacks(trapInput);
    const normal = result.evaluations.find((e) => e.channel === 'normal')!;
    const video = result.evaluations.find((e) => e.channel === 'video')!;

    expect(normal.shopDiscountVnd).toBe(15_000);
    expect(normal.afterShopVnd).toBe(190_000);
    expect(normal.platformEligible).toBe(false);
    expect(normal.platformShortfallVnd).toBe(10_000);
    expect(normal.platformDiscountVnd).toBe(0);
    expect(normal.shippingNetVnd).toBe(10_000);
    expect(normal.actionGuide).toContain('Bẫy đơn tối thiểu');
    expect(normal.actionGuide).toContain('10.000đ');

    // Meanwhile Video voucher has minSpend 150k, so 190k is eligible!
    expect(video.platformEligible).toBe(true);
    expect(video.platformShortfallVnd).toBe(0);
    expect(video.platformDiscountVnd).toBe(47_500); // 25% of 190k
    expect(result.bestChannel).toBe('video');
  });
});

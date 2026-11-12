import React, { useMemo, useState } from 'react';
import { formatVnd } from '../lib/optimizer';
import {
  DEFAULT_STACK_INPUT,
  OFFICIAL_VOUCHER_HUBS,
  SAMPLE_DEAL_PASTE_TEXT,
  compareChannelStacks,
  getUpcomingSaleRadar,
  parseDealTextPaste,
} from '../lib/yearRoundDeals';
import type {
  ChannelStackInput,
  ChannelVoucherSpec,
  DiscountType,
  EvaluatedChannelStack,
  ParsedDealCandidate,
  VoucherHubCategory,
} from '../types/contracts';

export interface VoucherMaxHubProps {
  onOpenShopeeUrl: (url: string, voucherCode?: string) => void;
  onSelectOrCreateSlot: (slotTime: string, campaignTitle: string, tip: string) => void;
  onImportParsedDeals: (deals: ParsedDealCandidate[]) => void;
  onCreateChannelReminder: (evaluation: EvaluatedChannelStack, slotTime: string) => void;
}

const HUB_CATEGORY_FILTERS: ReadonlyArray<{
  key: 'all' | VoucherHubCategory;
  label: string;
}> = [
  { key: 'all', label: 'Tất cả (8 trạm)' },
  { key: 'platform', label: 'Mã Sàn & Xtra' },
  { key: 'video-live', label: 'Video & Live' },
  { key: 'freeship', label: 'Freeship' },
  { key: 'payment-vip', label: 'ShopeePay / Ngân hàng / VIP' },
];

function updateSpecField(
  spec: ChannelVoucherSpec | null,
  fallbackLabel: string,
  patch: Partial<ChannelVoucherSpec>,
): ChannelVoucherSpec {
  const base: ChannelVoucherSpec = spec ?? {
    label: fallbackLabel,
    discountType: 'percent',
    discountValue: 15,
    maxDiscountVnd: 50_000,
    minSpendVnd: 200_000,
  };
  return { ...base, ...patch };
}

export const VoucherMaxHub: React.FC<VoucherMaxHubProps> = ({
  onOpenShopeeUrl,
  onSelectOrCreateSlot,
  onImportParsedDeals,
  onCreateChannelReminder,
}) => {
  // 1. 365-Day Sale Radar
  const radarEvents = useMemo(() => getUpcomingSaleRadar(), []);

  // 2. Official Voucher Hubs filter
  const [hubCategory, setHubCategory] = useState<'all' | VoucherHubCategory>('all');
  const visibleHubs = useMemo(
    () =>
      hubCategory === 'all'
        ? OFFICIAL_VOUCHER_HUBS
        : OFFICIAL_VOUCHER_HUBS.filter((h) => h.category === hubCategory),
    [hubCategory],
  );

  // 3. Smart Deal Text Paste Parser
  const [pasteText, setPasteText] = useState<string>('');
  const [isUsingSampleSyntax, setIsUsingSampleSyntax] = useState<boolean>(false);

  const parsedDeals = useMemo(() => parseDealTextPaste(pasteText), [pasteText]);

  const handleLoadSamplePaste = () => {
    setPasteText(SAMPLE_DEAL_PASTE_TEXT);
    setIsUsingSampleSyntax(true);
  };

  const handleClearPaste = () => {
    setPasteText('');
    setIsUsingSampleSyntax(false);
  };

  const handleImportParsed = () => {
    if (parsedDeals.length === 0) return;
    onImportParsedDeals(parsedDeals);
    setPasteText('');
    setIsUsingSampleSyntax(false);
  };

  // 4. 3-Layer Voucher Stack & Channel Comparison Calculator
  const [stackInput, setStackInput] = useState<ChannelStackInput>(() => DEFAULT_STACK_INPUT);
  const [reminderSlot, setReminderSlot] = useState<string>('00:00');

  const stackComparison = useMemo(() => compareChannelStacks(stackInput), [stackInput]);
  const winningEvaluation = useMemo(
    () =>
      stackComparison.evaluations.find((e) => e.channel === stackComparison.bestChannel) ??
      stackComparison.evaluations[0],
    [stackComparison],
  );

  return (
    <div className="maxhub-stack" data-testid="voucher-max-hub">
      {/* SECTION 1: 365-DAY SALE RADAR & REAL VOUCHER WORKFLOW EXPLANATION */}
      <section className="section-card" aria-label="Lịch Sale và Khung Giờ Thực Tế 365 Ngày">
        <div className="section-header">
          <div>
            <h2 className="section-title">📡 Lịch Sale &amp; Khung Giờ Thực Tế 365 Ngày</h2>
            <p style={{ margin: '2px 0 0', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              Tự động tính ngày Sale gần nhất theo giờ Việt Nam (UTC+7)
            </p>
          </div>
        </div>

        <div className="real-voucher-explainer" data-testid="real-voucher-explainer">
          <div style={{ fontWeight: 800, color: '#fbbf24', marginBottom: '2px', fontSize: '0.76rem' }}>
            💡 Lưu ý Mã Thật Shopee:
          </div>
          <p style={{ margin: 0, fontSize: '0.74rem', lineHeight: 1.35, color: 'var(--text-secondary)' }}>
            <strong>~90% mã là Mã Lưu Ví</strong> (lưu trong Kho Voucher/Banner, chọn lúc thanh toán 0h/9h/12h/21h). <strong>~10% là mã ký tự</strong> nhập tay (dán vào ô Bóc Tách Nhanh bên dưới).
          </p>
        </div>

        <div className="radar-grid">
          {radarEvents.map((ev) => (
            <article
              key={ev.id}
              className={`radar-card ${ev.daysAway === 0 ? 'is-today' : ''}`}
              data-testid={`radar-card-${ev.type}`}
            >
              <div className="radar-card-top">
                <div>
                  <span className="radar-date-label">{ev.dateLabel}</span>
                  <h3 style={{ margin: '2px 0 0', fontSize: '0.96rem', fontWeight: 800 }}>
                    {ev.title}
                  </h3>
                </div>
                <span className={`radar-badge ${ev.daysAway === 0 ? 'is-live' : ''}`}>
                  {ev.badge}
                </span>
              </div>

              <p style={{ margin: 0, fontSize: '0.83rem', color: 'var(--text-secondary)' }}>
                {ev.tip}
              </p>

              <div className="radar-slots-row">
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                  Canh khung giờ:
                </span>
                {ev.peakSlots.map((slot) => (
                  <button
                    key={`${ev.id}-${slot}`}
                    type="button"
                    className="btn btn-outline-accent radar-slot-btn tabular-nums"
                    onClick={() => onSelectOrCreateSlot(slot, ev.title, ev.tip)}
                  >
                    ⏰ {slot}
                  </button>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* SECTION 2: OFFICIAL SHOPEE VOUCHER HUBS (NATIVE APP DEEP LINKS) */}
      <section className="section-card" aria-label="Trạm Mở Nhanh Kho Mã Thật Trong App Shopee">
        <div className="section-header">
          <div>
            <h2 className="section-title">⚡ Trạm Mở Nhanh Kho Mã Thật Trong App Shopee</h2>
            <p style={{ margin: '2px 0 0', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              Bấm 1 chạm nhảy thẳng vào đúng trang lưu voucher chính thức bên trong App Shopee
            </p>
          </div>
        </div>

        <div
          className="chip-group"
          role="group"
          aria-label="Lọc danh mục kho mã"
          style={{ marginBottom: '12px' }}
        >
          {HUB_CATEGORY_FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              className={`slot-chip ${hubCategory === f.key ? 'active' : ''}`}
              onClick={() => setHubCategory(f.key)}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="hub-grid" data-testid="official-hubs-grid">
          {visibleHubs.map((hub) => (
            <article key={hub.id} className="hub-card" data-testid={`hub-card-${hub.id}`}>
              <div className="hub-card-top">
                <h3 style={{ margin: 0, fontSize: '0.96rem', fontWeight: 800 }}>{hub.title}</h3>
                <span className="hub-badge">{hub.badge}</span>
              </div>
              <p style={{ margin: 0, fontSize: '0.83rem', color: 'var(--text-secondary)' }}>
                {hub.subtitle}
              </p>
              <div style={{ fontSize: '0.78rem', color: '#fde68a' }}>
                ⏱️ Mẹo canh: <strong>{hub.bestTimeHint}</strong>
              </div>
              <button
                type="button"
                className="btn btn-primary"
                style={{ width: '100%', marginTop: 'auto' }}
                data-testid={`open-hub-${hub.id}`}
                onClick={() => onOpenShopeeUrl(hub.webUrl)}
              >
                Mở trong App Shopee ↗
              </button>
            </article>
          ))}
        </div>
      </section>

      {/* SECTION 3: SMART PASTE EXTRACTOR FOR REAL TEXT VOUCHER CODES */}
      <section className="section-card" aria-label="Bóc Tách Nhanh Bài Đăng Mã Ký Tự Thật">
        <div className="section-header">
          <div>
            <h2 className="section-title">📋 Bóc Tách Nhanh Bài Đăng Mã Ký Tự Thật (Smart Paste)</h2>
            <p style={{ margin: '2px 0 0', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              Copy tin nhắn phím mã từ Telegram / Zalo / Facebook 15 phút trước giờ mở mã rồi dán
              vào đây — tự tách Mã + Giờ + Điều kiện!
            </p>
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={handleLoadSamplePaste}
            >
              Xem cú pháp mẫu (chỉ để thử máy bóc tách)
            </button>
            {pasteText && (
              <button
                type="button"
                className="btn btn-danger-ghost btn-sm"
                onClick={handleClearPaste}
              >
                Xóa ô dán
              </button>
            )}
          </div>
        </div>

        {isUsingSampleSyntax && (
          <div className="sample-syntax-warning" data-testid="sample-syntax-warning">
            ⚠️ Lưu ý: Cú pháp mẫu chỉ để thử tính năng tách chữ, KHÔNG phải mã thật! Hãy dán bài
            đăng mã thật từ hội nhóm/KOL trước giờ G.
          </div>
        )}

        <label className="field-label" htmlFor="smart-paste-textarea">
          <span>Dán nội dung bài đăng mã giảm giá vào đây:</span>
          <textarea
            id="smart-paste-textarea"
            data-testid="smart-paste-textarea"
            className="text-input"
            rows={4}
            style={{ fontFamily: 'inherit', resize: 'vertical' }}
            placeholder="VD: Khung 12h: Mã REAL12H50 giảm 50% tối đa 50K đơn từ 99K (ShopeePay)..."
            value={pasteText}
            onChange={(e) => {
              setPasteText(e.target.value);
              if (e.target.value !== SAMPLE_DEAL_PASTE_TEXT) {
                setIsUsingSampleSyntax(false);
              }
            }}
          />
        </label>

        {parsedDeals.length > 0 ? (
          <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#6ee7b7' }}>
              ✅ Bóc tách được {parsedDeals.length} mã ký tự:
            </div>
            <div className="parsed-deals-list" data-testid="parsed-deals-preview">
              {parsedDeals.map((d) => (
                <div key={d.id} className="parsed-deal-item">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <span className="slot-pill">{d.slotTime}</span>
                    <span className="voucher-code-pill">Mã: {d.voucherCode}</span>
                    <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                      TT: <strong>{d.paymentMethod}</strong>
                    </span>
                  </div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-primary)', marginTop: '4px' }}>
                    {d.voucherNote}
                  </div>
                </div>
              ))}
            </div>

            <button
              type="button"
              className="btn btn-emerald"
              data-testid="import-parsed-deals-btn"
              onClick={handleImportParsed}
            >
              Đưa vào Kịch Bản Canh Giờ ({parsedDeals.length} mã)
            </button>
          </div>
        ) : (
          pasteText.trim() !== '' && (
            <p style={{ margin: '10px 0 0', fontSize: '0.84rem', color: '#fde68a' }}>
              Chưa tìm thấy mã ký tự hợp lệ (chứa chữ + số như AFF1122, VIDEO50K) trong đoạn văn
              bản trên.
            </p>
          )
        )}
      </section>

      {/* SECTION 4: 3-LAYER VOUCHER STACK & CHANNEL COMPARISON CALCULATOR */}
      <section className="section-card" aria-label="Bộ Tính Chồng 3 Tầng Mã và So Kênh Mua">
        <div className="section-header">
          <div>
            <h2 className="section-title">🏆 Bộ Tính Chồng 3 Tầng Mã &amp; So Kênh Mua</h2>
            <p style={{ margin: '2px 0 0', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              So sánh Giỏ Thường (Xtra) vs Shopee Video vs Shopee Live: [1. Mã Shop] + [2. Mã
              Sàn/Video/Live] + [3. Freeship + Xu/TT]
            </p>
          </div>
        </div>

        <div className="form-stack" style={{ marginBottom: '14px' }}>
          <div className="form-row form-row-3">
            <label className="field-label">
              <span>Tổng tiền hàng gốc (VNĐ)</span>
              <input
                type="number"
                className="text-input tabular-nums"
                data-testid="stack-item-price-input"
                value={stackInput.itemPriceVnd}
                onChange={(e) =>
                  setStackInput((prev) => ({
                    ...prev,
                    itemPriceVnd: Math.max(0, Number(e.target.value) || 0),
                  }))
                }
              />
            </label>

            <label className="field-label">
              <span>Tầng 1 — Mã Shop giảm (VNĐ)</span>
              <input
                type="number"
                className="text-input tabular-nums"
                data-testid="stack-shop-discount-input"
                value={stackInput.shopVoucher?.discountValue ?? 0}
                onChange={(e) => {
                  const val = Math.max(0, Number(e.target.value) || 0);
                  setStackInput((prev) => ({
                    ...prev,
                    shopVoucher:
                      val > 0
                        ? updateSpecField(prev.shopVoucher, `Mã Shop giảm ${formatVnd(val)}`, {
                            label: `Mã Shop giảm ${formatVnd(val)}`,
                            discountType: 'flat',
                            discountValue: val,
                            maxDiscountVnd: val,
                            minSpendVnd: 0,
                          })
                        : null,
                  }));
                }}
              />
            </label>

            <label className="field-label">
              <span>Tầng 3 — Shopee Xu + Giảm TT (VNĐ)</span>
              <input
                type="number"
                className="text-input tabular-nums"
                value={stackInput.coinsVnd + stackInput.paymentDiscountVnd}
                onChange={(e) => {
                  const val = Math.max(0, Number(e.target.value) || 0);
                  setStackInput((prev) => ({
                    ...prev,
                    coinsVnd: val,
                    paymentDiscountVnd: 0,
                  }));
                }}
              />
            </label>
          </div>

          <div className="form-row form-row-3">
            {/* Normal / Xtra Voucher Config */}
            <div className="channel-input-box">
              <div style={{ fontWeight: 700, fontSize: '0.84rem', marginBottom: '6px' }}>
                🛒 Mã Sàn / Xtra (Giỏ thường)
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                <label className="field-label" style={{ fontSize: '0.76rem' }}>
                  <span>Giảm (%)</span>
                  <input
                    type="number"
                    className="text-input tabular-nums"
                    value={stackInput.normalVoucher?.discountValue ?? 0}
                    onChange={(e) => {
                      const val = Math.max(0, Number(e.target.value) || 0);
                      setStackInput((prev) => ({
                        ...prev,
                        normalVoucher: updateSpecField(
                          prev.normalVoucher,
                          'Voucher Xtra',
                          {
                            discountType: 'percent' as DiscountType,
                            discountValue: val,
                          },
                        ),
                      }));
                    }}
                  />
                </label>
                <label className="field-label" style={{ fontSize: '0.76rem' }}>
                  <span>Tối đa (VNĐ)</span>
                  <input
                    type="number"
                    className="text-input tabular-nums"
                    value={stackInput.normalVoucher?.maxDiscountVnd ?? 0}
                    onChange={(e) => {
                      const maxVal = Math.max(0, Number(e.target.value) || 0);
                      setStackInput((prev) => ({
                        ...prev,
                        normalVoucher: updateSpecField(
                          prev.normalVoucher,
                          'Voucher Xtra',
                          { maxDiscountVnd: maxVal },
                        ),
                      }));
                    }}
                  />
                </label>
              </div>
              <label className="field-label" style={{ fontSize: '0.76rem', marginTop: '6px' }}>
                <span>Đơn tối thiểu Sàn (VNĐ)</span>
                <input
                  type="number"
                  className="text-input tabular-nums"
                  data-testid="stack-normal-minspend-input"
                  value={stackInput.normalVoucher?.minSpendVnd ?? 0}
                  onChange={(e) => {
                    const minVal = Math.max(0, Number(e.target.value) || 0);
                    setStackInput((prev) => ({
                      ...prev,
                      normalVoucher: updateSpecField(prev.normalVoucher, 'Voucher Xtra', {
                        minSpendVnd: minVal,
                      }),
                    }));
                  }}
                />
              </label>
            </div>

            {/* Shopee Video Voucher Config */}
            <div className="channel-input-box">
              <div style={{ fontWeight: 700, fontSize: '0.84rem', marginBottom: '6px' }}>
                🎬 Mã Shopee Video (Giỏ vàng)
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                <label className="field-label" style={{ fontSize: '0.76rem' }}>
                  <span>Giảm (%)</span>
                  <input
                    type="number"
                    className="text-input tabular-nums"
                    value={stackInput.videoVoucher?.discountValue ?? 0}
                    onChange={(e) => {
                      const val = Math.max(0, Number(e.target.value) || 0);
                      setStackInput((prev) => ({
                        ...prev,
                        videoVoucher: updateSpecField(prev.videoVoucher, 'Mã Shopee Video', {
                          discountType: 'percent' as DiscountType,
                          discountValue: val,
                        }),
                      }));
                    }}
                  />
                </label>
                <label className="field-label" style={{ fontSize: '0.76rem' }}>
                  <span>Tối đa (VNĐ)</span>
                  <input
                    type="number"
                    className="text-input tabular-nums"
                    value={stackInput.videoVoucher?.maxDiscountVnd ?? 0}
                    onChange={(e) => {
                      const maxVal = Math.max(0, Number(e.target.value) || 0);
                      setStackInput((prev) => ({
                        ...prev,
                        videoVoucher: updateSpecField(prev.videoVoucher, 'Mã Shopee Video', {
                          maxDiscountVnd: maxVal,
                        }),
                      }));
                    }}
                  />
                </label>
              </div>
              <label className="field-label" style={{ fontSize: '0.76rem', marginTop: '6px' }}>
                <span>Đơn tối thiểu Video (VNĐ)</span>
                <input
                  type="number"
                  className="text-input tabular-nums"
                  value={stackInput.videoVoucher?.minSpendVnd ?? 0}
                  onChange={(e) => {
                    const minVal = Math.max(0, Number(e.target.value) || 0);
                    setStackInput((prev) => ({
                      ...prev,
                      videoVoucher: updateSpecField(prev.videoVoucher, 'Mã Shopee Video', {
                        minSpendVnd: minVal,
                      }),
                    }));
                  }}
                />
              </label>
            </div>

            {/* Shopee Live Voucher Config */}
            <div className="channel-input-box">
              <div style={{ fontWeight: 700, fontSize: '0.84rem', marginBottom: '6px' }}>
                📺 Mã Shopee Live (Giỏ cam)
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                <label className="field-label" style={{ fontSize: '0.76rem' }}>
                  <span>Giảm (%)</span>
                  <input
                    type="number"
                    className="text-input tabular-nums"
                    value={stackInput.liveVoucher?.discountValue ?? 0}
                    onChange={(e) => {
                      const val = Math.max(0, Number(e.target.value) || 0);
                      setStackInput((prev) => ({
                        ...prev,
                        liveVoucher: updateSpecField(prev.liveVoucher, 'Mã Shopee Live', {
                          discountType: 'percent' as DiscountType,
                          discountValue: val,
                        }),
                      }));
                    }}
                  />
                </label>
                <label className="field-label" style={{ fontSize: '0.76rem' }}>
                  <span>Tối đa (VNĐ)</span>
                  <input
                    type="number"
                    className="text-input tabular-nums"
                    value={stackInput.liveVoucher?.maxDiscountVnd ?? 0}
                    onChange={(e) => {
                      const maxVal = Math.max(0, Number(e.target.value) || 0);
                      setStackInput((prev) => ({
                        ...prev,
                        liveVoucher: updateSpecField(prev.liveVoucher, 'Mã Shopee Live', {
                          maxDiscountVnd: maxVal,
                        }),
                      }));
                    }}
                  />
                </label>
              </div>
              <label className="field-label" style={{ fontSize: '0.76rem', marginTop: '6px' }}>
                <span>Đơn tối thiểu Live (VNĐ)</span>
                <input
                  type="number"
                  className="text-input tabular-nums"
                  value={stackInput.liveVoucher?.minSpendVnd ?? 0}
                  onChange={(e) => {
                    const minVal = Math.max(0, Number(e.target.value) || 0);
                    setStackInput((prev) => ({
                      ...prev,
                      liveVoucher: updateSpecField(prev.liveVoucher, 'Mã Shopee Live', {
                        minSpendVnd: minVal,
                      }),
                    }));
                  }}
                />
              </label>
            </div>
          </div>
        </div>

        <div className="savings-banner tabular-nums" data-testid="channel-comparison-summary">
          🏆 {stackComparison.summaryTip}
        </div>

        <div className="channel-eval-grid" style={{ marginTop: '8px' }}>
          {stackComparison.evaluations.map((ev) => {
            const isBest = ev.channel === stackComparison.bestChannel;
            return (
              <div
                key={ev.channel}
                className={`channel-eval-card ${isBest ? 'is-best-channel' : ''}`}
                data-testid={`channel-eval-${ev.channel}`}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '4px',
                    flexWrap: 'wrap',
                  }}
                >
                  <strong style={{ fontSize: '0.8rem' }}>{ev.channelLabel}</strong>
                  {isBest && (
                    <span className="readiness-badge is-ready" data-testid="winning-channel-badge">
                      Kênh Rẻ Nhất
                    </span>
                  )}
                </div>

                <div
                  className="tabular-nums"
                  style={{ fontSize: '0.73rem', color: 'var(--text-secondary)' }}
                >
                  <div>Sau Shop: {formatVnd(ev.afterShopVnd)}</div>
                  <div>Giảm T2: <strong style={{ color: '#6ee7b7' }}>-{formatVnd(ev.platformDiscountVnd)}</strong></div>
                  <div style={{ marginTop: '2px' }}>
                    Trả cuối:{' '}
                    <strong style={{ color: '#fbbf24', fontSize: '0.86rem' }}>
                      {formatVnd(ev.finalPayableVnd)}
                    </strong>
                  </div>
                </div>

                {!ev.platformEligible && ev.platformShortfallVnd > 0 && (
                  <div
                    className="shortfall-alert tabular-nums"
                    data-testid={`shortfall-alert-${ev.channel}`}
                    style={{ fontSize: '0.72rem', padding: '4px 6px', marginTop: '2px' }}
                  >
                    {ev.actionGuide}
                  </div>
                )}

                {(ev.platformEligible || ev.platformShortfallVnd === 0) && (
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                    {ev.actionGuide}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            flexWrap: 'wrap',
            marginTop: '12px',
          }}
        >
          <label
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '0.86rem',
              color: 'var(--text-secondary)',
            }}
          >
            <span>Khung giờ canh:</span>
            <select
              className="select-input tabular-nums"
              value={reminderSlot}
              onChange={(e) => setReminderSlot(e.target.value)}
            >
              <option value="00:00">00:00</option>
              <option value="09:00">09:00</option>
              <option value="12:00">12:00</option>
              <option value="18:00">18:00</option>
              <option value="21:00">21:00</option>
            </select>
          </label>

          <button
            type="button"
            className="btn btn-emerald"
            style={{ flex: 1 }}
            data-testid="create-channel-reminder-btn"
            onClick={() => onCreateChannelReminder(winningEvaluation, reminderSlot)}
          >
            + Tạo Ca Nhắc Mua Kênh {winningEvaluation.channelLabel}
          </button>
        </div>
      </section>
    </div>
  );
};

export default VoucherMaxHub;

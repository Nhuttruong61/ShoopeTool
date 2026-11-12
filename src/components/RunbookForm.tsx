import React, { useEffect, useMemo, useState } from 'react';
import {
  copyAndLaunchShopee,
  extractShopeeLinkInfo,
  resolveShopeeShortLink,
} from '../lib/clipboard';
import { buildProductVoucherSuggestions } from '../lib/yearRoundDeals';
import type {
  AutoProductVoucherItem,
  DealRunbookItem,
  ExtractedShopeeLink,
  StrikeMode,
} from '../types/contracts';

export type DealRunbookDraft = Omit<
  DealRunbookItem,
  'id' | 'checklist' | 'completed' | 'targetEpochMs'
>;

export interface RunbookFormProps {
  onAddDeal: (draft: DealRunbookDraft) => void;
  onDirectUseVoucher?: (voucher: AutoProductVoucherItem) => void;
}

export const PRESET_SLOTS: readonly string[] = [
  '00:00',
  '09:00',
  '12:00',
  '15:00',
  '18:00',
  '21:00',
];

export const PAYMENT_METHODS: readonly string[] = [
  'ShopeePay',
  'SPayLater',
  'Thẻ/COD',
];

export const DESTINATION_CHIPS: ReadonlyArray<{ label: string; url: string }> = [
  { label: 'Mã Toàn Sàn', url: 'https://shopee.vn/m/ma-giam-gia' },
  { label: 'Voucher Xtra', url: 'https://shopee.vn/m/voucher-xtra' },
  { label: 'Freeship', url: 'https://shopee.vn/m/mien-phi-van-chuyen' },
  { label: 'Shopee Video', url: 'https://shopee.vn/m/shopee-video' },
  { label: 'Shopee Live', url: 'https://shopee.vn/m/shopee-live' },
];

export const STRIKE_MODE_OPTIONS: ReadonlyArray<{
  value: StrikeMode;
  label: string;
}> = [
  {
    value: 'checkout-wait',
    label: '🛒 Đứng chờ ở Thanh toán (Săn mã giới hạn)',
  },
  {
    value: 'flash-product',
    label: '⚡ Canh nổ giá tại trang SP (Flash Sale)',
  },
];

export const RunbookForm: React.FC<RunbookFormProps> = ({
  onAddDeal,
  onDirectUseVoucher,
}) => {
  const [slotTime, setSlotTime] = useState<string>('00:00');
  const [title, setTitle] = useState<string>('');
  const [itemsSummary, setItemsSummary] = useState<string>('');
  const [voucherCode, setVoucherCode] = useState<string>('');
  const [voucherNote, setVoucherNote] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<string>('ShopeePay');
  const [productRaw, setProductRaw] = useState<string>('');
  const [voucherRaw, setVoucherRaw] = useState<string>('');
  const [strikeMode, setStrikeMode] = useState<StrikeMode>('checkout-wait');
  const [resolvedProductInfo, setResolvedProductInfo] =
    useState<ExtractedShopeeLink | null>(null);
  const [isResolvingLink, setIsResolvingLink] = useState<boolean>(false);

  const syncProductInfo = useMemo(() => extractShopeeLinkInfo(productRaw), [productRaw]);
  const productInfo = useMemo<ExtractedShopeeLink>(() => {
    if (resolvedProductInfo && resolvedProductInfo.cleanUrl) {
      return {
        ...syncProductInfo,
        ...resolvedProductInfo,
        extractedTitle:
          resolvedProductInfo.extractedTitle ?? syncProductInfo.extractedTitle,
      };
    }
    return syncProductInfo;
  }, [syncProductInfo, resolvedProductInfo]);

  const voucherInfo = useMemo(() => extractShopeeLinkInfo(voucherRaw), [voucherRaw]);

  const autoProductVouchers = useMemo(() => {
    if (!productInfo.cleanUrl) return [];
    return buildProductVoucherSuggestions(productRaw, productInfo, slotTime);
  }, [productRaw, productInfo, slotTime]);

  useEffect(() => {
    let cancelled = false;
    if (syncProductInfo.kind !== 'shortlink' || !syncProductInfo.cleanUrl) {
      setResolvedProductInfo(null);
      setIsResolvingLink(false);
      return;
    }

    setIsResolvingLink(true);
    void resolveShopeeShortLink(productRaw).then((resolved) => {
      if (cancelled) return;
      setIsResolvingLink(false);
      if (resolved.cleanUrl && resolved.cleanUrl !== syncProductInfo.cleanUrl) {
        setResolvedProductInfo(resolved);
        if (resolved.extractedTitle) {
          setTitle((prev) => (prev.trim() ? prev : resolved.extractedTitle!));
          setItemsSummary((prev) => (prev.trim() ? prev : resolved.extractedTitle!));
        }
      }
    });

    return () => {
      cancelled = true;
    };
  }, [productRaw, syncProductInfo.kind, syncProductInfo.cleanUrl]);

  const handleProductChange = (nextRaw: string) => {
    setProductRaw(nextRaw);
    const info = extractShopeeLinkInfo(nextRaw);
    if (info.extractedTitle) {
      if (!title.trim()) {
        setTitle(info.extractedTitle);
      }
      if (!itemsSummary.trim()) {
        setItemsSummary(info.extractedTitle);
      }
    }
  };

  const handleApplyAutoVoucher = (v: AutoProductVoucherItem) => {
    setVoucherRaw(v.voucherUrl);
    setVoucherNote(v.voucherNote);
    setTitle(v.title);
    setStrikeMode(v.strikeMode);
    if (v.voucherCode) {
      setVoucherCode(v.voucherCode);
    }
  };

  const handleDirectUseAutoVoucher = (v: AutoProductVoucherItem) => {
    if (onDirectUseVoucher) {
      onDirectUseVoucher(v);
      return;
    }
    void copyAndLaunchShopee({
      voucherCode: v.voucherCode || undefined,
      targetUrl: v.productUrl || v.voucherUrl,
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanSlot = slotTime.trim() || '00:00';
    const cleanProductUrl = productInfo.cleanUrl ?? undefined;
    const cleanVoucherUrl = voucherInfo.cleanUrl ?? undefined;
    const cleanTitle =
      title.trim() || productInfo.extractedTitle || `Ca săn khung ${cleanSlot}`;
    const cleanItems =
      itemsSummary.trim() || productInfo.extractedTitle || 'Món đã chọn trong giỏ';
    const cleanCode = voucherCode.trim().toUpperCase();
    const finalUrl =
      cleanProductUrl ||
      cleanVoucherUrl ||
      (cleanCode ? 'https://shopee.vn/cart' : 'https://shopee.vn/m/ma-giam-gia');

    onAddDeal({
      slotTime: cleanSlot,
      title: cleanTitle,
      itemsSummary: cleanItems,
      voucherCode: cleanCode,
      voucherNote: voucherNote.trim(),
      paymentMethod,
      productUrl: cleanProductUrl || undefined,
      voucherUrl: cleanVoucherUrl || undefined,
      strikeMode,
      shopeeUrl: finalUrl,
    });

    setTitle('');
    setItemsSummary('');
    setVoucherCode('');
    setVoucherNote('');
    setProductRaw('');
    setVoucherRaw('');
    setStrikeMode('checkout-wait');
  };

  return (
    <section className="section-card" aria-label="Thêm kịch bản săn mã mới">
      <div className="section-header">
        <h2 className="section-title">Thêm Ca Săn Mã Mới</h2>
      </div>

      <form className="form-stack" onSubmit={handleSubmit}>
        <div>
          <span className="field-label" style={{ marginBottom: '4px' }}>
            Khung giờ Flash Sale:
          </span>
          <div className="chip-group" role="group" aria-label="Khung giờ mẫu">
            {PRESET_SLOTS.map((preset) => (
              <button
                key={preset}
                type="button"
                className={`slot-chip ${slotTime === preset ? 'active' : ''}`}
                onClick={() => setSlotTime(preset)}
              >
                {preset}
              </button>
            ))}
          </div>
        </div>

        <div className="form-row form-row-2">
          <label className="field-label">
            <span>Khung giờ mở mã (HH:MM)</span>
            <input
              type="text"
              className="text-input tabular-nums"
              placeholder="VD: 00:00"
              value={slotTime}
              onChange={(e) => setSlotTime(e.target.value)}
            />
          </label>

          <label className="field-label">
            <span>Phương thức thanh toán</span>
            <select
              className="select-input"
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
            >
              {PAYMENT_METHODS.map((method) => (
                <option key={method} value={method}>
                  {method}
                </option>
              ))}
            </select>
          </label>
        </div>

        {/* Paired Smart Field 1: Product Link / Share Text */}
        <div>
          <label className="field-label">
            <span>📦 Link / Đoạn chia sẻ Sản Phẩm</span>
            <input
              type="text"
              data-testid="product-url-input"
              className="text-input"
              placeholder="Dán link hoặc nguyên câu Chia sẻ từ App Shopee (vn.shp.ee / s.shopee.vn)..."
              value={productRaw}
              onChange={(e) => handleProductChange(e.target.value)}
            />
          </label>
          {productInfo.cleanUrl && (
            <div
              className="link-preview-badge"
              data-testid="product-link-preview"
              title={productInfo.cleanUrl}
              style={{ marginTop: '4px' }}
            >
              ✓ Đã bóc link SP: {productInfo.cleanUrl}
              {productInfo.shopId ? ` • Shop #${productInfo.shopId}` : ''}
              {isResolvingLink ? ' (Đang giải mã link rút gọn...)' : ''}
            </div>
          )}

          {autoProductVouchers.length > 0 && (
            <div
              className="auto-voucher-box"
              data-testid="form-auto-voucher-list"
              style={{ marginTop: '6px' }}
            >
              <div className="auto-voucher-box-header">
                <span>
                  🎯 Tự động kéo {autoProductVouchers.length} Voucher áp dụng cho SP này (Bấm chọn
                  hoặc Dùng luôn):
                </span>
              </div>
              <div className="auto-voucher-list">
                {autoProductVouchers.map((v) => {
                  const isPicked =
                    voucherRaw === v.voucherUrl && voucherNote === v.voucherNote;
                  return (
                    <div
                      key={v.id}
                      className={`auto-voucher-item ${isPicked ? 'is-picked' : ''}`}
                      data-testid={`form-auto-voucher-${v.id}`}
                    >
                      <div className="auto-voucher-info">
                        <span className="auto-voucher-badge">{v.badge}</span>
                        <span className="auto-voucher-note">{v.voucherNote}</span>
                      </div>
                      <div className="auto-voucher-actions">
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          data-testid={`select-auto-voucher-${v.id}`}
                          onClick={() => handleApplyAutoVoucher(v)}
                        >
                          {isPicked ? '✓ Đã chọn' : '+ Chọn mã này'}
                        </button>
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          data-testid={`use-now-auto-voucher-${v.id}`}
                          onClick={() => handleDirectUseAutoVoucher(v)}
                        >
                          ⚡ Dùng luôn
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Paired Smart Field 2: Voucher Claim Link / Hub */}
        <div>
          <label className="field-label">
            <span>🎟️ Link Lưu Voucher / Kho Mã</span>
            <input
              type="text"
              data-testid="voucher-url-input"
              className="text-input"
              placeholder="Dán link lưu voucher (s.shopee.vn / promotionId) hoặc chọn trạm bên dưới..."
              value={voucherRaw}
              onChange={(e) => setVoucherRaw(e.target.value)}
            />
          </label>
          <div
            className="chip-group"
            role="group"
            aria-label="Đích đến mẫu"
            style={{ marginTop: '5px' }}
          >
            {DESTINATION_CHIPS.map((chip) => {
              const isSelected =
                voucherRaw === chip.url || voucherInfo.cleanUrl === chip.url;
              return (
                <button
                  key={chip.label}
                  type="button"
                  className={`slot-chip ${isSelected ? 'active' : ''}`}
                  onClick={() => setVoucherRaw(chip.url)}
                >
                  {chip.label}
                </button>
              );
            })}
          </div>
          {voucherInfo.cleanUrl &&
            !DESTINATION_CHIPS.some((c) => c.url === voucherInfo.cleanUrl) && (
              <div
                className="link-preview-badge"
                data-testid="voucher-link-preview"
                title={voucherInfo.cleanUrl}
                style={{ marginTop: '4px' }}
              >
                ✓ Đã bóc link Mã: {voucherInfo.cleanUrl}
              </div>
            )}
        </div>

        {/* Strike Mode Selector */}
        <div>
          <span className="field-label" style={{ marginBottom: '4px' }}>
            ⚡ Chế độ Tác Chiến:
          </span>
          <div
            className="strike-mode-pills"
            role="group"
            aria-label="Chế độ tác chiến"
          >
            {STRIKE_MODE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                data-testid={`strike-mode-${opt.value}`}
                aria-pressed={strikeMode === opt.value}
                className={`strike-mode-pill ${
                  strikeMode === opt.value ? 'active' : ''
                }`}
                onClick={() => setStrikeMode(opt.value)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="form-row form-row-2">
          <label className="field-label">
            <span>Tên ca săn / Nhãn gợi nhớ</span>
            <input
              type="text"
              className="text-input"
              placeholder="VD: Săn mã Mall 20% khung 0h"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </label>

          <label className="field-label">
            <span>Món cần tick sẵn trong Giỏ</span>
            <input
              type="text"
              className="text-input"
              placeholder="VD: Tai nghe Sony + Cáp sạc"
              value={itemsSummary}
              onChange={(e) => setItemsSummary(e.target.value)}
            />
          </label>
        </div>

        <div className="form-row form-row-2">
          <label className="field-label">
            <span>Mã Voucher ký tự (bỏ trống nếu mã lưu Banner)</span>
            <input
              type="text"
              className="text-input"
              placeholder="VD: AFF1111HOANXU"
              value={voucherCode}
              onChange={(e) => setVoucherCode(e.target.value)}
            />
          </label>

          <label className="field-label">
            <span>Điều kiện / Ghi chú mã</span>
            <input
              type="text"
              className="text-input"
              placeholder="VD: Giảm 20% tối đa 100k đơn từ 500k"
              value={voucherNote}
              onChange={(e) => setVoucherNote(e.target.value)}
            />
          </label>
        </div>

        <button type="submit" className="btn btn-primary">
          + Thêm Vào Kịch Bản Săn Mã
        </button>
      </form>
    </section>
  );
};

export default RunbookForm;

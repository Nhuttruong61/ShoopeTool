import React, { useState } from 'react';
import { extractShopeeLinkInfo } from '../lib/clipboard';
import type {
  DealRunbookItem,
  RunbookChecklist,
  StrikeMode,
} from '../types/contracts';

export interface DealLinksPatch {
  productUrl?: string;
  voucherUrl?: string;
  voucherCode?: string;
  strikeMode?: StrikeMode;
  title?: string;
  itemsSummary?: string;
  shopeeUrl?: string;
}

export interface RunbookListProps {
  items: DealRunbookItem[];
  activeId: string | null;
  copiedId: string | null;
  onSelectActive: (id: string) => void;
  onToggleChecklist: (id: string, key: keyof RunbookChecklist) => void;
  onCopyCode: (item: DealRunbookItem) => void;
  onCopyAndOpenShopee: (item: DealRunbookItem) => void;
  onOpenCart?: (item: DealRunbookItem) => void;
  onOpenProduct?: (item: DealRunbookItem) => void;
  onOpenVoucher?: (item: DealRunbookItem) => void;
  onUpdateDealLinks?: (id: string, patch: DealLinksPatch) => void;
  onToggleCompleted: (id: string) => void;
  onDelete: (id: string) => void;
}

interface AttachDraftState {
  productRaw: string;
  voucherRaw: string;
  codeRaw: string;
  strikeMode: StrikeMode;
}

const CHECKLIST_STEPS: ReadonlyArray<{
  key: keyof RunbookChecklist;
  label: string;
  shortLabel: string;
}> = [
  {
    key: 'itemsTickedInCart',
    label: '1. Đã tick sẵn món trong Giỏ',
    shortLabel: '1. Tick giỏ',
  },
  {
    key: 'waitingAtCheckoutScreen',
    label: '2. Đang đứng chờ ở màn Thanh Toán',
    shortLabel: '2. Thanh toán',
  },
  {
    key: 'paymentMethodSelected',
    label: '3. Đã chọn ShopeePay / SPayLater',
    shortLabel: '3. Chọn ví/TT',
  },
];

export function getDestinationHint(url?: string): string {
  if (!url) return '';
  if (url.includes('ma-giam-gia')) return 'Kho Mã';
  if (url.includes('voucher-xtra')) return 'Xtra';
  if (url.includes('mien-phi-van-chuyen')) return 'Freeship';
  if (url.includes('shopee-live')) return 'Live';
  if (url.includes('shopee-video')) return 'Video';
  if (url.includes('shopeepay')) return 'ShopeePay';
  if (url.includes('uu-dai-doi-tac')) return 'Ngân hàng';
  if (url.includes('shopee-rewards')) return 'Rewards';
  if (url.includes('cart')) return 'Giỏ hàng';
  return 'Shopee';
}

export const RunbookList: React.FC<RunbookListProps> = ({
  items,
  activeId,
  copiedId,
  onSelectActive,
  onToggleChecklist,
  onCopyCode,
  onCopyAndOpenShopee,
  onOpenCart,
  onOpenProduct,
  onOpenVoucher,
  onUpdateDealLinks,
  onToggleCompleted,
  onDelete,
}) => {
  const [attachDrafts, setAttachDrafts] = useState<
    Record<string, AttachDraftState>
  >({});

  const handleToggleAttach = (item: DealRunbookItem) => {
    setAttachDrafts((prev) => {
      if (prev[item.id]) {
        const next = { ...prev };
        delete next[item.id];
        return next;
      }
      return {
        ...prev,
        [item.id]: {
          productRaw: item.productUrl ?? '',
          voucherRaw: item.voucherUrl ?? '',
          codeRaw: item.voucherCode ?? '',
          strikeMode: item.strikeMode ?? 'checkout-wait',
        },
      };
    });
  };

  const handleUpdateDraft = (
    id: string,
    partial: Partial<AttachDraftState>,
  ) => {
    setAttachDrafts((prev) => {
      const existing = prev[id];
      if (!existing) return prev;
      return {
        ...prev,
        [id]: { ...existing, ...partial },
      };
    });
  };

  const handleCloseAttach = (id: string) => {
    setAttachDrafts((prev) => {
      if (!prev[id]) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const handleSaveAttach = (item: DealRunbookItem) => {
    const draft = attachDrafts[item.id];
    if (!draft) return;

    const prodInfo = extractShopeeLinkInfo(draft.productRaw);
    const vouchInfo = extractShopeeLinkInfo(draft.voucherRaw);
    const cleanProduct = prodInfo.cleanUrl || undefined;
    const cleanVoucher = vouchInfo.cleanUrl || undefined;
    const cleanCode = draft.codeRaw.trim().toUpperCase();
    const productChanged =
      draft.productRaw.trim() !== (item.productUrl ?? '').trim();

    const patch: DealLinksPatch = {
      productUrl: cleanProduct,
      voucherUrl: cleanVoucher,
      voucherCode: cleanCode,
      strikeMode: draft.strikeMode,
      shopeeUrl: cleanProduct || cleanVoucher || item.shopeeUrl,
    };

    if (productChanged && prodInfo.extractedTitle) {
      patch.title = prodInfo.extractedTitle;
      patch.itemsSummary = prodInfo.extractedTitle;
    }

    onUpdateDealLinks?.(item.id, patch);
    handleCloseAttach(item.id);
  };

  if (items.length === 0) {
    return (
      <section className="section-card" aria-label="Danh sách kịch bản săn mã">
        <div className="section-header" style={{ marginBottom: 4 }}>
          <h2 className="section-title">Kịch Bản Săn Mã (0 ca)</h2>
        </div>
        <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: '0.85rem' }}>
          Chưa có ca săn mã nào. Hãy thêm ca săn mới hoặc nạp từ Bộ Tối Ưu Giỏ Hàng!
        </p>
      </section>
    );
  }

  return (
    <section className="runbook-container" aria-label="Danh sách kịch bản săn mã">
      <div className="runbook-header-compact">
        <h2 className="section-title" style={{ fontSize: '0.92rem', margin: 0 }}>
          Kịch Bản Săn Mã ({items.length} ca)
        </h2>
        <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
          Hoàn thành 3/3 bước trước giờ mở mã
        </span>
      </div>

      <div className="runbook-list">
        {items.map((item) => {
          const isActive = item.id === activeId;
          const isCopied = item.id === copiedId;
          const readyCount = [
            item.checklist.itemsTickedInCart,
            item.checklist.waitingAtCheckoutScreen,
            item.checklist.paymentMethodSelected,
          ].filter(Boolean).length;
          const isAllReady = readyCount === 3;
          const destHint = getDestinationHint(item.voucherUrl || item.shopeeUrl);
          const draft = attachDrafts[item.id];
          const isAttachOpen = Boolean(draft);
          const draftProductInfo = draft
            ? extractShopeeLinkInfo(draft.productRaw)
            : null;

          const cardClass = [
            'runbook-card',
            isActive ? 'is-active' : '',
            item.completed ? 'is-completed' : '',
          ]
            .filter(Boolean)
            .join(' ');

          return (
            <article
              key={item.id}
              className={cardClass}
              data-testid={`runbook-card-${item.id}`}
            >
              {/* Header row (1 tight flex line) */}
              <div className="runbook-card-header">
                <span className="slot-pill">{item.slotTime}</span>
                <h3 className="runbook-title" title={item.title}>
                  {item.title}
                </h3>
                <span
                  className={`readiness-badge tabular-nums ${isAllReady ? 'is-ready' : ''}`}
                  data-testid={`readiness-badge-${item.id}`}
                >
                  {readyCount}/3
                </span>
                <button
                  type="button"
                  className={`btn runbook-select-btn ${
                    isActive ? 'btn-active-toggle' : 'btn-outline-accent'
                  }`}
                  onClick={() => onSelectActive(item.id)}
                >
                  {isActive ? 'Đang canh ca này' : 'Chọn canh giờ'}
                </button>
              </div>

              {/* Compact 1-line meta + inline actions row */}
              <div className="runbook-meta-action-row">
                <div className="runbook-meta-inline">
                  {item.voucherCode ? (
                    <span className="voucher-code-pill">Mã: {item.voucherCode}</span>
                  ) : (
                    <span className="wallet-voucher-badge">
                      Mã lưu trong Ví Shopee
                    </span>
                  )}
                  <span className="runbook-meta-pay">• {item.paymentMethod}</span>
                  {item.productUrl && (
                    <span
                      className="product-linked-badge"
                      title={item.productUrl}
                    >
                      📦 Đã gán SP
                    </span>
                  )}
                  {item.strikeMode === 'flash-product' && (
                    <span className="flash-mode-badge">⚡ Flash SP</span>
                  )}
                  {destHint && (
                    <span
                      className="dest-pill"
                      title={item.voucherUrl || item.shopeeUrl}
                    >
                      🎯 {destHint}
                    </span>
                  )}
                  {item.voucherNote && (
                    <span
                      className="runbook-verbose-meta"
                      style={{ color: '#fde68a', fontSize: '0.72rem' }}
                    >
                      ({item.voucherNote})
                    </span>
                  )}
                </div>

                <div className="runbook-inline-actions">
                  <button
                    type="button"
                    data-testid={`toggle-attach-${item.id}`}
                    className={`btn btn-sm ${
                      isAttachOpen ? 'btn-active-toggle' : 'btn-secondary'
                    }`}
                    onClick={() => handleToggleAttach(item)}
                  >
                    🔗 Gán SP/Mã
                  </button>

                  {item.voucherCode && (
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => onCopyCode(item)}
                    >
                      {isCopied
                        ? `Đã Copy: ${item.voucherCode}`
                        : `Copy Mã (${item.voucherCode})`}
                    </button>
                  )}

                  {item.productUrl ? (
                    <>
                      {item.voucherUrl && (
                        <button
                          type="button"
                          data-testid={`open-voucher-btn-${item.id}`}
                          className="btn btn-outline-accent btn-sm"
                          onClick={() =>
                            onOpenVoucher
                              ? onOpenVoucher(item)
                              : onCopyAndOpenShopee(item)
                          }
                        >
                          🎟️ Lưu Mã
                        </button>
                      )}

                      <button
                        type="button"
                        data-testid={`open-product-btn-${item.id}`}
                        className="btn btn-primary btn-sm"
                        onClick={() =>
                          onOpenProduct
                            ? onOpenProduct(item)
                            : onCopyAndOpenShopee(item)
                        }
                      >
                        {item.voucherCode ? 'Copy Mã + Mở SP' : '📦 Mua SP Ngay'}
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={() => onCopyAndOpenShopee(item)}
                    >
                      {item.voucherCode
                        ? 'Copy Mã + Mở App Shopee'
                        : 'Mở App Shopee'}
                    </button>
                  )}

                  {onOpenCart && destHint !== 'Giỏ hàng' && (
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm btn-cart"
                      onClick={() => onOpenCart(item)}
                      title="Mở thẳng Giỏ Hàng Shopee"
                    >
                      🛒 Giỏ hàng
                    </button>
                  )}

                  <label className="runbook-done-check" title="Đánh dấu đã săn xong">
                    <input
                      type="checkbox"
                      aria-label="Đánh dấu đã săn xong"
                      checked={item.completed}
                      onChange={() => onToggleCompleted(item.id)}
                    />
                    <span>Xong</span>
                  </label>

                  <button
                    type="button"
                    className="btn-delete-card"
                    aria-label="Xóa ca"
                    title="Xóa ca săn này"
                    onClick={() => onDelete(item.id)}
                  >
                    ✕
                  </button>
                </div>
              </div>

              {/* Inline Quick-Attach Drawer */}
              {isAttachOpen && draft && (
                <div
                  className="inline-attach-box"
                  data-testid={`inline-attach-box-${item.id}`}
                >
                  <div className="inline-attach-grid">
                    <label className="field-label">
                      <span>📦 Link Sản Phẩm</span>
                      <input
                        type="text"
                        data-testid={`attach-product-input-${item.id}`}
                        className="text-input"
                        placeholder="Dán link hoặc câu Chia sẻ SP từ App Shopee..."
                        value={draft.productRaw}
                        onChange={(e) =>
                          handleUpdateDraft(item.id, {
                            productRaw: e.target.value,
                          })
                        }
                      />
                    </label>

                    <label className="field-label">
                      <span>🎟️ Link Voucher</span>
                      <input
                        type="text"
                        data-testid={`attach-voucher-input-${item.id}`}
                        className="text-input"
                        placeholder="Dán link lưu mã / kho voucher..."
                        value={draft.voucherRaw}
                        onChange={(e) =>
                          handleUpdateDraft(item.id, {
                            voucherRaw: e.target.value,
                          })
                        }
                      />
                    </label>
                  </div>

                  {draftProductInfo?.cleanUrl && (
                    <div
                      className="link-preview-badge"
                      title={draftProductInfo.cleanUrl}
                    >
                      ✓ Đã bóc link SP: {draftProductInfo.cleanUrl}
                      {draftProductInfo.extractedTitle
                        ? ` (${draftProductInfo.extractedTitle})`
                        : ''}
                    </div>
                  )}

                  <div className="inline-attach-grid">
                    <label className="field-label">
                      <span>Mã ký tự</span>
                      <input
                        type="text"
                        data-testid={`attach-code-input-${item.id}`}
                        className="text-input"
                        placeholder="VD: AFFSONY50 (nếu có)"
                        value={draft.codeRaw}
                        onChange={(e) =>
                          handleUpdateDraft(item.id, {
                            codeRaw: e.target.value,
                          })
                        }
                      />
                    </label>

                    <div className="field-label">
                      <span>Chế độ tác chiến</span>
                      <div
                        className="strike-mode-pills strike-mode-pills-compact"
                        role="group"
                        aria-label="Chế độ tác chiến"
                      >
                        <button
                          type="button"
                          aria-pressed={draft.strikeMode === 'checkout-wait'}
                          className={`strike-mode-pill ${
                            draft.strikeMode === 'checkout-wait' ? 'active' : ''
                          }`}
                          onClick={() =>
                            handleUpdateDraft(item.id, {
                              strikeMode: 'checkout-wait',
                            })
                          }
                        >
                          🛒 Chờ Thanh toán
                        </button>
                        <button
                          type="button"
                          aria-pressed={draft.strikeMode === 'flash-product'}
                          className={`strike-mode-pill ${
                            draft.strikeMode === 'flash-product' ? 'active' : ''
                          }`}
                          onClick={() =>
                            handleUpdateDraft(item.id, {
                              strikeMode: 'flash-product',
                            })
                          }
                        >
                          ⚡ Flash SP
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="inline-attach-actions">
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => handleCloseAttach(item.id)}
                    >
                      Hủy
                    </button>
                    <button
                      type="button"
                      data-testid={`save-attach-${item.id}`}
                      className="btn btn-emerald btn-sm"
                      onClick={() => handleSaveAttach(item)}
                    >
                      Lưu gán
                    </button>
                  </div>
                </div>
              )}

              {/* 3-Step Checklist as single horizontal 3-column pill row */}
              <div className="checklist-box" role="group" aria-label={`Checklist ${item.title}`}>
                {CHECKLIST_STEPS.map((step) => {
                  const checked = item.checklist[step.key];
                  return (
                    <label
                      key={step.key}
                      className={`checklist-item ${checked ? 'checked' : ''}`}
                      title={step.label}
                    >
                      <input
                        type="checkbox"
                        aria-label={step.label}
                        checked={checked}
                        onChange={() => onToggleChecklist(item.id, step.key)}
                      />
                      <span>{step.shortLabel}</span>
                    </label>
                  );
                })}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
};

export default RunbookList;

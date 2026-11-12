import React from 'react';
import type { DealRunbookItem, RunbookChecklist } from '../types/contracts';

export interface RunbookListProps {
  items: DealRunbookItem[];
  activeId: string | null;
  copiedId: string | null;
  onSelectActive: (id: string) => void;
  onToggleChecklist: (id: string, key: keyof RunbookChecklist) => void;
  onCopyCode: (item: DealRunbookItem) => void;
  onCopyAndOpenShopee: (item: DealRunbookItem) => void;
  onOpenCart?: (item: DealRunbookItem) => void;
  onToggleCompleted: (id: string) => void;
  onDelete: (id: string) => void;
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
  onToggleCompleted,
  onDelete,
}) => {
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
          const destHint = getDestinationHint(item.shopeeUrl);

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
                  {destHint && (
                    <span className="dest-pill" title={item.shopeeUrl}>
                      🎯 {destHint}
                    </span>
                  )}
                  {item.voucherNote && (
                    <span className="runbook-verbose-meta" style={{ color: '#fde68a', fontSize: '0.72rem' }}>
                      ({item.voucherNote})
                    </span>
                  )}
                </div>

                <div className="runbook-inline-actions">
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

                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={() => onCopyAndOpenShopee(item)}
                  >
                    {item.voucherCode ? 'Copy Mã + Mở App Shopee' : 'Mở App Shopee'}
                  </button>

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

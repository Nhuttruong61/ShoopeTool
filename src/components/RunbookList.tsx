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
  onToggleCompleted: (id: string) => void;
  onDelete: (id: string) => void;
}

const CHECKLIST_STEPS: ReadonlyArray<{
  key: keyof RunbookChecklist;
  label: string;
}> = [
  { key: 'itemsTickedInCart', label: '1. Đã tick sẵn món trong Giỏ' },
  { key: 'waitingAtCheckoutScreen', label: '2. Đang đứng chờ ở màn Thanh Toán' },
  { key: 'paymentMethodSelected', label: '3. Đã chọn ShopeePay / SPayLater' },
];

export const RunbookList: React.FC<RunbookListProps> = ({
  items,
  activeId,
  copiedId,
  onSelectActive,
  onToggleChecklist,
  onCopyCode,
  onCopyAndOpenShopee,
  onToggleCompleted,
  onDelete,
}) => {
  if (items.length === 0) {
    return (
      <section className="section-card" aria-label="Danh sách kịch bản săn mã">
        <div className="section-header">
          <h2 className="section-title">Kịch Bản Săn Mã (Pre-flight Runbook)</h2>
        </div>
        <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: '0.92rem' }}>
          Chưa có ca săn mã nào. Hãy thêm ca săn mới hoặc nạp từ Bộ Tối Ưu Giỏ Hàng!
        </p>
      </section>
    );
  }

  return (
    <section className="section-card" aria-label="Danh sách kịch bản săn mã">
      <div className="section-header">
        <h2 className="section-title">Kịch Bản Săn Mã ({items.length} ca)</h2>
        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          Hoàn thành 3/3 bước chuẩn bị trước giờ mở mã
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
              <div className="runbook-card-header">
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div className="runbook-meta-row">
                    <span className="slot-pill">{item.slotTime}</span>
                    <h3 style={{ margin: 0, fontSize: '1.02rem', fontWeight: 800 }}>
                      {item.title}
                    </h3>
                    <span
                      className={`readiness-badge tabular-nums ${isAllReady ? 'is-ready' : ''}`}
                      data-testid={`readiness-badge-${item.id}`}
                    >
                      Sẵn sàng {readyCount}/3
                    </span>
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: '8px',
                      fontSize: '0.84rem',
                      color: 'var(--text-secondary)',
                    }}
                  >
                    <span>
                      Món tick: <strong>{item.itemsSummary || 'Chưa ghi chú món'}</strong>
                    </span>
                    <span>•</span>
                    <span>
                      Thanh toán: <strong>{item.paymentMethod}</strong>
                    </span>
                  </div>

                  <div className="runbook-meta-row">
                    {item.voucherCode ? (
                      <span className="voucher-code-pill">Mã: {item.voucherCode}</span>
                    ) : (
                      <span className="wallet-voucher-badge">
                        Mã lưu trong Ví Shopee
                      </span>
                    )}
                    {item.voucherNote && (
                      <span style={{ fontSize: '0.82rem', color: '#fde68a' }}>
                        ({item.voucherNote})
                      </span>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className={`btn ${isActive ? 'btn-active-toggle' : 'btn-outline-accent'}`}
                    style={{ minHeight: '40px', padding: '6px 12px', fontSize: '0.82rem' }}
                    onClick={() => onSelectActive(item.id)}
                  >
                    {isActive ? 'Đang canh ca này' : 'Chọn canh giờ'}
                  </button>
                </div>
              </div>

              <div className="checklist-box" role="group" aria-label={`Checklist ${item.title}`}>
                {CHECKLIST_STEPS.map((step) => {
                  const checked = item.checklist[step.key];
                  return (
                    <label
                      key={step.key}
                      className={`checklist-item ${checked ? 'checked' : ''}`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => onToggleChecklist(item.id, step.key)}
                      />
                      <span>{step.label}</span>
                    </label>
                  );
                })}
              </div>

              <div
                className="runbook-actions"
                style={item.voucherCode ? undefined : { gridTemplateColumns: '1fr' }}
              >
                {item.voucherCode && (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => onCopyCode(item)}
                  >
                    {isCopied
                      ? `Đã Copy: ${item.voucherCode}`
                      : `Copy Mã (${item.voucherCode})`}
                  </button>
                )}

                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => onCopyAndOpenShopee(item)}
                >
                  {item.voucherCode ? 'Copy Mã + Mở App Shopee' : 'Mở App Shopee'}
                </button>
              </div>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '8px',
                  paddingTop: '4px',
                  borderTop: '1px solid rgba(255, 255, 255, 0.06)',
                }}
              >
                <label
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    fontSize: '0.82rem',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={item.completed}
                    onChange={() => onToggleCompleted(item.id)}
                  />
                  <span>Đánh dấu đã săn xong</span>
                </label>

                <button
                  type="button"
                  className="btn btn-danger-ghost"
                  style={{ minHeight: '36px', padding: '4px 10px', fontSize: '0.8rem' }}
                  onClick={() => onDelete(item.id)}
                >
                  Xóa ca
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
};

export default RunbookList;

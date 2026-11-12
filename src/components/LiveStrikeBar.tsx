import React, { useState } from 'react';
import type {
  DealRunbookItem,
  PipSupportInfo,
  StrikeCountdownState,
  TimePhase,
  TimeSyncSnapshot,
} from '../types/contracts';
import { getDestinationHint } from './RunbookList';

export interface LiveStrikeBarProps {
  countdown: StrikeCountdownState;
  syncState: TimeSyncSnapshot;
  activeDeal: DealRunbookItem | null;
  pipSupport: PipSupportInfo;
  isPipActive: boolean;
  pipError?: string | null;
  onMountInlinePipVideo?: (container: HTMLElement | null) => void;
  isFullscreenHud: boolean;
  audioEnabled: boolean;
  onSyncNow: () => void;
  onLeadMsChange: (ms: number) => void;
  onManualAdjustChange: (ms: number) => void;
  onTogglePip: () => void;
  onToggleFullscreenHud: () => void;
  onToggleAudio: () => void;
  onQuickCopyAndOpen?: (deal: DealRunbookItem) => void;
  onQuickOpenCart?: (deal: DealRunbookItem) => void;
  onQuickOpenProduct?: (deal: DealRunbookItem) => void;
  onQuickOpenVoucher?: (deal: DealRunbookItem) => void;
}

export const PHASE_LABELS: Record<TimePhase, string> = {
  IDLE: 'CHỜ KHUNG GIỜ',
  PREPARE_60S: 'CHUẨN BỊ (60s)',
  READY_10S: 'SẴN SÀNG (10s)',
  COUNTDOWN_3S: 'ĐẾM NGƯỢC 3s!',
  STRIKE_NOW: 'BẤM NGAY!',
  PASSED: 'ĐÃ QUA GIỜ',
};

export const LiveStrikeBar: React.FC<LiveStrikeBarProps> = ({
  countdown,
  syncState,
  activeDeal,
  pipSupport,
  isPipActive,
  pipError,
  onMountInlinePipVideo,
  isFullscreenHud,
  audioEnabled,
  onSyncNow,
  onLeadMsChange,
  onManualAdjustChange,
  onTogglePip,
  onToggleFullscreenHud,
  onToggleAudio,
  onQuickCopyAndOpen,
  onQuickOpenCart,
  onQuickOpenProduct,
  onQuickOpenVoucher,
}) => {
  const [showTuning, setShowTuning] = useState(false);
  const phaseLabel = PHASE_LABELS[countdown.phase] ?? PHASE_LABELS.IDLE;
  const activeDestHint = activeDeal
    ? getDestinationHint(activeDeal.voucherUrl || activeDeal.shopeeUrl)
    : '';

  const containerClassName = [
    'strike-bar',
    `phase-${countdown.phase}`,
    isFullscreenHud ? 'hud-fullscreen' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const formattedOffset =
    syncState.offsetMs >= 0
      ? `+${Math.round(syncState.offsetMs)}ms`
      : `${Math.round(syncState.offsetMs)}ms`;

  const renderActiveDealBar = () =>
    activeDeal ? (
      <div className="active-deal-summary" data-testid="active-deal-banner">
        <div className="active-deal-left">
          <span className="slot-pill">{activeDeal.slotTime}</span>
          <strong className="active-deal-title" title={activeDeal.title}>
            {activeDeal.title}
          </strong>
          {activeDeal.voucherCode ? (
            <span className="voucher-code-pill">Mã: {activeDeal.voucherCode}</span>
          ) : (
            <span className="wallet-voucher-badge">Mã lưu trong Ví Shopee</span>
          )}
          {activeDeal.productUrl && (
            <span
              className="product-linked-badge"
              title={activeDeal.productUrl}
            >
              📦 Đã gán SP
            </span>
          )}
          {activeDestHint && (
            <span
              className="dest-pill"
              title={activeDeal.voucherUrl || activeDeal.shopeeUrl}
            >
              🎯 {activeDestHint}
            </span>
          )}
        </div>

        <div className="active-deal-actions">
          {activeDeal.productUrl ? (
            <>
              {activeDeal.voucherUrl &&
                (onQuickOpenVoucher || onQuickCopyAndOpen) && (
                  <button
                    type="button"
                    data-testid="quick-open-voucher-btn"
                    className="btn btn-outline-accent active-deal-open-btn"
                    onClick={() =>
                      (onQuickOpenVoucher ?? onQuickCopyAndOpen)?.(activeDeal)
                    }
                  >
                    🎟️ Lưu Mã
                  </button>
                )}
              {(onQuickOpenProduct || onQuickCopyAndOpen) && (
                <button
                  type="button"
                  data-testid="quick-open-product-btn"
                  className="btn btn-primary active-deal-open-btn"
                  onClick={() =>
                    (onQuickOpenProduct ?? onQuickCopyAndOpen)?.(activeDeal)
                  }
                >
                  {activeDeal.voucherCode ? 'Copy Mã + Mở SP' : '📦 Mở SP Ngay'}
                </button>
              )}
              {onQuickOpenCart && (
                <button
                  type="button"
                  className="btn btn-secondary active-deal-open-btn"
                  onClick={() => onQuickOpenCart(activeDeal)}
                  title="Mở thẳng Giỏ Hàng Shopee"
                >
                  🛒
                </button>
              )}
            </>
          ) : (
            <>
              {onQuickCopyAndOpen && (
                <button
                  type="button"
                  className="btn btn-primary active-deal-open-btn"
                  onClick={() => onQuickCopyAndOpen(activeDeal)}
                >
                  {activeDeal.voucherCode
                    ? 'Copy Mã + Mở App Shopee'
                    : 'Mở App Shopee'}
                </button>
              )}
              {onQuickOpenCart && activeDestHint !== 'Giỏ hàng' && (
                <button
                  type="button"
                  className="btn btn-secondary active-deal-open-btn"
                  onClick={() => onQuickOpenCart(activeDeal)}
                  title="Mở thẳng Giỏ Hàng Shopee"
                >
                  🛒
                </button>
              )}
            </>
          )}
        </div>
      </div>
    ) : (
      <div className="active-deal-summary" data-testid="active-deal-empty">
        <span className="active-deal-empty-text">Chưa chọn ca săn mục tiêu</span>
      </div>
    );

  const renderPipErrorBanner = () =>
    pipError ? (
      <div
        className="shortfall-alert"
        style={{
          marginTop: '6px',
          padding: '6px 8px',
          fontSize: '0.76rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '4px',
        }}
        data-testid="pip-error-banner"
      >
        <span>{pipError}</span>
        {onMountInlinePipVideo && (
          <div
            ref={(el) => onMountInlinePipVideo(el)}
            style={{ display: 'flex', justifyContent: 'center' }}
            data-testid="inline-pip-video-slot"
          />
        )}
      </div>
    ) : null;

  if (isFullscreenHud) {
    return (
      <section className={containerClassName} aria-label="Đồng hồ canh nhịp săn mã">
        <div className="strike-header-row">
          <span className="phase-badge" data-testid="phase-badge">
            {phaseLabel}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <button
              type="button"
              className={`btn btn-sm ${audioEnabled ? 'btn-active-toggle' : 'btn-secondary'}`}
              onClick={onToggleAudio}
              aria-pressed={audioEnabled}
            >
              {audioEnabled ? 'Âm: BẬT' : 'Âm: TẮT'}
            </button>
            <button
              type="button"
              className="btn btn-danger-ghost btn-sm"
              onClick={onToggleFullscreenHud}
            >
              Thoát HUD
            </button>
          </div>
        </div>

        <div className="clock-main-box">
          <div className="clock-display tabular-nums" data-testid="live-clock">
            {countdown.formattedClock}
          </div>
          <div className="countdown-row">
            <span className="countdown-label">Còn lại:</span>
            <span className="countdown-display tabular-nums" data-testid="live-countdown">
              {countdown.formattedRemaining}
            </span>
          </div>
        </div>

        <div>
          {renderActiveDealBar()}
          {renderPipErrorBanner()}
        </div>
      </section>
    );
  }

  return (
    <section className={containerClassName} aria-label="Đồng hồ canh nhịp săn mã">
      {/* Row 1: Compact Horizontal Bar */}
      <div className="strike-row-1">
        <div className="strike-clock-box">
          <span className="clock-display tabular-nums" data-testid="live-clock">
            {countdown.formattedClock}
          </span>
          <span className="countdown-inline tabular-nums">
            Còn:{' '}
            <strong className="countdown-display" data-testid="live-countdown">
              {countdown.formattedRemaining}
            </strong>
          </span>
        </div>

        <span className="phase-badge" data-testid="phase-badge">
          {phaseLabel}
        </span>
      </div>

      {/* Row 2: Compact Active Deal + Quick Controls in 1 tight grid/flex */}
      <div className="strike-row-2">
        {renderActiveDealBar()}

        <div className="strike-controls-strip">
          <button
            type="button"
            className={`btn btn-sm ${isPipActive ? 'btn-active-toggle' : 'btn-secondary'}`}
            onClick={onTogglePip}
            aria-pressed={isPipActive}
            title="Đồng hồ nổi PiP"
          >
            {isPipActive ? '✓ PiP' : '⧉ PiP'}
          </button>

          <button
            type="button"
            className={`btn btn-sm ${isFullscreenHud ? 'btn-active-toggle' : 'btn-secondary'}`}
            onClick={onToggleFullscreenHud}
            aria-pressed={isFullscreenHud}
            title="Toàn màn hình HUD"
          >
            HUD
          </button>

          <button
            type="button"
            className={`btn btn-sm ${audioEnabled ? 'btn-active-toggle' : 'btn-secondary'}`}
            onClick={onToggleAudio}
            aria-pressed={audioEnabled}
            title="Âm báo nhịp"
          >
            {audioEnabled ? 'Âm: BẬT' : 'Âm: TẮT'}
          </button>

          <button
            type="button"
            className={`btn btn-sm ${showTuning ? 'btn-active-toggle' : 'btn-secondary'}`}
            onClick={() => setShowTuning((v) => !v)}
            aria-expanded={showTuning}
            title="Tinh chỉnh nhịp phản xạ & đồng bộ"
          >
            ⚙️ Nhịp ({countdown.leadMs >= 0 ? `+${countdown.leadMs}` : countdown.leadMs}ms)
          </button>
        </div>
      </div>

      {/* Collapsible Settings Drawer */}
      {showTuning && (
        <div className="strike-tuning-drawer">
          <div className="controls-grid">
            <div className="slider-card">
              <label className="slider-header" htmlFor="lead-ms-slider">
                <span>Báo sớm bù phản xạ tay (0–2000ms)</span>
                <span className="slider-val tabular-nums">{countdown.leadMs}ms</span>
              </label>
              <input
                id="lead-ms-slider"
                type="range"
                className="range-input"
                min={0}
                max={2000}
                step={50}
                value={countdown.leadMs}
                onChange={(e) => onLeadMsChange(Number(e.target.value))}
              />
            </div>

            <div className="slider-card">
              <label className="slider-header" htmlFor="manual-adjust-slider">
                <span>Tinh chỉnh lệch giờ thủ công (-2000ms..+2000ms)</span>
                <span className="slider-val tabular-nums">
                  {syncState.manualAdjustMs >= 0
                    ? `+${syncState.manualAdjustMs}ms`
                    : `${syncState.manualAdjustMs}ms`}
                </span>
              </label>
              <input
                id="manual-adjust-slider"
                type="range"
                className="range-input"
                min={-2000}
                max={2000}
                step={50}
                value={syncState.manualAdjustMs}
                onChange={(e) => onManualAdjustChange(Number(e.target.value))}
              />
            </div>
          </div>

          <div className="strike-sync-footer">
            <span
              className="tabular-nums"
              style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}
            >
              {syncState.synced
                ? `Đã đồng bộ (${syncState.source}) • Lệch ${formattedOffset}${
                    syncState.rttMs !== null ? ` • RTT ${Math.round(syncState.rttMs)}ms` : ''
                  }`
                : `Giờ máy (${syncState.source})`}
            </span>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={onSyncNow}
            >
              Đồng bộ lại
            </button>
          </div>
        </div>
      )}

      {renderPipErrorBanner()}

      {pipSupport.fallbackHudOnly && !pipError && (
        <p
          style={{
            margin: '6px 0 0',
            fontSize: '0.72rem',
            color: '#fde68a',
            textAlign: 'center',
          }}
        >
          Trình duyệt hạn chế Canvas PiP — nên dùng HUD + Âm báo.
        </p>
      )}
    </section>
  );
};

export default LiveStrikeBar;

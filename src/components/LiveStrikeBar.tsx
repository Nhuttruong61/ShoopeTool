import React from 'react';
import type {
  DealRunbookItem,
  PipSupportInfo,
  StrikeCountdownState,
  TimePhase,
  TimeSyncSnapshot,
} from '../types/contracts';

export interface LiveStrikeBarProps {
  countdown: StrikeCountdownState;
  syncState: TimeSyncSnapshot;
  activeDeal: DealRunbookItem | null;
  pipSupport: PipSupportInfo;
  isPipActive: boolean;
  isFullscreenHud: boolean;
  audioEnabled: boolean;
  onSyncNow: () => void;
  onLeadMsChange: (ms: number) => void;
  onManualAdjustChange: (ms: number) => void;
  onTogglePip: () => void;
  onToggleFullscreenHud: () => void;
  onToggleAudio: () => void;
  onQuickCopyAndOpen?: (deal: DealRunbookItem) => void;
}

export const PHASE_LABELS: Record<TimePhase, string> = {
  IDLE: 'CHỜ KHUNG GIỜ',
  PREPARE_60S: 'CHUẨN BỊ VÀO THANH TOÁN (60s)',
  READY_10S: 'SẴN SÀNG TAY BẤM (10s)',
  COUNTDOWN_3S: 'ĐẾM NGƯỢC 3 GIÂY!',
  STRIKE_NOW: 'BẤM ĐẶT HÀNG NGAY!',
  PASSED: 'ĐÃ QUA MỐC GIỜ',
};

export const LiveStrikeBar: React.FC<LiveStrikeBarProps> = ({
  countdown,
  syncState,
  activeDeal,
  pipSupport,
  isPipActive,
  isFullscreenHud,
  audioEnabled,
  onSyncNow,
  onLeadMsChange,
  onManualAdjustChange,
  onTogglePip,
  onToggleFullscreenHud,
  onToggleAudio,
  onQuickCopyAndOpen,
}) => {
  const phaseLabel = PHASE_LABELS[countdown.phase] ?? PHASE_LABELS.IDLE;

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

  return (
    <section className={containerClassName} aria-label="Đồng hồ canh nhịp săn mã">
      <div className="strike-header-row">
        <span className="phase-badge" data-testid="phase-badge">
          {phaseLabel}
        </span>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span
            className="tabular-nums"
            style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}
          >
            {syncState.synced
              ? `Đã đồng bộ (${syncState.source}) • Lệch ${formattedOffset}${
                  syncState.rttMs !== null ? ` • RTT ${Math.round(syncState.rttMs)}ms` : ''
                }`
              : `Giờ máy (${syncState.source})`}
          </span>
          <button
            type="button"
            className="btn btn-secondary"
            style={{ minHeight: '36px', padding: '4px 10px', fontSize: '0.8rem' }}
            onClick={onSyncNow}
          >
            Đồng bộ lại
          </button>
          {isFullscreenHud && (
            <button
              type="button"
              className="btn btn-danger-ghost"
              style={{ minHeight: '36px', padding: '4px 10px', fontSize: '0.8rem' }}
              onClick={onToggleFullscreenHud}
            >
              Thoát HUD
            </button>
          )}
        </div>
      </div>

      <div className="clock-main-box">
        <div className="clock-display tabular-nums" data-testid="live-clock">
          {countdown.formattedClock}
        </div>
        <div className="countdown-row">
          <span className="countdown-label">Còn lại đến mốc mở mã:</span>
          <span className="countdown-display tabular-nums" data-testid="live-countdown">
            {countdown.formattedRemaining}
          </span>
        </div>
      </div>

      {activeDeal ? (
        <div className="active-deal-summary" data-testid="active-deal-banner">
          <div className="active-deal-top">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span className="slot-pill">{activeDeal.slotTime}</span>
              <strong style={{ fontSize: '0.95rem' }}>{activeDeal.title}</strong>
            </div>
            {activeDeal.voucherCode ? (
              <span className="voucher-code-pill">Mã: {activeDeal.voucherCode}</span>
            ) : (
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Mã lưu sẵn trong Ví
              </span>
            )}
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '8px',
              flexWrap: 'wrap',
              fontSize: '0.84rem',
              color: 'var(--text-secondary)',
            }}
          >
            <span>
              Món: <strong>{activeDeal.itemsSummary || 'Đã chọn trong giỏ'}</strong> • TT:{' '}
              <strong>{activeDeal.paymentMethod}</strong>
            </span>
            {onQuickCopyAndOpen && (
              <button
                type="button"
                className="btn btn-primary"
                style={{ minHeight: '48px', padding: '8px 14px', fontSize: '0.85rem' }}
                onClick={() => onQuickCopyAndOpen(activeDeal)}
              >
                Copy Mã + Mở Shopee
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="active-deal-summary" data-testid="active-deal-empty">
          <span style={{ fontSize: '0.88rem', color: 'var(--text-muted)' }}>
            Chưa chọn ca săn mã mục tiêu. Hãy chọn 1 ca bên dưới để bắt đầu đếm ngược.
          </span>
        </div>
      )}

      <div className="controls-grid">
        <div className="slider-card">
          <label className="slider-header" htmlFor="lead-ms-slider">
            <span>Báo sớm bù phản xạ tay (0–2000ms, mặc định 300ms)</span>
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

      <div className="action-buttons-grid">
        <button
          type="button"
          className={`btn ${isPipActive ? 'btn-active-toggle' : 'btn-primary'}`}
          onClick={onTogglePip}
          aria-pressed={isPipActive}
        >
          {isPipActive ? 'Đang Bật Đồng Hồ Nổi (PiP)' : 'Bật Đồng Hồ Nổi (PiP)'}
        </button>

        <button
          type="button"
          className={`btn ${isFullscreenHud ? 'btn-active-toggle' : 'btn-secondary'}`}
          onClick={onToggleFullscreenHud}
          aria-pressed={isFullscreenHud}
        >
          Chế độ Toàn Màn Hình (HUD)
        </button>

        <button
          type="button"
          className={`btn ${audioEnabled ? 'btn-active-toggle' : 'btn-secondary'}`}
          onClick={onToggleAudio}
          aria-pressed={audioEnabled}
        >
          Âm Báo Nhịp: {audioEnabled ? 'BẬT' : 'TẮT'}
        </button>
      </div>

      {pipSupport.fallbackHudOnly && (
        <p
          style={{
            margin: '10px 0 0',
            fontSize: '0.78rem',
            color: '#fde68a',
            textAlign: 'center',
          }}
        >
          Trình duyệt này hạn chế cửa sổ nổi Canvas PiP — khuyến nghị bật{' '}
          <strong>Chế độ Toàn Màn Hình (HUD)</strong> kèm <strong>Âm Báo Nhịp</strong>.
        </p>
      )}
    </section>
  );
};

export default LiveStrikeBar;

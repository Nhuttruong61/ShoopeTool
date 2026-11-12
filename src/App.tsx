import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CartOptimizer } from './components/CartOptimizer';
import { LiveStrikeBar } from './components/LiveStrikeBar';
import { RunbookForm, type DealRunbookDraft } from './components/RunbookForm';
import { RunbookList, type DealLinksPatch } from './components/RunbookList';
import { VoucherMaxHub } from './components/VoucherMaxHub';
import { AudioCueController } from './lib/audioCue';
import {
  copyAndLaunchShopee,
  copyVoucherCode,
  type OpenModePreference,
} from './lib/clipboard';
import { formatVnd, optimizeCartSplit } from './lib/optimizer';
import { detectPipSupport, PipClockController } from './lib/pipClock';
import {
  DEFAULT_SAMPLE_VOUCHERS,
  loadLeadMs,
  loadManualAdjustMs,
  loadOpenMode,
  loadRunbookItems,
  saveLeadMs,
  saveManualAdjustMs,
  saveOpenMode,
  saveRunbookItems,
} from './lib/storage';
import {
  computeStrikeCountdown,
  getNextDropEpochMs,
  syncServerTime,
} from './lib/timeSync';
import type {
  DealRunbookItem,
  EvaluatedChannelStack,
  OrderSplitPlan,
  ParsedDealCandidate,
  PipOverlayPayload,
  RunbookChecklist,
  StrikeCountdownState,
  TimeSyncSnapshot,
} from './types/contracts';

type TabKey = 'runbook' | 'maxhub' | 'add' | 'optimizer' | 'guide';

const TABS: ReadonlyArray<{ key: TabKey; label: string }> = [
  { key: 'runbook', label: 'Kịch bản săn' },
  { key: 'maxhub', label: '🔥 Kho Mã & 365' },
  { key: 'add', label: 'Thêm ca săn' },
  { key: 'optimizer', label: 'Tối ưu tách đơn' },
  { key: 'guide', label: 'Hướng dẫn ĐT' },
];

const TICK_MS = 80;

const BANNER_BY_PHASE: Record<StrikeCountdownState['phase'], string> = {
  IDLE: 'CHỜ GIỜ',
  PREPARE_60S: 'CHUẨN BỊ',
  READY_10S: 'SẴN SÀNG',
  COUNTDOWN_3S: 'SẮP BẤM...',
  STRIKE_NOW: 'BẤM NGAY!',
  PASSED: 'ĐÃ QUA GIỜ',
};

let idCounter = 0;
function makeId(): string {
  idCounter += 1;
  return `deal-${Date.now().toString(36)}-${idCounter}-${Math.random().toString(36).slice(2, 6)}`;
}

function emptyChecklist(): RunbookChecklist {
  return {
    itemsTickedInCart: false,
    waitingAtCheckoutScreen: false,
    paymentMethodSelected: false,
  };
}

const STALE_GRACE_MS = 3000;

function refreshStaleTarget(item: DealRunbookItem): DealRunbookItem {
  if (item.completed || item.targetEpochMs >= Date.now() - STALE_GRACE_MS) return item;
  return { ...item, targetEpochMs: getNextDropEpochMs(item.slotTime) };
}

function firstUncompletedId(items: DealRunbookItem[]): string | null {
  return items.find((i) => !i.completed)?.id ?? null;
}

export function App() {
  const [initialItems] = useState<DealRunbookItem[]>(() =>
    loadRunbookItems().map(refreshStaleTarget),
  );
  const [items, setItems] = useState<DealRunbookItem[]>(initialItems);
  const [activeId, setActiveId] = useState<string | null>(() =>
    firstUncompletedId(initialItems),
  );
  const [leadMs, setLeadMs] = useState<number>(() => loadLeadMs());
  const [manualAdjustMs, setManualAdjustMs] = useState<number>(() => loadManualAdjustMs());
  const [openMode, setOpenMode] = useState<OpenModePreference>(() => loadOpenMode());
  const [syncState, setSyncState] = useState<TimeSyncSnapshot>(() => ({
    synced: false,
    offsetMs: 0,
    rttMs: null,
    source: 'local',
    lastSyncedAt: null,
    manualAdjustMs: loadManualAdjustMs(),
  }));
  const [tab, setTab] = useState<TabKey>('runbook');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isPipActive, setIsPipActive] = useState(false);
  const [pipError, setPipError] = useState<string | null>(null);
  const [isFullscreenHud, setIsFullscreenHud] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(true);

  const audioRef = useRef<AudioCueController | null>(null);
  const pipRef = useRef<PipClockController | null>(null);
  if (!audioRef.current) audioRef.current = new AudioCueController(true);
  if (!pipRef.current) pipRef.current = new PipClockController(audioRef.current);
  const audio = audioRef.current;
  const pip = pipRef.current;

  const pipSupport = useMemo(() => detectPipSupport(), []);

  const activeDeal = useMemo(
    () => items.find((i) => i.id === activeId) ?? null,
    [items, activeId],
  );

  // Persist
  useEffect(() => saveRunbookItems(items), [items]);
  useEffect(() => saveLeadMs(leadMs), [leadMs]);
  useEffect(() => saveManualAdjustMs(manualAdjustMs), [manualAdjustMs]);
  useEffect(() => saveOpenMode(openMode), [openMode]);

  // Time sync
  const syncNow = useCallback(async (adjust: number) => {
    try {
      const snap = await syncServerTime(adjust);
      setSyncState({ ...snap, manualAdjustMs: adjust });
    } catch {
      // keep local clock fallback
    }
  }, []);
  useEffect(() => {
    void syncNow(loadManualAdjustMs());
  }, [syncNow]);

  const [countdown, setCountdown] = useState<StrikeCountdownState>(() =>
    computeStrikeCountdown(Date.now(), syncState, activeDeal?.targetEpochMs ?? null, leadMs),
  );

  // Latest values for the timer without re-creating the interval
  const latest = useRef({ syncState, activeDeal, leadMs });
  latest.current = { syncState, activeDeal, leadMs };

  useEffect(() => {
    const timer = setInterval(() => {
      const { syncState: s, activeDeal: d, leadMs: l } = latest.current;
      const next = computeStrikeCountdown(Date.now(), s, d?.targetEpochMs ?? null, l);
      setCountdown(next);
      audio.handleCountdownTick(next);
      const payload: PipOverlayPayload = {
        clockText: next.formattedClock,
        countdownText: next.formattedRemaining,
        phase: next.phase,
        bannerText: BANNER_BY_PHASE[next.phase],
        voucherLabel: d?.title ?? 'Chưa chọn ca săn',
        voucherCode: d?.voucherCode || undefined,
      };
      pip.update(payload);
      if (!pip.isActive()) {
        // PiP window closed externally
        setIsPipActive((prev) => (prev ? false : prev));
      }
    }, TICK_MS);
    return () => clearInterval(timer);
  }, [audio, pip]);

  useEffect(
    () => () => {
      void pip.close();
      void audio.dispose();
    },
    [audio, pip],
  );

  // Handlers
  const handleLeadMsChange = (ms: number) => {
    setLeadMs(Math.min(2000, Math.max(0, Math.round(ms))));
  };

  const handleManualAdjustChange = (ms: number) => {
    setManualAdjustMs(ms);
    setSyncState((prev) => ({ ...prev, manualAdjustMs: ms }));
  };

  const handleTogglePip = async () => {
    if (pip.isActive()) {
      await pip.close();
      setIsPipActive(false);
      setPipError(null);
      return;
    }
    void audio.unlock();
    const ok = await pip.open();
    setIsPipActive(ok);
    if (!ok) {
      setPipError(pip.getLastError());
      setIsFullscreenHud(true);
    } else {
      setPipError(null);
    }
  };

  const handleToggleAudio = () => {
    const next = !audioEnabled;
    setAudioEnabled(next);
    audio.setEnabled(next);
    if (next) void audio.unlock();
  };

  const handleSelectActive = (id: string) => {
    setItems((prev) => prev.map((i) => (i.id === id ? refreshStaleTarget(i) : i)));
    setActiveId(id);
  };

  const handleToggleChecklist = (id: string, key: keyof RunbookChecklist) => {
    setItems((prev) =>
      prev.map((i) =>
        i.id === id ? { ...i, checklist: { ...i.checklist, [key]: !i.checklist[key] } } : i,
      ),
    );
  };

  const handleToggleCompleted = (id: string) => {
    const next = items.map((i) => (i.id === id ? { ...i, completed: !i.completed } : i));
    setItems(next);
    if (id === activeId && next.find((i) => i.id === id)?.completed) {
      setActiveId(firstUncompletedId(next));
    }
  };

  const handleDelete = (id: string) => {
    const next = items.filter((i) => i.id !== id);
    setItems(next);
    if (id === activeId) setActiveId(firstUncompletedId(next));
  };

  const handleCopyCode = async (item: DealRunbookItem) => {
    if (!item.voucherCode) {
      setCopiedId(item.id);
      return;
    }
    const res = await copyVoucherCode(item.voucherCode);
    setCopiedId(res.ok ? item.id : null);
  };

  const handleCopyAndOpen = async (item: DealRunbookItem) => {
    const res = await copyAndLaunchShopee({
      voucherCode: item.voucherCode || undefined,
      targetUrl: item.productUrl || item.voucherUrl || item.shopeeUrl,
      mode: openMode,
    });
    if (res.copied?.ok) {
      setCopiedId(item.id);
    }
  };

  const handleOpenProduct = async (item: DealRunbookItem) => {
    const res = await copyAndLaunchShopee({
      voucherCode: item.voucherCode || undefined,
      targetUrl: item.productUrl || item.shopeeUrl || 'https://shopee.vn/cart',
      mode: openMode,
    });
    if (res.copied?.ok) {
      setCopiedId(item.id);
    }
  };

  const handleOpenVoucher = async (item: DealRunbookItem) => {
    const res = await copyAndLaunchShopee({
      voucherCode: item.voucherCode || undefined,
      targetUrl: item.voucherUrl || item.shopeeUrl || 'https://shopee.vn/m/ma-giam-gia',
      mode: openMode,
    });
    if (res.copied?.ok) {
      setCopiedId(item.id);
    }
  };

  const handleOpenCart = async (item: DealRunbookItem) => {
    const res = await copyAndLaunchShopee({
      voucherCode: item.voucherCode || undefined,
      targetUrl: 'https://shopee.vn/cart',
      mode: openMode,
    });
    if (res.copied?.ok) {
      setCopiedId(item.id);
    }
  };

  const handleUpdateDealLinks = (id: string, patch: DealLinksPatch) => {
    setItems((prev) =>
      prev.map((i) => {
        if (i.id !== id) return i;
        return {
          ...i,
          productUrl: 'productUrl' in patch ? patch.productUrl : i.productUrl,
          voucherUrl: 'voucherUrl' in patch ? patch.voucherUrl : i.voucherUrl,
          voucherCode: patch.voucherCode !== undefined ? patch.voucherCode : i.voucherCode,
          strikeMode: patch.strikeMode !== undefined ? patch.strikeMode : i.strikeMode,
          title: patch.title !== undefined ? patch.title : i.title,
          itemsSummary: patch.itemsSummary !== undefined ? patch.itemsSummary : i.itemsSummary,
          shopeeUrl: 'shopeeUrl' in patch ? patch.shopeeUrl : i.shopeeUrl,
        };
      }),
    );
    if (copiedId === id && patch.voucherCode !== undefined) {
      setCopiedId(null);
    }
  };

  const handleOpenShopeeUrl = async (url: string, voucherCode?: string) => {
    await copyAndLaunchShopee({
      voucherCode,
      targetUrl: url,
      mode: openMode,
    });
  };

  const handleSelectOrCreateSlot = (slotTime: string, campaignTitle: string, tip: string) => {
    const existing = items.find((i) => !i.completed && i.slotTime === slotTime);
    if (existing) {
      setItems((prev) => prev.map((i) => (i.id === existing.id ? refreshStaleTarget(i) : i)));
      setActiveId(existing.id);
      setTab('runbook');
      return;
    }
    const deal: DealRunbookItem = {
      id: makeId(),
      slotTime,
      targetEpochMs: getNextDropEpochMs(slotTime),
      title: `${campaignTitle} (${slotTime})`,
      itemsSummary: 'Tick sẵn món cần mua — Chọn mã đã lưu trong Ví Voucher',
      voucherCode: '',
      voucherNote: tip,
      paymentMethod: 'ShopeePay',
      shopeeUrl: 'https://shopee.vn/m/ma-giam-gia',
      voucherUrl: 'https://shopee.vn/m/ma-giam-gia',
      strikeMode: 'checkout-wait',
      checklist: emptyChecklist(),
      completed: false,
    };
    setItems((prev) => [...prev, deal]);
    setActiveId(deal.id);
    setTab('runbook');
  };

  const handleImportParsedDeals = (deals: ParsedDealCandidate[]) => {
    if (deals.length === 0) return;
    const created: DealRunbookItem[] = deals.map((d) => ({
      id: makeId(),
      slotTime: d.slotTime,
      targetEpochMs: getNextDropEpochMs(d.slotTime),
      title: d.title,
      itemsSummary: 'Tick sẵn món đủ đơn tối thiểu trước giờ mở mã',
      voucherCode: d.voucherCode,
      voucherNote: d.voucherNote,
      paymentMethod: d.paymentMethod,
      productUrl: d.productUrl,
      voucherUrl: d.voucherUrl,
      strikeMode: 'checkout-wait',
      shopeeUrl:
        d.productUrl ||
        d.voucherUrl ||
        (d.voucherCode ? 'https://shopee.vn/cart' : 'https://shopee.vn/m/ma-giam-gia'),
      checklist: emptyChecklist(),
      completed: false,
    }));
    setItems((prev) => [...prev, ...created]);
    setActiveId(created[0].id);
    setTab('runbook');
  };

  const handleCreateChannelReminder = (evaluation: EvaluatedChannelStack, slotTime: string) => {
    const channelUrl =
      evaluation.channel === 'video'
        ? 'https://shopee.vn/m/shopee-video'
        : evaluation.channel === 'live'
          ? 'https://shopee.vn/m/shopee-live'
          : 'https://shopee.vn/cart';
    const deal: DealRunbookItem = {
      id: makeId(),
      slotTime,
      targetEpochMs: getNextDropEpochMs(slotTime),
      title: `Mua qua ${evaluation.channelLabel}`,
      itemsSummary: evaluation.actionGuide,
      voucherCode: '',
      voucherNote: `Thanh toán dự kiến ${formatVnd(evaluation.finalPayableVnd)} (Tiết kiệm tổng ${formatVnd(evaluation.totalSavedVnd)})`,
      paymentMethod: 'ShopeePay',
      shopeeUrl: channelUrl,
      checklist: emptyChecklist(),
      completed: false,
    };
    setItems((prev) => [...prev, deal]);
    setActiveId(deal.id);
    setTab('runbook');
  };

  const handleAddDeal = (draft: DealRunbookDraft) => {
    const deal: DealRunbookItem = {
      ...draft,
      id: makeId(),
      targetEpochMs: getNextDropEpochMs(draft.slotTime),
      checklist: emptyChecklist(),
      completed: false,
    };
    setItems((prev) => [...prev, deal]);
    setActiveId(deal.id);
    setTab('runbook');
  };

  const handleImportPlan = (plan: OrderSplitPlan, slotTime: string) => {
    const created: DealRunbookItem[] = plan.groups
      .filter((g) => g.items.length > 0)
      .map((g) => ({
        id: makeId(),
        slotTime,
        targetEpochMs: getNextDropEpochMs(slotTime),
        title: `Đơn #${g.groupIndex} • ${plan.strategyLabel}`,
        itemsSummary: g.items.map((it) => `${it.name} (x${it.quantity})`).join(', '),
        voucherCode: g.appliedVoucher?.code ?? '',
        voucherNote: g.appliedVoucher
          ? `${g.appliedVoucher.label} • Thanh toán ${formatVnd(g.finalPayableVnd)}`
          : `Chưa áp voucher • Thanh toán ${formatVnd(g.finalPayableVnd)}`,
        paymentMethod: g.appliedVoucher?.paymentNote ?? 'ShopeePay',
        shopeeUrl: 'https://shopee.vn/cart',
        checklist: emptyChecklist(),
        completed: false,
      }));
    if (created.length === 0) return;
    setItems((prev) => [...prev, ...created]);
    setActiveId(created[0].id);
    setTab('runbook');
  };

  const audioUnlocked = useRef(false);
  const unlockAudioOnce = () => {
    if (audioUnlocked.current) return;
    audioUnlocked.current = true;
    void audio.unlock();
    (pip as unknown as { warmup?: () => void }).warmup?.();
  };

  const currentUrl = typeof window !== 'undefined' ? window.location.href : '';

  return (
    <div
      className="app-container"
      data-phase={countdown.phase}
      onPointerDownCapture={unlockAudioOnce}
      onTouchStartCapture={unlockAudioOnce}
    >
      <header className="app-header">
        <div className="app-header-left">
          <h1 className="app-title">ShoopeeTool 365 — Trợ Lý Săn Mã &amp; Canh Nhịp Shopee</h1>
          <p className="app-subtitle">
            Canh giờ chuẩn 0.1s, mở thẳng kho mã thật trong App Shopee &amp; tối ưu chồng 3 tầng mã
            quanh năm.
          </p>
        </div>

        <label
          className="open-mode-label"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            fontSize: '0.74rem',
            color: 'var(--text-secondary)',
            flexShrink: 0,
          }}
        >
          <select
            aria-label="Chế độ mở Shopee"
            data-testid="open-mode-select"
            className="open-mode-select"
            value={openMode}
            onChange={(e) => setOpenMode(e.target.value as OpenModePreference)}
          >
            <option value="auto-app">📱 Mở App Shopee (Tự động)</option>
            <option value="force-app">🚀 Ép mở App Shopee</option>
            <option value="web">🌐 Mở Web</option>
          </select>
        </label>
      </header>

      <LiveStrikeBar
        countdown={countdown}
        syncState={syncState}
        activeDeal={activeDeal}
        pipSupport={pipSupport}
        isPipActive={isPipActive}
        pipError={pipError}
        onMountInlinePipVideo={(el) => pip.mountInlineVideo(el)}
        isFullscreenHud={isFullscreenHud}
        audioEnabled={audioEnabled}
        onSyncNow={() => void syncNow(manualAdjustMs)}
        onLeadMsChange={handleLeadMsChange}
        onManualAdjustChange={handleManualAdjustChange}
        onTogglePip={() => void handleTogglePip()}
        onToggleFullscreenHud={() => {
          void audio.unlock();
          setIsFullscreenHud((v) => !v);
        }}
        onToggleAudio={handleToggleAudio}
        onQuickCopyAndOpen={(d) => void handleCopyAndOpen(d)}
        onQuickOpenCart={(d) => void handleOpenCart(d)}
        onQuickOpenProduct={(d) => void handleOpenProduct(d)}
        onQuickOpenVoucher={(d) => void handleOpenVoucher(d)}
      />

      <nav
        role="tablist"
        aria-label="Điều hướng chức năng"
        className="tab-bar"
      >
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            className={`tab-btn ${tab === t.key ? 'active' : ''}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {tab === 'runbook' && (
        <RunbookList
          items={items}
          activeId={activeId}
          copiedId={copiedId}
          onSelectActive={handleSelectActive}
          onToggleChecklist={handleToggleChecklist}
          onCopyCode={(i) => void handleCopyCode(i)}
          onCopyAndOpenShopee={(i) => void handleCopyAndOpen(i)}
          onOpenCart={(i) => void handleOpenCart(i)}
          onOpenProduct={(i) => void handleOpenProduct(i)}
          onOpenVoucher={(i) => void handleOpenVoucher(i)}
          onUpdateDealLinks={handleUpdateDealLinks}
          onToggleCompleted={handleToggleCompleted}
          onDelete={handleDelete}
        />
      )}

      {tab === 'maxhub' && (
        <VoucherMaxHub
          onOpenShopeeUrl={(url, code) => void handleOpenShopeeUrl(url, code)}
          onSelectOrCreateSlot={handleSelectOrCreateSlot}
          onImportParsedDeals={handleImportParsedDeals}
          onCreateChannelReminder={handleCreateChannelReminder}
        />
      )}

      {tab === 'add' && <RunbookForm onAddDeal={handleAddDeal} />}

      {tab === 'optimizer' && (
        <CartOptimizer
          initialVouchers={DEFAULT_SAMPLE_VOUCHERS}
          onEvaluateSplit={optimizeCartSplit}
          onImportPlanToRunbook={handleImportPlan}
        />
      )}

      {tab === 'guide' && (
        <section className="section-card" aria-label="Hướng dẫn dùng trên điện thoại">
          <div className="section-header">
            <h2 className="section-title">Hướng dẫn dùng trên điện thoại</h2>
          </div>
          <p style={{ margin: '0 0 8px' }}>
            Địa chỉ hiện tại: <code data-testid="current-url">{currentUrl}</code>
          </p>
          <ol style={{ margin: 0, paddingLeft: 20, display: 'grid', gap: 8 }}>
            <li>
              Mở qua Wi-Fi LAN: trên máy tính chạy <code>npm run dev:lan</code>, rồi mở địa chỉ
              mạng (dạng <code>http://192.168.x.x:5173</code>) trên điện thoại cùng Wi-Fi.
            </li>
            <li>
              Thêm vào Màn hình chính (PWA): menu trình duyệt → “Thêm vào Màn hình chính” để mở
              toàn màn hình như app.
            </li>
            <li>
              Ghép cặp <strong>[Link Sản Phẩm + Link Voucher]</strong> qua nút{' '}
              <strong>🔗 Gán SP/Mã</strong> trên thẻ săn hoặc ô <strong>Smart Paste</strong>: tự
              lọc sạch câu chia sẻ từ App Shopee để đúng giờ mở mã bấm 1 chạm nhảy thẳng vào đúng
              trang Sản phẩm / Lưu mã trong App Shopee.
            </li>
            <li>Bấm “Bật đồng hồ nổi” (PiP) để đồng hồ nổi đè lên màn hình Shopee.</li>
            <li>
              Đứng chờ sẵn ở màn hình Thanh toán của Shopee trước mốc <strong>:00</strong>, chỉ
              bấm xác nhận khi đồng hồ báo “BẤM NGAY!”. Ứng dụng không tự bấm thay bạn.
            </li>
          </ol>
        </section>
      )}
    </div>
  );
}

export default App;


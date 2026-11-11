export type TimePhase =
  | 'IDLE'
  | 'PREPARE_60S'
  | 'READY_10S'
  | 'COUNTDOWN_3S'
  | 'STRIKE_NOW'
  | 'PASSED';

export interface TimeSyncSnapshot {
  synced: boolean;
  offsetMs: number;
  rttMs: number | null;
  source: string;
  lastSyncedAt: number | null;
  manualAdjustMs: number;
}

export type TimeSyncState = TimeSyncSnapshot;

export interface StrikeCountdownState {
  nowEpochMs: number;
  targetEpochMs: number | null;
  remainingMs: number | null;
  effectiveStrikeRemainingMs: number | null;
  leadMs: number;
  phase: TimePhase;
  formattedClock: string;
  formattedRemaining: string;
}

export interface PipSupportInfo {
  canVideoPip: boolean;
  canWebkitPip: boolean;
  fallbackHudOnly: boolean;
}

export interface PipOverlayPayload {
  clockText: string;
  countdownText: string;
  phase: TimePhase;
  bannerText: string;
  voucherLabel: string;
  voucherCode?: string;
}

export type DiscountType = 'percent' | 'flat';

export interface VoucherRule {
  id: string;
  label: string;
  code?: string;
  minSpendVnd: number;
  discountType: DiscountType;
  discountValue: number;
  maxDiscountVnd?: number;
  categoryTag?: string;
  paymentNote?: string;
}

export interface CartItem {
  id: string;
  name: string;
  priceVnd: number;
  quantity: number;
  categoryTag?: string;
  shopName?: string;
}

export interface EvaluatedOrderGroup {
  groupIndex: number;
  items: CartItem[];
  subtotalVnd: number;
  appliedVoucher: VoucherRule | null;
  discountVnd: number;
  finalPayableVnd: number;
  shortfallToMinSpendVnd: number;
  nextBestVoucherHint?: string;
}

export interface OrderSplitPlan {
  strategyLabel: string;
  groups: EvaluatedOrderGroup[];
  totalSubtotalVnd: number;
  totalDiscountVnd: number;
  totalFinalPayableVnd: number;
  savingsVsSingleOrderVnd: number;
}

export interface RunbookChecklist {
  itemsTickedInCart: boolean;
  waitingAtCheckoutScreen: boolean;
  paymentMethodSelected: boolean;
}

export interface DealRunbookItem {
  id: string;
  slotTime: string;
  targetEpochMs: number;
  title: string;
  itemsSummary: string;
  voucherCode: string;
  voucherNote: string;
  paymentMethod: string;
  shopeeUrl?: string;
  checklist: RunbookChecklist;
  completed: boolean;
}

export interface ClipboardResult {
  ok: boolean;
  method: 'clipboard-api' | 'exec-command' | 'failed';
  error?: string;
}

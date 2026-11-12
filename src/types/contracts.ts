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

export type StrikeMode = 'checkout-wait' | 'flash-product';
export type ShopeeLinkKind = 'product' | 'voucher' | 'shortlink' | 'hub' | 'cart' | 'unknown';
export interface ExtractedShopeeLink {
  cleanUrl: string | null;
  extractedTitle: string | null;
  kind: ShopeeLinkKind;
  shopId?: string;
  itemId?: string;
  resolvedFromShortlink?: boolean;
}

export interface AutoProductVoucherItem {
  id: string;
  badge: string;
  title: string;
  voucherNote: string;
  slotTime: string;
  strikeMode: StrikeMode;
  productUrl: string;
  voucherUrl: string;
  voucherCode: string;
  paymentMethod: string;
  shopId?: string;
  itemId?: string;
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
  productUrl?: string;
  voucherUrl?: string;
  strikeMode?: StrikeMode;
  checklist: RunbookChecklist;
  completed: boolean;
}

export interface ClipboardResult {
  ok: boolean;
  method: 'clipboard-api' | 'exec-command' | 'failed';
  error?: string;
}

// ============================================================================
// v2.0 Year-Round Max Voucher (365 Ngày) Contracts
// ============================================================================

export type SaleCampaignType =
  | 'double-day'
  | 'mid-month'
  | 'payday'
  | 'wednesday-freeship'
  | 'daily-restock';

export interface SaleCampaignEvent {
  id: string;
  type: SaleCampaignType;
  dateLabel: string;
  title: string;
  badge: string;
  daysAway: number;
  peakSlots: string[];
  tip: string;
}

export type VoucherHubCategory =
  | 'platform'
  | 'video-live'
  | 'freeship'
  | 'payment-vip';

export interface VoucherHubShortcut {
  id: string;
  title: string;
  subtitle: string;
  badge: string;
  category: VoucherHubCategory;
  webUrl: string;
  bestTimeHint: string;
}

export interface ParsedDealCandidate {
  id: string;
  slotTime: string;
  voucherCode: string;
  title: string;
  voucherNote: string;
  paymentMethod: string;
  rawLine: string;
  productUrl?: string;
  voucherUrl?: string;
}

export type ShoppingChannel = 'normal' | 'video' | 'live';

export interface ChannelVoucherSpec {
  label: string;
  discountType: DiscountType;
  discountValue: number;
  maxDiscountVnd?: number;
  minSpendVnd: number;
}

export interface ChannelStackInput {
  itemPriceVnd: number;
  shopVoucher: ChannelVoucherSpec | null;
  normalVoucher: ChannelVoucherSpec | null;
  videoVoucher: ChannelVoucherSpec | null;
  liveVoucher: ChannelVoucherSpec | null;
  shippingFeeVnd: number;
  freeshipCapVnd: number;
  coinsVnd: number;
  paymentDiscountVnd: number;
}

export interface EvaluatedChannelStack {
  channel: ShoppingChannel;
  channelLabel: string;
  itemPriceVnd: number;
  shopDiscountVnd: number;
  afterShopVnd: number;
  platformDiscountVnd: number;
  platformEligible: boolean;
  platformShortfallVnd: number;
  shippingNetVnd: number;
  coinsUsedVnd: number;
  paymentDiscountVnd: number;
  finalPayableVnd: number;
  totalSavedVnd: number;
  actionGuide: string;
}

export interface ChannelStackComparison {
  evaluations: EvaluatedChannelStack[];
  bestChannel: ShoppingChannel;
  extraSavedVsNormalVnd: number;
  summaryTip: string;
}


import type {
  CartItem,
  EvaluatedOrderGroup,
  OrderSplitPlan,
  VoucherRule,
} from '../types/contracts';

/**
 * Formats a VND number using dot thousand separators and 'đ' suffix.
 * Example: 125000 -> "125.000đ"
 */
export function formatVnd(amount: number): string {
  if (!Number.isFinite(amount)) {
    return '0đ';
  }
  const rounded = Math.round(amount);
  const sign = rounded < 0 ? '-' : '';
  const absStr = Math.abs(rounded)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${sign}${absStr}đ`;
}

/**
 * Computes the discount in VND for a given subtotal and voucher rule.
 * Returns 0 if subtotalVnd < rule.minSpendVnd or subtotalVnd <= 0.
 */
export function computeVoucherDiscount(subtotalVnd: number, rule: VoucherRule): number {
  if (subtotalVnd < rule.minSpendVnd || subtotalVnd <= 0 || rule.discountValue <= 0) {
    return 0;
  }

  const rawDiscount =
    rule.discountType === 'flat'
      ? Math.floor(rule.discountValue)
      : Math.floor((subtotalVnd * rule.discountValue) / 100);

  const cappedDiscount =
    rule.maxDiscountVnd !== undefined && rule.maxDiscountVnd >= 0
      ? Math.min(rawDiscount, Math.floor(rule.maxDiscountVnd))
      : rawDiscount;

  return Math.max(0, Math.min(cappedDiscount, Math.floor(subtotalVnd)));
}

/**
 * Checks if a VoucherRule is category-compatible with the items in an order group.
 * If both the rule and at least one item specify `categoryTag`, all items with a `categoryTag`
 * in the group must match `rule.categoryTag` (case-insensitive).
 */
function isRuleCategoryEligible(items: readonly CartItem[], rule: VoucherRule): boolean {
  const ruleTag = rule.categoryTag?.trim().toLowerCase();
  if (!ruleTag) {
    return true;
  }

  const taggedItems = items.filter(
    (item) => typeof item.categoryTag === 'string' && item.categoryTag.trim().length > 0,
  );
  if (taggedItems.length === 0) {
    return true;
  }

  return taggedItems.every((item) => item.categoryTag!.trim().toLowerCase() === ruleTag);
}

/**
 * Computes the total subtotal in VND for a list of cart items.
 */
export function computeSubtotalVnd(items: readonly CartItem[]): number {
  return items.reduce((sum, item) => {
    const price = Number.isFinite(item.priceVnd) ? Math.max(0, Math.floor(item.priceVnd)) : 0;
    const qty = Number.isFinite(item.quantity) ? Math.max(0, Math.floor(item.quantity)) : 0;
    return sum + price * qty;
  }, 0);
}

/**
 * Evaluates a single order group against available voucher rules:
 * - Picks the eligible voucher rule yielding the highest discount.
 * - Checks if spending slightly more unlocks a better voucher and generates a Vietnamese hint.
 */
export function evaluateGroupWithVouchers(
  items: CartItem[],
  rules: VoucherRule[],
  groupIndex = 0,
): EvaluatedOrderGroup {
  const subtotalVnd = computeSubtotalVnd(items);
  const categoryEligibleRules = rules.filter((rule) => isRuleCategoryEligible(items, rule));

  let appliedVoucher: VoucherRule | null = null;
  let discountVnd = 0;

  for (const rule of categoryEligibleRules) {
    const d = computeVoucherDiscount(subtotalVnd, rule);
    if (
      d > discountVnd ||
      (d > 0 &&
        d === discountVnd &&
        appliedVoucher !== null &&
        rule.minSpendVnd < appliedVoucher.minSpendVnd)
    ) {
      discountVnd = d;
      appliedVoucher = rule;
    }
  }

  const finalPayableVnd = Math.max(0, subtotalVnd - discountVnd);

  let shortfallToMinSpendVnd = 0;
  let nextBestVoucherHint: string | undefined;

  if (subtotalVnd > 0) {
    let bestCandidate: { rule: VoucherRule; shortfall: number; potentialDiscount: number } | null =
      null;

    for (const rule of categoryEligibleRules) {
      if (rule.minSpendVnd > subtotalVnd) {
        const potentialDiscount = computeVoucherDiscount(rule.minSpendVnd, rule);
        if (potentialDiscount > discountVnd) {
          const shortfall = rule.minSpendVnd - subtotalVnd;
          if (
            bestCandidate === null ||
            shortfall < bestCandidate.shortfall ||
            (shortfall === bestCandidate.shortfall &&
              potentialDiscount > bestCandidate.potentialDiscount)
          ) {
            bestCandidate = { rule, shortfall, potentialDiscount };
          }
        }
      }
    }

    if (bestCandidate !== null) {
      shortfallToMinSpendVnd = bestCandidate.shortfall;
      nextBestVoucherHint = `Mua thêm ${formatVnd(shortfallToMinSpendVnd)} để áp mã ${bestCandidate.rule.label}`;
    }
  }

  const result: EvaluatedOrderGroup = {
    groupIndex,
    items: [...items],
    subtotalVnd,
    appliedVoucher,
    discountVnd,
    finalPayableVnd,
    shortfallToMinSpendVnd,
  };

  if (nextBestVoucherHint !== undefined) {
    result.nextBestVoucherHint = nextBestVoucherHint;
  }

  return result;
}

/**
 * Given a partition of items into k groups (1 <= k <= 3) and a pool of VoucherRules where
 * each rule can be used at most once across the groups, finds the optimal assignment of
 * distinct vouchers to groups to maximize total discount.
 */
function evaluatePartitionWithDistinctVouchers(
  partition: CartItem[][],
  rules: VoucherRule[],
): {
  groups: EvaluatedOrderGroup[];
  totalSubtotalVnd: number;
  totalDiscountVnd: number;
  totalFinalPayableVnd: number;
} {
  const k = partition.length;
  const subtotals = partition.map((groupItems) => computeSubtotalVnd(groupItems));

  // For each group, rank candidate rules (plus null for no voucher)
  const candidatesPerGroup: Array<Array<{ rule: VoucherRule | null; discount: number }>> =
    partition.map((groupItems, idx) => {
      const subtotal = subtotals[idx];
      const eligible = rules
        .filter((rule) => isRuleCategoryEligible(groupItems, rule))
        .map((rule) => ({
          rule,
          discount: computeVoucherDiscount(subtotal, rule),
        }))
        .filter((entry) => entry.discount > 0)
        .sort((a, b) => b.discount - a.discount || a.rule.minSpendVnd - b.rule.minSpendVnd)
        .slice(0, k);

      return [...eligible, { rule: null, discount: 0 }];
    });

  let bestDiscountSum = -1;
  let bestAssignedRules: Array<VoucherRule | null> = new Array(k).fill(null);

  const currentAssigned: Array<VoucherRule | null> = new Array(k).fill(null);
  const usedRuleIds = new Set<string>();

  function searchAssignment(groupIdx: number, runningDiscount: number): void {
    if (groupIdx === k) {
      if (runningDiscount > bestDiscountSum) {
        bestDiscountSum = runningDiscount;
        bestAssignedRules = [...currentAssigned];
      }
      return;
    }

    for (const candidate of candidatesPerGroup[groupIdx]) {
      const ruleId = candidate.rule?.id;
      if (ruleId !== undefined && usedRuleIds.has(ruleId)) {
        continue;
      }
      if (ruleId !== undefined) {
        usedRuleIds.add(ruleId);
      }
      currentAssigned[groupIdx] = candidate.rule;
      searchAssignment(groupIdx + 1, runningDiscount + candidate.discount);
      if (ruleId !== undefined) {
        usedRuleIds.delete(ruleId);
      }
    }
  }

  searchAssignment(0, 0);

  // Build each group's EvaluatedOrderGroup using the rules not claimed by other groups
  const groups: EvaluatedOrderGroup[] = partition.map((groupItems, idx) => {
    const claimedByOthers = new Set<string>();
    for (let otherIdx = 0; otherIdx < k; otherIdx++) {
      if (otherIdx !== idx && bestAssignedRules[otherIdx] !== null) {
        claimedByOthers.add(bestAssignedRules[otherIdx]!.id);
      }
    }
    const assignedRule = bestAssignedRules[idx];
    const availableRulesForGroup = rules.filter((r) => !claimedByOthers.has(r.id));

    // If an assigned rule was chosen, prioritize it while preserving unused rules for hints
    const evaluated = evaluateGroupWithVouchers(groupItems, availableRulesForGroup, idx + 1);
    if (assignedRule !== null && evaluated.appliedVoucher?.id !== assignedRule.id) {
      const assignedDiscount = computeVoucherDiscount(evaluated.subtotalVnd, assignedRule);
      return {
        ...evaluated,
        appliedVoucher: assignedRule,
        discountVnd: assignedDiscount,
        finalPayableVnd: Math.max(0, evaluated.subtotalVnd - assignedDiscount),
      };
    }
    return evaluated;
  });

  const totalSubtotalVnd = groups.reduce((sum, g) => sum + g.subtotalVnd, 0);
  const totalDiscountVnd = groups.reduce((sum, g) => sum + g.discountVnd, 0);
  const totalFinalPayableVnd = Math.max(0, totalSubtotalVnd - totalDiscountVnd);

  return {
    groups,
    totalSubtotalVnd,
    totalDiscountVnd,
    totalFinalPayableVnd,
  };
}

/**
 * Generates all set partitions of `items` into at most `maxGroups` non-empty subsets.
 * Used when `items.length <= 10`.
 */
function generatePartitions(items: CartItem[], maxGroups: number): CartItem[][][] {
  const results: CartItem[][][] = [];
  const currentGroups: CartItem[][] = [];

  function backtrack(index: number): void {
    if (index === items.length) {
      results.push(currentGroups.map((g) => [...g]));
      return;
    }

    const item = items[index];

    // Option 1: Add item to an existing group
    for (let i = 0; i < currentGroups.length; i++) {
      currentGroups[i].push(item);
      backtrack(index + 1);
      currentGroups[i].pop();
    }

    // Option 2: Start a new group if under maxGroups limit
    if (currentGroups.length < maxGroups) {
      currentGroups.push([item]);
      backtrack(index + 1);
      currentGroups.pop();
    }
  }

  backtrack(0);
  return results;
}

/**
 * Builds candidate partitions using a fast greedy heuristic when `items.length > 10`.
 */
function generateGreedyCandidatePartitions(items: CartItem[], rules: VoucherRule[]): CartItem[][][] {
  const candidates: CartItem[][][] = [[items]];
  const sortedByValueDesc = [...items].sort(
    (a, b) => b.priceVnd * b.quantity - a.priceVnd * a.quantity,
  );

  // Balanced 2-way and 3-way splits by alternating largest items
  for (const bucketCount of [2, 3]) {
    if (items.length >= bucketCount) {
      const buckets: CartItem[][] = Array.from({ length: bucketCount }, () => []);
      const bucketTotals = new Array(bucketCount).fill(0);
      for (const item of sortedByValueDesc) {
        let minIdx = 0;
        for (let i = 1; i < bucketCount; i++) {
          if (bucketTotals[i] < bucketTotals[minIdx]) {
            minIdx = i;
          }
        }
        buckets[minIdx].push(item);
        bucketTotals[minIdx] += item.priceVnd * item.quantity;
      }
      if (buckets.every((b) => b.length > 0)) {
        candidates.push(buckets);
      }
    }
  }

  // Threshold-guided greedy splits for each rule's minSpendVnd
  const sortedMinSpends = [...new Set(rules.map((r) => r.minSpendVnd).filter((m) => m > 0))].sort(
    (a, b) => b - a,
  );

  for (const targetSpend of sortedMinSpends.slice(0, 5)) {
    const g1: CartItem[] = [];
    const g2: CartItem[] = [];
    let g1Total = 0;
    for (const item of sortedByValueDesc) {
      if (g1Total < targetSpend || g2.length > 0) {
        if (g1Total < targetSpend) {
          g1.push(item);
          g1Total += item.priceVnd * item.quantity;
        } else {
          g2.push(item);
        }
      } else {
        g2.push(item);
      }
    }
    if (g1.length > 0 && g2.length > 0) {
      candidates.push([g1, g2]);
    }
  }

  return candidates;
}

/**
 * Compares keeping all items in 1 order vs splitting into 2 or 3 subgroups
 * (with each VoucherRule used at most once across split orders) to maximize totalDiscountVnd.
 */
export function optimizeCartSplit(items: CartItem[], rules: VoucherRule[]): OrderSplitPlan {
  const validItems = items.filter((item) => item.quantity > 0 && item.priceVnd >= 0);

  if (validItems.length === 0) {
    return {
      strategyLabel: 'Chưa có sản phẩm trong giỏ',
      groups: [],
      totalSubtotalVnd: 0,
      totalDiscountVnd: 0,
      totalFinalPayableVnd: 0,
      savingsVsSingleOrderVnd: 0,
    };
  }

  const singleEval = evaluatePartitionWithDistinctVouchers([validItems], rules);

  const maxGroups = Math.min(3, validItems.length);
  const candidatePartitions =
    validItems.length <= 10
      ? generatePartitions(validItems, maxGroups)
      : generateGreedyCandidatePartitions(validItems, rules);

  let bestEval = singleEval;

  for (const partition of candidatePartitions) {
    const currentEval = evaluatePartitionWithDistinctVouchers(partition, rules);

    const isStrictlyBetterDiscount = currentEval.totalDiscountVnd > bestEval.totalDiscountVnd;
    const isSameDiscountFewerGroups =
      currentEval.totalDiscountVnd === bestEval.totalDiscountVnd &&
      currentEval.groups.length < bestEval.groups.length;

    if (isStrictlyBetterDiscount || isSameDiscountFewerGroups) {
      bestEval = currentEval;
    }
  }

  const savingsVsSingleOrderVnd = Math.max(
    0,
    bestEval.totalDiscountVnd - singleEval.totalDiscountVnd,
  );

  const strategyLabel =
    bestEval.groups.length === 1 || savingsVsSingleOrderVnd === 0
      ? 'Gộp 1 đơn duy nhất tối ưu nhất'
      : `Tách ${bestEval.groups.length} đơn lời hơn gộp chung ${formatVnd(savingsVsSingleOrderVnd)}`;

  return {
    strategyLabel,
    groups: bestEval.groups,
    totalSubtotalVnd: bestEval.totalSubtotalVnd,
    totalDiscountVnd: bestEval.totalDiscountVnd,
    totalFinalPayableVnd: bestEval.totalFinalPayableVnd,
    savingsVsSingleOrderVnd,
  };
}

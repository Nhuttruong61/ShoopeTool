import React, { useMemo, useState } from 'react';
import type {
  CartItem,
  DiscountType,
  OrderSplitPlan,
  VoucherRule,
} from '../types/contracts';

export interface CartOptimizerProps {
  initialVouchers: VoucherRule[];
  onEvaluateSplit: (items: CartItem[], vouchers: VoucherRule[]) => OrderSplitPlan;
  onImportPlanToRunbook: (plan: OrderSplitPlan, slotTime: string) => void;
}

const SAMPLE_1111_ITEMS: CartItem[] = [
  {
    id: 'sample-item-1',
    name: 'Tai nghe Bluetooth ANC',
    priceVnd: 520_000,
    quantity: 1,
    shopName: 'Official Audio Mall',
  },
  {
    id: 'sample-item-2',
    name: 'Sạc nhanh GaN 65W',
    priceVnd: 290_000,
    quantity: 1,
    shopName: 'Tech Phụ Kiện Mall',
  },
  {
    id: 'sample-item-3',
    name: 'Cáp sạc bọc dù C-to-C',
    priceVnd: 95_000,
    quantity: 2,
    shopName: 'Tech Phụ Kiện Mall',
  },
];

const SAMPLE_1111_VOUCHERS: VoucherRule[] = [
  {
    id: 'sample-v-1',
    label: 'Mã 11/11 Giảm 20% tối đa 100k (Đơn từ 500k)',
    code: '1111MALL100K',
    minSpendVnd: 500_000,
    discountType: 'percent',
    discountValue: 20,
    maxDiscountVnd: 100_000,
  },
  {
    id: 'sample-v-2',
    label: 'Mã Khung Giờ Giảm 60k (Đơn từ 400k)',
    code: 'FLASH60K',
    minSpendVnd: 400_000,
    discountType: 'flat',
    discountValue: 60_000,
  },
  {
    id: 'sample-v-3',
    label: 'Mã Toàn Sàn Giảm 15% tối đa 150k (Đơn từ 1 triệu)',
    code: 'SIEUSALE150K',
    minSpendVnd: 1_000_000,
    discountType: 'percent',
    discountValue: 15,
    maxDiscountVnd: 150_000,
  },
];

function formatVnd(amount: number): string {
  return `${Math.round(amount).toLocaleString('vi-VN')}đ`;
}

export const CartOptimizer: React.FC<CartOptimizerProps> = ({
  initialVouchers,
  onEvaluateSplit,
  onImportPlanToRunbook,
}) => {
  const [items, setItems] = useState<CartItem[]>(SAMPLE_1111_ITEMS);
  const [vouchers, setVouchers] = useState<VoucherRule[]>(
    initialVouchers.length > 0 ? initialVouchers : SAMPLE_1111_VOUCHERS
  );

  // Item form state
  const [itemName, setItemName] = useState<string>('');
  const [itemPrice, setItemPrice] = useState<string>('');
  const [itemQty, setItemQty] = useState<string>('1');

  // Voucher form state
  const [vLabel, setVLabel] = useState<string>('');
  const [vCode, setVCode] = useState<string>('');
  const [vType, setVType] = useState<DiscountType>('percent');
  const [vValue, setVValue] = useState<string>('20');
  const [vMinSpend, setVMinSpend] = useState<string>('500000');
  const [vMaxDiscount, setVMaxDiscount] = useState<string>('100000');

  // Target slot time when importing to Runbook
  const [importSlotTime, setImportSlotTime] = useState<string>('00:00');

  const plan = useMemo(
    () => onEvaluateSplit(items, vouchers),
    [items, vouchers, onEvaluateSplit]
  );

  const handleLoadSample = () => {
    setItems(SAMPLE_1111_ITEMS);
    setVouchers(
      initialVouchers.length > 0 ? initialVouchers : SAMPLE_1111_VOUCHERS
    );
  };

  const handleAddItem = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedPrice = Number(itemPrice);
    const parsedQty = Math.max(1, Number(itemQty) || 1);
    if (!itemName.trim() || Number.isNaN(parsedPrice) || parsedPrice <= 0) {
      return;
    }
    const newItem: CartItem = {
      id: `item-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: itemName.trim(),
      priceVnd: parsedPrice,
      quantity: parsedQty,
    };
    setItems((prev) => [...prev, newItem]);
    setItemName('');
    setItemPrice('');
    setItemQty('1');
  };

  const handleRemoveItem = (id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  const handleAddVoucher = (e: React.FormEvent) => {
    e.preventDefault();
    const discountValue = Number(vValue);
    const minSpendVnd = Math.max(0, Number(vMinSpend) || 0);
    const maxDiscountVnd =
      vType === 'percent' && vMaxDiscount.trim() !== ''
        ? Math.max(0, Number(vMaxDiscount))
        : undefined;

    if (Number.isNaN(discountValue) || discountValue <= 0) {
      return;
    }

    const defaultLabel =
      vType === 'percent'
        ? `Giảm ${discountValue}% (Đơn từ ${formatVnd(minSpendVnd)})`
        : `Giảm ${formatVnd(discountValue)} (Đơn từ ${formatVnd(minSpendVnd)})`;

    const newVoucher: VoucherRule = {
      id: `voucher-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      label: vLabel.trim() || defaultLabel,
      code: vCode.trim().toUpperCase() || undefined,
      minSpendVnd,
      discountType: vType,
      discountValue,
      maxDiscountVnd,
    };

    setVouchers((prev) => [...prev, newVoucher]);
    setVLabel('');
    setVCode('');
  };

  const handleRemoveVoucher = (id: string) => {
    setVouchers((prev) => prev.filter((v) => v.id !== id));
  };

  return (
    <section className="section-card" aria-label="Bộ tối ưu gộp tách giỏ hàng và voucher">
      <div className="section-header">
        <div>
          <h2 className="section-title">Tối Ưu Gộp / Tách Đơn & Voucher</h2>
          <p style={{ margin: '2px 0 0', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
            So sánh gộp 1 đơn hay tách nhiều đơn để ăn trọn mức giảm tối đa
          </p>
        </div>
        <button
          type="button"
          className="btn btn-outline-accent"
          style={{ minHeight: '40px', padding: '6px 12px', fontSize: '0.84rem' }}
          onClick={handleLoadSample}
        >
          Nạp giỏ mẫu 11/11
        </button>
      </div>

      {/* Cart Items Section */}
      <div style={{ marginBottom: '16px' }}>
        <h3 style={{ fontSize: '0.95rem', margin: '0 0 8px', color: 'var(--text-secondary)' }}>
          1. Danh sách món cần mua ({items.length} món)
        </h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '10px' }}>
          {items.map((item) => (
            <div
              key={item.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '8px',
                padding: '8px 10px',
                backgroundColor: 'var(--bg-input)',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <div style={{ fontSize: '0.88rem' }}>
                <strong>{item.name}</strong>{' '}
                <span className="price-num" style={{ color: 'var(--text-secondary)' }}>
                  ({formatVnd(item.priceVnd)} × {item.quantity} ={' '}
                  <strong style={{ color: '#fbbf24' }}>
                    {formatVnd(item.priceVnd * item.quantity)}
                  </strong>
                  )
                </span>
              </div>
              <button
                type="button"
                className="btn btn-danger-ghost"
                style={{ minHeight: '32px', padding: '2px 8px', fontSize: '0.78rem' }}
                onClick={() => handleRemoveItem(item.id)}
                aria-label={`Xóa món ${item.name}`}
              >
                Xóa
              </button>
            </div>
          ))}
        </div>

        <form className="form-row form-row-3" onSubmit={handleAddItem}>
          <input
            type="text"
            className="text-input"
            placeholder="Tên món hàng..."
            value={itemName}
            onChange={(e) => setItemName(e.target.value)}
          />
          <input
            type="number"
            className="text-input tabular-nums"
            placeholder="Đơn giá (VNĐ)"
            value={itemPrice}
            onChange={(e) => setItemPrice(e.target.value)}
          />
          <div style={{ display: 'flex', gap: '6px' }}>
            <input
              type="number"
              className="text-input tabular-nums"
              style={{ width: '70px' }}
              min={1}
              max={99}
              value={itemQty}
              onChange={(e) => setItemQty(e.target.value)}
              aria-label="Số lượng"
            />
            <button type="submit" className="btn btn-secondary" style={{ flex: 1 }}>
              + Món
            </button>
          </div>
        </form>
      </div>

      {/* Vouchers Section */}
      <div style={{ marginBottom: '16px' }}>
        <h3 style={{ fontSize: '0.95rem', margin: '0 0 8px', color: 'var(--text-secondary)' }}>
          2. Kho Voucher đang có ({vouchers.length} mã)
        </h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '10px' }}>
          {vouchers.map((v) => (
            <div
              key={v.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '8px',
                padding: '8px 10px',
                backgroundColor: 'var(--bg-input)',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-subtle)',
                fontSize: '0.85rem',
              }}
            >
              <div>
                <strong>{v.label}</strong>{' '}
                {v.code && <span className="voucher-code-pill">{v.code}</span>}
                <div className="tabular-nums" style={{ color: 'var(--text-muted)', marginTop: '2px' }}>
                  Đơn tối thiểu: {formatVnd(v.minSpendVnd)} •{' '}
                  {v.discountType === 'percent'
                    ? `Giảm ${v.discountValue}%${
                        v.maxDiscountVnd ? ` (Tối đa ${formatVnd(v.maxDiscountVnd)})` : ''
                      }`
                    : `Giảm thẳng ${formatVnd(v.discountValue)}`}
                </div>
              </div>
              <button
                type="button"
                className="btn btn-danger-ghost"
                style={{ minHeight: '32px', padding: '2px 8px', fontSize: '0.78rem' }}
                onClick={() => handleRemoveVoucher(v.id)}
                aria-label={`Xóa voucher ${v.label}`}
              >
                Xóa
              </button>
            </div>
          ))}
        </div>

        <form className="form-stack" onSubmit={handleAddVoucher}>
          <div className="form-row form-row-2">
            <input
              type="text"
              className="text-input"
              placeholder="Tên gợi nhớ voucher (tùy chọn)"
              value={vLabel}
              onChange={(e) => setVLabel(e.target.value)}
            />
            <input
              type="text"
              className="text-input"
              placeholder="Mã code (VD: FLASH60K)"
              value={vCode}
              onChange={(e) => setVCode(e.target.value)}
            />
          </div>

          <div className="form-row form-row-2">
            <label className="field-label">
              <span>Loại giảm</span>
              <select
                className="select-input"
                value={vType}
                onChange={(e) => setVType(e.target.value as DiscountType)}
              >
                <option value="percent">Giảm theo %</option>
                <option value="flat">Giảm thẳng tiền (đ)</option>
              </select>
            </label>

            <label className="field-label">
              <span>Mức giảm ({vType === 'percent' ? '%' : 'VNĐ'})</span>
              <input
                type="number"
                className="text-input tabular-nums"
                value={vValue}
                onChange={(e) => setVValue(e.target.value)}
              />
            </label>
          </div>

          <div className="form-row form-row-2">
            <label className="field-label">
              <span>Đơn tối thiểu (VNĐ)</span>
              <input
                type="number"
                className="text-input tabular-nums"
                value={vMinSpend}
                onChange={(e) => setVMinSpend(e.target.value)}
              />
            </label>

            <label className="field-label">
              <span>Giảm tối đa (VNĐ, nếu giảm %)</span>
              <input
                type="number"
                className="text-input tabular-nums"
                disabled={vType === 'flat'}
                value={vMaxDiscount}
                onChange={(e) => setVMaxDiscount(e.target.value)}
              />
            </label>
          </div>

          <button type="submit" className="btn btn-secondary">
            + Thêm Voucher Vào Phép Tính
          </button>
        </form>
      </div>

      {/* Evaluated Split Plan Output */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          paddingTop: '12px',
          borderTop: '1px solid var(--border-subtle)',
        }}
        data-testid="optimizer-result"
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '8px',
          }}
        >
          <h3 style={{ margin: 0, fontSize: '1rem', color: '#fbbf24' }}>
            Phương án tối ưu: {plan.strategyLabel}
          </h3>
          <div className="tabular-nums" style={{ fontSize: '0.9rem' }}>
            Tổng giảm: <strong style={{ color: '#6ee7b7' }}>-{formatVnd(plan.totalDiscountVnd)}</strong> •
            Còn trả: <strong style={{ color: '#ffffff' }}>{formatVnd(plan.totalFinalPayableVnd)}</strong>
          </div>
        </div>

        {plan.savingsVsSingleOrderVnd > 0 && (
          <div className="savings-banner tabular-nums">
            Lời thêm {formatVnd(plan.savingsVsSingleOrderVnd)} so với gộp tất cả vào 1 đơn!
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {plan.groups.map((group) => (
            <div
              key={group.groupIndex}
              className="optimizer-group-card"
              data-testid={`optimizer-group-${group.groupIndex}`}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '6px',
                }}
              >
                <strong>Đơn #{group.groupIndex}</strong>
                <span className="tabular-nums" style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  Tạm tính: {formatVnd(group.subtotalVnd)} • Giảm:{' '}
                  <strong style={{ color: '#6ee7b7' }}>-{formatVnd(group.discountVnd)}</strong> • Thanh
                  toán: <strong style={{ color: '#fbbf24' }}>{formatVnd(group.finalPayableVnd)}</strong>
                </span>
              </div>

              <div style={{ fontSize: '0.86rem', color: 'var(--text-secondary)' }}>
                Món trong đơn:{' '}
                <strong>
                  {group.items.map((it) => `${it.name} (x${it.quantity})`).join(', ')}
                </strong>
              </div>

              <div style={{ fontSize: '0.85rem' }}>
                {group.appliedVoucher ? (
                  <span>
                    Áp mã: <strong style={{ color: '#fed7aa' }}>{group.appliedVoucher.label}</strong>{' '}
                    {group.appliedVoucher.code && (
                      <span className="voucher-code-pill">{group.appliedVoucher.code}</span>
                    )}
                  </span>
                ) : (
                  <span style={{ color: 'var(--text-muted)' }}>Chưa đủ điều kiện áp voucher</span>
                )}
              </div>

              {(group.shortfallToMinSpendVnd > 0 || group.nextBestVoucherHint) && (
                <div className="shortfall-alert tabular-nums">
                  {group.shortfallToMinSpendVnd > 0
                    ? `Còn thiếu ${formatVnd(group.shortfallToMinSpendVnd)} để chạm ngưỡng đơn tối thiểu!`
                    : null}{' '}
                  {group.nextBestVoucherHint && <span>{group.nextBestVoucherHint}</span>}
                </div>
              )}
            </div>
          ))}
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            flexWrap: 'wrap',
            marginTop: '4px',
          }}
        >
          <label
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '0.86rem',
              color: 'var(--text-secondary)',
            }}
          >
            <span>Khung giờ săn:</span>
            <select
              className="select-input tabular-nums"
              style={{ minHeight: '48px' }}
              value={importSlotTime}
              onChange={(e) => setImportSlotTime(e.target.value)}
            >
              <option value="00:00">00:00</option>
              <option value="09:00">09:00</option>
              <option value="12:00">12:00</option>
              <option value="15:00">15:00</option>
              <option value="18:00">18:00</option>
              <option value="21:00">21:00</option>
            </select>
          </label>

          <button
            type="button"
            className="btn btn-emerald"
            style={{ flex: 1 }}
            disabled={plan.groups.length === 0}
            onClick={() => onImportPlanToRunbook(plan, importSlotTime)}
          >
            Đưa phương án này vào Kịch Bản Săn Mã
          </button>
        </div>
      </div>
    </section>
  );
};

export default CartOptimizer;

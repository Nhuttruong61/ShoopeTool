import React, { useState } from 'react';
import type { DealRunbookItem } from '../types/contracts';

export type DealRunbookDraft = Omit<
  DealRunbookItem,
  'id' | 'checklist' | 'completed' | 'targetEpochMs'
>;

export interface RunbookFormProps {
  onAddDeal: (draft: DealRunbookDraft) => void;
}

export const PRESET_SLOTS: readonly string[] = [
  '00:00',
  '09:00',
  '12:00',
  '15:00',
  '18:00',
  '21:00',
];

export const PAYMENT_METHODS: readonly string[] = [
  'ShopeePay',
  'SPayLater',
  'Thẻ/COD',
];

export const RunbookForm: React.FC<RunbookFormProps> = ({ onAddDeal }) => {
  const [slotTime, setSlotTime] = useState<string>('00:00');
  const [title, setTitle] = useState<string>('');
  const [itemsSummary, setItemsSummary] = useState<string>('');
  const [voucherCode, setVoucherCode] = useState<string>('');
  const [voucherNote, setVoucherNote] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<string>('ShopeePay');
  const [shopeeUrl, setShopeeUrl] = useState<string>('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanSlot = slotTime.trim() || '00:00';
    const cleanTitle = title.trim() || `Ca săn khung ${cleanSlot}`;
    const cleanItems = itemsSummary.trim() || 'Món đã chọn trong giỏ';

    onAddDeal({
      slotTime: cleanSlot,
      title: cleanTitle,
      itemsSummary: cleanItems,
      voucherCode: voucherCode.trim().toUpperCase(),
      voucherNote: voucherNote.trim(),
      paymentMethod,
      shopeeUrl: shopeeUrl.trim() || undefined,
    });

    setTitle('');
    setItemsSummary('');
    setVoucherCode('');
    setVoucherNote('');
    setShopeeUrl('');
  };

  return (
    <section className="section-card" aria-label="Thêm kịch bản săn mã mới">
      <div className="section-header">
        <h2 className="section-title">Thêm Ca Săn Mã Mới</h2>
      </div>

      <form className="form-stack" onSubmit={handleSubmit}>
        <div>
          <span className="field-label" style={{ marginBottom: '6px' }}>
            Chọn nhanh khung giờ Flash Sale:
          </span>
          <div className="chip-group" role="group" aria-label="Khung giờ mẫu">
            {PRESET_SLOTS.map((preset) => (
              <button
                key={preset}
                type="button"
                className={`slot-chip ${slotTime === preset ? 'active' : ''}`}
                onClick={() => setSlotTime(preset)}
              >
                {preset}
              </button>
            ))}
          </div>
        </div>

        <div className="form-row form-row-2">
          <label className="field-label">
            <span>Khung giờ mở mã (HH:MM)</span>
            <input
              type="text"
              className="text-input tabular-nums"
              placeholder="VD: 00:00"
              value={slotTime}
              onChange={(e) => setSlotTime(e.target.value)}
            />
          </label>

          <label className="field-label">
            <span>Phương thức thanh toán</span>
            <select
              className="select-input"
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
            >
              {PAYMENT_METHODS.map((method) => (
                <option key={method} value={method}>
                  {method}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="form-row form-row-2">
          <label className="field-label">
            <span>Tên ca săn / Nhãn gợi nhớ</span>
            <input
              type="text"
              className="text-input"
              placeholder="VD: Săn mã Mall 20% khung 0h"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </label>

          <label className="field-label">
            <span>Món cần tick sẵn trong Giỏ</span>
            <input
              type="text"
              className="text-input"
              placeholder="VD: Tai nghe Sony + Cáp sạc"
              value={itemsSummary}
              onChange={(e) => setItemsSummary(e.target.value)}
            />
          </label>
        </div>

        <div className="form-row form-row-2">
          <label className="field-label">
            <span>Mã Voucher ký tự (bỏ trống nếu mã lưu Banner)</span>
            <input
              type="text"
              className="text-input"
              placeholder="VD: AFF1111HOANXU"
              value={voucherCode}
              onChange={(e) => setVoucherCode(e.target.value)}
            />
          </label>

          <label className="field-label">
            <span>Điều kiện / Ghi chú mã</span>
            <input
              type="text"
              className="text-input"
              placeholder="VD: Giảm 20% tối đa 100k đơn từ 500k"
              value={voucherNote}
              onChange={(e) => setVoucherNote(e.target.value)}
            />
          </label>
        </div>

        <button type="submit" className="btn btn-primary">
          + Thêm Vào Kịch Bản Săn Mã
        </button>
      </form>
    </section>
  );
};

export default RunbookForm;

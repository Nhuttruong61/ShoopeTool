# Spec: Shopee 11/11 Manual-Assist Companion (ShoopeeTool)

## Objective

Xây dựng một **Web App di động (PWA)** hợp lệ giúp người mua hàng cá nhân trên Shopee khắc phục việc thao tác tay bị chậm nhịp khi săn voucher giới hạn lượt trong các đợt sale lớn (11/11, 12/12, Flash Sale khung giờ).

Thay vì can thiệp trái phép vào Shopee (không auto-click, không gọi API Shopee, không vượt anti-bot để bảo vệ tài khoản khỏi lỗi `F01`/`M02`), ứng dụng giải quyết bài toán tốc độ bằng cách **tách toàn bộ khâu chọn sản phẩm & ghép voucher lên trước giờ mở mã**, kết hợp **đồng hồ nổi Picture-in-Picture (PiP) đồng bộ giờ chuẩn đến `0.1s` + âm báo đếm ngược** đè trên góc màn hình điện thoại để người dùng chỉ cần bấm 2 chạm cuối lúc mở sale.

### User Stories
1. **Chuẩn bị kịch bản săn mã (Pre-flight Runbook):** Trước khung giờ sale (`00:00`, `09:00`, `12:00`, `15:00`, `18:00`, `21:00`), người dùng tạo thẻ săn mã gồm: khung giờ, món cần tick sẵn, mã ký tự (nếu có), phương thức thanh toán, và checklist xác nhận đã đứng chờ sẵn ở màn hình Thanh toán của Shopee.
2. **Tối ưu ghép giỏ hàng & voucher (Smart Cart-Voucher Splitter):** Khi có nhiều món cần mua và nhiều voucher có mức giảm/đơn tối thiểu khác nhau, người dùng có thể nhập nhanh giá món + điều kiện mã để công cụ gợi ý nên gộp hay tách đơn sao cho tổng tiền giảm cao nhất (và báo còn thiếu bao nhiêu tiền để đạt ngưỡng tối thiểu).
3. **Đồng hồ nổi PiP & Âm báo nhịp chuẩn giây:** Khi bấm *"Bật Đồng Hồ Nổi"*, trình duyệt mở cửa sổ nhỏ Picture-in-Picture hiển thị giờ chuẩn đã bù độ trễ mạng (`0.1s`), tên mã đang săn, đổi màu cảnh báo (`CHUẨN BỊ` → `SẴN SÀNG` → `BẤM NGAY!`) sớm hơn `leadMs` (mặc định `300ms` bù phản xạ tay) kèm âm báo nhịp *Bíp-Bíp-BẤM!*.
4. **Copy mã 1 chạm & Mở nhanh Shopee:** Nút bấm 1 chạm sao chép sẵn mã voucher vào Clipboard (hoạt động cả trên HTTPS lẫn mạng LAN Wi-Fi nội bộ) và mở nhanh ứng dụng/trang giỏ hàng Shopee do chính người dùng kích hoạt.

## Tech Stack

- **Runtime & Build:** Node.js `>=22`, Vite `^6.x`, TypeScript `^5.7`
- **UI Framework:** React `^19.x` + CSS Modules / Scoped Modern CSS (Mobile-first, không dùng thư viện UI nặng để tải tức thì trên điện thoại)
- **PWA Support:** Static `manifest.webmanifest` + Service Worker nhẹ cho phép *"Thêm vào màn hình chính"* trên Android Chrome & iOS Safari
- **Testing:** Vitest `^3.x` + `@testing-library/react` + `jsdom`

## Commands

```bash
# Cài đặt dependencies
npm install

# Chạy môi trường dev trên máy tính
npm run dev

# Chạy dev mở cổng LAN Wi-Fi để điện thoại cùng mạng truy cập trực tiếp
npm run dev:lan

# Kiểm tra kiểu TypeScript
npm run typecheck

# Chạy toàn bộ unit & integration tests
npm test

# Build bản production tĩnh
npm run build
```

## Project Structure

```text
C:/O D/ShoopeeTool/
├── public/
│   └── manifest.webmanifest   → Cấu hình PWA cài ra màn hình chính điện thoại
├── src/
│   ├── types/
│   │   └── contracts.ts       → Toàn bộ kiểu dữ liệu & interface dùng chung giữa các module
│   ├── lib/
│   │   ├── timeSync.ts        → Đồng bộ giờ chuẩn bù RTT + state machine đếm ngược
│   │   ├── pipClock.ts        → Vẽ Canvas 30fps & điều khiển cửa sổ nổi Picture-in-Picture
│   │   ├── audioCue.ts        → Bộ phát âm báo nhịp Web Audio & ghép track cho PiP
│   │   ├── optimizer.ts       → Thuật toán gợi ý gộp/tách đơn tối ưu theo điều kiện voucher
│   │   ├── clipboard.ts       → Copy mã 1 chạm (có fallback cho HTTP LAN) & deep-link mở Shopee
│   │   └── storage.ts         → Lưu/đọc kịch bản săn mã vào localStorage có kiểm tra dữ liệu
│   ├── components/
│   │   ├── LiveStrikeBar.tsx  → Đồng hồ lớn, chỉnh bù phản xạ (ms), nút bật PiP & Âm báo
│   │   ├── RunbookList.tsx    → Danh sách ca săn mã, checklist trước giờ G, nút Copy + Mở Shopee
│   │   ├── RunbookForm.tsx    → Form thêm/sửa nhanh ca săn mã theo khung giờ sale
│   │   └── CartOptimizer.tsx  → Công cụ tính nhanh gộp/tách giỏ hàng & chuyển thành thẻ săn mã
│   ├── styles/
│   │   └── global.css         → Giao diện tối tương phản cao, nút bấm chuẩn cảm ứng >= 48px
│   ├── App.tsx                → Ghép nối các khu vực chức năng chính
│   └── main.tsx               → Điểm khởi chạy ứng dụng
├── tests/
│   ├── timeSync.test.ts       → Kiểm thử tính offset RTT & chuyển trạng thái đếm ngược
│   ├── optimizer.test.ts      → Kiểm thử tính giảm giá, báo thiếu đơn tối thiểu & tách đơn
│   └── storage-ui.test.tsx    → Kiểm thử lưu kịch bản, checklist & luồng thao tác người dùng
├── tasks/
│   ├── plan.md                → Kế hoạch kỹ thuật & điều phối Gemini Agents
│   └── todo.md                → Danh sách đầu việc chi tiết kèm tiêu chí nghiệm thu
└── SPEC.md                    → Tài liệu đặc tả nguồn (file này)
```

## Code Style

- Sử dụng **TypeScript strict mode** (`noImplicitAny`, `strictNullChecks`).
- Tách bạch hoàn toàn **pure logic** trong `src/lib/*` (không phụ thuộc React, dễ test 100%) và **giao diện** trong `src/components/*`.
- Tên hàm dùng `camelCase`, tên component và interface dùng `PascalCase`, hằng số cấu hình dùng `UPPER_SNAKE_CASE`.

```typescript
export interface VoucherRule {
  readonly id: string;
  readonly label: string;
  readonly code?: string;
  readonly minSpendVnd: number;
  readonly discountType: 'percent' | 'flat';
  readonly discountValue: number;
  readonly maxDiscountVnd?: number;
}

export function computeVoucherDiscount(subtotalVnd: number, rule: VoucherRule): number {
  if (subtotalVnd < rule.minSpendVnd || subtotalVnd <= 0) return 0;
  const raw =
    rule.discountType === 'flat'
      ? rule.discountValue
      : Math.floor((subtotalVnd * rule.discountValue) / 100);
  return rule.maxDiscountVnd !== undefined ? Math.min(raw, rule.maxDiscountVnd) : raw;
}
```

## Testing Strategy

- **Unit Tests (`tests/timeSync.test.ts`, `tests/optimizer.test.ts`):** Bao phủ 100% nhánh logic tính bù độ trễ mạng (`RTT/2`), chuyển pha cảnh báo (`IDLE` → `PREPARE` → `READY` → `STRIKE`), tính tiền giảm voucher phần trăm/trừ thẳng/trần tối đa, phát hiện số tiền còn thiếu để đạt đơn tối thiểu, và so sánh phương án gộp đơn vs tách đơn.
- **Component / Integration Tests (`tests/storage-ui.test.tsx`):** Kiểm tra thêm ca săn mã, lưu trữ bền vững qua `localStorage`, đánh dấu checklist chuẩn bị trước giờ G, và copy mã voucher.
- **Runtime Verification:** Chạy `npm test`, `npm run typecheck`, và `npm run build` không có bất kỳ lỗi hay cảnh báo nghiêm trọng nào.

## Boundaries

- **Always do:**
  - Chạy `npm run typecheck` và `npm test` trước khi hoàn thành mỗi task.
  - Đảm bảo mọi nút thao tác chính trên mobile có chiều cao tối thiểu `48px` để bấm nhanh một tay.
  - Có cơ chế fallback an toàn khi trình duyệt điện thoại không hỗ trợ PiP hoặc chạy qua mạng LAN HTTP chưa có HTTPS (fallback copy clipboard + đồng hồ toàn màn hình + âm báo).
- **Ask first:**
  - Thêm bất kỳ thư viện ngoài nào ngoài danh sách trong mục Tech Stack.
  - Thay đổi cấu trúc interface trong `src/types/contracts.ts` sau khi các agent song song đã bắt đầu code.
- **Never do:**
  - **Tuyệt đối không** viết tính năng auto-click, macro, can thiệp DOM của Shopee, gọi ngầm API riêng của Shopee, hay vượt CAPTCHA / hệ thống chống bot dưới mọi hình thức.
  - Không lưu thông tin đăng nhập, cookie hay token tài khoản Shopee của người dùng.

## Success Criteria

1. Người dùng tạo được kịch bản săn mã (khung giờ, món cần tick, mã voucher, ghi chú thanh toán) và dữ liệu giữ nguyên sau khi tải lại trang.
2. Bộ tính tối ưu giỏ hàng tính đúng số tiền giảm, báo chính xác số tiền còn thiếu để chạm ngưỡng tối thiểu, và gợi ý đúng phương án gộp/tách đơn cho tối đa 10 món hàng.
3. Đồng hồ canh nhịp hiển thị chính xác đến `0.1 giây`, hỗ trợ hiệu chỉnh độ trễ bấm sớm (`0ms` – `2000ms`), phát âm báo đếm ngược và mở được cửa sổ nổi Picture-in-Picture (trên trình duyệt hỗ trợ) hoặc chế độ HUD toàn màn hình (fallback).
4. Nút Copy mã hoạt động trên cả `localhost` / `https` và địa chỉ IP mạng LAN nội bộ (`http://192.168.x.x`).
5. Toàn bộ test trong `npm test` pass 100% và `npm run build` xuất gói production thành công.

## Open Questions

1. Bạn đang dùng **Android (Chrome)** hay **iPhone (Safari)** làm máy bấm mua chính? *(Mặc định thiết kế hỗ trợ cả hai, kèm fallback HUD + Âm báo cho iOS đời cũ hạn chế Canvas PiP).*
2. Bạn có muốn triển khai luôn lên host tĩnh HTTPS miễn phí sau khi chạy thử nội bộ qua Wi-Fi không? *(Mặc định chạy ngay trên máy và mạng Wi-Fi nội bộ trước).*

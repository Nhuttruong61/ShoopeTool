# Task Breakdown: Shopee 11/11 Manual-Assist Companion

## Task 1: Khởi tạo dự án & Khóa hợp đồng kiểu dữ liệu (`contracts.ts`)

**Description:** Thiết lập khung dự án Vite + React + TypeScript + Vitest tối giản, cấu hình lệnh `dev:lan` (`vite --host`), và định nghĩa đầy đủ các kiểu dữ liệu dùng chung tại `src/types/contracts.ts` để các Gemini Agents ở Phase 2 có thể làm việc song song không xung đột.

**Acceptance criteria:**
- [x] Cấu hình đầy đủ `package.json` với các lệnh `dev`, `dev:lan`, `build`, `typecheck`, `test`.
- [x] `src/types/contracts.ts` định nghĩa rõ `TimePhase`, `TimeSyncState`, `VoucherRule`, `CartItem`, `DealRunbookItem`, `OrderSplitPlan`.
- [x] Có khung `index.html` tối ưu viewport di động (`viewport-fit=cover`, theme-color).

**Verification:**
- [x] Tests pass: `npm test`
- [x] Build succeeds: `npm run typecheck && npm run build`
- [x] Manual check: Kiểm tra cây thư mục khớp `SPEC.md`

**Dependencies:** None

**Files likely touched:**
- `package.json`
- `tsconfig.json`
- `vite.config.ts`
- `index.html`
- `src/types/contracts.ts`

**Estimated scope:** Medium (5 files)

---

## Checkpoint: After Task 1 (Foundation)
- [x] `npm install` hoàn tất không lỗi
- [x] `npm run typecheck` pass 100%
- [x] Hợp đồng kiểu `src/types/contracts.ts` sẵn sàng cho 3 nhánh song song

---

## Task 2: Engine Đồng bộ giờ chuẩn, Âm báo & Cửa sổ nổi PiP (`time-pip`)

**Description:** Cài đặt bộ đồng bộ giờ chuẩn bù một nửa độ trễ khứ hồi (`RTT/2`), máy trạng thái đếm ngược có bù thời gian phản xạ tay (`leadMs`), bộ phát âm thanh báo nhịp Web Audio (`T-3s`, `T-2s`, `T-1s`, `BẤM!`), và bộ dựng hình `<canvas>` 30fps xuất ra cửa sổ nổi Picture-in-Picture.

**Acceptance criteria:**
- [x] `timeSync.ts` tính đúng độ lệch giờ (`offsetMs`) từ mẫu đo RTT, lọc nhiễu theo trung vị và lùi an toàn về giờ máy nếu lỗi mạng.
- [x] Máy trạng thái chuyển pha chính xác (`IDLE` → `PREPARE_60S` → `READY_10S` → `COUNTDOWN_3S` → `STRIKE_NOW` sớm hơn mốc mở mã đúng `leadMs`).
- [x] `pipClock.ts` & `audioCue.ts` mở được cửa sổ PiP từ thao tác bấm của người dùng và báo rõ trạng thái hỗ trợ của trình duyệt để UI hiển thị fallback khi cần.

**Verification:**
- [x] Tests pass: `npx vitest run tests/timeSync.test.ts`
- [x] Build succeeds: `npm run typecheck`
- [x] Manual check: Kiểm tra logic chuyển trạng thái ở các mốc biên `59.7s`, `00.0s`, `03.0s`

**Dependencies:** Task 1

**Files likely touched:**
- `src/lib/timeSync.ts`
- `src/lib/audioCue.ts`
- `src/lib/pipClock.ts`
- `tests/timeSync.test.ts`

**Estimated scope:** Medium (4 files)

---

## Task 3: Bộ tối ưu Ghép đơn – Voucher, Lưu trữ & Clipboard (`voucher-brain`)

**Description:** Cài đặt thuật toán tính mức giảm voucher và gợi ý phương án gộp chung hay tách thành các đơn riêng để tối đa hóa tổng tiền giảm (kèm cảnh báo còn thiếu bao nhiêu tiền để chạm đơn tối thiểu), cộng với lưu trữ `localStorage` an toàn (có dữ liệu mẫu 11/11) và hàm copy mã chạy được cả trên mạng LAN HTTP.

**Acceptance criteria:**
- [x] `optimizer.ts` tính chính xác giảm giá theo `%` (có trần `maxDiscountVnd`) và giảm thẳng (`flat`), báo đúng số tiền còn thiếu nếu chưa đủ `minSpendVnd`, và tìm được cách phân bổ tối ưu tối đa 10 món hàng vào các voucher hiện có.
- [x] `storage.ts` đọc/ghi danh sách `DealRunbookItem` bền vững, không crash khi dữ liệu `localStorage` hỏng, kèm sẵn bộ khung giờ mẫu 11/11 (`00:00`, `09:00`, `12:00`, `21:00`).
- [x] `clipboard.ts` hỗ trợ copy bằng `navigator.clipboard` kèm fallback `<textarea>` cho mạng LAN HTTP và tạo đúng URL mở giỏ hàng Shopee.

**Verification:**
- [x] Tests pass: `npx vitest run tests/optimizer.test.ts`
- [x] Build succeeds: `npm run typecheck`
- [x] Manual check: Đối chiếu kết quả bài toán tách 2 đơn áp 2 mã so với gộp 1 đơn

**Dependencies:** Task 1

**Files likely touched:**
- `src/lib/optimizer.ts`
- `src/lib/storage.ts`
- `src/lib/clipboard.ts`
- `tests/optimizer.test.ts`

**Estimated scope:** Medium (4 files)

---

## Task 4: Giao diện Mobile-First cho Săn mã & Ghép đơn (`mobile-ui`)

**Description:** Xây dựng bộ giao diện React tối ưu cho màn hình dọc điện thoại (nền tối chống chói ban đêm 0h, chữ số đồng hồ monospace lớn không giật khung hình, nút bấm `>= 48px`) gồm thanh đồng hồ canh nhịp, danh sách thẻ kịch bản săn mã có checklist trước giờ G, form tạo nhanh kịch bản và bảng tính ghép giỏ hàng.

**Acceptance criteria:**
- [x] `LiveStrikeBar.tsx` hiển thị đồng hồ `HH:MM:SS.d`, pha cảnh báo đổi màu rõ rệt, thanh trượt chỉnh bấm sớm (`0ms`–`1500ms`), nút bật Đồng hồ nổi PiP / chế độ HUD toàn màn hình và bật/tắt âm thanh.
- [x] `RunbookList.tsx` & `RunbookForm.tsx` cho phép chọn ca săn đang canh giờ, tick checklist 3 bước trước giờ G, bấm 1 chạm *"Copy Mã + Mở Shopee"*, và thêm/xóa ca săn nhanh.
- [x] `CartOptimizer.tsx` cho phép nhập danh sách món + voucher để xem gợi ý tách đơn lời nhất và bấm 1 nút chuyển thẳng kết quả thành các thẻ kịch bản săn mã.

**Verification:**
- [x] Build succeeds: `npm run typecheck`
- [x] Manual check: Rà soát responsive ở kích thước màn hình điện thoại `375x812` (iPhone) và `360x800` (Android)

**Dependencies:** Task 1

**Files likely touched:**
- `src/components/LiveStrikeBar.tsx`
- `src/components/RunbookList.tsx`
- `src/components/RunbookForm.tsx`
- `src/components/CartOptimizer.tsx`
- `src/styles/global.css`

**Estimated scope:** Medium (5 files)

---

## Checkpoint: After Tasks 2-4 (Core Modules)
- [x] Unit tests của cả `time-pip` và `voucher-brain` pass 100%
- [x] Toàn bộ components biên dịch sạch với `npm run typecheck`
- [x] Không có xung đột file giữa 3 nhánh song song

---

## Task 5: Tích hợp Ứng dụng, PWA Manifest & Integration Tests (`integrator`)

**Description:** Ghép nối engine thời gian, PiP, âm báo, lưu trữ và giao diện vào `src/App.tsx`, thêm cấu hình `public/manifest.webmanifest` để cài lên màn hình chính điện thoại, và viết integration tests kiểm tra trọn vẹn luồng người dùng từ tạo ca săn mã đến copy mã.

**Acceptance criteria:**
- [x] `src/App.tsx` kết nối mượt mà giữa ca săn đang chọn trong `RunbookList` với mốc đếm ngược mục tiêu của `LiveStrikeBar` và nội dung hiển thị trên cửa sổ nổi PiP.
- [x] `public/manifest.webmanifest` hợp lệ để trình duyệt mobile nhận diện cài đặt PWA.
- [x] `tests/storage-ui.test.tsx` kiểm tra thêm ca săn mới, đánh dấu checklist, chuyển kết quả tối ưu đơn sang kịch bản và lưu `localStorage`.

**Verification:**
- [x] Tests pass: `npm test`
- [x] Build succeeds: `npm run typecheck && npm run build`
- [x] Manual check: Luồng chuyển đổi ca săn cập nhật ngay giờ mục tiêu trên đồng hồ

**Dependencies:** Task 2, Task 3, Task 4

**Files likely touched:**
- `src/App.tsx`
- `src/main.tsx`
- `public/manifest.webmanifest`
- `tests/storage-ui.test.tsx`

**Estimated scope:** Medium (4 files)

---

## Task 6: Kiểm định chất lượng độc lập & Nghiệm thu cuối (`verifier`)

**Description:** Agent kiểm định (`verifier`) rà soát chéo toàn bộ mã nguồn đối chiếu với `SPEC.md` (đặc biệt là các ranh giới an toàn Boundaries và trải nghiệm mobile), chạy toàn bộ test suite, kiểm tra bản build production và xác nhận hướng dẫn mở qua Wi-Fi cho điện thoại.

**Acceptance criteria:**
- [x] 100% tests trong `npm test` pass, không có lỗi TypeScript hay lỗi đóng gói `npm run build`.
- [x] Xác nhận tuân thủ tuyệt đối mục Boundaries trong `SPEC.md` (không chứa bất kỳ đoạn mã can thiệp Shopee hay auto-click nào).
- [x] Có hướng dẫn ngắn gọn trong `README.md` cách chạy trên máy tính và quét/mở địa chỉ Wi-Fi LAN trên điện thoại trong 30 giây.

**Verification:**
- [x] Tests pass: `npm test`
- [x] Build succeeds: `npm run typecheck && npm run build`
- [x] Manual check: Khởi chạy thử dev server và kiểm tra phản hồi HTTP 200 của trang chủ + manifest

**Dependencies:** Task 5

**Files likely touched:**
- `README.md`
- `tasks/todo.md`

**Estimated scope:** Small (2 files)

---

## Checkpoint: Complete
- [x] All acceptance criteria in `SPEC.md` met
- [x] Tests pass, production build clean, ready for user review on mobile & desktop

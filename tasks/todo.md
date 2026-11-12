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

---

## Phase v2.0: Nâng cấp Săn Tối Đa Voucher Quanh Năm (365 Ngày)

### Task 7 (`v2-core`): Core Domain & Contracts cho Year-Round Max Voucher
- [x] Mở rộng `src/types/contracts.ts` với đầy đủ kiểu dữ liệu v2.0 (`SaleCampaignType`, `SaleCampaignEvent`, `VoucherHubCategory`, `VoucherHubShortcut`, `ParsedDealCandidate`, `ShoppingChannel`, `ChannelVoucherSpec`, `ChannelStackInput`, `EvaluatedChannelStack`, `ChannelStackComparison`) mà vẫn giữ nguyên 100% export v1.0.
- [x] Cài đặt `src/lib/yearRoundDeals.ts`:
  - `getUpcomingSaleRadar(nowEpochMs?)`: Radar lịch sale 365 ngày theo múi giờ Việt Nam (`UTC+7`, độc lập `TZ` máy chủ) gồm Làm Mới Kho Mã Hàng Ngày, Ngày Đôi (`1/1`..`12/12`), Giữa Tháng (`15/MM`), Lương Về (`25/MM`), và Thứ 4 Freeship.
  - `OFFICIAL_VOUCHER_HUBS`: 8 lối tắt chính thống `https://shopee.vn/m/...` (Mã Toàn Sàn, Freeship Xtra, Voucher Xtra, Shopee Video, Shopee Live, ShopeePay, Ngân Hàng/Đối Tác, Shopee Rewards).
  - `parseDealTextPaste(rawText)` & `SAMPLE_DEAL_PASTE_TEXT`: Bóc tách nhanh danh sách deal từ Zalo/Telegram/FB thành thẻ săn mã.
  - `compareChannelStacks(input)` & `DEFAULT_STACK_INPUT`: Tính chồng 3 tầng mã (Shop → Sàn/Video/Live → Ship/Xu/Thanh toán) và phát hiện bẫy hụt đơn tối thiểu sau khi trừ Mã Shop.
- [x] Viết unit test đầy đủ tại `tests/yearRoundDeals.test.ts` (kiểm thử cả với `TZ=UTC`).

### Task 8 (`v2-ui` & `deeplink`): Giao diện VoucherMaxHub, Deep-Link Shopee App & Mobile Cockpit
- [x] Cài đặt `VoucherMaxHub.tsx` tích hợp Radar sale 365 ngày, 8 Trạm lưu mã chính thống, Smart Paste và Bảng tính chồng 3 tầng mã.
- [x] Bổ sung `detectLaunchPlatform`, `buildShopeeLaunchTargets` và `copyAndLaunchShopee` (`shopeevn://` + Android `intent://`) kèm unit tests tại `tests/deeplink.test.ts` và `tests/v2-max-voucher.test.tsx`.
- [x] Tối ưu giao diện Mobile Cockpit mật độ cao và migrate các URL `/cart` cũ sang các Hub lưu mã thực tế trên Shopee.

### Checkpoint: Complete Phase v2.0
- [x] Toàn bộ unit & integration tests v1.0 + v2.0 pass 100%, `npm run build` sạch lỗi.

---

## Phase v2.1: Ghép Cặp `[Link Sản Phẩm + Link Voucher]` Chốt Đơn 1-Chạm (6-Agent Swarm)

### Task 9 (`contracts-links` — Wave 1): Hợp đồng Kiểu Ghép Cặp, Bóc Tách Share-Text & Universal Link Launcher

**Description:** Mở rộng hợp đồng kiểu tương thích ngược 100% cho mô hình cặp `[productUrl + voucherUrl + strikeMode]`, cài đặt bộ lọc văn bản chia sẻ Shopee App (`extractShopeeLinkInfo`), xử lý điều hướng Universal Link / Android App Link cho shortlink (`vn.shp.ee`, `s.shopee.vn`) không bị lạc về `/cart`, và lưu trữ bền vững trong `localStorage`.

**Acceptance criteria:**
- [x] `src/types/contracts.ts` bổ sung `StrikeMode` (`'checkout-wait' | 'flash-product'`), `ShopeeLinkKind`, `ExtractedShopeeLink`, mở rộng tùy chọn `productUrl`, `voucherUrl`, `strikeMode` trên `DealRunbookItem` và `productUrl`, `voucherUrl` trên `ParsedDealCandidate`.
- [x] `src/lib/clipboard.ts` cài đặt `extractShopeeLinkInfo(rawInput)` tách sạch `cleanUrl` (cắt dấu câu thừa cuối link), tự động trích xuất `extractedTitle` từ câu rao Shopee App hoặc slug `-i.{shopId}.{itemId}`, lấy `shopId`/`itemId` và phân loại đúng `ShopeeLinkKind`.
- [x] `buildShopeeLaunchTargets` lọc `cleanUrl` từ chuỗi share-text trước khi parse để không bao giờ bị fallback nhầm về `/cart`; `copyAndLaunchShopee` mở shortlink trực tiếp qua OS Universal Link / App Link ở `auto-app` trên Android/iOS và qua `intent://...#Intent;scheme=https;package=com.shopee.vn...` ở `force-app` trên Android, giữ tương thích 100% với `tests/deeplink.test.ts`.
- [x] `src/lib/storage.ts` bảo toàn `productUrl`, `voucherUrl`, `strikeMode` khi đọc/ghi `localStorage` và tự ánh xạ `shopeeUrl` (khác `/cart`) sang `voucherUrl` cho dữ liệu cũ chưa có `voucherUrl`.
- [x] `tests/productVoucherLinks.test.ts` bao phủ đầy đủ Share-Text extraction, phân loại link, điều hướng shortlink trên Android/iOS/Desktop và round-trip `storage.ts`.

**Verification:**
- [x] Tests pass: `npx vitest run tests/deeplink.test.ts tests/productVoucherLinks.test.ts`
- [x] Build succeeds: `npm test && npm run build`

**Dependencies:** Phase v2.0

**Files owned:**
- `src/types/contracts.ts`
- `src/lib/clipboard.ts`
- `src/lib/storage.ts`
- `tests/productVoucherLinks.test.ts`

---

### Task 10 (`plan-architect` — Wave 1): Đặc Tả Kiến Trúc v2.1 & Kế Hoạch Điều Phối Swarm

**Description:** Cập nhật tài liệu đặc tả nguồn `SPEC.md`, kế hoạch điều phối `tasks/plan.md` và danh mục kiểm tra `tasks/todo.md` cho Milestone v2.1 mà vẫn bảo toàn toàn bộ lịch sử hoàn thành v1.0 / v2.0.

**Acceptance criteria:**
- [x] `SPEC.md` bổ sung đầy đủ đặc tả Milestone v2.1: mô hình ghép cặp `productUrl` + `voucherUrl` + `voucherCode` kèm `strikeMode` (`checkout-wait` vs `flash-product`), bóc tách thông minh Share-Text Shopee App, cơ chế Universal Link / App Link chống lạc về `/cart`, và cụm nút 1-chạm (`🎟️ Lưu Mã` + `📦 Mở SP` + `🛒 Giỏ hàng`) + đính link inline + Smart Paste combo.
- [x] `tasks/plan.md` & `tasks/todo.md` ghi rõ phân rã công việc cho 6 Swarm agents (`contracts-links`, `plan-architect`, `combo-parser`, `pair-ui`, `integrator`, `verifier`) kèm quyền sở hữu file không chồng lấn, tiêu chí nghiệm thu và các mốc Verification Checkpoints.

**Verification:**
- [x] Manual check: Kiểm tra `git diff` chỉ chạm đúng 3 file tài liệu (`SPEC.md`, `tasks/plan.md`, `tasks/todo.md`), không sửa bất kỳ file nào trong `src/`, `public/`, `tests/`.

**Dependencies:** Phase v2.0

**Files owned:**
- `SPEC.md`
- `tasks/plan.md`
- `tasks/todo.md`

---

### Checkpoint: After Wave 1 (`contracts-links` + `plan-architect`)
- [x] Hợp đồng kiểu v2.1 và hàm `extractShopeeLinkInfo` + Universal Link launcher đã merge sạch, pass 100% unit tests (`deeplink.test.ts` & `productVoucherLinks.test.ts`).
- [x] Tài liệu đặc tả `SPEC.md` và kế hoạch điều phối Swarm v2.1 đã sẵn sàng làm chuẩn tham chiếu cho Wave 2–4.

---

### Task 11 (`combo-parser` — Wave 2): Nâng Cấp Smart Paste Combo Parser `[SP + Voucher]`

**Description:** Nâng cấp bộ phân tích tin nhắn deal trong `src/lib/yearRoundDeals.ts` để tự động nhận diện, phân loại và ghép cặp cả `productUrl` (link sản phẩm / shortlink SP kèm tên món) lẫn `voucherUrl` (link lưu mã / trạm voucher) cùng `voucherCode` từ văn bản copy trên Zalo / Telegram / Facebook.

**Acceptance criteria:**
- [x] `parseDealTextPaste(rawText)` sử dụng `extractShopeeLinkInfo` để bóc tách chính xác `productUrl` và `voucherUrl` trên từng dòng hoặc cụm dòng deal liên tiếp trong cùng khung giờ, đồng thời tận dụng `extractedTitle` làm tên món dễ hiểu khi có văn bản chia sẻ SP.
- [x] Bảo toàn 100% tương thích ngược cho `SAMPLE_DEAL_PASTE_TEXT` và hỗ trợ thêm cả kèo link trực tiếp (`voucherCode: ''`) lẫn cặp link SP rút gọn + link lưu voucher + mã ký tự mà không nhận nhầm slug URL hay thông số `100W`/`256GB` thành mã.
- [x] Mở rộng `tests/yearRoundDeals.test.ts` kiểm thử đầy đủ các ca dán combo `[Link SP + Link Voucher + Mã]`, chỉ có Link SP, chỉ có Link Voucher, và nhiều link trong cùng bản tin.

**Verification:**
- [x] Tests pass: `npx vitest run tests/yearRoundDeals.test.ts`
- [x] Build succeeds: `npm run typecheck`

**Dependencies:** Task 9 (`contracts-links`)

**Files owned:**
- `src/lib/yearRoundDeals.ts`
- `tests/yearRoundDeals.test.ts`

---

### Task 12 (`pair-ui` — Wave 2): Giao Diện Ghép Cặp Link, Đính Link Inline & Cụm Nút 1-Chạm

**Description:** Nâng cấp các React components sang trải nghiệm Ghép Cặp `[SP + Voucher]` 1-chạm trên di động: tự lọc câu rao Shopee App khi dán link vào form, hỗ trợ đính/sửa nhanh link ngay trên thẻ Runbook hiện có, chọn chế độ `strikeMode`, và hiển thị cụm nút `🎟️ Lưu Mã` + `📦 Mở SP` + `🛒 Giỏ hàng` trên cả thẻ Runbook, `LiveStrikeBar` và `VoucherMaxHub`.

**Acceptance criteria:**
- [x] `RunbookForm.tsx` có ô nhập `productUrl` (dán nguyên câu chia sẻ Shopee App tự lọc URL sạch & tự điền tên món nếu đang trống), ô `voucherUrl` (kèm gợi ý chọn nhanh Hub lưu mã) và nút chọn `strikeMode` (`checkout-wait` vs `flash-product`).
- [x] `RunbookList.tsx` hiển thị rõ trạng thái cặp link + huy hiệu `strikeMode` trên từng thẻ, tích hợp cụm nút hành động 1-chạm (`🎟️ Lưu Mã`, `📦 Mua SP Ngay` / `Copy Mã + Mở SP`, `🛒 Giỏ hàng` — tự động copy `voucherCode` trước khi mở Shopee), và cho phép bấm **🔗 Gán SP/Mã** ngay trên thẻ (inline attachment/editor) không cần xóa tạo lại.
- [x] `LiveStrikeBar.tsx` hiển thị thanh hành động 1-chạm tương ứng với cặp `productUrl` / `voucherUrl` của ca săn đang chọn ngay dưới/cạnh đồng hồ `0.1s`.
- [x] `VoucherMaxHub.tsx` hiển thị preview các tag `[📦 Có Link SP]` / `[🎟️ Có Link Mã]` cho kết quả Smart Paste combo và cho phép nạp trọn bộ cặp link vào Runbook.
- [x] `src/styles/global.css` đảm bảo bố cục gọn gàng trên màn hình hẹp `360px`, tương phản rõ và vùng chạm cảm ứng chuẩn mobile.

**Verification:**
- [x] Build succeeds: `npm run typecheck && npm run build`
- [x] Manual check: Kiểm tra hiển thị và tương tác trên kích thước mobile `360x800` & `375x812`.

**Dependencies:** Task 9 (`contracts-links`)

**Files owned:**
- `src/components/RunbookForm.tsx`
- `src/components/RunbookList.tsx`
- `src/components/LiveStrikeBar.tsx`
- `src/components/VoucherMaxHub.tsx`
- `src/styles/global.css`

---

### Checkpoint: After Wave 2 (`combo-parser` + `pair-ui`)
- [x] Engine Smart Paste combo pass 100% unit tests trong `tests/yearRoundDeals.test.ts`.
- [x] Toàn bộ UI components mới biên dịch sạch kiểu (`tsc -b`), không xung đột file giữa `combo-parser` và `pair-ui`.

---

### Task 13 (`integrator` — Wave 3): Tích Hợp Toàn Luồng `App.tsx`, SW v4 & Kiểm Thử Tích Hợp v2.1

**Description:** Hợp nhất kết quả của Wave 1 & Wave 2 vào `src/App.tsx`, nâng cache Service Worker lên `shoopeetool-shell-v4`, kết nối state cập nhật inline cặp link/`strikeMode` trên thẻ Runbook, truyền trọn vẹn `productUrl` + `voucherUrl` từ Smart Paste sang danh sách kịch bản săn mã, cập nhật hướng dẫn sử dụng và bổ sung E2E integration tests tại `tests/v21-pair-links.test.tsx`.

**Acceptance criteria:**
- [x] `src/App.tsx` kết nối đầy đủ `handleOpenProduct`, `handleOpenVoucher`, `handleUpdateDealLinks` và ưu tiên `productUrl || voucherUrl || shopeeUrl` trong `handleCopyAndOpen`, đồng bộ tức thì xuống `localStorage`, `LiveStrikeBar` và cửa sổ PiP.
- [x] Khi nạp deal từ Smart Paste trong `VoucherMaxHub`, các trường `productUrl`, `voucherUrl` và `shopeeUrl` được bảo toàn trọn vẹn vào `DealRunbookItem` mới.
- [x] Nâng `CACHE` trong `public/sw.js` lên `'shoopeetool-shell-v4'`, cập nhật hướng dẫn trên tab `Hướng dẫn ĐT` và `README.md`.
- [x] `tests/v21-pair-links.test.tsx` kiểm tra toàn luồng E2E: tạo deal ghép cặp từ câu chia sẻ Shopee App trong `RunbookForm`, gán link inline qua `toggle-attach-${id}` cập nhật `RunbookList` + `LiveStrikeBar` + `localStorage`, và nạp bài đăng combo từ `VoucherMaxHub` Smart Paste mở đúng từng link (không bao giờ lạc về `/cart`).

**Verification:**
- [x] Tests pass: `npm test`
- [x] Build succeeds: `npm run typecheck && npm run build`

**Dependencies:** Task 10, Task 11, Task 12

**Files owned:**
- `src/App.tsx`
- `public/sw.js`
- `README.md`
- `tasks/todo.md`
- `tests/v21-pair-links.test.tsx`

---

### Task 14 (`verifier` — Wave 4): Kiểm Định Độc Lập & Nghiệm Thu Milestone v2.1

**Description:** Agent kiểm định độc lập (`verifier`) đối chiếu toàn bộ mã nguồn đã hợp nhất với `SPEC.md` (Milestone v2.1 & Boundaries), chạy toàn bộ bộ kiểm thử tự động, kiểm tra đóng gói production và xác nhận không có lỗi hồi quy ở các tính năng v1.0 / v2.0.

**Acceptance criteria:**
- [ ] 100% test files (`smoke`, `timeSync`, `optimizer`, `deeplink`, `productVoucherLinks`, `yearRoundDeals`, `storage-ui`, `v2-max-voucher`) pass tuyệt đối.
- [ ] `npm run typecheck` và `npm run build` hoàn tất với 0 lỗi.
- [ ] Xác nhận shortlink (`vn.shp.ee`, `s.shopee.vn`) mở qua Universal Link / App Link đúng chuẩn, không bị điều hướng nhầm về `/cart`, và tuân thủ 100% ranh giới an toàn trong `SPEC.md` (không auto-click, không gọi ngầm API Shopee).

**Verification:**
- [ ] Tests pass: `npm test`
- [ ] Build succeeds: `npm run typecheck && npm run build`

**Dependencies:** Task 13 (`integrator`)

**Files owned:**
- *(Read-only verification & report to Coordinator)*

---

### Checkpoint: Complete Phase v2.1
- [ ] Mọi tiêu chí nghiệm thu của Milestone v2.1 trong `SPEC.md` đạt 100%.
- [ ] Toàn bộ test suite pass, bản build production sạch lỗi và sẵn sàng sử dụng thực chiến trên điện thoại.



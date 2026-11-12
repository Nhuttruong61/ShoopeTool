# Spec: Shopee Max Voucher 365 Ngày & 11/11 Manual-Assist Companion (ShoopeeTool v2.1)

## Objective

Xây dựng một **Web App di động (PWA)** hợp lệ giúp người mua hàng cá nhân trên Shopee **tối đa hóa lượng voucher áp được quanh năm (365 ngày)**, **ghép cặp `[Link Sản Phẩm + Link Voucher]` chốt đơn 1-chạm**, cũng như khắc phục việc thao tác tay bị chậm nhịp khi săn voucher giới hạn lượt trong các đợt sale lớn (Ngày Đôi `1/1`..`12/12`, Sale Giữa Tháng `15/MM`, Lương Về `25/MM`, Thứ 4 Freeship, và Flash Sale khung giờ hàng ngày).

Thay vì can thiệp trái phép vào Shopee (không auto-click, không gọi API Shopee, không vượt anti-bot để bảo vệ tài khoản khỏi lỗi `F01`/`M02`), ứng dụng giải quyết bài toán **săn nhiều mã nhất & giảm sâu nhất quanh năm** bằng 4 trụ cột v2.0 kết hợp bộ canh giờ chuẩn `0.1s` của v1.0:

### User Stories (v1.0 + v2.0 Year-Round Max Voucher)
1. **Chuẩn bị kịch bản săn mã (Pre-flight Runbook):** Trước khung giờ sale (`00:00`, `09:00`, `12:00`, `15:00`, `18:00`, `21:00`), người dùng tạo thẻ săn mã gồm: khung giờ, món cần tick sẵn, mã ký tự (nếu có), phương thức thanh toán, và checklist xác nhận đã đứng chờ sẵn ở màn hình Thanh toán của Shopee.
2. **Tối ưu ghép giỏ hàng & voucher (Smart Cart-Voucher Splitter):** Khi có nhiều món cần mua và nhiều voucher có mức giảm/đơn tối thiểu khác nhau, người dùng có thể nhập nhanh giá món + điều kiện mã để công cụ gợi ý nên gộp hay tách đơn sao cho tổng tiền giảm cao nhất (và báo còn thiếu bao nhiêu tiền để đạt ngưỡng tối thiểu).
3. **Đồng hồ nổi PiP & Âm báo nhịp chuẩn giây:** Khi bấm *"Bật Đồng Hồ Nổi"*, trình duyệt mở cửa sổ nhỏ Picture-in-Picture hiển thị giờ chuẩn đã bù độ trễ mạng (`0.1s`), tên mã đang săn, đổi màu cảnh báo (`CHUẨN BỊ` → `SẴN SÀNG` → `BẤM NGAY!`) sớm hơn `leadMs` (mặc định `300ms` bù phản xạ tay) kèm âm báo nhịp *Bíp-Bíp-BẤM!*.
4. **Copy mã 1 chạm & Mở nhanh Shopee:** Nút bấm 1 chạm sao chép sẵn mã voucher vào Clipboard (hoạt động cả trên HTTPS lẫn mạng LAN Wi-Fi nội bộ) và mở nhanh ứng dụng/trang giỏ hàng Shopee do chính người dùng kích hoạt.
5. **Radar Lịch Sale 365 Ngày (`getUpcomingSaleRadar`):** Tự động tính theo múi giờ Việt Nam (`UTC+7`) các đợt tung mã gần nhất quanh năm: Làm Mới Kho Mã Hàng Ngày (`00:00`, `09:00`, `12:00`, `18:00`, `21:00`), Siêu Sale Ngày Đôi (`1/1`..`12/12`, tự cuộn qua `01/01` năm sau khi qua 12/12), Sale Giữa Tháng (`15/MM`), Sale Lương Về (`25/MM`), và Thứ 4 Siêu Rẻ & Freeship.
6. **Trạm Lưu Mã Chính Thống 1 Chạm (`OFFICIAL_VOUCHER_HUBS`):** Danh bạ 8 lối tắt chính thức (`https://shopee.vn/m/...`) mở trực tiếp trang lưu sớm Mã Toàn Sàn, Freeship Xtra, Voucher Xtra, Shopee Video, Shopee Live, ShopeePay, Ưu Đãi Ngân Hàng và Shopee Rewards mà không cần mò tìm trong app.
7. **Bộ Bóc Tách Nhanh Tin Nhắn Deal (`parseDealTextPaste`):** Dán nguyên đoạn văn bản tổng hợp mã từ các nhóm Zalo / Telegram / Facebook (hỗ trợ tiêu đề khung giờ `🔥 KHUNG 0H:` hoặc giờ đầu dòng `12h:`, `21:00`), tự động lọc mã ký tự (`AFF1122`, `VIDEO50K`, `FMCG100`), loại bỏ từ tiếng Việt/mệnh giá (`100K`, `250K`, `GIAM`, `DON`, `SHOPEE`), trích xuất điều kiện giảm & phương thức thanh toán để nạp thẳng vào Runbook chỉ bằng 1 chạm.
8. **Bộ Tính Chồng 3 Tầng Voucher & So Kèo Kênh Mua (`compareChannelStacks`):** Mô phỏng chính xác quy tắc chồng 3 tầng mã của Shopee: (Tầng 1) Trừ Mã Shop trước ra `afterShopVnd` → (Tầng 2) Kiểm tra điều kiện `afterShopVnd >= minSpendVnd` của Mã Sàn / Mã Shopee Video (Giỏ vàng) / Mã Shopee Live (Giỏ cam) và cảnh báo ngay **"Bẫy đơn tối thiểu"** nếu trừ Mã Shop xong làm rớt ngưỡng áp Mã Sàn → (Tầng 3) Cộng phí ship sau Freeship và trừ Shopee Xu + ưu đãi thanh toán để chỉ ra kênh mua lời nhất kèm hướng dẫn thao tác từng bước.

## Milestone v2.1 — Ghép Cặp `[Link Sản Phẩm + Link Voucher]` Chốt Đơn 1-Chạm

Trong thực chiến săn sale trên điện thoại, người dùng thường nhận được cả **link rút gọn / đoạn văn chia sẻ sản phẩm từ Shopee App** lẫn **link lưu mã / mã ký tự** trong cùng một tin nhắn Zalo/Telegram/Facebook. Milestone v2.1 mở rộng kiến trúc 100% tương thích ngược để kết nối liền mạch cặp `[Sản phẩm + Voucher]` từ khâu dán tin nhắn đến khâu bấm chốt đơn đúng `0.0s`:

### 1. Mô hình Ghép Cặp `productUrl` + `voucherUrl` + `voucherCode` & Chế độ Săn (`strikeMode`)
- Mở rộng `DealRunbookItem` và `ParsedDealCandidate` với các trường tùy chọn tương thích ngược:
  - `productUrl?: string` — Link trực tiếp tới sản phẩm mục tiêu (link đầy đủ `-i.{shopId}.{itemId}`, `/product/{shopId}/{itemId}`, hoặc shortlink `vn.shp.ee` / `s.shopee.vn`).
  - `voucherUrl?: string` — Link trạm lưu mã / ví voucher / trang sự kiện lưu sớm (`/voucher/`, `promotionId=`, `/m/ma-giam-gia`, `/m/voucher-xtra`, v.v.). Khi tải dữ liệu cũ từ `localStorage` có `shopeeUrl` khác `/cart` mà chưa có `voucherUrl`, tự động ánh xạ sang `voucherUrl` và giữ nguyên `shopeeUrl` để tương thích 100%.
  - `voucherCode: string` — Mã ký tự (nếu có) để tự động sao chép vào Clipboard trước khi chuyển sang Shopee App.
  - `strikeMode?: 'checkout-wait' | 'flash-product'` — Hai chiến thuật chốt đơn thực chiến:
    - **`checkout-wait` (Mặc định — Săn mã giới hạn lượt):** Lưu mã & bỏ SP vào giỏ từ trước (`T-5 phút`), đứng chờ sẵn ở màn hình *Thanh toán* hoặc *Giỏ hàng*, đến đúng nhịp `STRIKE_NOW` bấm áp mã / Đặt hàng ngay.
    - **`flash-product` (Canh giá Flash Sale / Mở bán đúng giờ G):** Sản phẩm chỉ đổi giá Flash Sale hoặc mở kho đúng giây `00.0s`; ưu tiên nút **📦 Mở SP** nhảy thẳng vào trang sản phẩm để chọn phân loại & Mua ngay với mã đã lưu sẵn.

### 2. Bóc Tách Thông Minh Văn Bản Chia Sẻ Shopee App (`extractShopeeLinkInfo`)
- Khi người dùng bấm *"Chia sẻ → Sao chép đường dẫn"* từ Shopee App, nội dung clipboard thường lẫn nhiều câu rao tự động, ví dụ:
  > `"Mua ngay Tai nghe Sony WF-1000XM5 với giá chỉ ₫3.990.000! Mua ngay trên Shopee! https://vn.shp.ee/AbCd12"`
- Hàm `extractShopeeLinkInfo(rawInput)` thực hiện:
  - **Tách URL sạch (`cleanUrl`):** Trích xuất URL đầu tiên (`https?://...`, `shopeevn://...`, hoặc đường dẫn tương đối `/m/...`, `/cart`, `/product/...` chuẩn hóa về `https://shopee.vn...`) và cắt bỏ dấu câu thừa cuối chuỗi (`.,;:!?)>]`).
  - **Tự động điền tên sản phẩm (`extractedTitle`):** Lọc phần văn bản đứng trước URL, loại bỏ emoji/ký hiệu đầu dòng và các cụm rao mẫu của Shopee App (*"Xem ngay"*, *"Mua ngay"*, *"Săn ngay"*, *"Sản phẩm"*, *"với giá..."*, *"giá chỉ..."*, *"mua ngay trên Shopee..."*, *"trên Shopee..."*, *"tại"*). Nếu dán URL trần dạng slug (`https://shopee.vn/Tai-nghe-Bluetooth-ANC-i.12345.67890`), tự động chuyển đổi slug thành tên dễ đọc (`"Tai nghe Bluetooth ANC"`).
  - **Nhận diện định danh & phân loại (`ShopeeLinkKind`):** Bóc tách `shopId` + `itemId` từ mẫu `-i.{shopId}.{itemId}`, `/product/{shopId}/{itemId}`, `/item/{shopId}/{itemId}` và phân loại chính xác thành `'shortlink' | 'product' | 'voucher' | 'hub' | 'cart' | 'unknown'`.

### 3. Xử Lý Universal Link / Android App Link Cho Shortlink Không Bị Lạc Về `/cart`
- Các tên miền rút gọn chính thức của Shopee (`vn.shp.ee`, `shp.ee`, `s.shopee.vn`, `shope.ee`) là các redirect trung gian: nếu nhồi trực tiếp vào `shopeevn://home?navigate_url=...` có thể không resolve đúng màn hình đích trong Shopee App, và nếu đưa nguyên chuỗi văn bản chia sẻ vào `new URL(...)` sẽ văng lỗi và bị đẩy nhầm về `/cart`.
- Cơ chế điều hướng chuẩn trong `buildShopeeLaunchTargets` & `copyAndLaunchShopee`:
  - Luôn lọc `cleanUrl` qua `extractShopeeLinkInfo` trước khi parse URL để chuỗi share-text không bao giờ bị fallback nhầm về `https://shopee.vn/cart`.
  - Khi `kind === 'shortlink'`:
    - **`auto-app` trên Android / iOS:** Điều hướng trực tiếp `cleanUrl` ở tab hiện tại (`navigateFn(cleanUrl, false)`, `usedNativeApp: true`) để hệ điều hành kích hoạt **iOS Universal Links / Android App Links** mở thẳng đúng màn hình sản phẩm/voucher trong Shopee App.
    - **`force-app` trên Android:** Đóng gói `intent://{host+path}#Intent;scheme=https;package=com.shopee.vn;S.browser_fallback_url={encodedCleanUrl};end` buộc mở trực tiếp bằng gói `com.shopee.vn` kèm fallback trình duyệt an toàn.
    - **`web` hoặc Desktop:** Mở tab mới tới `cleanUrl` (`usedNativeApp: false`).

### 4. Cụm Nút Đôi/Ba 1-Chạm, Đính Link Trực Tiếp Trên Thẻ & Smart Paste Combo
- **Cụm nút thao tác nhanh 1-chạm (`>= 48px` hoặc thanh compact chuẩn cảm ứng):**
  - **🎟️ Lưu Mã:** Copy sẵn `voucherCode` (nếu có) + mở thẳng `voucherUrl` (trạm lưu mã / ví voucher).
  - **📦 Mở SP:** Copy sẵn `voucherCode` (nếu có) + mở thẳng `productUrl` (trang sản phẩm mục tiêu).
  - **🛒 Giỏ hàng:** Copy sẵn `voucherCode` (nếu có) + mở nhanh màn hình Giỏ hàng (`/cart`) để chốt thanh toán.
- **Đính/Sửa nhanh Link ngay trên Thẻ Runbook (`RunbookList`) & Thanh Canh Nhịp (`LiveStrikeBar`):**
  - Cho phép đính kèm hoặc cập nhật nhanh `productUrl`, `voucherUrl` và chuyển đổi `strikeMode` (`Chờ Thanh toán` vs `Canh Flash SP`) ngay trên từng thẻ kịch bản săn đã tạo mà không cần xóa tạo lại; khi dán văn bản chia sẻ Shopee App vào ô link SP trong `RunbookForm` hoặc inline editor, tự động làm sạch URL và gợi ý điền tên món nếu đang trống.
  - Trên `LiveStrikeBar`, hiển thị nút hành động 1-chạm theo đúng cặp link & `strikeMode` của ca săn đang canh giờ ngay cạnh đồng hồ `0.1s`.
- **Smart Paste Combo Parser (`parseDealTextPaste` trong `yearRoundDeals.ts` & `VoucherMaxHub`):**
  - Bóc tách đồng thời cả cặp `[productUrl + voucherUrl + voucherCode]` từ tin nhắn deal nhiều dòng hoặc cùng dòng trên Zalo/Telegram/Facebook (tự phân biệt link SP `-i.{shopId}.{itemId}` / shortlink SP với link lưu voucher `/voucher/`, `/m/...`), giữ trọn cặp link khi nạp 1-chạm vào danh sách kịch bản săn mã (`DealRunbookItem`).

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
│   │   └── contracts.ts       → Toàn bộ kiểu dữ liệu & interface dùng chung (v1.0 + v2.0 + v2.1 Paired Links)
│   ├── lib/
│   │   ├── timeSync.ts        → Đồng bộ giờ chuẩn bù RTT + state machine đếm ngược
│   │   ├── pipClock.ts        → Vẽ Canvas 30fps & điều khiển cửa sổ nổi Picture-in-Picture
│   │   ├── audioCue.ts        → Bộ phát âm báo nhịp Web Audio & ghép track cho PiP
│   │   ├── optimizer.ts       → Thuật toán gợi ý gộp/tách đơn tối ưu theo điều kiện voucher
│   │   ├── yearRoundDeals.ts  → Engine v2.0/v2.1: Radar lịch sale 365 ngày, 8 Hub lưu mã, Smart Paste combo SP+Mã & Bộ tính chồng 3 tầng mã
│   │   ├── clipboard.ts       → Copy mã 1 chạm, bóc tách Share-Text Shopee & Universal Link / Deep-link launcher
│   │   └── storage.ts         → Lưu/đọc kịch bản săn mã (kèm cặp productUrl + voucherUrl + strikeMode) vào localStorage
│   ├── components/
│   │   ├── LiveStrikeBar.tsx  → Đồng hồ lớn, chỉnh bù phản xạ (ms), PiP/Âm báo & nút chốt nhanh SP/Mã theo ca đang chọn
│   │   ├── RunbookList.tsx    → Danh sách ca săn mã, checklist, đính link inline & cụm nút 1 chạm (🎟️ Lưu Mã / 📦 Mở SP / 🛒 Giỏ hàng)
│   │   ├── RunbookForm.tsx    → Form thêm nhanh ca săn mã kèm ghép cặp Link SP (tự lọc Share-Text) + Link Voucher + StrikeMode
│   │   ├── VoucherMaxHub.tsx  → Trung tâm 365 Ngày: Radar sale, 8 Trạm lưu mã, Smart Paste combo & Tính chồng 3 tầng mã
│   │   └── CartOptimizer.tsx  → Công cụ tính nhanh gộp/tách giỏ hàng & chuyển thành thẻ săn mã
│   ├── styles/
│   │   └── global.css         → Giao diện tối tương phản cao, nút bấm chuẩn cảm ứng >= 48px
│   ├── App.tsx                → Ghép nối các khu vực chức năng chính
│   └── main.tsx               → Điểm khởi chạy ứng dụng
├── tests/
│   ├── timeSync.test.ts            → Kiểm thử tính offset RTT & chuyển trạng thái đếm ngược
│   ├── optimizer.test.ts           → Kiểm thử tính giảm giá, báo thiếu đơn tối thiểu & tách đơn
│   ├── deeplink.test.ts            → Kiểm thử deep-link Shopee App trên Android / iOS / Desktop
│   ├── productVoucherLinks.test.ts → Kiểm thử bóc tách Share-Text, Universal Link shortlink & lưu trữ cặp SP+Voucher (v2.1)
│   ├── yearRoundDeals.test.ts      → Kiểm thử Radar 365 ngày, Smart Paste combo parser & chồng 3 tầng mã
│   ├── storage-ui.test.tsx         → Kiểm thử lưu kịch bản, checklist & luồng thao tác người dùng
│   └── v2-max-voucher.test.tsx     → Kiểm thử tích hợp giao diện VoucherMaxHub & cặp nút hành động 1 chạm
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
5. Ghép cặp `[Link Sản Phẩm + Link Voucher]` hoạt động xuyên suốt: dán nguyên câu chia sẻ từ Shopee App tự lọc sạch shortlink (`vn.shp.ee`, `s.shopee.vn`) + điền tên món, mở đúng Universal Link / App Link trên Android & iOS không bị đẩy nhầm về `/cart`, và hiển thị cụm nút 1-chạm (`🎟️ Lưu Mã` + `📦 Mở SP` + `🛒 Giỏ hàng`) ngay trên thẻ Runbook, LiveStrikeBar và Smart Paste.
6. Toàn bộ test trong `npm test` pass 100% và `npm run build` xuất gói production thành công.

## Open Questions

1. Bạn đang dùng **Android (Chrome)** hay **iPhone (Safari)** làm máy bấm mua chính? *(Mặc định thiết kế hỗ trợ cả hai, kèm fallback HUD + Âm báo cho iOS đời cũ hạn chế Canvas PiP).*
2. Bạn có muốn triển khai luôn lên host tĩnh HTTPS miễn phí sau khi chạy thử nội bộ qua Wi-Fi không? *(Mặc định chạy ngay trên máy và mạng Wi-Fi nội bộ trước).*

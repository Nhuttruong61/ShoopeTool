# ShoopeeTool 365 — Trợ Lý Săn Mã & Canh Nhịp Shopee

Web app di động (PWA) hỗ trợ **thao tác tay** khi săn voucher giới hạn lượt trên Shopee **quanh năm (365 ngày)**:
- **Ghép Cặp `[Link Sản Phẩm + Link Voucher]` Chốt Đơn 1-Chạm (v2.1)**: Dán nguyên câu *Chia sẻ* từ App Shopee (`vn.shp.ee`, `s.shopee.vn`, `-i.shopId.itemId`) tự động lọc sạch URL + điền tên món, mở đúng trang Sản phẩm / Lưu mã qua Universal Links & Android App Links (không bao giờ bị lạc về `/cart`). Hỗ trợ nút **🔗 Gán SP/Mã** ngay trên thẻ săn và cụm nút 1-chạm `🎟️ Lưu Mã` + `📦 Mua SP Ngay` / `Copy Mã + Mở SP` + `🛒 Giỏ hàng` trên cả thẻ kịch bản lẫn thanh đồng hồ `0.1s`.
- **Mở thẳng App Shopee trên điện thoại (`shopeevn://`, Universal Links & Android `intent://`)**: Bấm 1 chạm vào thẳng đúng trang sản phẩm, link lưu voucher hoặc 8 trạm mã thật trong App Shopee (Toàn Sàn, Voucher Xtra, Freeship, Shopee Video, Shopee Live, ShopeePay, Ngân Hàng, VIP) — tự động copy mã ký tự trước khi chuyển app.
- **Không chứa mã giả (Mock Codes)**: Phân biệt rõ **Mã Lưu Ví (~90% mã Shopee)** và **Mã Ký Tự Nhập Tay (~10%)**.
- **Bóc Tách Nhanh Kèo Combo & Mã Thật (Smart Paste v2.1)**: Dán bài đăng combo `[Link SP + Link Voucher + Mã ký tự]` (hoặc kèo link trực tiếp) từ Telegram/Zalo/Facebook để tự động tách Link SP, Link lưu mã, Mã ký tự + Khung giờ đưa thẳng vào kịch bản đếm ngược.
- **Bộ Tính Chồng 3 Tầng Mã & So Kênh Mua**: So sánh **Giỏ Hàng Thường (Xtra)** vs **Shopee Video (Giỏ Vàng)** vs **Shopee Live (Giỏ Cam)** theo đúng cơ chế 3 tầng `[1. Mã Shop] + [2. Mã Sàn/Video/Live] + [3. Freeship + Xu/TT]`, tự cảnh báo bẫy hụt đơn tối thiểu sau khi trừ Mã Shop.
- **Đồng hồ nổi chuẩn 0.1s (PiP / HUD) & Tối ưu Gộp/Tách đơn**.

> **An toàn:** ứng dụng **không** auto-click, không gọi API Shopee, không can thiệp trang Shopee, không lưu tài khoản/cookie/token. Bạn tự bấm mọi thao tác trên Shopee. Dữ liệu chỉ nằm trong `localStorage` của trình duyệt.

## Yêu cầu

- Node.js `>= 22`

```bash
npm install
```

## 1. Chạy trên máy tính

```bash
npm run dev
```

Mở `http://localhost:5173`.

## 2. Mở trên điện thoại qua Wi-Fi LAN (30 giây)

1. Máy tính và điện thoại **cùng một mạng Wi-Fi**.
2. Trên máy tính chạy:
   ```bash
   npm run dev:lan
   ```
3. Xem dòng `Network: http://<IP-Máy-Tính>:5173` trong terminal (hoặc chạy `ipconfig` và lấy địa chỉ IPv4, dạng `192.168.x.x`).
4. Trên điện thoại mở `http://<IP-Máy-Tính>:5173`.
5. Nếu không vào được: cho phép Node.js qua Windows Firewall (mạng Private) hoặc tắt VPN.

Ghi chú khi chạy qua `http://192.168.x.x` (không có HTTPS):
- **Copy mã** vẫn hoạt động nhờ fallback `execCommand('copy')`.
- **Đồng hồ nổi (PiP)** tùy trình duyệt; nếu không hỗ trợ, app tự chuyển sang **HUD toàn màn hình + âm báo**.
- Service Worker chỉ bật khi chạy bản build trên HTTPS/localhost; chạy LAN vẫn dùng bình thường.

## 3. Thêm vào Màn hình chính (PWA)

- **Android (Chrome):** menu `⋮` → *Thêm vào Màn hình chính* / *Cài đặt ứng dụng*.
- **iPhone (Safari):** nút *Chia sẻ* → *Thêm vào Màn hình chính*.

## 4. Quy trình săn mã quanh năm & chốt đơn cặp SP + Voucher — 3 bước

**Bước 1 — Chuẩn bị trước giờ G (vài phút đến vài giờ trước)**
1. Tab **Kịch bản săn**: chọn ca (00:00, 09:00, 12:00, 15:00, 18:00, 21:00), bấm **🔗 Gán SP/Mã** ngay trên thẻ để dán cặp `[Link Sản Phẩm + Link Voucher]` (tự lọc câu chia sẻ từ App Shopee), hoặc dán cả bài đăng hội nhóm vào **Smart Paste** ở tab **🔥 Kho Mã & 365**.
2. Cần ghép nhiều mã hoặc so kênh mua? Dùng **Bộ Tính Chồng 3 Tầng Mã** (Video vs Live vs Xtra) hoặc tab **Tối ưu tách đơn** để kiểm tra ngưỡng đơn tối thiểu sau trừ Mã Shop.
3. Bấm **🎟️ Lưu Mã** trước giờ mở lượt; nếu săn theo chế độ **🛒 Chờ Thanh toán**, tick sẵn món trong Giỏ và đứng chờ ở màn **Thanh toán**.

**Bước 2 — Canh nhịp (1–2 phút trước)**
1. Bấm **Chọn canh giờ** cho đúng ca, bấm **Đồng bộ lại** (xem lệch giờ/RTT).
2. Chỉnh **Báo sớm bù phản xạ tay** (mặc định 300ms, tối đa 2000ms) và **Tinh chỉnh lệch giờ** (±2000ms) nếu cần.
3. Bấm **⧉ PiP** (Đồng hồ nổi) rồi chuyển sang Shopee; nếu thiết bị không hỗ trợ PiP thì dùng chế độ **HUD** toàn màn hình. Giữ **Âm: BẬT** và tăng âm lượng.
4. Màu đồng hồ: `CHUẨN BỊ` (60s) → `SẴN SÀNG` (10s) → đếm ngược 3s (bíp) → `BẤM NGAY!`.

**Bước 3 — Bấm chốt 1-chạm (đúng lúc báo `BẤM NGAY!`)**
1. Bấm **📦 Mua SP Ngay** / **Copy Mã + Mở SP** (cho kèo Flash Sale / cặp SP + Voucher) hoặc **🛒 Giỏ hàng** để tự động có sẵn mã trong clipboard và mở đúng màn hình trong App Shopee.
2. Tự dán mã/xác nhận đặt hàng trên Shopee bằng tay.
3. Xong thì tick *Đánh dấu đã săn xong*.

## Lệnh phát triển

| Lệnh | Mô tả |
|---|---|
| `npm run dev` | Dev server trên máy tính |
| `npm run dev:lan` | Dev server mở cổng LAN cho điện thoại |
| `npm run typecheck` | Kiểm tra TypeScript |
| `npm test` | Chạy unit + integration tests (Vitest) |
| `npm run build` | Build production vào `dist/` |

Xem thêm: [`SPEC.md`](./SPEC.md), [`tasks/plan.md`](./tasks/plan.md), [`tasks/todo.md`](./tasks/todo.md).

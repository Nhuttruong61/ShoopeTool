# ShoopeeTool 11/11 — Trợ Lý Canh Nhịp Săn Mã

Web app di động (PWA) hỗ trợ **thao tác tay** khi săn voucher giới hạn lượt trên Shopee: chuẩn bị sẵn kịch bản, tính gộp/tách đơn, copy mã 1 chạm và **đồng hồ nổi chuẩn 0.1s** có âm báo đếm ngược.

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

## 4. Quy trình săn mã 11/11 — 3 bước

**Bước 1 — Chuẩn bị trước giờ G (vài phút đến vài giờ trước)**
1. Tab **Kịch bản săn**: chọn ca (00:00, 09:00, 12:00, 15:00, 18:00, 21:00) hoặc thêm ca mới ở tab **Thêm ca săn** (món cần tick, mã voucher, thanh toán).
2. Cần ghép nhiều mã? Dùng tab **Tối ưu tách đơn** để xem nên gộp hay tách đơn, còn thiếu bao nhiêu tiền để chạm mức tối thiểu, rồi đưa kết quả vào kịch bản. (Mỗi voucher chỉ dùng cho 1 đơn.)
3. Trong Shopee: tick sẵn món trong Giỏ, vào màn **Thanh toán**, chọn sẵn phương thức. Tick đủ checklist 3 bước trong app.

**Bước 2 — Canh nhịp (1–2 phút trước)**
1. Bấm **Chọn canh giờ** cho đúng ca, bấm **Đồng bộ lại** (xem lệch giờ/RTT).
2. Chỉnh **Báo sớm bù phản xạ tay** (mặc định 300ms, tối đa 2000ms) và **Tinh chỉnh lệch giờ** (±2000ms) nếu cần.
3. Bấm **Bật Đồng Hồ Nổi (PiP)** rồi chuyển sang Shopee; nếu thiết bị không hỗ trợ PiP thì dùng **Chế độ Toàn Màn Hình (HUD)**. Giữ **Âm Báo Nhịp** bật và tăng âm lượng.
4. Màu đồng hồ: `CHUẨN BỊ` (60s) → `SẴN SÀNG` (10s) → đếm ngược 3s (bíp) → `BẤM NGAY!`.

**Bước 3 — Bấm (đúng lúc báo `BẤM NGAY!`)**
1. Bấm **Copy Mã + Mở Shopee** (hoặc **Copy Mã**) để có sẵn mã trong clipboard.
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

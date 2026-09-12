# Vocab Blaster - bản web trả phí + VietQR + SePay

## Chạy local

```powershell
$env:ADMIN_KEY="mat-khau-admin"
$env:TOKEN_SECRET="token-secret-rat-dai"
$env:SEPAY_WEBHOOK_SECRET="secret-giong-tren-sepay"
node server.js
```

- Game: http://localhost:3000
- Admin: http://localhost:3000/admin.html

## Cấu hình ngân hàng / QR

Vào `/admin.html`, nhập:

- Giá, ví dụ `1000`
- Mã ngân hàng VietQR, ví dụ `VCB` hoặc BIN ngân hàng
- Tên ngân hàng
- Số tài khoản
- Chủ tài khoản
- Tiền tố nội dung chuyển khoản, nên để `VOCAB`
- Tắt `Cho chơi miễn phí`

Khi người chơi bấm tạo thanh toán, server tạo một nội dung riêng như `VOCABABC123...` và sinh VietQR chứa sẵn số tiền + nội dung.

## Tự xác nhận bằng SePay

Webhook endpoint:

```text
https://TEN-WEB-CUA-BAN.onrender.com/api/payment/sepay
```

Trên SePay:

1. Liên kết tài khoản ngân hàng nhận tiền.
2. Tạo webhook sự kiện Tiền vào.
3. Chọn HMAC-SHA256.
4. Tạo Secret Key.
5. Trên Render thêm environment variable:

```text
SEPAY_WEBHOOK_SECRET=<secret giống SePay>
```

Khi SePay báo giao dịch tiền vào có đúng số tiền và đúng nội dung `VOCAB...`, server đổi giao dịch sang `paid`; trình duyệt đang chờ sẽ tự nhận token và tự bắt đầu game.

## MoMo

Project này không giả lập API MoMo. Thanh toán trực tiếp qua MoMo cần tài khoản Merchant/API chính thức và thông tin merchant riêng. Bản hiện tại dùng VietQR ngân hàng + SePay; người dùng quét bằng ứng dụng ngân hàng hỗ trợ VietQR, ví dụ VCB Digibank.

## Deploy Render

Project có `render.yaml`. Sau khi push GitHub, Render deploy lại branch `main`. Cần đặt:

- `ADMIN_KEY`
- `TOKEN_SECRET`
- `SEPAY_WEBHOOK_SECRET`

Lưu ý: filesystem của web service có thể không phải nơi lưu cấu hình/giao dịch bền vững qua mọi lần redeploy. Nếu thu tiền thật ở quy mô lâu dài, nên chuyển config/payment records sang database hoặc persistent storage.

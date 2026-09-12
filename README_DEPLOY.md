# Vocab Blaster - Paid Web Version

Bản này có thêm **cổng quyền chơi**. Giá mặc định là **1.000đ** và chủ web có thể đổi.

## Chạy trên máy

Cần Node.js 18+.

```bash
node server.js
```

Mở:

- Game: http://localhost:3000
- Admin: http://localhost:3000/admin.html

### PowerShell

```powershell
$env:ADMIN_KEY="mat-khau-admin-cua-ban"
$env:TOKEN_SECRET="chuoi-bi-mat-rat-dai"
$env:WEBHOOK_SECRET="chuoi-bi-mat-webhook"
node server.js
```

## Admin

Vào `/admin.html`.

Bạn có thể:

- đổi giá từ 1.000đ thành giá khác;
- bật/tắt chơi miễn phí;
- đổi thời gian quyền chơi;
- nhập ngân hàng, số tài khoản, tên chủ tài khoản;
- xem giao dịch đang chờ;
- bấm **Duyệt** để xác nhận giao dịch.

Sau khi duyệt, trình duyệt người chơi đang chờ sẽ tự nhận quyền chơi.

## Thanh toán thật / tự động

Hiện project có sẵn endpoint:

```text
POST /api/payment/webhook
```

Nó dùng để kết nối webhook của cổng thanh toán hoặc hệ thống theo dõi chuyển khoản.

Payload chuẩn nội bộ:

```json
{
  "secret": "WEBHOOK_SECRET",
  "id": "PAYMENT_ID",
  "amount": 1000,
  "status": "paid"
}
```

Khi nối MoMo/VNPAY/SePay/ngân hàng thật, cần adapter chuyển dữ liệu webhook của nhà cung cấp thành payload trên.

**Không nên xác nhận thanh toán chỉ bằng JavaScript phía trình duyệt**, vì người dùng có thể sửa mã và tự mở khóa.

## Đưa lên Internet

Đây là Node web app. Có thể deploy lên dịch vụ chạy Node hoặc VPS.

Project có `render.yaml` để thuận tiện nếu dùng Render. Trước khi public phải đặt:

- `ADMIN_KEY`
- `TOKEN_SECRET`
- `WEBHOOK_SECRET`

và vào admin sửa thông tin tài khoản nhận tiền.

## Luồng sử dụng

1. Người chơi truy cập web.
2. Nạp bộ từ của họ.
3. Bấm bắt đầu.
4. Nếu chưa có quyền chơi, web hiện phí (mặc định 1.000đ).
5. Web tạo mã giao dịch và nội dung chuyển khoản riêng.
6. Chủ web duyệt giao dịch, hoặc payment webhook xác nhận tự động.
7. Trình duyệt nhận token chơi trong số phút do admin đặt.
8. Hết hạn thì cần mua quyền mới.

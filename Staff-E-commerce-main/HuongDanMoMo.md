
---

# Hướng dẫn cấu hình MoMo UAT + Ngrok cho dự án

Dưới đây là hướng dẫn chi tiết từng bước để giúp bạn tích hợp thanh toán **MoMo Sandbox (UAT)** với **Ngrok** nhằm test IPN callback.

---

##  1. Tải và dùng MoMo UAT (không dùng MoMo thật)

**Không dùng app MoMo thật**, để tránh lỗi và tránh rủi ro.
Hãy tải app **MoMo UAT (sandbox)** tại:

👉 [https://developers.momo.vn/v3/docs/app-integration/testing/momo-uat-app](https://developers.momo.vn/v3/docs/app-integration/testing/momo-uat-app)

* Đây là app sandbox dùng riêng cho môi trường test
* Không liên quan đến ví thật
* Không trừ tiền thật

Cài vào điện thoại và đăng ký như bình thường.

---

## ✅ 2. Tải & cài Ngrok đúng cách

**Không tải bản trên Microsoft Store.**
Hãy tải bản ZIP từ website chính chủ:

➡️ [https://ngrok.com/download](https://ngrok.com/download)

**Cách cài:**

1. Tải file ZIP
2. Giải nén
3. Quăng thư mục vào ổ `D:` hoặc bất kỳ đâu bạn muốn
4. Trong thư mục đó mở file `ngrok.exe`

---

## ✅ 3. Thêm Authtoken cho Ngrok

Trước tiên đăng ký tài khoản tại:

👉 [https://dashboard.ngrok.com/signup](https://dashboard.ngrok.com/signup)

Sau đó vào:

👉 [https://dashboard.ngrok.com/get-started/your-authtoken](https://dashboard.ngrok.com/get-started/your-authtoken)

Copy **authtoken**.

Trong cửa sổ `ngrok.exe` chạy:

```sh
ngrok config add-authtoken <authtoken-của-bạn>
```

---

## ✅ 4. Tạo public URL để MoMo gọi IPN

Chạy lệnh:

```sh
ngrok http 5099
```

Ngrok sẽ tạo một URL dạng:

```
https://xxxxxx.ngrok-free.dev
```

Hãy copy URL này để dùng cho NotifyUrl.

---

## ✅ 5. Sửa NotifyUrl trong frontend

Mở **useOrders.js**, tìm hàm **pay()**, sau đó sửa:

```js
NotifyUrl: "https://<your-ngrok-url>/api/payment/momo/ipn"
```

Ví dụ:

```js
NotifyUrl: "https://stainful-asher-unfeigningly.ngrok-free.dev/api/payment/momo/ipn"
```

---

## ✅ 6. Cấu hình MoMo UAT trong `appsettings.json`

Mở file:

```
appsettings.json
```

Tìm phần:

```json
"Momo": {
  "PartnerCode": "MOMO",
  "AccessKey": "F8BBA842ECF85",
  "SecretKey": "K951B6PE1waDMi640xX08PD3vg6EkVlz",
  "Endpoint": "https://test-payment.momo.vn/v2/gateway/api/create",
  "RedirectUrl": "",
  "IpnUrl": "https://<your-ngrok-url>/api/payment/momo/ipn"
}
```

Ví dụ hoàn chỉnh:

```json
"Momo": {
  "PartnerCode": "MOMO",
  "AccessKey": "F8BBA842ECF85",
  "SecretKey": "K951B6PE1waDMi640xX08PD3vg6EkVlz",
  "Endpoint": "https://test-payment.momo.vn/v2/gateway/api/create",
  "RedirectUrl": "",
  "IpnUrl": "https://stainful-asher-unfeigningly.ngrok-free.dev/api/payment/momo/ipn"
}
```


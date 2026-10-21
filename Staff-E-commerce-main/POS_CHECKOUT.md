# POS / tạo đơn

Hai màn hình bán tại quầy và tạo đơn trong lịch sử đơn hàng dùng chung `POST /api/orders/checkout`.

## Nghiệp vụ

- Frontend gửi mã sản phẩm, số lượng, khách hàng, khuyến mãi, điểm muốn dùng và phương thức thanh toán. Backend tự đọc giá, kiểm tra trạng thái sản phẩm/khách hàng, hạn/lượt khuyến mãi, mức giảm tối đa và số dư điểm. Giá hiển thị chỉ dùng đối chiếu; nếu thay đổi, API trả 409 để người bán kiểm tra lại.
- Tiền mặt: bắt buộc nhập đủ tiền khách đưa. Backend ghi nhận thanh toán, trừ kho, cập nhật điểm và tạo hóa đơn trong cùng transaction.
- Đơn mới chỉ hỗ trợ tiền mặt và MoMo. Lựa chọn quẹt thẻ đã được bỏ khỏi giao diện và API tạo đơn. Các đơn thẻ có từ trước vẫn giữ dữ liệu và có thể xử lý theo luồng cũ.
- MoMo: lưu đơn chờ, tạo liên kết trên chính đơn đó. Chỉ callback có chữ ký hợp lệ, đúng mã yêu cầu thanh toán đã lưu và đúng số tiền mới hoàn tất. Trang quay về từ MoMo chỉ hướng dẫn kiểm tra trạng thái.
- Đơn chờ giữ hàng và điểm đã sử dụng; chưa cộng điểm thưởng và chưa tạo hóa đơn. Hủy đơn chờ hoàn kho, điểm và lượt khuyến mãi một lần. Chưa có cơ chế tự hết hạn đơn chờ.
- Khóa transaction của SQL Server tuần tự hóa các thay đổi POS, kết hợp trừ tồn có điều kiện. Lỗi giữa chừng rollback cả đơn, kho, điểm, thanh toán và hóa đơn.
- `requestId` là UUID cho mỗi lần bán. Thử lại cùng giỏ giữ nguyên khóa để trả lại đơn đã tạo. Giỏ khác dùng cùng khóa bị từ chối; lần bán mới tạo khóa mới. Frontend giữ khóa trong phiên mở màn hình; khi tải lại trang sau lỗi mạng, cần kiểm tra lịch sử trước khi tạo lại.
- API thêm/xóa dòng hàng, thanh toán rời và hoàn thành đơn cũ không thể bỏ qua nghiệp vụ đối với đơn POS mới. Dữ liệu đơn cũ không được tự chuyển sang luồng mới.

## Chạy bản mới

Khởi động lại backend rồi tải lại frontend. Khi khởi động, initializer tự thêm `orders.checkout_key`, `checkout_hash`, `points_used`, `points_earned`, `cash_received` và index duy nhất cho khóa checkout.

MoMo sử dụng cấu hình `Momo` hiện có và `App:BaseUrl` của backend để tạo URL callback. Để nhận thông báo từ nhà cung cấp, URL này phải truy cập được từ bên ngoài; localhost chỉ dùng phát triển. Các lần thanh toán lỗi/chậm hoặc khách thanh toán sau khi đơn đã hủy cần đối soát với MoMo; bản này chưa có truy vấn trạng thái nhà cung cấp hay tự hoàn tiền. Kiểm thử tự động dùng callback ký bằng khóa thử, chưa xác minh giao dịch MoMo thực tế.

## Kiểm tra

Xem [hướng dẫn chạy kiểm thử](tests/AuthorizationRegression/README.md). Bộ kiểm thử tạo database riêng và tự xóa, bao gồm cả hủy/xác nhận thanh toán đồng thời. Frontend được kiểm tra bằng ESLint trên các file thay đổi và `npm run build`.

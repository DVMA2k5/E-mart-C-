# POS / tạo đơn

Tạo đơn tại quầy thực hiện ở POS qua `POST /api/orders/checkout`. Lịch sử đơn hàng dùng để xem, tìm kiếm và chuyển đúng đơn sang POS để xử lý; không tạo/hoàn tất/thanh toán/hủy trực tiếp tại Lịch sử.

## Nghiệp vụ

- Frontend gửi mã sản phẩm, số lượng, khách hàng, khuyến mãi, điểm muốn dùng và phương thức thanh toán. Backend tự đọc giá, kiểm tra trạng thái sản phẩm/khách hàng, hạn/lượt khuyến mãi, mức giảm tối đa và số dư điểm. Giá hiển thị chỉ dùng đối chiếu; nếu thay đổi, API trả 409 để người bán kiểm tra lại.
- Tiền mặt: bắt buộc nhập đủ tiền khách đưa. Backend ghi nhận thanh toán, trừ kho, cập nhật điểm và tạo hóa đơn trong cùng transaction.
- Đơn mới chỉ hỗ trợ tiền mặt và MoMo. Lựa chọn quẹt thẻ đã được bỏ khỏi giao diện và API tạo đơn. Các đơn thẻ có từ trước vẫn giữ dữ liệu và có thể xử lý theo luồng cũ.
- MoMo: lưu đơn chờ, tạo liên kết trên chính đơn đó. Chỉ callback có chữ ký hợp lệ, đúng mã yêu cầu thanh toán đã lưu và đúng số tiền mới hoàn tất. Trang quay về từ MoMo chỉ hướng dẫn kiểm tra trạng thái.
- Đơn chờ giữ hàng và điểm đã sử dụng; chưa cộng điểm thưởng và chưa tạo hóa đơn. Hủy đơn chờ hoàn kho, điểm và lượt khuyến mãi một lần. Chưa có cơ chế tự hết hạn đơn chờ.
- Khóa transaction của SQL Server tuần tự hóa các thay đổi POS, kết hợp trừ tồn có điều kiện. Lỗi giữa chừng rollback cả đơn, kho, điểm, thanh toán và hóa đơn.
- `requestId` là UUID cho mỗi lần bán. Trước khi gửi, frontend lưu đầy đủ yêu cầu vào sessionStorage, theo tài khoản và tab. Khi mất phản hồi hoặc reload, POS chặn tạo đơn khác và cho kiểm tra/gửi lại đúng yêu cầu đã lưu. Server tra khóa theo người tạo, trả lại đơn đã có hoặc tiếp tục xử lý cùng khóa; không tạo UUID mới cho lần thử lại. Lưu trữ phiên phải còn nguyên; đóng tab/xóa dữ liệu trình duyệt thì cần đối soát trong Lịch sử trước khi tạo lại.
- API thêm/xóa dòng hàng, thanh toán rời và hoàn thành đơn cũ không thể bỏ qua nghiệp vụ đối với đơn POS mới. Dữ liệu đơn cũ không được tự chuyển sang luồng mới.

## Mở lại đơn và cập nhật giỏ

- Nút “Thanh toán tại POS”/“Xử lý tại POS” ở Lịch sử mở `/pos?orderId=<id>`. POS nạp đúng mã đơn, không chép hàng sang giỏ để tạo đơn khác. Đơn app mở phần xử lý online với người nhận và các dòng hàng; đơn tại quầy mở phiếu và panel thanh toán.
- Đơn app: xác nhận nhận đơn chỉ chuyển sang processing. Đơn ví/chuyển khoản chưa được xác nhận trả tiền không thể hoàn tất giao hàng. COD cần người bán xác nhận đã giao và thu đủ tiền.
- Đơn POS cũ chờ thu tiền mặt: API `confirm-cash` yêu cầu `payments.write`, kiểm tra dòng hàng/tổng tiền và ghi thanh toán, điểm, hóa đơn trong transaction. Không trừ kho lần nữa: dữ liệu tồn đã giữ của luồng cũ được giữ nguyên. Vì không thể suy ra đơn cũ đã từng trừ kho đầy đủ hay chưa chỉ từ tổng tiền, các đơn nghi ngờ nhập dở cần đối soát tồn trước; API chặn đơn thiếu dòng hoặc lệch tổng. Không tự sửa dữ liệu cũ hàng loạt.
- “Cập nhật giá và tồn kho” tải lại giá/ưu đãi hiện tại, tồn và điểm khách cho giỏ chưa chốt. Giữ nguyên số lượng để người bán chủ động sửa nếu không đủ hàng; không âm thầm bỏ dòng. Chốt/hủy/thanh toán đơn tại quầy làm mới danh sách tồn.
- Trạng thái đơn và trạng thái thanh toán hiển thị riêng. `paid` không còn là lựa chọn trong bộ lọc trạng thái đơn.
- Quản lý hóa đơn chỉ liệt kê hóa đơn có đơn gốc `completed`, không lấy điều kiện `paid` thay cho hoàn tất giao hàng. Bộ đếm/phân trang áp dụng cùng bộ lọc. Các chứng từ chưa hoàn tất vẫn được giữ để tra cứu chi tiết và đối soát; không xóa dữ liệu cũ.

## Thông tin người nhận

Đơn online lưu riêng `orders.recipient_name`, `recipient_phone`, `shipping_address`; `note` chỉ chứa lời nhắn/ghi chú. Các trường giao hàng là thông tin tại thời điểm đặt đơn, không đọc lại địa chỉ/số điện thoại từ hồ sơ mỗi khi xem đơn. POS, Lịch sử, chi tiết hóa đơn và app khách hàng hiển thị phần người nhận riêng. Thông tin khách hàng trên hóa đơn vẫn là thông tin người mua; phần giao hàng hiển thị riêng để hỗ trợ nhận hộ.

Người nhận trên app có thể khác chủ tài khoản. Với khách đăng nhập, CustomerId và điểm lấy theo tài khoản đã xác thực, không theo số điện thoại người nhận. Khách chưa đăng nhập không được dùng điểm.

Khi khởi động, initializer thêm ba cột nếu chưa có và chạy chuyển dữ liệu `order-delivery-v1` một lần, trong transaction. Chỉ chuyển đơn app/WEB có đủ ba nhãn người nhận/số điện thoại/địa chỉ theo định dạng cũ và chưa có trường giao hàng riêng. Giữ địa chỉ nhiều dòng, ghi chú và lý do từ chối; nội dung không nhận diện được, đơn tại quầy và trường đã tách được giữ nguyên. Không thay đổi số tiền/trạng thái/ngày cập nhật đơn hoặc sửa lại snapshot tài chính của hóa đơn cũ.

## Chạy bản mới

Khởi động lại backend rồi tải lại frontend. Khi khởi động, initializer tự thêm `orders.checkout_key`, `checkout_hash`, `points_used`, `points_earned`, `cash_received` và index duy nhất cho khóa checkout.

MoMo sử dụng cấu hình `Momo` hiện có và `App:BaseUrl` của backend để tạo URL callback. Để nhận thông báo từ nhà cung cấp, URL này phải truy cập được từ bên ngoài; localhost chỉ dùng phát triển. Các lần thanh toán lỗi/chậm hoặc khách thanh toán sau khi đơn đã hủy cần đối soát với MoMo; bản này chưa có truy vấn trạng thái nhà cung cấp hay tự hoàn tiền. Kiểm thử tự động dùng callback ký bằng khóa thử, chưa xác minh giao dịch MoMo thực tế.

## Kiểm tra

Xem [hướng dẫn chạy kiểm thử](tests/AuthorizationRegression/README.md). Bộ kiểm thử tạo database riêng và tự xóa, bao gồm cả hủy/xác nhận thanh toán đồng thời. Frontend được kiểm tra bằng ESLint trên các file thay đổi và `npm run build`.

Kiểm thử khôi phục phiên và cập nhật giỏ: chạy `node --test tests/posWorkflow.test.js` trong `frontend`.

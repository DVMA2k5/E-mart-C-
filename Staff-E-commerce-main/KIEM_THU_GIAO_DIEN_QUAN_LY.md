# Kiểm thử giao diện quản lý nhiều dòng

## 1. Phạm vi và thiết kế

Đợt này triển khai hạng mục đầu tiên trong danh sách bổ sung: tăng mật độ hiển thị cho **hóa đơn, sản phẩm, khách hàng và đơn hàng**. Tiếp tục các hạng mục cache, báo cáo và xuất file sau khi người dùng xác nhận theo quy trình cuốn chiếu.

| Tầng | Phạm vi |
| --- | --- |
| DAO | Không cần thay đổi truy vấn cho hạng mục giao diện; API hiện hỗ trợ phân trang tối đa 100 dòng. |
| BUS | Tiếp tục sử dụng nghiệp vụ và kiểm tra phân trang hiện có. |
| GUI | Điều chỉnh bố cục, chiều cao dòng, số dòng mỗi trang và trạng thái hiển thị chi tiết. Không thêm SQL hoặc truy cập DAO từ giao diện. |

Các file GUI được tạo hoặc điều chỉnh:

- `frontend/src/components/ui/TableDisplayControls.jsx`: điều khiển số dòng và chế độ dòng gọn dùng chung.
- `frontend/src/index.css`: kiểu bảng gọn, tiêu đề cố định, vùng cuộn giới hạn theo chiều cao màn hình.
- `frontend/src/components/layout/AppLayout.jsx`, `Topbar.jsx`: giảm khoảng trống, tận dụng chiều rộng vùng nội dung.
- `frontend/src/pages/invoices/InvoicePage.jsx`: phân trang tùy chọn, ẩn/hiện chi tiết hóa đơn.
- `frontend/src/pages/products/ProductList.jsx`: bảng sản phẩm, ảnh thu nhỏ, ô tổng quan và phân trang gọn.
- `frontend/src/pages/customers/CustomerList.jsx`, `frontend/src/features/customers/customerSlice.js`: bảng khách hàng, số dòng và xử lý phản hồi cũ khi đổi số dòng.
- `frontend/src/pages/orders/OrdersPage.jsx`, `frontend/src/components/orders/OrderTable.jsx`, `frontend/src/hook/useOrders.js`: bảng và tham số phân trang đơn hàng.

## 2. Điều kiện kiểm thử

- Đăng nhập tài khoản có quyền xem bốn màn hình trên, khởi chạy backend và frontend theo README.
- Dùng màn hình máy tính ở mức zoom 100%; kiểm tra thêm kích thước 1366 × 768 và 1920 × 1080 nếu có thể.
- Để kiểm tra phân trang, cần tập dữ liệu có nhiều hơn 25 dòng; để kiểm tra 100 dòng/trang, cần ít nhất 100 bản ghi phù hợp bộ lọc. Nếu không đủ dữ liệu, bảng chỉ hiển thị số bản ghi thực tế.
- Ghi lại màn hình, điều kiện lọc và bước xảy ra lỗi nếu kết quả khác kỳ vọng.

## 3. Kịch bản kiểm thử thủ công

| Mã | Thao tác | Kết quả mong đợi |
| --- | --- | --- |
| UI-01 | Tải lại ứng dụng, lần lượt mở Hóa đơn, Sản phẩm, Khách hàng, Đơn hàng. | Mặc định chọn **25 dòng/trang**, bật **Dòng gọn**; hiển thị tối đa 25 bản ghi nếu đủ dữ liệu. |
| UI-02 | Bỏ chọn rồi bật lại **Dòng gọn** tại từng màn hình. | Khi bật, chiều cao dòng giảm; tên, tiền, trạng thái và nút thao tác vẫn đọc và sử dụng được. Ảnh sản phẩm thu nhỏ theo dòng. |
| UI-03 | Lần lượt chọn **10**, **25**, **50**, **100** dòng/trang. | Số bản ghi không vượt mức chọn; tổng số trang thay đổi tương ứng. Tổng số bản ghi phù hợp bộ lọc không đổi. |
| UI-04 | Chọn 10 dòng, sang trang 2; nhập từ khóa có kết quả và chọn bộ lọc có sẵn, sau đó đổi sang 50 dòng. | Về trang 1; từ khóa và các bộ lọc được giữ; dữ liệu vẫn thỏa các điều kiện đó. |
| UI-05 | Dùng các nút Trước/Sau; ở màn hình Hóa đơn và Sản phẩm kiểm tra thêm Đầu/Cuối. | Không vượt trang đầu/cuối; nút không hợp lệ bị vô hiệu hóa; dữ liệu đúng trang. |
| UI-06 | Nhập từ khóa không tồn tại, ví dụ `KHONG_CO_DU_LIEU_987654321`. | Hiện thông báo không có dữ liệu, không lỗi trang; nơi có khoảng bản ghi hiển thị **0–0**, không phải **1–0**. |
| UI-07 | Chọn 100 dòng và cuộn trong từng bảng. | Tiêu đề cột nằm ở đầu vùng cuộn; các dòng không đè lên tiêu đề; có thể đến dòng cuối và dùng phân trang. |
| UI-08 | Tại Hóa đơn, bấm **Ẩn chi tiết** rồi chọn một dòng hóa đơn. | Danh sách mở rộng khi ẩn; chọn dòng mở lại chi tiết đúng hóa đơn, dòng chọn được đánh dấu. |
| UI-09 | Chọn qua lại hai hóa đơn liên tiếp, sau đó bấm **Hiện chi tiết/Ẩn chi tiết**. | Chi tiết tương ứng lựa chọn mới nhất, không bị phản hồi chậm của lựa chọn cũ ghi đè. |
| UI-10 | Ở bảng đơn hàng, bấm mã đơn, bấm Xem; nếu có quyền, bấm Xử lý tại POS. | Mã đơn/Xem mở đúng chi tiết; thao tác POS chuyển đúng đơn; không mở chi tiết hai lần từ một click mã đơn. |
| UI-11 | Tại hóa đơn đã mở chi tiết, bấm **In / Xuất PDF** và xem bản xem trước. | Nội dung hóa đơn hiện được để in; thanh điều khiển danh sách không xuất hiện; vùng cuộn màn hình không cắt nội dung bản in. Đây là kiểm tra hồi quy in hóa đơn, chưa phải chức năng PDF báo cáo thống kê. |
| UI-12 | Thu hẹp cửa sổ, kiểm tra tên dài, địa chỉ dài và cuộn ngang nếu bảng rộng. | Điều khiển có thể xuống dòng; dữ liệu vẫn truy cập được; chi tiết hóa đơn chuyển xuống dưới danh sách khi màn hình không đủ rộng. |
| UI-13 | Khởi động lại backend, mở danh sách hóa đơn và danh sách đơn hàng. | Mã cũ và mới có dạng ngắn `INV-001`, `DH-001`; từ bản ghi 1000 trở đi tự tăng thêm chữ số để không trùng. |
| UI-14 | Kiểm tra một dòng hóa đơn đủ 8 cột: mã, ngày giờ, khách hàng, tổng thanh toán, phương thức, trạng thái hóa đơn, nhân viên tạo, thao tác. | Cả 8 cột có đúng dữ liệu; nút **Xem** mở đúng chi tiết và nút **In** mở bản xem trước đúng hóa đơn vừa chọn. |

- [ ] UI-01 đến UI-14 đã được người dùng chạy và xác nhận đạt.

## 4. Kiểm tra tự động đã thực hiện

- ESLint trên các file JavaScript/JSX thay đổi: đạt, không lỗi hoặc cảnh báo.
- Kiểm tra logic Redux khách hàng: mặc định 25 dòng; đổi số dòng về trang 1; giữ bộ lọc; bỏ qua phản hồi của kích thước trang cũ; nhận phản hồi mới; chấp nhận 10/25/50/100 và bỏ qua kích thước không hợp lệ.
- `npm run build`: đạt. Vite có cảnh báo bundle lớn hơn 500 kB và chú thích `PURE` trong thư viện SignalR; không có lỗi build.
- `git diff --check`: không phát hiện lỗi khoảng trắng trong diff.

**Giới hạn xác minh:** công cụ điều khiển trình duyệt chưa kết nối được trong phiên làm việc. Chưa đánh dấu các kịch bản thao tác và bố cục là đã chạy đạt.

## 5. Xác nhận trước đợt tiếp theo

Khi các bước trên đạt, phản hồi **“Đã test không lỗi, làm tiếp yêu cầu tiếp theo”** để chuyển sang tối đa hóa tái sử dụng cache. Nếu có lỗi, cung cấp mã test và kết quả thực tế để sửa trong đợt này.

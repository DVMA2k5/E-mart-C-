# Rà soát trang quản trị — 21/10/2026

## Phạm vi và cách đọc

Rà các tuyến giao diện admin, API, service, repository liên quan: đăng nhập/hồ sơ, nhân viên/tài khoản/role, POS, lịch sử đơn hàng, thanh toán, hóa đơn, sản phẩm/danh mục/đơn vị tính, tồn kho, nhà cung cấp/phiếu nhập, khuyến mãi, khách hàng, báo cáo/dashboard và nhật ký. Các API storefront được đưa vào khi chúng có thể làm thay đổi dữ liệu mà admin sử dụng.

Đây là rà soát mã nguồn và kiểm tra build/lint, không phải kiểm thử toàn bộ thao tác trên trình duyệt. Chưa đối chiếu dữ liệu, trigger và cấu hình thực tế của database đang chạy; tác động có điều kiện được ghi rõ. Không chỉnh sửa nghiệp vụ trong lượt rà soát này. Báo cáo cũ `AUDIT_REPORT.md` có một số nhận xét đã lỗi thời, không dùng làm kết luận cho bản này.

- **P0 — Khẩn cấp:** có thể sai tiền, sai kho hoặc dùng tài sản của khách không đúng chủ; xử lý trước khi vận hành thật.
- **P1 — Cao:** lỗi quyền, bảo mật hoặc tính toàn vẹn của nghiệp vụ; xử lý trong đợt sửa gần nhất.
- **P2 — Trung bình:** sai trải nghiệm, đối soát, trạng thái hoặc thiếu chức năng hỗ trợ vận hành.
- **P3 — Thấp:** cải thiện chất lượng mã và hiệu năng sau khi các luồng chính ổn định.

Các phát hiện bên dưới đều có căn cứ trong mã hiện tại. Những tình huống đồng thời là rủi ro suy ra từ thứ tự đọc/ghi và cần kiểm thử cạnh tranh để xác nhận biểu hiện cụ thể. Các dòng mã có thể dịch chuyển sau khi sửa.

## 1. Tài khoản, nhân viên, phân quyền và hồ sơ

| Mã | Ưu tiên | Cần sửa và tác động | Vị trí chính | Hướng xử lý |
|---|---|---|---|---|
| A01 | P1 | Quyền `users.write` cho phép tạo/đổi tài khoản thành admin. Người được giao quản lý tài khoản có thể tạo một tài khoản có quyền vượt quá quyền của mình. | `backend/Services/UserService.cs:67`, `:120`; `backend/Security/PermissionCatalog.cs` | Tách quyền gán vai trò/quản trị; hạn chế tạo, sửa tài khoản admin và tự nâng quyền ở backend. |
| A02 | P1 | Hub đơn hàng cho kết nối không đăng nhập, trong khi phát sự kiện tới `Clients.All`, gồm tên/số điện thoại người mua. Kiểm tra permission của API không bảo vệ kênh này. | `backend/Program.cs:203`; `backend/Hubs/OrderHub.cs`; `backend/Controllers/StorefrontController.cs:601` | Xác thực và phân quyền kết nối; nhóm người nhận theo quyền/chủ đơn. Xử lý cả kết nối đang mở khi khóa tài khoản hoặc thu hồi quyền. |
| A03 | P1 | Nút chức năng vẫn kiểm tra `isStaff` thay vì quyền được cấp. Nhân viên có `products.write` vẫn bị chặn sửa ở giao diện; role khác có thể thấy nút mà API không cho dùng. | `frontend/src/pages/products/ProductList.jsx:32`, `:225`; `pages/categories/CategoryList.jsx:51`; `pages/customers/CustomerList.jsx:43` | Dùng permission cho từng nút và thao tác. Có quyền thì dùng được, thiếu quyền thì ẩn/khóa nhất quán. |
| A04 | P2 | API đổi mật khẩu chỉ kiểm tra không để trống, chưa kiểm tra độ dài tối thiểu/tối đa như lúc tạo tài khoản. | `backend/Controllers/MeController.cs:93`; `backend/DTO/MeDTO.cs` | Dùng chung quy tắc kiểm tra mật khẩu tại backend; kiểm tra chuỗi quá ngắn/quá dài và xác nhận mật khẩu. |

Phần đã có nền tảng tốt: tài khoản liên kết hồ sơ, kiểm tra `session_version` mỗi request HTTP, chặn role/tài khoản/hồ sơ ngừng hoạt động, bảo vệ admin cuối cùng và chặn xóa tài khoản có lịch sử. Không cần làm lại các phần này; cần mở rộng kiểm thử khi sửa tiếp.

## 2. Nhật ký hệ thống

| Mã | Ưu tiên | Cần sửa và tác động | Vị trí chính | Hướng xử lý |
|---|---|---|---|---|
| B01 | P1 | Chỉ che tên trường `password`, `token`, `creditCard`. Request đổi mật khẩu dùng `CurrentPassword`, `NewPassword`, `ConfirmNewPassword`, nên các giá trị này có thể được ghi nguyên vào log. Không đọc nội dung log thực tế trong lượt rà soát này. | `backend/Middleware/RequestLoggingMiddleware.cs:221`; `backend/DTO/MeDTO.cs` | Loại trừ endpoint đăng nhập/đổi mật khẩu hoặc che JSON theo danh sách trường đầy đủ, có xử lý lồng nhau. Sau khi sửa, kiểm tra và xử lý log cũ nếu có dữ liệu nhạy cảm. |
| B02 | P1 | Nhật ký còn nhận `X-User-Id` và mặc định `userId = 2` khi không tìm được người dùng. Hoạt động vô danh có thể bị gán cho nhân viên khác; cũng ảnh hưởng điều kiện xóa tài khoản chưa hoạt động. | `backend/Middleware/RequestLoggingMiddleware.cs:79`, `:175` | Chỉ dùng danh tính đã xác thực; hoạt động hệ thống/vô danh phải có danh tính riêng hoặc `null`. |
| B03 | P2 | Ghi nhật ký trước `_next`, không ghi kết quả HTTP và bỏ qua PATCH. Khóa tài khoản dùng PATCH không được ghi ở đây; thao tác thất bại vẫn trông như một lần tạo/sửa/xóa. | `backend/Middleware/RequestLoggingMiddleware.cs:35`, `:109` | Ghi kết quả sau xử lý, gồm thành công/thất bại, status, mã thực thể thật và hành động nghiệp vụ; bổ sung PATCH. |

## 3. Bán hàng tại quầy và tạo đơn mới

| Mã | Ưu tiên | Cần sửa và tác động | Vị trí chính | Hướng xử lý |
|---|---|---|---|---|
| C01 | P0 | POS gửi đơn lồng sản phẩm tới `/orders`, nhưng đường lưu ở service/repository không trừ tồn kho. Nếu database thực tế không có trigger bổ sung, bán hàng tại quầy không giảm tồn. | `frontend/src/pages/pos/POS.jsx:324`; `backend/Services/OrderService.cs:113`; `backend/Repository/OrderRepository.cs:62` | Chốt đơn và cập nhật kho tại một nghiệp vụ backend; kiểm tra tồn tại thời điểm ghi. Kiểm thử bán hết hàng và hai quầy mua sản phẩm cuối cùng. |
| C02 | P0 | Giá, tổng tiền, giảm giá và trạng thái `completed`/`paid` của POS do trình duyệt gửi lên. Backend hiện chủ yếu kiểm tra số tiền không âm, chưa tự tính lại và chưa xác minh thu tiền cho từng phương thức. | `frontend/src/pages/pos/POS.jsx:334`; `backend/Services/OrderService.cs:113` | Backend đọc giá/quy tắc từ dữ liệu chuẩn, kiểm tra số lượng và tổng; chỉ đánh dấu trả tiền sau xác nhận thu tiền hợp lệ. |
| C03 | P1 | Luồng “Tạo đơn hàng mới” trong lịch sử đơn vẫn gọi riêng lưu đơn → sản phẩm → trừ kho → khuyến mãi → thanh toán. Lỗi giữa chừng để lại dữ liệu dở dang. Đơn tiền mặt có thể phát hành hóa đơn trước khi thêm dòng hàng; hóa đơn snapshot sau đó không tự thêm các dòng thiếu. | `frontend/src/hook/useOrders.js:568`; `backend/Services/OrderService.cs:150`; `backend/Services/InvoiceService.cs:14` | Hợp nhất hai luồng tạo đơn; ghi dữ liệu nội bộ bằng giao dịch, phát hành hóa đơn sau khi đủ dòng hàng. Thanh toán bên ngoài cần trạng thái chờ và cơ chế thử lại. |
| C04 | P1 | POS tính tiền giảm do điểm ở frontend và gửi trong `discount`/ghi chú, nhưng đường lưu này chỉ cộng điểm tích lũy, chưa trừ điểm đã dùng. | `frontend/src/pages/pos/POS.jsx:312`; `backend/Services/OrderService.cs:153` | Gửi số điểm yêu cầu; backend kiểm tra, trừ và ghi lịch sử điểm nguyên tử cùng chốt đơn. |
| C05 | P1 | Quét barcode dùng `quantity || 999`, biến tồn bằng 0 thành 999. Thêm cùng sản phẩm nhiều dòng cũng chưa kiểm tra tổng số lượng trong giỏ. | `frontend/src/components/orders/DetailOrderForm.jsx:37`, `:79` | Giữ đúng tồn 0, cộng dồn dòng cùng sản phẩm, chặn số lượng không hợp lệ; backend vẫn phải kiểm tra tồn. |

## 4. Thanh toán, xử lý đơn, hủy và hoàn tiền

| Mã | Ưu tiên | Cần sửa và tác động | Vị trí chính | Hướng xử lý |
|---|---|---|---|---|
| D01 | P0 | Tạo thanh toán MoMo nhận `Amount` từ request. Callback kiểm tra chữ ký nhưng chưa đối chiếu số tiền đã thanh toán với số phải thu của đơn trước khi đánh dấu `paid`. | `backend/Services/PaymentService.cs:45`, `:154` | Lấy số tiền từ đơn, đối chiếu số tiền và mã giao dịch trong callback; trả thiếu/thừa phải có trạng thái đối soát. |
| D02 | P1 | Một đơn có thể có nhiều payment khi thử lại, nhưng đọc payment bằng `FirstOrDefault(OrderId)`. Chưa gắn callback chắc chắn với từng lần thử; callback lặp tiếp tục cập nhật/ghi log. | `backend/Repository/PaymentRepository.cs:25`; `backend/Services/PaymentService.cs:157` | Lưu mã lần thử duy nhất; tìm theo mã giao dịch; callback xử lý một lần, không hồi sinh đơn đã hủy/hoàn tiền. |
| D03 | P1 | Hoàn tất đơn pending chỉ đổi trạng thái. Giao hàng thành công tự đặt `PaymentStatus = paid` cho mọi phương thức. Hai việc này chưa chứng minh đã thu đủ tiền. | `backend/Repository/OrderRepository.cs:219`; `backend/Services/OrderService.cs:394` | Quy định trạng thái và điều kiện riêng cho tiền mặt/COD/chuyển khoản/ví; tách xác nhận giao hàng khỏi xác nhận thu tiền khi cần. |
| D04 | P1 | “Hoàn tiền” hiện chủ yếu đổi cờ đơn/hóa đơn. Chưa thấy nghiệp vụ chuyển tiền thực tế, số tiền hoàn, chi tiết hàng trả, quyết định nhập lại kho và hoàn tác điểm. | `backend/Services/OrderService.cs:430` | Xây dựng hồ sơ đổi trả/hoàn tiền; chỉ xác nhận hoàn khi có chứng từ hoặc phản hồi thanh toán. |
| D05 | P1 | Hủy/từ chối đọc trạng thái trước giao dịch rồi hoàn kho; chưa có điều kiện cập nhật trạng thái nguyên tử/chống lặp. Hoàn thành giao hàng cũng đọc rồi cộng điểm. Các request cạnh tranh có nguy cơ ghi nhận lặp hoặc mất cập nhật. Ngoài ra, hủy ghi đè `UserId` trước khi biết có hủy được hay không. | `backend/Repository/OrderRepository.cs:168`; `backend/Services/OrderService.cs:224`, `:344`, `:394` | Khóa/kiểm tra phiên bản bản ghi; chuyển trạng thái có điều kiện; lưu người tạo/người xử lý riêng; kiểm thử hủy/giao/xác nhận đồng thời. |

## 5. Sản phẩm, danh mục, đơn vị tính và tồn kho

| Mã | Ưu tiên | Cần sửa và tác động | Vị trí chính | Hướng xử lý |
|---|---|---|---|---|
| E01 | P1 | Điều chỉnh kho ghi số mới trước, sau đó mới lưu lịch sử; không cùng một giao dịch. DTO/service chưa chặn số lượng âm và chưa bắt buộc lý do. Database có thể có ràng buộc nhưng chưa đối chiếu. | `backend/Services/InventoryService.cs:115`; `backend/DTO/InventoryDTO.cs` | Kiểm tra đầu vào, bắt buộc lý do; lưu tồn và lịch sử trong cùng giao dịch; chống ghi đè khi hai người kiểm kê. |
| E02 | P1 | Lịch sử kho chưa bao phủ hết nguồn biến động. Nhập hàng có ghi `InventoryAdjustments`; giảm tồn bán hàng/hủy hoàn kho chưa ghi tương ứng trong các luồng đã rà. | `backend/Services/InventoryService.cs:43`; `backend/Repository/OrderRepository.cs:168`; `backend/Services/OrderService.cs:344` | Mọi biến động có nguồn chứng từ, người thực hiện, số trước/sau và loại nhập/xuất/hoàn/kiểm kê. |
| E03 | P2 | “Xóa” sản phẩm và đơn vị tính thực chất đảo `IsActive`. Gửi lại yêu cầu xóa có thể bật lại bản ghi đã ngừng hoạt động. | `backend/Repository/ProductRepository.cs:79`; `backend/Repository/UnitRepository.cs:74` | Xóa mềm phải đặt cố định `false`; thao tác bật lại dùng API riêng. Đồng bộ nhãn giao diện với hành vi. |

## 6. Nhà cung cấp và phiếu nhập hàng

| Mã | Ưu tiên | Cần sửa và tác động | Vị trí chính | Hướng xử lý |
|---|---|---|---|---|
| F01 | P1 | Hoàn tất phiếu nhập có giao dịch Serializable, nhưng hủy phiếu không dùng cùng cơ chế. Một request hủy đã đọc pending có thể cạnh tranh với hoàn tất và ghi đè trạng thái. | `backend/Services/PurchaseOrderService.cs:67`, `:99` | Dùng cùng quy tắc khóa/chuyển trạng thái có điều kiện cho cả hủy và hoàn tất. Kỳ vọng: chỉ một thao tác thành công và kho khớp trạng thái phiếu. |
| F02 | P1 | Phiếu nhập cộng tồn nhưng không cập nhật `Product.Cost`, trong khi dashboard định giá tồn bằng `Quantity * Product.Cost`. Nhập lô giá mới có thể không phản ánh vào giá trị tồn. | `backend/Services/PurchaseOrderService.cs:79`; `backend/Repository/StatisticsRepository.cs:87` | Chốt chính sách giá vốn (ví dụ bình quân) và cập nhật có kiểm soát, hoặc ghi rõ báo cáo đang dùng giá vốn danh mục thay vì giá vốn thực nhập. |
| F03 | P2 | Form nhập chỉ tải 100 sản phẩm đầu rồi dùng dropdown cục bộ. Khi danh mục vượt 100 sản phẩm, một số sản phẩm không chọn được. | `frontend/src/pages/purchaseOrders/PurchaseOrderList.jsx:68` | Tìm sản phẩm qua API có phân trang hoặc ô tìm kiếm chọn sản phẩm. |

Phần nhà cung cấp đã có hành vi ngừng hoạt động cố định thay vì đảo trạng thái. Không ghi nhận thêm lỗi lớn từ các tuyến CRUD đã xem; vẫn cần kiểm thử ràng buộc dữ liệu liên kết trên DB thực tế.

## 7. Khuyến mãi

| Mã | Ưu tiên | Cần sửa và tác động | Vị trí chính | Hướng xử lý |
|---|---|---|---|---|
| G01 | P1 | Áp dụng theo ID chỉ tìm chương trình rồi tăng lượt/ghi redemption, không kiểm tra lại đầy đủ thời gian, trạng thái, mức tối thiểu và đơn đã áp mã hay chưa. Các lần ghi chưa là một thao tác nguyên tử. | `backend/Services/PromotionService.cs:317` | Xác thực và ghi nhận mã ngay trong nghiệp vụ chốt đơn; chặn vượt giới hạn và áp lặp, kể cả request đồng thời. |
| G02 | P1 | Form tạo đơn tính giảm một lần khi chọn mã, chưa tính lại khi giỏ đổi và chưa áp `maxDiscount` trong nhánh phần trăm; chưa có nút bỏ mã. | `frontend/src/components/orders/PromotionSection.jsx:24`; `components/orders/DetailOrderForm.jsx:70` | Tính lại theo tổng hiện tại, kiểm tra lại điều kiện và giới hạn; backend là nơi quyết định tiền cuối cùng. |

## 8. Khách hàng, tài khoản khách và điểm thưởng

| Mã | Ưu tiên | Cần sửa và tác động | Vị trí chính | Hướng xử lý |
|---|---|---|---|---|
| H01 | P0 | API đặt hàng công khai lấy khách theo số điện thoại rồi cho trừ điểm. Biết số điện thoại không chứng minh quyền sử dụng điểm. Đơn mua gửi cho người khác cũng bị gắn theo số người nhận. | `backend/Controllers/StorefrontController.cs:412`, `:450`, `:504` | Điểm và chủ đơn lấy từ danh tính đã xác thực; tách người mua/người nhận. Khách không đăng nhập không được dùng điểm có sẵn. |
| H02 | P1 | Đăng ký có thể nhận hồ sơ khách cũ chưa có tài khoản chỉ bằng số điện thoại, chưa xác minh quyền sở hữu số đó. | `backend/Controllers/StorefrontController.cs:87` | Xác minh trước khi liên kết hồ sơ, điểm và lịch sử đơn cũ. |
| H03 | P1 | Xóa hồ sơ khách là xóa vật lý, chưa có kiểm tra lịch sử tương tự xóa tài khoản. Quan hệ DB có thể làm mất liên kết hoặc từ chối xóa bằng lỗi ràng buộc. | `backend/Repository/CustomerRepository.cs:67`; `backend/Data/AppDbContext.cs` | Chỉ xóa hồ sơ chưa có nghiệp vụ; khách đã mua hàng dùng ngừng hoạt động, giữ lịch sử. |
| H04 | P2 | Sửa/import khách tại admin cập nhật hồ sơ nhưng chưa đồng bộ tên/email sang User như luồng storefront. Dữ liệu đăng nhập/hồ sơ có thể lệch, dù một số DTO đã ưu tiên đọc từ hồ sơ. | `backend/Services/CustomerService.cs:135`; `backend/Services/ImportService.cs:198`; `backend/Controllers/StorefrontController.cs:215` | Dùng chung nghiệp vụ cập nhật hồ sơ/tài khoản và chuẩn hóa điện thoại cho mọi đường tạo/sửa/import. |

## 9. Hóa đơn, báo cáo và dashboard

| Mã | Ưu tiên | Cần sửa và tác động | Vị trí chính | Hướng xử lý |
|---|---|---|---|---|
| I01 | P1 | Helper báo cáo và hàm xuất file có `fetch` không gửi bearer token; các hàm lấy chi tiết sản phẩm đơn/payment trong `useOrders` cũng bỏ qua request dùng chung. Với API yêu cầu đăng nhập, các lời gọi này có thể trả 401 dù admin đã đăng nhập. | `frontend/src/api/reportsApi.js:5`, `:40`, `:68`; `frontend/src/hook/useOrders.js:844`, `:868`, `:892`; `components/orders/PromotionSection.jsx:9` | Dùng API client thống nhất, hỗ trợ cả JSON và file; sửa URL tương đối của khuyến mãi. Kiểm thử tải báo cáo, xuất file và mở chi tiết đơn khi đã đăng nhập. |
| I02 | P1 | Dashboard đổi biên ngày Việt Nam sang UTC; nhiều truy vấn báo cáo dùng trực tiếp `.Date` và nhóm `CreatedAt.Date`. Cùng một ngày có thể cho số liệu khác nhau, nhất là quanh 00:00–07:00 Việt Nam. | `backend/Repository/StatisticsRepository.cs:23`; `backend/Repository/ReportsRepository.cs:28`, `:158`; `backend/Services/InvoiceService.cs:71` | Dùng một quy tắc múi giờ, biên ngày và tiêu chí doanh thu; tách ngày tạo đơn/ngày thanh toán theo mục đích báo cáo. |
| I03 | P2 | Trang hóa đơn cố định `paymentStatus: paid`, không có bộ lọc cho chờ thanh toán/hoàn tiền. Dashboard giữ lỗi trong Redux nhưng không hiển thị lỗi tương ứng tại trang. | `frontend/src/pages/invoices/InvoicePage.jsx`; `frontend/src/pages/dashboard/Dashboard.jsx`; `features/statistics/statisticsSlice.js` | Thêm lọc trạng thái hóa đơn/thanh toán; thông báo lỗi và thử lại; phân biệt không có dữ liệu với tải dữ liệu thất bại. |

## 10. Lịch sử đơn hàng, giao diện và chất lượng chung

| Mã | Ưu tiên | Cần sửa và tác động | Vị trí chính | Hướng xử lý |
|---|---|---|---|---|
| J01 | P2 | Bộ lọc đơn vẫn có `paid` như trạng thái đơn, trong khi backend phân biệt `Status` và `PaymentStatus`. Không có đơn có thể hiện trang 1/0 và nút Sau chưa vô hiệu đúng. | `frontend/src/pages/orders/OrdersPage.jsx`; `components/orders/OrderTable.jsx:126`; `backend/Services/OrderService.cs:202` | Tách hai bộ lọc/cột trạng thái, chuẩn hóa nhãn; xử lý tổng trang tối thiểu 1 hoặc ẩn phân trang khi rỗng. |
| J02 | P2 | Hủy đơn trong bảng gọi API ngay; đóng form tạo đơn bằng bấm ngoài có thể mất nội dung. Hiện chưa có xác nhận tương ứng ở hai điểm này. | `frontend/src/components/orders/OrderTable.jsx:98`; `frontend/src/hook/useOrders.js:121`; `components/orders/OrderForm.jsx` | Xác nhận hủy có lý do, khóa nút trong khi xử lý; cảnh báo khi đóng giỏ đang nhập dở. |
| J03 | P2 | Nhiều API/hub gắn cứng `http://localhost:5099`; một số nơi dùng client riêng. Khi triển khai lên máy chủ, `localhost` trỏ về máy người dùng và xử lý 401/lỗi không thống nhất. | `frontend/src/api/apiClient.js`; `api/customerApi.js`; `api/reportsApi.js`; `pages/pos/POS.jsx`; `hook/useOrders.js` | Cấu hình địa chỉ backend qua môi trường, dùng client chung; không cần thay URL thủ công ở nhiều file. |
| J04 | P3 | Toàn frontend còn 8 lỗi lint, 5 cảnh báo hook; bundle JS khoảng 1,18 MB trước gzip. Backend build có 23 cảnh báo. Các kiểm thử hiện thiên về tài khoản/phân quyền, chưa đủ để bảo đảm bán hàng/kho/hoàn tiền đúng. | Kết quả kiểm tra bên dưới; `tests/AuthorizationRegression` | Xử lý lint/nullability theo luồng rủi ro trước; thêm test nghiệp vụ và tải đồng thời; sau đó tách bundle theo route. |

## Các đề xuất vận hành cần chốt thêm, chưa kết luận là lỗi

- Có cần quản lý ca thu ngân, tiền đầu ca/cuối ca và chênh lệch tiền mặt? Phụ thuộc cách vận hành cửa hàng.
- Có cần theo dõi lô/hạn sử dụng, hàng hỏng, trả nhà cung cấp và nhập từng phần? Đặc biệt quan trọng nếu kinh doanh thực phẩm.
- Giá vốn theo lô, bình quân hay một giá danh mục? Chốt trước khi thêm báo cáo lợi nhuận.
- Hủy/hoàn hàng có hoàn lượt voucher và điểm đã dùng không? Cần quy tắc rõ để triển khai nhất quán.
- Hóa đơn đang là chứng từ nội bộ; nếu cần tích hợp hóa đơn điện tử, phải xác định yêu cầu riêng, không mặc định tính năng in PDF hiện tại đã đáp ứng.
- Khi mở URL trực tiếp mà thiếu quyền, nên có trang “Không có quyền truy cập”. Đây là cải thiện UX; API vẫn là lớp thực thi quyền.

## Thứ tự sửa đề xuất

1. **Tiền và kho:** C01–C04, D01, H01. Hợp nhất chốt đơn, xác thực số tiền, cập nhật kho/điểm và trạng thái thanh toán.
2. **Quyền và dữ liệu nhạy cảm:** A01–A03, B01–B02, H02. Sửa cả API và hub; sau đó đồng bộ các nút theo permission.
3. **Vòng đời chứng từ:** D02–D05, E01–E02, F01–F02, G01–G02, H03. Kiểm thử retry và hai thao tác đồng thời.
4. **Đối soát và vận hành:** I01–I03, B03, J01–J03, H04, F03, A04, E03, C05.
5. **Chất lượng và tốc độ:** J04; bổ sung các yêu cầu vận hành đã thống nhất.

Các mục có thể sửa song song về mặt kỹ thuật, nhưng chỉ nên bắt đầu thiết kế báo cáo lợi nhuận sau khi chính sách thu tiền, hoàn tiền, điểm và giá vốn đã thống nhất.

## Bộ kiểm thử cần có trước khi coi luồng bán hàng ổn định

1. Bán một sản phẩm: tồn giảm đúng một lần, có dòng đơn và chứng từ đúng.
2. Hai quầy mua đơn vị tồn cuối: chỉ một giao dịch được chốt.
3. Gửi lại cùng yêu cầu chốt đơn/callback: không tạo trùng đơn, thu tiền, trừ kho hoặc cộng điểm.
4. Thanh toán thiếu/sai số tiền: không chuyển thành paid.
5. Thanh toán thất bại rồi thử lại: tìm đúng lần thử và không trừ kho/điểm lần hai.
6. Hủy đối đầu với xác nhận/giao hàng; hủy phiếu nhập đối đầu hoàn tất: chỉ một nhánh thành công.
7. Hoàn một phần/toàn bộ: khớp tiền hoàn, kho thực nhận, điểm và báo cáo.
8. Bỏ permission: chặn API, nút tương ứng và dữ liệu realtime, kể cả phiên đang mở.
9. Request thất bại/403/PATCH: nhật ký ghi đúng người và kết quả, không có mật khẩu/token thô.
10. Đối soát một bộ đơn sát nửa đêm Việt Nam: dashboard, báo cáo và hóa đơn khớp theo cùng quy tắc ngày.

## Kiểm tra đã thực hiện trong lượt này

- Frontend: `npm.cmd run build` — thành công; 2.721 module, JS khoảng 1.182,71 kB (gzip 327,82 kB). Có cảnh báo chunk lớn và annotation từ SignalR.
- Backend: `dotnet build ... --no-restore` với output riêng — thành công, 0 lỗi và 23 cảnh báo. Không ghi đè bản backend đang chạy.
- ESLint toàn frontend: 99 file được phân tích; **8 lỗi `no-unused-vars`, 5 cảnh báo `react-hooks/exhaustive-deps`**. Lint chưa đạt.
- Chưa chạy lại toàn bộ regression test trong lượt rà soát này; các kết quả test ở các lượt trước không được coi là chứng minh cho tất cả các mục trên.
- Chưa thao tác thử toàn bộ trang trên trình duyệt và chưa đọc dữ liệu nhạy cảm trong file log.

**Kết luận:** ưu tiên hoàn thiện nghiệp vụ tiền/kho, quyền truy cập và nhật ký trước khi tiếp tục thêm nút hoặc chỉnh giao diện. Build thành công chứng minh mã biên dịch được, không chứng minh các nghiệp vụ đã đúng.

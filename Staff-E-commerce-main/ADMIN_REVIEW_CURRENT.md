# Rà soát admin — bản cập nhật sau khi sửa POS

Ngày rà soát: 21/10/2026. Báo cáo dựa trên mã nguồn hiện có trong workspace, gồm các thay đổi chưa commit.

## Cập nhật sau khi sửa nhóm POS / Lịch sử đơn hàng

Cập nhật tiếp về thông tin giao hàng: đã lưu riêng tên/số điện thoại người nhận/địa chỉ trên đơn, chuyển ghi chú cũ theo định dạng nhận diện được và cập nhật các màn xem. **E01 đã xử lý ở luồng tạo đơn:** khách đăng nhập dùng CustomerId/điểm theo tài khoản xác thực; khách chưa đăng nhập không được dùng điểm. Các mục còn lại về đối soát, cạnh tranh điểm, tra cứu đơn công khai vẫn giữ để sửa riêng. Bộ kiểm thử bổ sung 26 kiểm tra dữ liệu giao hàng/migration đã qua.

Các bảng phía dưới giữ phát hiện tại thời điểm rà soát. Sau đó đã xử lý:

- **C01:** Lịch sử chỉ xem/tra cứu, bỏ luồng tạo/hoàn tất/hủy/thanh toán tại đây; chuyển đúng mã đơn qua `/pos?orderId=...`. POS mở đơn app với thao tác nhận/hủy/giao, hoặc đơn tại quầy với panel thanh toán. Đơn tiền mặt cũ được thu trên đúng mã, không trừ kho lần nữa; thiếu dòng hàng/lệch tổng thì chặn đối soát.
- **C02:** Tách trạng thái đơn và thanh toán, bỏ `paid` khỏi bộ lọc trạng thái đơn; nhãn thanh toán đã dịch.
- **C03:** Có cập nhật giá/tồn/điểm cho giỏ chưa chốt, kiểm tra số lượng vượt tồn; làm mới danh sách sản phẩm sau chốt/hủy/thanh toán POS. Giá trị của đơn đã chốt giữ theo chứng từ.
- **C04:** Lưu nguyên yêu cầu chốt vào sessionStorage theo nhân viên/tab trước khi gửi, có tra kết quả bằng khóa theo đúng người tạo. Khi kết quả chưa rõ thì giữ khóa và chặn đơn mới; vẫn cần đối soát nếu đóng tab/xóa dữ liệu phiên.
- **Một phần D02:** Backend chặn hoàn tất giao hàng đơn không dùng tiền mặt khi chưa có trạng thái paid; POS yêu cầu xác nhận giao và thu đủ tiền COD. Các rủi ro còn lại của vòng đời đơn app và đối soát vẫn thuộc các mục D/E.

Kiểm tra đợt sửa: **75 kiểm tra tài khoản + 96 kiểm tra POS/API**, cùng **4 test frontend khôi phục phiên/cập nhật giỏ** đều qua; ESLint các file thay đổi và build frontend/backend thành công. Chưa kiểm thử MoMo thực tế hay toàn bộ thao tác trình duyệt. Xem `POS_CHECKOUT.md` để vận hành và hiểu giới hạn dữ liệu đơn cũ.

## Phạm vi và giới hạn

Đã rà tuyến giao diện và mã xử lý của: đăng nhập/hồ sơ, dashboard, POS, lịch sử đơn hàng, hóa đơn, sản phẩm, danh mục, đơn vị tính, tồn kho, nhà cung cấp, phiếu nhập, khuyến mãi, khách hàng, nhân viên, tài khoản, vai trò, nhật ký và báo cáo. Kiểm tra thêm API storefront khi nó thay đổi tiền, điểm, kho hoặc thông tin mà admin sử dụng.

Đây là rà soát mã nguồn, build, lint và bộ regression hiện có; chưa thao tác thử mọi màn hình trên trình duyệt, chưa kiểm tra mọi cấu hình/trigger của database vận hành, chưa giao dịch với MoMo thực tế. Các rủi ro cạnh tranh được suy ra từ thứ tự đọc/ghi trong mã; chưa có kiểm thử tái hiện cho mọi tình huống. Không sửa mã nghiệp vụ trong lượt này.

Các đường dẫn dưới đây tính từ thư mục `Staff-E-commerce-main`. Số dòng là vị trí lúc rà soát. Báo cáo này cập nhật kết luận của `ADMIN_REVIEW_2026-10-21.md`; không tiếp tục coi những lỗi POS đã sửa là lỗi còn tồn tại.

## Quy ước ưu tiên

| Mức | Ý nghĩa | Thời điểm xử lý |
|---|---|---|
| P0 — Khẩn cấp | Có đường dùng tài sản/điểm của khách sai chủ | Xử lý trước khi cho người dùng bên ngoài sử dụng |
| P1 — Cao | Có thể sai tiền/kho/quyền hoặc làm hỏng đối soát | Đợt sửa gần nhất, trước vận hành thật |
| P2 — Trung bình | Luồng thao tác, hiển thị và quản lý dữ liệu chưa nhất quán | Sau khi các luồng P0/P1 ổn định |
| P3 — Thấp | Chất lượng mã và hiệu năng | Dọn sau các lỗi nghiệp vụ |

## 1. Tài khoản, nhân viên và phân quyền

| Mã | Mức | Phát hiện và ảnh hưởng | Cần sửa | Căn cứ |
|---|---|---|---|---|
| A01 | P1 | **API nhật ký bỏ qua permission do sai tên controller.** Catalog khai báo `ActivityLogs`, trong khi tên lớp thực tế là `ActivityLogController`. `PermissionFilter` trả về ngay khi không tìm được mapping. Fallback chỉ yêu cầu đăng nhập, nên tài khoản hợp lệ không có `audit.read`, kể cả customer, không bị lớp permission này chặn đọc nhật ký. | Sửa mapping; thêm test HTTP đọc nhật ký bằng staff thiếu quyền và customer phải trả 403. Thêm kiểm tra bao phủ mapping cho toàn bộ API nội bộ, quy định rõ API nào được miễn kiểm tra. | `backend/Security/PermissionCatalog.cs:28`; `backend/Security/PermissionFilter.cs:18`; `backend/Controllers/ActivityLogsController.cs:9` |
| A02 | P1 | **Hub đơn hàng cho truy cập vô danh**, trong khi sự kiện mới được gửi tới `Clients.All`, có tên, số điện thoại và giá trị đơn. Bỏ quyền HTTP không ngăn được kênh này. | Xác thực kết nối; kiểm tra quyền đọc đơn; nhóm người nhận do server quản lý; xử lý thu hồi quyền đối với kết nối đang mở. | `backend/Program.cs:204`; `backend/Hubs/OrderHub.cs`; `backend/Controllers/StorefrontController.cs:601` |
| A03 | P1 | Có `users.write` là có thể yêu cầu tạo/đổi tài khoản sang admin; chưa thấy kiểm tra người thực hiện có được cấp vai trò có quyền cao hơn mình hay không. Bảo vệ admin cuối cùng không ngăn được nâng quyền kiểu này. | Tách quyền gán vai trò/quản trị hoặc chỉ cho admin quản lý tài khoản admin; kiểm tra tại backend. | `backend/Services/UserService.cs:67`, `:120`; `backend/Security/AccountMutationFilter.cs` |
| A04 | P2 | Nhiều nút vẫn dùng `isStaff`, không dùng permission. Staff được cấp quyền ghi vẫn bị giao diện chặn; người bị thu hồi quyền vẫn có thể thấy nút rồi nhận 403. Bảo vệ route chỉ kiểm tra token. | Kiểm tra quyền theo từng thao tác; có trang thiếu quyền; refresh danh sách quyền sau thay đổi. Không thay thế kiểm tra ở API bằng việc ẩn nút. | `frontend/src/pages/products/ProductList.jsx:32`; `pages/categories/CategoryList.jsx:51`; `pages/units/UnitList.jsx:16`; `pages/suppliers/SupplierList.jsx:15`; `pages/customers/CustomerList.jsx:43`; `components/auth/ProtectedRoute.jsx` |
| A05 | P2 | Đổi mật khẩu kiểm tra không để trống và xác nhận khớp, nhưng chưa có độ dài tối thiểu/tối đa tương ứng quy tắc tạo tài khoản. | Dùng chung validator mật khẩu ở backend; trả lỗi rõ tại form hồ sơ. | `backend/Controllers/MeController.cs:93`; `backend/DTO/MeDTO.cs`; `backend/Services/UserService.cs:209` |

Phần đã ổn hơn trước: kiểm tra `session_version`, tài khoản/role/hồ sơ hoạt động ở HTTP; khóa tài khoản khi nhân viên nghỉ; giữ admin cuối cùng; chỉ xóa tài khoản chưa có hoạt động. Bộ test hiện có kiểm tra nhiều trường hợp này, nhưng chưa bao phủ A01/A02/A03.

## 2. Nhật ký hệ thống

| Mã | Mức | Phát hiện và ảnh hưởng | Cần sửa | Căn cứ |
|---|---|---|---|---|
| B01 | P1 | **Có đường ghi mật khẩu vào log.** Bộ che chỉ nhận đúng tên `password`, `token`, `creditCard`; đổi mật khẩu dùng `CurrentPassword`, `NewPassword`, `ConfirmNewPassword`, nên các trường này không được che. Kết hợp với A01 làm tăng mức độ nghiêm trọng. Chưa đọc log thật để xác nhận đã lộ dữ liệu. | Loại trừ payload xác thực/đổi mật khẩu hoặc che trường JSON đầy đủ, có xử lý lồng nhau. Kiểm tra và xử lý các log cũ sau khi sửa. | `backend/Middleware/RequestLoggingMiddleware.cs:216`; `backend/DTO/MeDTO.cs` |
| B02 | P1 | Khi không có danh tính, logger nhận `X-User-Id` hoặc gán mặc định user 2. Request công khai có thể bị gán sai người; còn ảnh hưởng điều kiện xóa tài khoản chưa hoạt động. | Chỉ lấy người dùng từ xác thực; hoạt động vô danh/hệ thống dùng danh tính riêng hoặc null. | `backend/Middleware/RequestLoggingMiddleware.cs:79`, `:176` |
| B03 | P2 | Ghi log trước khi xử lý, chưa có kết quả HTTP; bỏ qua PATCH. Request thất bại cũng có thể mang tên CREATE/UPDATE và khóa tài khoản không được middleware này ghi nhận. | Ghi sau xử lý, có status/kết quả, loại hành động nghiệp vụ và mã thực thể; bổ sung PATCH. | `backend/Middleware/RequestLoggingMiddleware.cs:35`, `:109` |

## 3. POS và lịch sử đơn hàng

| Mã | Mức | Phát hiện và ảnh hưởng | Cần sửa | Căn cứ |
|---|---|---|---|---|
| C01 | P1 | **Nút “Tạo Đơn Hàng” vẫn còn trong chi tiết đơn pending cũ**, dù đã bỏ nút tạo mới ngoài danh sách. Nó gọi hoàn tất đơn và gặp “Chưa có xác nhận thu đủ tiền”. Lịch sử vẫn có panel thanh toán trực tiếp; POS chưa có cơ chế nhận mã đơn từ Lịch sử để mở đúng đơn. | Theo hướng đã đề xuất: Lịch sử chỉ xem/tra cứu; thay nút cũ bằng “Xử lý tại POS” hoặc “Thanh toán tại POS”; truyền mã đơn, nạp lại đơn hiện có. Phân biệt đơn app với đơn tại quầy, không tạo bản sao để thu tiền. | `frontend/src/components/orders/OrderForm.jsx:293`, `:322`; `frontend/src/hook/useOrders.js:116`; `frontend/src/pages/pos/POS.jsx`; `backend/Services/OrderService.cs:192` |
| C02 | P2 | “Trạng thái” ở phần thanh toán chưa ghi rõ tên; trạng thái đơn vẫn chứa lựa chọn `paid`, trùng với trạng thái thanh toán. Một số giá trị trạng thái còn hiển thị tiếng Anh. | Đổi thành “Trạng thái thanh toán”; bỏ `paid` khỏi lựa chọn trạng thái đơn nếu không có quy tắc dữ liệu cũ riêng; dịch nhãn thống nhất. | `frontend/src/components/orders/OrderForm.jsx:187`, `:279`; `frontend/src/pages/orders/OrdersPage.jsx`; `components/orders/OrderTable.jsx` |
| C03 | P2 | Tồn hiển thị trong POS là snapshot lúc tải danh sách; sau bán chưa tự tải lại. Giá trong giỏ cũng giữ snapshot: backend từ chối giá cũ đúng, nhưng giao diện chưa có cách rõ ràng cập nhật giỏ theo giá mới. | Refresh tồn sau chốt/hủy; có thao tác cập nhật giá và ưu đãi khi nhận 409, yêu cầu người bán kiểm tra lại tổng trước chốt. | `frontend/src/pages/pos/POS.jsx:234`, `:252`, `:335` |
| C04 | P1 | Khóa chống tạo trùng chỉ giữ bằng `useRef`. Nếu server đã tạo đơn nhưng phản hồi mất, tải lại trang làm mất khóa và có thể tạo lại cùng giao dịch bán với UUID mới. Chống trùng hiện tại có hiệu lực khi giữ nguyên màn hình và payload. | Lưu yêu cầu chưa rõ kết quả theo phiên thu ngân, khôi phục sau reload và tra kết quả bằng khóa trước khi tạo mới. Dọn khóa khi đã xác định kết quả. | `frontend/src/pages/pos/POS.jsx:136`; `frontend/src/api/posCheckoutApi.js:4`; `backend/Services/PosCheckoutService.cs:46` |

Các mục POS đã sửa, không yêu cầu làm lại: backend tự tính giá/giảm giá/điểm; kiểm tra tồn và trừ có điều kiện; transaction; khóa chống request lặp; tiền mặt phải đủ; MoMo cần callback hợp lệ; hủy POS hoàn kho/điểm/lượt khuyến mãi; có ghi chú; đơn mới chỉ tiền mặt/MoMo. Nút tạo mới và phiếu giảm giá đã bỏ khỏi giao diện Lịch sử theo yêu cầu.

## 4. Thanh toán, hủy, giao hàng và hoàn tiền

| Mã | Mức | Phát hiện và ảnh hưởng | Cần sửa | Căn cứ |
|---|---|---|---|---|
| D01 | P1 | Nhánh đơn app/cũ trong callback lưu payment, cập nhật order và hóa đơn bằng các lần lưu riêng. Kiểm tra callback lặp chưa được khóa cùng vòng đời hủy/giao; có nguy cơ dữ liệu dở dang hoặc callback đua với hủy. Nhánh POS mới đã có transaction/khóa riêng. | Đưa vòng đời đơn app vào nghiệp vụ nguyên tử, chuyển trạng thái có điều kiện; kiểm thử callback lặp và hủy/callback đồng thời. | `backend/Services/PaymentService.cs:167–194`; `backend/Services/OrderService.cs:300`; `backend/Repository/OrderRepository.cs:170` |
| D02 | P1 | “Giao hàng thành công” tự đặt `paid` cho mọi phương thức và cộng điểm, chưa phân biệt COD với MoMo/chuyển khoản; endpoint này dùng quyền ghi đơn. Có thể biến đơn ví chưa trả tiền thành đã trả. | COD phải có xác nhận thu tiền rõ; ví phải có giao dịch hợp lệ. Giao hàng và thu tiền cần điều kiện/quyền tương ứng. | `backend/Services/OrderService.cs:349`; `backend/Security/PermissionCatalog.cs` |
| D03 | P1 | POS có thể hủy sau khi đã tạo liên kết MoMo. Callback thành công đến sau bị từ chối do đơn đã hủy; chưa có hồ sơ đối soát/hoàn tiền cho tiền thực tế đã thu. Tạo liên kết nhiều lần cũng tạo nhiều lần thử có thể cùng còn mở ở nhà cung cấp. | Quy định hủy khi đang thanh toán; tái sử dụng lần thử còn hiệu lực; có truy vấn trạng thái/đối soát và ghi nhận tiền đến muộn hoặc trả dư, không chỉ bỏ callback. | `backend/Services/PaymentService.cs:53`, `:164`; `backend/Services/PosCheckoutService.cs:166`, `:178`; `frontend/src/components/orders/PosPaymentPanel.jsx` |
| D04 | P1 | “Hoàn tiền” chỉ đổi trạng thái đơn/hóa đơn. Chưa có chứng từ hoàn tiền, tiền thực hoàn, hàng trả, hoàn điểm và chính sách nhập lại kho. | Tạo nghiệp vụ hoàn trả với số tiền, dòng hàng, phương thức, người duyệt và bằng chứng; chỉ ghi hoàn thành khi đã xác nhận hoàn tiền. | `backend/Services/OrderService.cs:384`; `backend/Controllers/OrdersController.cs:274` |
| D05 | P2 | Đọc payment bằng dòng đầu tiên theo OrderId, có thể là lần thất bại/chờ cũ. Callback có kết quả khác 0 được trả thành công nhưng chưa cập nhật trạng thái lần thử, nên giao diện có thể tiếp tục thấy pending. | Lấy trạng thái thanh toán chuẩn từ order và hiển thị lịch sử các lần thử; xử lý kết quả nhà cung cấp theo đúng từng loại, phân biệt chờ và thất bại. | `backend/Repository/PaymentRepository.cs:29`, `:72`; `backend/Services/PaymentService.cs:164–201` |

API thanh toán offline rời hiện đã chặn đơn checkout POS mới; với đơn cũ vẫn nhận entity Payment và chưa đối chiếu đủ nghiệp vụ. Cần hạn chế/sửa endpoint này khi hợp nhất D01/D02, tránh dùng nó làm đường tắt để bỏ kiểm tra thu tiền.

## 5. Đơn app và quản lý khách hàng

| Mã | Mức | Phát hiện và ảnh hưởng | Cần sửa | Căn cứ |
|---|---|---|---|---|
| E01 | P0 | **API đặt hàng công khai tìm khách bằng số điện thoại rồi trừ điểm theo `PointsUsed`, không xác minh chủ tài khoản.** Biết số điện thoại của khách khác có thể yêu cầu sử dụng điểm của họ. | Chỉ dùng điểm cho khách đăng nhập và CustomerId lấy từ tài khoản đã xác thực; khách vãng lai không được dùng điểm. Số điện thoại người nhận không phải bằng chứng sở hữu điểm. | `backend/Controllers/StorefrontController.cs:411`, `:450`, `:504` |
| E02 | P1 | Đơn app trừ điểm/lượt ưu đãi khi tạo, nhưng chưa lưu `PointsUsed` vào order như POS mới. Hủy/từ chối chỉ hoàn kho, chưa hoàn điểm/lượt ưu đãi. Đọc trạng thái trước transaction có nguy cơ hoàn kho/cộng điểm lặp khi request cạnh tranh; hủy còn đổi UserId trước khi biết có thành công. | Lưu đầy đủ thành phần giảm giá; hoàn tác một lần trong transaction; kiểm tra phiên bản/trạng thái; tách người tạo, người xử lý, người hủy. | `backend/Controllers/StorefrontController.cs:504–545`; `backend/Services/OrderService.cs:170`, `:300`, `:349`; `backend/Repository/OrderRepository.cs:170` |
| E03 | P1 | Xem trạng thái và tạo lại liên kết MoMo của đơn app là API vô danh dùng ID số, chưa có kiểm tra chủ đơn/token tra cứu riêng. | Xác thực chủ đơn hoặc token tra cứu khó đoán, giới hạn dữ liệu trả về và giới hạn tạo lại yêu cầu thanh toán. | `backend/Controllers/StorefrontController.cs:642`, `:667` |
| E04 | P1 | Xóa khách gọi xóa bản ghi trực tiếp. Model cấu hình SetNull cho liên kết order/user; tùy schema thật, có thể làm mất liên kết lịch sử mua/điểm/tài khoản hoặc bị database từ chối. Chưa có kiểm tra trước khi xóa như tài khoản. | Chỉ xóa hồ sơ chưa được sử dụng; hồ sơ có tài khoản/đơn/điểm/lịch sử thì ngừng hoạt động, trả lỗi nghiệp vụ rõ ràng. | `backend/Services/CustomerService.cs:196`; `backend/Repository/CustomerRepository.cs:73`; `backend/Data/AppDbContext.cs:76`, phần Order.Customer |
| E05 | P2 | Sửa khách hàng và import khách cập nhật Customer, chưa đồng bộ tên/email sang tài khoản liên kết; sửa hồ sơ cá nhân lại có chiều đồng bộ ngược. | Chọn Customer làm nguồn dữ liệu và dùng chung dịch vụ cập nhật cho admin/import/hồ sơ; kiểm thử email trùng và tài khoản liên kết. | `backend/Services/CustomerService.cs:120`; `backend/Services/ImportService.cs:225`; `backend/Services/UserService.cs:174` |

## 6. Sản phẩm, danh mục, đơn vị tính và tồn kho

| Mã | Mức | Phát hiện và ảnh hưởng | Cần sửa | Căn cứ |
|---|---|---|---|---|
| F01 | P1 | Điều chỉnh kho đọc tồn, lưu số mới, rồi lưu lịch sử lần thứ hai, không cùng transaction. Lỗi lần ghi sau có thể thiếu lịch sử; điều chỉnh cạnh tranh với bán/nhập có thể ghi đè tồn vừa thay đổi. Controller đã chặn số âm, không kết luận đây là lỗi âm kho đầu vào. | Transaction cho tồn và lịch sử; kiểm tra phiên bản tồn hoặc dùng thay đổi có điều kiện; bắt buộc lý do khi kiểm kê/chỉnh tồn. | `backend/Services/InventoryService.cs:115–140`; `backend/Controllers/InventoryController.cs:44` |
| F02 | P2 | Nhật ký biến động chưa bao phủ hết: POS mới/phiếu nhập có ghi, nhưng xuất bán trên app, hủy app và API giảm kho rời chưa ghi tương ứng. | Mọi biến động phải có nguồn chứng từ, người xử lý, lượng thay đổi và số trước/sau; hạn chế endpoint giảm kho không gắn chứng từ. | `backend/Services/InventoryService.cs:43`; `backend/Controllers/StorefrontController.cs:547`; `backend/Services/OrderService.cs:323` |
| F03 | P2 | DELETE sản phẩm/đơn vị tính đang đảo IsActive. Gửi lại cùng yêu cầu xóa có thể bật lại dữ liệu đã ngừng hoạt động. | Xóa mềm đặt cố định false; khôi phục dùng hành động riêng, tên nút thống nhất với ý nghĩa. | `backend/Repository/ProductRepository.cs:85`; `backend/Repository/UnitRepository.cs:82` |
| F04 | P1 | Upload ảnh trong modal dùng fetch không có bearer, nên có thể nhận 401 và chặn lưu sản phẩm khi chọn ảnh từ máy. Ở component cha còn một nhánh upload lần nữa sau tạo sản phẩm, cũng không có bearer và không kiểm tra `res.ok`. | Dùng API client hỗ trợ FormData; chỉ upload một lần rồi lưu URL với sản phẩm; thông báo rõ lỗi upload. | `frontend/src/components/products/ProductModal.jsx:210`, `:249`; `frontend/src/pages/products/ProductList.jsx:280–300`; `backend/Controllers/ProductsController.cs:171` |

Danh mục/đơn vị tính/nhà cung cấp còn chịu vấn đề nút dựa vào role ở A04. Chưa thấy căn cứ cần thay toàn bộ các màn này; ưu tiên quyền và hành vi xóa/khôi phục trước chỉnh bố cục.

## 7. Nhà cung cấp và phiếu nhập

| Mã | Mức | Phát hiện và ảnh hưởng | Cần sửa | Căn cứ |
|---|---|---|---|---|
| G01 | P1 | Hoàn tất phiếu dùng Serializable, nhưng hủy đọc phiếu rồi lưu không có khóa/điều kiện trạng thái tương đương. Hủy đọc pending trước khi bên hoàn tất commit có thể lưu cancelled sau khi tồn đã tăng. | Chuyển trạng thái có điều kiện hoặc cùng cơ chế khóa; kiểm thử hủy đối đầu hoàn tất và hoàn tất lặp. | `backend/Services/PurchaseOrderService.cs:67`, `:99` |
| G02 | P2 | Phiếu lưu ImportPrice, nhưng hoàn tất chỉ cộng tồn, chưa cập nhật giá vốn. Báo cáo giá trị tồn lại lấy Product.Cost và có chỗ thay bằng giá bán khi Cost null. | Chốt cách tính giá vốn; cập nhật nguyên tử khi nhập hoặc lưu lớp giá vốn riêng. Không dùng giá bán làm giá vốn mà không ghi rõ. | `backend/Services/PurchaseOrderService.cs:67–96`; `backend/Repository/ReportsRepository.cs:63`, `:172`; `backend/Repository/StatisticsRepository.cs` |

Giới hạn hiện tại cần chốt theo yêu cầu cửa hàng: nhập toàn bộ một lần, chưa có nhận từng phần/trả nhà cung cấp/lô-hạn sử dụng. Đây là nhu cầu mở rộng, không tự coi là lỗi nếu đề tài chưa yêu cầu.

## 8. Khuyến mãi và điểm thưởng

| Mã | Mức | Phát hiện và ảnh hưởng | Cần sửa | Căn cứ |
|---|---|---|---|---|
| H01 | P1 | Sửa khuyến mãi nhận `UsedCount` từ frontend rồi `SetValues` vào entity. Form mở trước khi có đơn mới có thể ghi đè số lượt đã dùng; request thủ công cũng có thể đặt lại bộ đếm. | Dùng DTO cập nhật chỉ có trường được phép sửa; UsedCount/redemption do nghiệp vụ server quản lý, không nhận từ form. | `backend/Controllers/PromotionsController.cs:184`; `backend/Repository/PromotionRepository.cs:187` |
| H02 | P1 | Khóa POS chỉ tuần tự hóa POS. App kiểm tra và tăng lượt riêng, chưa có phép giữ lượt dùng chung có điều kiện; ưu đãi sản phẩm trên app chỉ được đọc để tính giá, chưa ghi lượt dùng như POS. Endpoint apply riêng còn cho tăng lượt/thêm redemption mà không kiểm tra hết điều kiện hoặc chống áp dụng lặp. | Một dịch vụ giữ/ghi nhận/hoàn lượt dùng cho mọi kênh, áp dụng có điều kiện ở database; khóa duy nhất theo đơn/khuyến mãi; giới hạn hoặc bỏ API apply rời. | `backend/Services/PosCheckoutService.cs:120`; `backend/Controllers/StorefrontController.cs:437`, `:544`; `backend/Services/PromotionService.cs:317` |
| H03 | P2 | Cách tính giảm giá và kiểm tra ngày còn khác nhau: POS làm tròn xuống phần trăm; storefront/PromotionService còn tính số lẻ. MoMo từ chối tiền lẻ, nên một số cấu hình giá/khuyến mãi có thể tạo đơn nhưng không tạo được link. Chưa có trường kênh áp dụng. | Dùng chung quy tắc làm tròn/ngày hiệu lực và cộng dồn; thống nhất giá trị nguyên đồng nếu dùng MoMo. Kênh Tất cả/App/Tại quầy là bổ sung khi cần chương trình riêng. | `backend/Services/PosCheckoutService.cs:25`; `backend/Controllers/StorefrontController.cs:386`; `backend/Services/PromotionService.cs:294`; `backend/Services/PaymentService.cs:61` |

Thêm phiếu giảm giá vào POS vẫn là đề xuất chưa thực hiện, không ghi thành chức năng đã có trên giao diện. Cần chốt việc cộng dồn với giảm giá sản phẩm/điểm trước khi thêm.

## 9. Hóa đơn, báo cáo và dashboard

| Mã | Mức | Phát hiện và ảnh hưởng | Cần sửa | Căn cứ |
|---|---|---|---|---|
| I01 | P1 | Helper báo cáo và xuất CSV/XLSX dùng fetch không có token. API yêu cầu đăng nhập/quyền nên người đã đăng nhập trên UI vẫn có thể nhận 401. | Dùng client thống nhất cho cả JSON/blob; kiểm tra tải dữ liệu và tải file với phiên hợp lệ/thiếu quyền. | `frontend/src/api/reportsApi.js:5`, `:40`, `:68`; `backend/Security/PermissionCatalog.cs` |
| I02 | P2 | Điều kiện tạo hóa đơn là processing/completed hoặc paid. Đơn app vừa được cửa hàng xác nhận có thể có hóa đơn trước trả tiền/giao xong; điều này chưa chắc sai, nhưng phụ thuộc nghĩa “đặt hàng thành công” trong yêu cầu của cô. | Chốt một mốc nghiệp vụ rồi dùng cùng điều kiện ở backend và nút xem hóa đơn. Không tự coi thanh toán, nhận đơn và giao hàng là cùng một sự kiện. | `backend/Services/InvoiceService.cs:20`, `:59`; `backend/Services/OrderService.cs:285`; `frontend/src/components/orders/OrderForm.jsx:60` |
| I03 | P2 | Trang hóa đơn cố định `paymentStatus: paid`. Hóa đơn issued chưa thu tiền và hóa đơn refunded bị ẩn khỏi danh sách mặc định, gây khó tìm/đối soát. | Có bộ lọc trạng thái hóa đơn và thanh toán, tùy chọn tất cả; phân biệt issued/paid/voided/refunded bằng nhãn tiếng Việt. | `frontend/src/pages/invoices/InvoicePage.jsx:34`; `backend/Services/InvoiceService.cs:73` |
| I04 | P1 | Dashboard quy đổi ngày Việt Nam sang UTC, báo cáo và lọc hóa đơn dùng biên ngày trực tiếp; nhóm báo cáo theo CreatedAt.Date. Cùng ngày có thể lệch số liệu quanh nửa đêm. Doanh thu cũng lấy theo ngày tạo đơn, chưa tách ngày thanh toán/hoàn tất/hoàn tiền. | Một bộ helper biên ngày Việt Nam; chốt định nghĩa doanh thu và ngày ghi nhận; dùng dữ liệu thanh toán/hoàn tiền khi báo cáo dòng tiền. | `backend/Repository/StatisticsRepository.cs:19`; `backend/Repository/ReportsRepository.cs:28`, `:158`; `backend/Services/InvoiceService.cs:76` |

## 10. Trải nghiệm và chất lượng chung

| Mã | Mức | Phát hiện và ảnh hưởng | Cần sửa | Căn cứ |
|---|---|---|---|---|
| J01 | P2 | Trang nhật ký gọi fetch không token cho cả logs và danh sách user, lỗi chủ yếu vào console. Dashboard giữ error trong Redux nhưng trang không hiển thị. Thiếu `reports.read` có thể trông như không có dữ liệu khi vào dashboard. | Client thống nhất; hiển thị lỗi/thiếu quyền và nút thử lại; phân biệt dữ liệu rỗng với tải thất bại. Nhật ký nên có API lấy người dùng phù hợp với quyền audit thay vì buộc cấp users.read. | `frontend/src/hook/useAudit.js:19`, `:36`, `:52`; `pages/dashboard/Dashboard.jsx`; `features/statistics/statisticsSlice.js` |
| J02 | P2 | API/hub gắn cứng localhost ở nhiều nơi; khi triển khai máy khác sẽ gọi sai máy. CORS chấp nhận mọi origin và credentials, chưa giới hạn theo môi trường. Đây không tự đồng nghĩa đã vượt được bearer, nhưng cấu hình vận hành quá rộng. | Đưa URL vào biến môi trường và dùng chung client; khai báo origin admin/app theo môi trường; kiểm tra callback MoMo bằng URL backend truy cập được từ ngoài. | `frontend/src/api/apiClient.js`; `api/reportsApi.js`; `pages/pos/POS.jsx:183`; `backend/Program.cs:154` |
| J03 | P3 | Lint còn lỗi; bundle JS lớn; backend có cảnh báo nullable. Regression hiện thiên về tài khoản/POS, chưa bao phủ hoàn tiền, nhập/hủy cạnh tranh, quyền audit và đối soát ngày. | Sửa lint, rồi bổ sung test theo rủi ro; xử lý nullability trước đường thu tiền/ghi chứng từ; tách bundle theo route sau. | Kết quả kiểm tra bên dưới |
| J04 | P2 | Import có transaction rollback toàn bộ khi gặp lỗi hệ thống, nhưng bộ đếm Created/Updated đã tăng trong vòng lặp vẫn được trả lại. Có thể báo đã nhập thành công một phần dù transaction thực tế rollback. | Kết quả có trạng thái commit/rollback; reset bộ đếm ghi thành công khi rollback; hiển thị rõ dòng bỏ qua do validation khác với lỗi hủy toàn bộ. | `backend/Services/ImportService.cs:84–145`, `:198–254` |

## Thứ tự sửa đề xuất

1. **Bảo vệ điểm và dữ liệu nhạy cảm:** E01, A01, B01, A02. Đây là ưu tiên trước việc thêm trường/nút giao diện.
2. **Hoàn thiện vòng đời tiền/kho:** D01–D04, E02, F01, G01, H01–H02. Tập trung transaction, chuyển trạng thái có điều kiện, chống thao tác lặp và đối soát.
3. **Làm thống nhất nơi xử lý đơn:** C01 trước; Lịch sử chuyển đúng đơn sang POS, không tạo lại đơn. Sau đó C02–C04, I02–I03.
4. **Sửa chức năng đang dễ lỗi:** I01, F04, J01; tiếp theo A03–A05, B02–B03, E03–E05, F02–F03.
5. **Chuẩn hóa quản trị và báo cáo:** I04, G02, H03, D05, J02/J04; cuối cùng J03.

Thứ tự 3 có thể sửa sớm để hết vướng thao tác hiện tại, nhưng không thay thế việc xử lý các mục bảo mật và tiền/kho ở bước 1–2.

## Kiểm tra đã thực hiện

- Frontend `npm.cmd run build`: thành công; 2.722 module; JS khoảng 1.178,08 kB, gzip 325,99 kB. Có cảnh báo chunk lớn và annotation SignalR.
- ESLint toàn frontend: **7 lỗi unused-vars, 2 cảnh báo hook**, chưa đạt. Lỗi tại `api/statisticsApi.js`, `components/products/ProductModal.jsx`, `hook/useProducts.js`, `pages/customers/CustomerList.jsx`, `pages/inventory/InventoryHistory.jsx`, `pages/profile/ProfilePage.jsx` (2 lỗi). Cảnh báo tại `hook/useAudit.js` và `pages/reports/ReportsPage.jsx`.
- Build backend và test harness với output riêng `.tmp/auth-regression`: thành công, **0 lỗi, 21 cảnh báo**; không ghi đè output backend đang chạy.
- Regression trên database SQL Server tạm, tự xóa: **75 kiểm tra phân quyền/tài khoản + 66 kiểm tra POS/thanh toán/tồn kho đều qua**. Không sửa dữ liệu vận hành.
- Các test đó không chứng minh toàn bộ admin đúng. Chưa có test cho nhiều mục trong báo cáo, đặc biệt A01, E01, hoàn tiền và hủy/hoàn tất phiếu nhập cạnh tranh.

## Những yêu cầu cần thống nhất trước khi mở rộng

- “Đơn đặt hàng thành công” là lúc cửa hàng nhận đơn, thanh toán thành công hay giao hoàn tất?
- Chính sách hủy/hoàn hàng: hoàn bao nhiêu tiền, điểm, lượt ưu đãi; hàng nào nhập lại kho?
- Ưu đãi áp dụng chung hai kênh hay riêng; có cộng dồn điểm/voucher/giảm sản phẩm không?
- Có cần ca thu ngân và đối soát tiền mặt; quản lý lô/hạn dùng, nhập từng phần, trả nhà cung cấp không?
- Giá vốn theo bình quân/lô/giá danh mục? Chốt trước khi bổ sung lợi nhuận.

Đây là các lựa chọn nghiệp vụ cần chốt theo phạm vi đề tài, không mặc định là lỗi vì chưa có chức năng.

import { ShieldAlert } from "lucide-react";
import { useAuth } from "../../hook/useAuth";

// Hides a page from accounts without the permission instead of rendering its buttons and an empty table.
// The API still enforces the permission; this only keeps the screen consistent with the sidebar.
export default function RequirePermission({ permission, children }) {
  const { permissions, permissionsLoaded } = useAuth();

  if (!permissionsLoaded) {
    return <div className="p-8 text-gray-500">Đang kiểm tra quyền truy cập...</div>;
  }

  if (!permissions.includes(permission)) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 p-12 text-center">
        <ShieldAlert className="h-10 w-10 text-red-500" />
        <h2 className="text-xl font-semibold text-gray-800">Bạn không có quyền truy cập trang này</h2>
        <p className="text-gray-500">Cần quyền <code>{permission}</code>. Liên hệ quản trị viên nếu bạn cần sử dụng chức năng này.</p>
      </div>
    );
  }

  return children;
}

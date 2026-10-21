const sections = [
  { title: "Bán hàng", resources: [["orders", "Đơn hàng"], ["payments", "Thanh toán"], ["invoices", "Hóa đơn"], ["customers", "Khách hàng"], ["promotions", "Khuyến mãi"]] },
  { title: "Sản phẩm và kho", resources: [["products", "Sản phẩm"], ["categories", "Danh mục"], ["units", "Đơn vị tính"], ["inventory", "Tồn kho"]] },
  { title: "Nhập hàng", resources: [["suppliers", "Nhà cung cấp"], ["purchaseorders", "Phiếu nhập hàng"]] },
  { title: "Quản trị và báo cáo", resources: [["employees", "Nhân viên"], ["users", "Tài khoản"], ["roles", "Vai trò và phân quyền"], ["reports", "Báo cáo, thống kê"], ["audit", "Nhật ký hệ thống"]] },
];

const requiredAdminPermissions = ["users.read", "users.write", "roles.read", "roles.write"];

export default function PermissionGroups({ permissions, selectedIds, onChange, isAdmin, disabled }) {
  const locked = (permission) => isAdmin && requiredAdminPermissions.includes(permission.code);
  const changePermissions = (items, checked) => {
    const ids = new Set(selectedIds);
    items.forEach((permission) => {
      if (locked(permission)) return;
      if (checked) ids.add(permission.id);
      else ids.delete(permission.id);
    });
    onChange([...ids]);
  };
  const knownCodes = new Set(sections.flatMap((section) => section.resources.flatMap(([resource]) => [`${resource}.read`, `${resource}.write`])));
  const extraPermissions = permissions.filter((permission) => !knownCodes.has(permission.code));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-gray-50 p-3">
        <span className="text-sm text-gray-600">Đã chọn {permissions.filter((p) => selectedIds.includes(p.id)).length}/{permissions.length} quyền</span>
        <div className="flex gap-3 text-sm font-medium">
          <button type="button" disabled={disabled} onClick={() => changePermissions(permissions, true)} className="text-primary-700 disabled:opacity-50">Chọn tất cả</button>
          <button type="button" disabled={disabled} onClick={() => changePermissions(permissions, false)} className="text-gray-600 disabled:opacity-50">Bỏ chọn tất cả</button>
        </div>
      </div>
      {sections.map((section) => {
        const rows = section.resources.map(([resource, label]) => ({
          resource, label, read: permissions.find((p) => p.code === `${resource}.read`), write: permissions.find((p) => p.code === `${resource}.write`),
        })).filter((row) => row.read || row.write);
        const items = rows.flatMap((row) => [row.read, row.write].filter(Boolean));
        if (!items.length) return null;
        return (
          <section key={section.title} className="overflow-hidden rounded-lg border border-gray-200">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-gray-50 px-4 py-3">
              <h3 className="font-semibold text-gray-800">{section.title}</h3>
              <div className="flex gap-3 text-xs font-medium">
                <button type="button" disabled={disabled} onClick={() => changePermissions(items, true)} className="text-primary-700 disabled:opacity-50">Chọn cả mục</button>
                <button type="button" disabled={disabled} onClick={() => changePermissions(items, false)} className="text-gray-600 disabled:opacity-50">Bỏ chọn</button>
              </div>
            </div>
            <table className="w-full table-fixed text-sm">
              <colgroup>
                <col className="w-1/2" />
                <col className="w-1/4" />
                <col className="w-1/4" />
              </colgroup>
              <thead><tr className="border-b text-gray-500"><th scope="col" className="px-4 py-2 text-left font-medium">Chức năng</th><th scope="col" className="px-2 py-2 font-medium">Xem</th><th scope="col" className="px-2 py-2 font-medium">Thao tác</th></tr></thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map((row) => (
                  <tr key={row.resource}>
                    <th scope="row" className="px-4 py-3 text-left font-medium text-gray-700">{row.label}</th>
                    {[row.read, row.write].map((permission, index) => {
                      const required = permission && locked(permission);
                      return (
                        <td key={index} className="px-2 py-3 text-center" title={required ? "Quyền bắt buộc của quản trị viên, không thể thay đổi" : undefined}>
                          {permission ? (
                            <div className="inline-flex flex-col items-center gap-1">
                              <input type="checkbox" className={`h-4 w-4 ${required ? "cursor-not-allowed accent-gray-400 opacity-50" : "accent-primary-600"}`} aria-label={`${row.label}: ${index === 0 ? "Xem" : "Thao tác"}${required ? " (bắt buộc)" : ""}`} checked={selectedIds.includes(permission.id)} disabled={disabled || required} onChange={(e) => changePermissions([permission], e.target.checked)} />
                            </div>
                          ) : <span className="text-gray-300" aria-label="Không áp dụng">—</span>}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        );
      })}
      {extraPermissions.length > 0 && (
        <section className="rounded-lg border p-4">
          <h3 className="mb-3 font-semibold">Quyền khác</h3>
          <div className="grid gap-3 sm:grid-cols-2">{extraPermissions.map((permission) => (
            <label key={permission.id} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={selectedIds.includes(permission.id)} disabled={disabled || locked(permission)} onChange={(e) => changePermissions([permission], e.target.checked)} />{permission.name}</label>
          ))}</div>
        </section>
      )}
    </div>
  );
}

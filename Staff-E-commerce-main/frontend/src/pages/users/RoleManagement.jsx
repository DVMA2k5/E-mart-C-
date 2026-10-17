import { useEffect, useState } from "react";
import { getPermissions, getRoles, updateRole } from "../../api/apiClient";

export default function RoleManagement() {
  const [roles, setRoles] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [permissionIds, setPermissionIds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    Promise.all([getRoles(), getPermissions()])
      .then(([roleData, permissionData]) => {
        setRoles(roleData ?? []);
        setPermissions(permissionData ?? []);
        if (roleData?.length) selectRole(roleData[0]);
      })
      .catch((error) => setMessage(error.message || "Không thể tải dữ liệu phân quyền."))
      .finally(() => setLoading(false));
  }, []);

  function selectRole(role) {
    setSelectedId(role.id);
    setPermissionIds(role.permissionIds ?? []);
  }

  function togglePermission(id) {
    setPermissionIds((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id]
    );
  }

  async function save() {
    const role = roles.find((item) => item.id === selectedId);
    if (!role) return;
    setSaving(true);
    setMessage("");
    try {
      const updated = await updateRole(role.id, {
        name: role.name,
        description: role.description ?? "",
        isActive: role.isActive,
        permissionIds,
      });
      setRoles((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      setMessage("Đã cập nhật quyền cho vai trò.");
    } catch (error) {
      setMessage(error.message || "Cập nhật phân quyền thất bại.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="text-gray-500">Đang tải phân quyền...</p>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-800">Phân quyền role</h1>
        <p className="text-sm text-gray-500">
          Cấu hình quyền truy cập cho các role admin, nhân viên và khách hàng.
        </p>
      </div>
      {message && <div className="rounded-md bg-indigo-50 px-4 py-2 text-sm text-indigo-700">{message}</div>}
      <div className="grid gap-6 md:grid-cols-3">
        <div className="rounded-lg border bg-white p-4">
          <h2 className="mb-3 font-semibold">Vai trò</h2>
          <div className="space-y-2">
            {roles.map((role) => (
              <button
                key={role.id}
                onClick={() => selectRole(role)}
                className={`w-full rounded-md px-3 py-2 text-left ${
                  role.id === selectedId ? "bg-indigo-50 text-indigo-700" : "hover:bg-gray-50"
                }`}
              >
                <div className="font-medium">{role.name}</div>
                <div className="text-xs text-gray-500">{role.description || "Chưa có mô tả"}</div>
              </button>
            ))}
          </div>
        </div>
        <div className="rounded-lg border bg-white p-4 md:col-span-2">
          <h2 className="mb-3 font-semibold">Quyền được cấp</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {permissions.map((permission) => (
              <label key={permission.id} className="flex gap-2 rounded border p-3">
                <input
                  type="checkbox"
                  checked={permissionIds.includes(permission.id)}
                  onChange={() => togglePermission(permission.id)}
                />
                <span>
                  <span className="block font-medium">{permission.name}</span>
                  <span className="text-xs text-gray-500">{permission.code}</span>
                </span>
              </label>
            ))}
          </div>
          <button
            className="mt-5 rounded-md bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700 disabled:opacity-50"
            disabled={!selectedId || saving}
            onClick={save}
          >
            {saving ? "Đang lưu..." : "Lưu phân quyền"}
          </button>
        </div>
      </div>
    </div>
  );
}

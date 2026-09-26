import React, { useEffect, useState } from "react";

const UnitModal = ({
  title = null,
  unit = null,
  mode = "view", // 'view' | 'edit' | 'create'
  onSave,
  onCancel,
  onDelete,
  saving = false,
}) => {
  const [formData, setFormData] = useState({
    code: "",
    name: "",
    isActive: true,
  });
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (mode === "create") {
      setFormData({
        code: "",
        name: "",
        isActive: true,
      });
    } else if (unit) {
      setFormData({
        code: unit.code || "",
        name: unit.name || "",
        isActive: unit.isActive !== undefined ? unit.isActive : true,
      });
    }
  }, [mode, unit]);

  const modalTitle =
    title ||
    {
      create: "Thêm đơn vị mới",
      edit: "Sửa đơn vị",
      view: "Chi tiết đơn vị",
    }[mode];

  // Validate
  const validate = () => {
    const newErrors = {};

    if (!formData.code?.trim()) {
      newErrors.code = "Mã đơn vị không được để trống";
    } else if (!/^[a-zA-Z0-9_-]+$/.test(formData.code)) {
      newErrors.code = "Mã chỉ chứa chữ, số, gạch dưới hoặc gạch ngang";
    }

    if (!formData.name?.trim()) {
      newErrors.name = "Tên đơn vị không được để trống";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleFieldChange = (field, value) => {
    if (mode === "view") return;
    setFormData((prev) => ({ ...prev, [field]: value }));

    // Clear error when user starts typing
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: null }));
    }
  };

  const handleSave = async () => {
    if (mode === "view") return;
    if (!validate()) return;

    const saveData = {
      ...formData,
      code: formData.code.trim(),
      name: formData.name.trim(),
      ...(mode === "edit" && unit?.id && { id: unit.id }),
    };

    onSave?.(saveData, mode);
  };

  const isView = mode === "view";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-lg w-full max-w-md shadow-2xl">
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b">
          <h3 className="text-lg font-semibold text-gray-800">{modalTitle}</h3>
          <div className="flex items-center gap-2">
            {onDelete && mode !== "create" && (
              <button
                className="text-red-600 text-sm hover:text-red-800 px-3 py-1 rounded hover:bg-red-50"
                onClick={onDelete}
              >
                Xóa
              </button>
            )}
            <button
              className="text-gray-500 hover:text-gray-700 p-1"
              onClick={onCancel}
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          {/* Mã đơn vị */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Mã đơn vị <span className="text-red-500">*</span>
            </label>
            {isView ? (
              <div className="p-3 border rounded-md bg-gray-50 text-gray-700">
                {formData.code || "—"}
              </div>
            ) : (
              <>
                <input
                  type="text"
                  value={formData.code}
                  onChange={(e) => handleFieldChange("code", e.target.value)}
                  className={`w-full border px-3 py-2 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition ${
                    errors.code ? "border-red-500" : "border-gray-300"
                  }`}
                  placeholder="VD: pc, kg, m"
                  maxLength={20}
                />
                {errors.code && (
                  <p className="text-xs text-red-500 mt-1">{errors.code}</p>
                )}
              </>
            )}
          </div>

          {/* Tên đơn vị */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tên đơn vị <span className="text-red-500">*</span>
            </label>
            {isView ? (
              <div className="p-3 border rounded-md bg-gray-50 text-gray-700">
                {formData.name || "—"}
              </div>
            ) : (
              <>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleFieldChange("name", e.target.value)}
                  className={`w-full border px-3 py-2 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition ${
                    errors.name ? "border-red-500" : "border-gray-300"
                  }`}
                  placeholder="VD: Cái, Kilogram, Mét"
                  maxLength={100}
                />
                {errors.name && (
                  <p className="text-xs text-red-500 mt-1">{errors.name}</p>
                )}
              </>
            )}
          </div>

          {/* Trạng thái */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Trạng thái
            </label>
            {isView ? (
              <div className="flex items-center gap-2">
                <div
                  className={`w-3 h-3 rounded-full ${
                    formData.isActive ? "bg-green-500" : "bg-gray-400"
                  }`}
                ></div>
                <span className="text-sm text-gray-700">
                  {formData.isActive ? "Đang sử dụng" : "Ngừng sử dụng"}
                </span>
              </div>
            ) : (
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.isActive}
                  onChange={(e) =>
                    handleFieldChange("isActive", e.target.checked)
                  }
                  className="w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
                />
                <span className="text-sm text-gray-700">Đang sử dụng</span>
              </label>
            )}
          </div>

          {/* Thông tin bổ sung (nếu mode view) */}
          {isView && unit && (
            <>
              <div className="pt-4 border-t">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">Số sản phẩm:</span>
                    <span className="ml-2 font-semibold text-indigo-600">
                      {unit.productCount || 0}
                    </span>
                  </div>
                  {unit.createdAt && (
                    <div>
                      <span className="text-gray-600">Ngày tạo:</span>
                      <span className="ml-2 text-gray-700">
                        {new Date(unit.createdAt).toLocaleDateString("vi-VN")}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t bg-gray-50 flex items-center justify-end gap-2">
          <button
            className="px-4 py-2 rounded-md border border-gray-300 hover:bg-gray-100 transition"
            onClick={onCancel}
          >
            {isView ? "Đóng" : "Hủy"}
          </button>
          {!isView && (
            <button
              className="px-4 py-2 rounded-md bg-indigo-600 text-white hover:bg-indigo-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? (
                <>
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                      fill="none"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  Đang lưu...
                </>
              ) : mode === "create" ? (
                "Thêm mới"
              ) : (
                "Cập nhật"
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default UnitModal;

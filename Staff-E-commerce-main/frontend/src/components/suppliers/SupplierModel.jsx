import React, { useEffect, useState } from "react";

const SupplierModal = ({
  title = null,
  supplier = null,
  mode = "view",
  onSave,
  onCancel,
  onDelete,
  saving = false,
}) => {
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    email: "",
    address: "",
    isActive: true,
  });
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});

  useEffect(() => {
    if (mode === "create") {
      setFormData({
        name: "",
        phone: "",
        email: "",
        address: "",
        isActive: true,
      });
    } else if (supplier) {
      setFormData({
        name: supplier.name || "",
        phone: supplier.phone || "",
        email: supplier.email || "",
        address: supplier.address || "",
        isActive: supplier.isActive ?? true,
      });
    }
    setErrors({});
    setTouched({});
  }, [mode, supplier]);

  const modalTitle =
    title ||
    {
      create: "Thêm nhà cung cấp mới",
      edit: "Sửa thông tin nhà cung cấp",
      view: "Chi tiết nhà cung cấp",
    }[mode];

  const isView = mode === "view";

  // Validate từng field
  const validateField = (field, value) => {
    switch (field) {
      case "name":
        if (!value?.trim()) {
          return "Tên nhà cung cấp là bắt buộc";
        }
        if (value.trim().length < 2) {
          return "Tên phải có ít nhất 2 ký tự";
        }
        if (value.trim().length > 200) {
          return "Tên không được quá 200 ký tự";
        }
        return null;

      case "phone":
        if (value && value.trim()) {
          // Remove spaces and dashes
          const cleanPhone = value.replace(/[\s-]/g, "");
          if (!/^0[0-9]{9,10}$/.test(cleanPhone)) {
            return "SĐT phải bắt đầu bằng 0 và có 10-11 chữ số";
          }
        }
        return null;

      case "email":
        if (value && value.trim()) {
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())) {
            return "Email không hợp lệ";
          }
          if (value.length > 100) {
            return "Email không được quá 100 ký tự";
          }
        }
        return null;

      case "address":
        if (value && value.length > 500) {
          return "Địa chỉ không được quá 500 ký tự";
        }
        return null;

      default:
        return null;
    }
  };

  // Validate toàn bộ form
  const validate = () => {
    const newErrors = {};
    Object.keys(formData).forEach((field) => {
      const error = validateField(field, formData[field]);
      if (error) {
        newErrors[field] = error;
      }
    });
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleFieldChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));

    // Real-time validation khi đã touch
    if (touched[field]) {
      const error = validateField(field, value);
      setErrors((prev) => ({ ...prev, [field]: error }));
    }
  };

  const handleBlur = (field) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
    const error = validateField(field, formData[field]);
    setErrors((prev) => ({ ...prev, [field]: error }));
  };

  const handleSave = () => {
    // Mark all fields as touched
    const allTouched = {};
    Object.keys(formData).forEach((key) => {
      allTouched[key] = true;
    });
    setTouched(allTouched);

    if (!validate()) {
      // Scroll to first error
      const firstErrorField = Object.keys(errors)[0];
      document.getElementById(`field-${firstErrorField}`)?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
      return;
    }

    // Clean data trước khi gửi
    const cleanData = {
      ...formData,
      name: formData.name.trim(),
      phone: formData.phone?.replace(/[\s-]/g, "") || null,
      email: formData.email?.trim() || null,
      address: formData.address?.trim() || null,
    };

    onSave(cleanData);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl animate-slideUp">
        {/* Header - Sticky */}
        <div className="sticky top-0 bg-white z-10 flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-bold text-gray-800">{modalTitle}</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              {isView
                ? "Xem thông tin chi tiết"
                : mode === "create"
                ? "Điền thông tin nhà cung cấp mới"
                : "Cập nhật thông tin nhà cung cấp"}
            </p>
          </div>
          <button
            onClick={onCancel}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
            title="Đóng"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form Body */}
        <div className="px-6 py-4 space-y-4">
          {/* Tên nhà cung cấp */}
          <div id="field-name">
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Tên nhà cung cấp <span className="text-red-500">*</span>
            </label>
            {isView ? (
              <div className="px-3 py-2.5 border border-gray-200 rounded-lg bg-gray-50 text-gray-800">
                {formData.name || "—"}
              </div>
            ) : (
              <>
                <input
                  type="text"
                  className={`w-full border px-3 py-2.5 rounded-lg transition-all ${
                    errors.name && touched.name
                      ? "border-red-500 bg-red-50 focus:ring-red-500 focus:border-red-500"
                      : "border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  }`}
                  placeholder="VD: Công ty TNHH ABC"
                  value={formData.name}
                  onChange={(e) => handleFieldChange("name", e.target.value)}
                  onBlur={() => handleBlur("name")}
                  maxLength={200}
                />
                {errors.name && touched.name && (
                  <p className="text-xs text-red-600 mt-1.5 flex items-center gap-1">
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                    >
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
                    </svg>
                    {errors.name}
                  </p>
                )}
                <p className="text-xs text-gray-500 mt-1">
                  {formData.name.length}/200 ký tự
                </p>
              </>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Số điện thoại */}
            <div id="field-phone">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Số điện thoại
              </label>
              {isView ? (
                <div className="px-3 py-2.5 border border-gray-200 rounded-lg bg-gray-50 text-gray-800">
                  {formData.phone || "—"}
                </div>
              ) : (
                <>
                  <input
                    type="tel"
                    className={`w-full border px-3 py-2.5 rounded-lg transition-all ${
                      errors.phone && touched.phone
                        ? "border-red-500 bg-red-50 focus:ring-red-500 focus:border-red-500"
                        : "border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    }`}
                    placeholder="0123456789"
                    value={formData.phone}
                    onChange={(e) => handleFieldChange("phone", e.target.value)}
                    onBlur={() => handleBlur("phone")}
                    maxLength={15}
                  />
                  {errors.phone && touched.phone && (
                    <p className="text-xs text-red-600 mt-1.5 flex items-center gap-1">
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                      >
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
                      </svg>
                      {errors.phone}
                    </p>
                  )}
                </>
              )}
            </div>

            {/* Email */}
            <div id="field-email">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Email
              </label>
              {isView ? (
                <div className="px-3 py-2.5 border border-gray-200 rounded-lg bg-gray-50 text-gray-800">
                  {formData.email || "—"}
                </div>
              ) : (
                <>
                  <input
                    type="email"
                    className={`w-full border px-3 py-2.5 rounded-lg transition-all ${
                      errors.email && touched.email
                        ? "border-red-500 bg-red-50 focus:ring-red-500 focus:border-red-500"
                        : "border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    }`}
                    placeholder="supplier@example.com"
                    value={formData.email}
                    onChange={(e) => handleFieldChange("email", e.target.value)}
                    onBlur={() => handleBlur("email")}
                    maxLength={100}
                  />
                  {errors.email && touched.email && (
                    <p className="text-xs text-red-600 mt-1.5 flex items-center gap-1">
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                      >
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
                      </svg>
                      {errors.email}
                    </p>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Địa chỉ */}
          <div id="field-address">
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Địa chỉ
            </label>
            {isView ? (
              <div className="px-3 py-2.5 border border-gray-200 rounded-lg bg-gray-50 text-gray-800 min-h-[80px] whitespace-pre-wrap">
                {formData.address || "—"}
              </div>
            ) : (
              <>
                <textarea
                  className={`w-full border px-3 py-2.5 rounded-lg transition-all resize-none ${
                    errors.address && touched.address
                      ? "border-red-500 bg-red-50 focus:ring-red-500 focus:border-red-500"
                      : "border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  }`}
                  rows="3"
                  placeholder="VD: 123 Đường ABC, Quận 1, TP.HCM"
                  value={formData.address}
                  onChange={(e) => handleFieldChange("address", e.target.value)}
                  onBlur={() => handleBlur("address")}
                  maxLength={500}
                />
                {errors.address && touched.address && (
                  <p className="text-xs text-red-600 mt-1.5 flex items-center gap-1">
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                    >
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
                    </svg>
                    {errors.address}
                  </p>
                )}
                <p className="text-xs text-gray-500 mt-1">
                  {formData.address.length}/500 ký tự
                </p>
              </>
            )}
          </div>

          {/* Trạng thái */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Trạng thái
            </label>
            {isView ? (
              <span
                className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${
                  formData.isActive
                    ? "bg-green-100 text-green-700"
                    : "bg-gray-100 text-gray-700"
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    formData.isActive ? "bg-green-500" : "bg-gray-400"
                  }`}
                />
                {formData.isActive ? "Đang hoạt động" : "Ngừng hoạt động"}
              </span>
            ) : (
              <label className="flex items-center gap-3 cursor-pointer group">
                <div className="relative">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={formData.isActive}
                    onChange={(e) =>
                      handleFieldChange("isActive", e.target.checked)
                    }
                  />
                  <div className="w-11 h-6 bg-gray-300 peer-focus:ring-2 peer-focus:ring-indigo-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                </div>
                <span className="text-sm font-medium text-gray-700 group-hover:text-gray-900">
                  {formData.isActive ? "Đang hoạt động" : "Ngừng hoạt động"}
                </span>
              </label>
            )}
          </div>
        </div>

        {/* Footer - Sticky */}
        <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-4 flex items-center justify-between">
          <div>
            {mode === "edit" && onDelete && (
              <button
                onClick={onDelete}
                disabled={saving}
                className="px-4 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors font-medium disabled:opacity-50 flex items-center gap-2"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                </svg>
                Xóa
              </button>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onCancel}
              disabled={saving}
              className="px-5 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium disabled:opacity-50"
            >
              {isView ? "Đóng" : "Hủy"}
            </button>

            {!isView && (
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium disabled:opacity-50 flex items-center gap-2 min-w-[100px] justify-center"
              >
                {saving ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Đang lưu...
                  </>
                ) : (
                  <>
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z" />
                      <polyline points="17 21 17 13 7 13 7 21" />
                      <polyline points="7 3 7 8 15 8" />
                    </svg>
                    Lưu
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fadeIn {
          animation: fadeIn 0.2s ease-out;
        }
        .animate-slideUp {
          animation: slideUp 0.3s ease-out;
        }
      `}</style>
    </div>
  );
};

export default SupplierModal;

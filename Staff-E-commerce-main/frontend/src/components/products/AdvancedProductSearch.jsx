import { useState } from "react";

const fields = [
  { value: "productName", label: "Tên sản phẩm", type: "string" },
  { value: "sku", label: "SKU", type: "string" },
  { value: "barcode", label: "Mã vạch", type: "string" },
  { value: "description", label: "Mô tả", type: "string" },
  { value: "categoryName", label: "Tên danh mục", type: "string" },
  { value: "supplierName", label: "Tên nhà cung cấp", type: "string" },
  { value: "region", label: "Miền nhà cung cấp", type: "region" },
  { value: "unitName", label: "Đơn vị tính", type: "string" },
  { value: "id", label: "ID", type: "number" },
  { value: "price", label: "Giá bán", type: "number" },
  { value: "cost", label: "Giá vốn", type: "number" },
  { value: "stockQuantity", label: "Số lượng tồn", type: "number" },
  { value: "categoryId", label: "ID danh mục", type: "number" },
  { value: "supplierId", label: "ID nhà cung cấp", type: "number" },
  { value: "unitId", label: "ID đơn vị", type: "number" },
  { value: "createdAt", label: "Ngày tạo", type: "date" },
  { value: "updatedAt", label: "Ngày cập nhật", type: "date" },
  { value: "isActive", label: "Trạng thái", type: "boolean" },
];

const comparisonOperators = [">", "<", ">=", "<=", "==", "!=", "<>"];
let nextConditionId = 1;
const createCondition = () => ({
  id: nextConditionId++, field: "productName", operator: "==", value: "", logic: "AND", negate: false,
});

export default function AdvancedProductSearch({ appliedConditions, onApply, onClear }) {
  const [open, setOpen] = useState(false);
  const [conditions, setConditions] = useState([createCondition()]);
  const [validationError, setValidationError] = useState("");

  const updateCondition = (id, changes) => {
    setConditions((current) => current.map((condition) =>
      condition.id === id ? { ...condition, ...changes } : condition));
    setValidationError("");
  };

  const changeField = (condition, field) => {
    const definition = fields.find((item) => item.value === field);
    updateCondition(condition.id, {
      field,
      value: "",
      operator: ["boolean", "region"].includes(definition?.type) ? "==" : condition.operator,
    });
  };

  const apply = () => {
    if (conditions.some((condition) => String(condition.value).trim() === "")) {
      setValidationError("Vui lòng nhập giá trị cho tất cả điều kiện.");
      return;
    }
    onApply(conditions.map((condition) => ({
      field: condition.field,
      operator: condition.operator,
      value: condition.value,
      logic: condition.logic,
      negate: condition.negate,
    })));
    setValidationError("");
  };

  const clear = () => {
    setConditions([createCondition()]);
    setValidationError("");
    onClear();
  };

  return (
    <section className="mb-4 rounded-md bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold text-gray-800">Tìm kiếm nâng cao</h2>
          <p className="text-xs text-gray-500">AND được tính trước OR; chọn NOT để đảo kết quả của một điều kiện.</p>
        </div>
        <div className="flex items-center gap-2">
          {appliedConditions.length > 0 && (
            <span className="rounded-full bg-primary-50 px-3 py-1 text-xs font-medium text-primary-700">
              Đang áp dụng {appliedConditions.length} điều kiện
            </span>
          )}
          <button type="button" onClick={() => setOpen((value) => !value)}
            className="rounded-md border px-3 py-2 text-sm hover:bg-gray-50">
            {open ? "Thu gọn" : "Mở bộ lọc"}
          </button>
        </div>
      </div>

      {open && (
        <div className="mt-4 space-y-3 border-t pt-4">
          {conditions.map((condition, index) => {
            const definition = fields.find((field) => field.value === condition.field) || fields[0];
            const operators = ["boolean", "region"].includes(definition.type)
              ? ["==", "!=", "<>"]
              : comparisonOperators;
            return (
              <div key={condition.id} className="grid grid-cols-1 items-end gap-2 rounded-lg bg-gray-50 p-3 md:grid-cols-[90px_90px_minmax(150px,1.2fr)_90px_minmax(150px,1fr)_auto]">
                <label className="text-xs text-gray-600">
                  Logic
                  <select value={condition.logic} disabled={index === 0}
                    onChange={(event) => updateCondition(condition.id, { logic: event.target.value })}
                    className="mt-1 w-full rounded-md border bg-white px-2 py-2 text-sm disabled:bg-gray-100">
                    <option value="AND">AND</option><option value="OR">OR</option>
                  </select>
                </label>
                <label className="flex h-10 items-center gap-2 rounded-md border bg-white px-2 text-sm">
                  <input type="checkbox" checked={condition.negate}
                    onChange={(event) => updateCondition(condition.id, { negate: event.target.checked })} />
                  NOT
                </label>
                <label className="text-xs text-gray-600">
                  Trường
                  <select value={condition.field} onChange={(event) => changeField(condition, event.target.value)}
                    className="mt-1 w-full rounded-md border bg-white px-2 py-2 text-sm">
                    {fields.map((field) => <option key={field.value} value={field.value}>{field.label}</option>)}
                  </select>
                </label>
                <label className="text-xs text-gray-600">
                  So sánh
                  <select value={condition.operator}
                    onChange={(event) => updateCondition(condition.id, { operator: event.target.value })}
                    className="mt-1 w-full rounded-md border bg-white px-2 py-2 text-sm">
                    {operators.map((operator) => <option key={operator} value={operator}>{operator}</option>)}
                  </select>
                </label>
                <label className="text-xs text-gray-600">
                  Giá trị
                  {definition.type === "boolean" ? (
                    <select value={condition.value}
                      onChange={(event) => updateCondition(condition.id, { value: event.target.value })}
                      className="mt-1 w-full rounded-md border bg-white px-2 py-2 text-sm">
                      <option value="">Chọn trạng thái</option>
                      <option value="true">Hoạt động</option><option value="false">Vô hiệu</option>
                    </select>
                  ) : definition.type === "region" ? (
                    <select value={condition.value}
                      onChange={(event) => updateCondition(condition.id, { value: event.target.value })}
                      className="mt-1 w-full rounded-md border bg-white px-2 py-2 text-sm">
                      <option value="">Chọn miền</option>
                      <option value="Bắc">Bắc</option>
                      <option value="Trung">Trung</option>
                      <option value="Nam">Nam</option>
                    </select>
                  ) : (
                    <input type={definition.type === "date" ? "date" : definition.type === "number" ? "number" : "text"}
                      step={definition.type === "number" ? "any" : undefined}
                      value={condition.value}
                      onChange={(event) => updateCondition(condition.id, { value: event.target.value })}
                      className="mt-1 w-full rounded-md border bg-white px-2 py-2 text-sm"
                      placeholder={definition.type === "string" ? "Nhập giá trị chính xác" : undefined} />
                  )}
                </label>
                <button type="button" disabled={conditions.length === 1}
                  onClick={() => setConditions((current) => current.filter((item) => item.id !== condition.id))}
                  className="h-10 rounded-md border border-red-200 px-3 text-sm text-red-700 hover:bg-red-50 disabled:opacity-40">
                  Xóa
                </button>
              </div>
            );
          })}

          {validationError && <p className="text-sm text-red-700">{validationError}</p>}
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={conditions.length >= 10}
              onClick={() => setConditions((current) => [...current, createCondition()])}
              className="rounded-md border px-3 py-2 text-sm hover:bg-gray-50 disabled:opacity-40">
              + Thêm điều kiện
            </button>
            <button type="button" onClick={apply}
              className="rounded-md bg-primary-600 px-4 py-2 text-sm text-white hover:bg-primary-700">
              Áp dụng
            </button>
            <button type="button" onClick={clear}
              className="rounded-md border px-3 py-2 text-sm hover:bg-gray-50">
              Xóa tìm nâng cao
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

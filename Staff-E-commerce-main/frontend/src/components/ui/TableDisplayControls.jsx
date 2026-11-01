export default function TableDisplayControls({ pageSize, onPageSizeChange, disabled = false }) {
  return (
    <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600 print:hidden">
      <label className="flex items-center gap-2">
        Số dòng/trang
        <select value={pageSize} disabled={disabled}
          onChange={(event) => onPageSizeChange(Number(event.target.value))}
          className="min-h-8 rounded border bg-white px-2 py-1 text-gray-800 disabled:opacity-50">
          {[10, 25, 50, 100].map((size) => <option key={size} value={size}>{size}</option>)}
        </select>
      </label>
    </div>
  );
}

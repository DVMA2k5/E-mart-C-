import React from 'react';

export default function LowStockAlert({ items }) {
  return (
    <div className="bg-white p-6 rounded-lg shadow">
      <h2 className="text-xl font-bold mb-4">⚠️ Sản phẩm sắp hết hàng</h2>
      <div className="space-y-3 max-h-[300px] overflow-y-auto">
        {items?.length === 0 ? (
          <p className="text-gray-500">Tất cả sản phẩm đều còn đủ hàng</p>
        ) : (
          items.map((item) => (
            <div key={item.productId} className="flex justify-between items-center border-b pb-2">
              <div>
                <p className="font-semibold text-sm">{item.productName}</p>
                <p className="text-xs text-gray-500">{item.sku}</p>
              </div>
              <span className={`px-2 py-1 rounded text-xs font-semibold ${
                item.quantity < 5 ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'
              }`}>
                Còn {item.quantity}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

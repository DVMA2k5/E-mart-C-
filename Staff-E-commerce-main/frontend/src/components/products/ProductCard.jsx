// src/components/products/ProductCard.jsx
import React from "react";

export default function ProductCard({ product }) {
  // Map product fields depending on your API (adjust if names differ)
  const name = product.productName;
  const price = product.price ?? product.Price ?? product.price_usd ?? 0;
  const image = product.imageUrl ?? product.image_url ?? product.image ?? null;
  const unit = product.unit ?? product.Unit ?? "";
  const qty =
    product.inventory?.quantity ??
    product.quantity ??
    product.Inventory?.quantity ??
    null;

  return (
    <div className="bg-white rounded-lg shadow-sm overflow-hidden hover:shadow-md transition-shadow">
      <div className="w-full h-44 bg-gray-100 flex items-center justify-center">
        {/* // eslint-disable-next-line jsx-a11y/img-redundant-alt */}
        {image ? (
          <img src={image} alt={name} className="object-contain h-full" />
        ) : (
          <div className="text-gray-400">No image</div>
        )}
      </div>

      <div className="p-4">
        <h3 className="text-sm font-medium text-gray-800 line-clamp-2">
          {name}
        </h3>
        <div className="mt-2 flex items-center justify-between">
          <div>
            <div className="text-lg font-semibold text-indigo-600">
              {Intl.NumberFormat("vi-VN").format(price)} ₫
            </div>
            <div className="text-xs text-gray-500">{unit}</div>
          </div>

          <div className="text-sm text-gray-600">
            {qty !== null ? (
              <span className={qty <= 5 ? "text-red-500 font-semibold" : ""}>
                {qty} in stock
              </span>
            ) : (
              <span className="text-gray-400">—</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

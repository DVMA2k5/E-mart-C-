import React, { useEffect, useState } from "react";
import { request } from "../../api/apiClient";

export default function PromotionSection({ isCreateMode, promotion, setPromotion, currentOrder, setCurrentOrder }) {
  const [promotions, setPromotions] = useState([]);
  const [selectedPromotionId, setSelectedPromotionId] = useState(promotion?.id || null);

  useEffect(() => {
    if (isCreateMode === "create") {
      request("/promotions/active")
        .then((data) => setPromotions(data.filter((p) => p.type === "voucher" || p.type === "event")))
        .catch((err) => console.error("Failed to fetch promotions:", err));
    }
  }, [isCreateMode]);

  useEffect(() => {
    setSelectedPromotionId(promotion?.id || null);
  }, [promotion, isCreateMode]);

  useEffect(() => {
    if (isCreateMode !== "create") return;
    const subtotal = Number(currentOrder?.subtotal || 0);
    const eligible = promotion && subtotal >= Number(promotion.minOrderAmount || 0);
    if (promotion && !eligible) setPromotion(null);
    let discount = eligible ? (promotion.discountType === "percent" ? Math.floor(subtotal * promotion.value / 100) : Number(promotion.value)) : 0;
    if (eligible && promotion.maxDiscount != null) discount = Math.min(discount, promotion.maxDiscount);
    discount = Math.max(0, Math.min(subtotal, discount));
    setCurrentOrder((previous) => previous?.discount === discount && previous?.totalAmount === subtotal - discount ? previous : ({ ...previous, discount, totalAmount: subtotal - discount, total_amount: subtotal - discount }));
  }, [isCreateMode, currentOrder?.subtotal, promotion, setCurrentOrder, setPromotion]);



  const handleSelect = (promo) => {
    const subtotal = currentOrder?.subtotal || 0;

    const now = new Date();

    //  Không đủ mức tối thiểu
    if (promo.minOrderAmount > 0 && subtotal < promo.minOrderAmount) {
      alert(`Đơn hàng phải đạt tối thiểu ${promo.minOrderAmount.toLocaleString()}₫ để dùng mã này!`);
      return;
    }

    //  Chưa đến ngày bắt đầu
    if (promo.startDate && new Date(promo.startDate) > now) {
      alert("Mã giảm giá này chưa đến thời gian áp dụng!");
      return;
    }

    //  Hết hạn
    if (promo.endDate && new Date(promo.endDate) < now) {
      alert("Mã giảm giá này đã hết hạn!");
      return;
    }

    //  Hết lượt sử dụng
    if (promo.usageLimit !== null && promo.usedCount >= promo.usageLimit) {
      alert("Mã này đã hết lượt sử dụng!");
      return;
    }

    // Nếu hợp lệ → ÁP MÃ
    setSelectedPromotionId(promo.id);
    setPromotion(promo);

    let discountAmount = 0;

    if (promo.discountType === "percent") {
      discountAmount = Math.floor((subtotal * promo.value) / 100);
    } else {
      discountAmount = promo.value;
    }

    // cập nhật order
    const totalAmount = Math.max(0, subtotal - discountAmount);
    setCurrentOrder((prev) => ({
      ...prev,
      discount: discountAmount,
      totalAmount,
      total_amount: totalAmount,
    }));
  };





  const formatValue = (promo) => {
    if (promo.discountType === "percent") return `${promo.value}%`;
    return `${Number(promo.value).toLocaleString()}₫`;
  };

  return (
    <div className="mb-6 p-5 bg-gradient-to-r from-emerald-50 to-emerald-50 rounded-xl border-2 border-gray-400">
      <h4 className="text-xl font-bold text-gray-800 mb-3">PHIẾU GIẢM GIÁ</h4>
      {isCreateMode === "create" && promotion?.id && <button type="button" onClick={() => setPromotion(null)} className="mb-3 text-sm text-red-700 underline">Bỏ khuyến mãi</button>}

      <div className="space-y-3 max-h-64 overflow-y-auto">
        {isCreateMode === "create"
          ? promotions.map((promo) => (
              <label
                key={promo.id}
                className={`flex items-center justify-between p-4 border rounded-lg cursor-pointer hover:border-primary hover:shadow ${
                  selectedPromotionId === promo.id ? "border-primary-600 bg-primary-50" : ""
                }`}
              >
                <div>
                  <div className="font-bold text-primary text-lg">{promo.type === "voucher" ? promo.code : promo.name}</div>
                  <div className="text-sm text-gray-600">
                    Giảm {formatValue(promo)}
                    {promo.minOrderAmount > 0 && (
                      <> • Tối thiểu {Number(promo.minOrderAmount).toLocaleString()}₫</>
                    )}
                  </div>
                </div>
                <input
                  type="radio"
                  name="voucher"
                  className="form-radio h-5 w-5 text-primary-600"
                  checked={selectedPromotionId === promo.id}
                  onChange={() => handleSelect(promo)}
                />
              </label>
            ))
            
          : promotion && (
              <label className="flex items-center justify-between p-4 border rounded-lg cursor-pointer bg-gray-100">
                <div>
                  <div className="font-bold text-primary text-lg">{promotion.type === "voucher" ? promotion.code : promotion.name}</div>
                  <div className="text-sm text-gray-600">
                    Giảm {formatValue(promotion)}
                    {promotion.minOrderAmount > 0 && (
                      <> • Tối thiểu {Number(promotion.minOrderAmount).toLocaleString()}₫</>
                    )}
                  </div>
                </div>
                <input type="radio" name="voucher" className="form-radio h-5 w-5 text-primary-600" checked readOnly />
              </label>
            )}
      </div>
    </div>
  );
}

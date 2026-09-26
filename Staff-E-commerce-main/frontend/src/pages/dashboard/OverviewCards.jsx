import React from 'react';
import { formatCurrency } from '../../utils/formatters';

export default function OverviewCards({ overview }) {
  const renderChange = (value) => {
    if (value === null || value === undefined) {
      return <span className="text-gray-400">Không có dữ liệu hôm qua</span>;
    }
    const isPositive = value >= 0;
    return (
      <span className={isPositive ? 'text-green-500' : 'text-red-500'}>
        {isPositive ? '↑' : '↓'} {Math.abs(value).toFixed(1)}% so với hôm qua
      </span>
    );
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      <div className="bg-white p-6 rounded-lg shadow">
        <p className="text-gray-500 text-sm">Doanh thu hôm nay</p>
        <p className="text-3xl font-bold text-blue-600">{formatCurrency(overview?.todayRevenue || 0)}</p>
        <p className="text-sm mt-2">
          {renderChange(overview?.revenueChange)}
        </p>
      </div>

      <div className="bg-white p-6 rounded-lg shadow">
        <p className="text-gray-500 text-sm">Số đơn hàng</p>
        <p className="text-3xl font-bold text-green-600">{overview?.todayOrders || 0}</p>
        <p className="text-sm mt-2">
          {renderChange(overview?.ordersChange)}
        </p>
      </div>

      <div className="bg-white p-6 rounded-lg shadow">
        <p className="text-gray-500 text-sm">Sản phẩm bán được</p>
        <p className="text-3xl font-bold text-purple-600">{overview?.todayProductsSold || 0}</p>
      </div>

      <div className="bg-white p-6 rounded-lg shadow">
        <p className="text-gray-500 text-sm">Đơn trung bình (7 ngày)</p>
        <p className="text-3xl font-bold text-orange-600">{formatCurrency(overview?.averageOrderValue || 0)}</p>
      </div>
    </div>
  );
}

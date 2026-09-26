import { useState, useEffect } from "react";
import {
  exportSalesReport,
  exportInventoryReport,
  getSalesSummary,
  getRevenueByDay,
  getHighValueInventory,
  getPeriodComparison,
  getTopProducts,
  getTopCustomers,
  getSalesByStaff,
} from "../../api/reportsApi";
import { formatCurrency } from "../../utils/formatters";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { Calendar, Download, FileSpreadsheet, FileText } from "lucide-react";
import Pagination from "../../components/ui/Pagination";

const ReportsPage = () => {
  const [fromDate, setFromDate] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() - 12);
    return date.toISOString().split("T")[0];
  });
  const [toDate, setToDate] = useState(() => {
    const date = new Date();
    return date.toISOString().split("T")[0];
  });
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState(null);
  const [revenueByDay, setRevenueByDay] = useState([]);
  const [highValueInventory, setHighValueInventory] = useState([]);
  const [periodComparison, setPeriodComparison] = useState(null);
  const [topProducts, setTopProducts] = useState([]);
  const [topCustomers, setTopCustomers] = useState([]);
  const [salesByStaff, setSalesByStaff] = useState([]);
  const [exporting, setExporting] = useState(false);
  
  // Pagination cho tồn kho
  const [inventoryPage, setInventoryPage] = useState(1);
  const [inventoryPageSize] = useState(10);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const from = fromDate ? new Date(fromDate) : null;
      const to = toDate ? new Date(toDate) : null;

      const [
        summaryData,
        revenueData,
        inventoryData,
        comparisonData,
        productsData,
        customersData,
        staffData,
      ] = await Promise.all([
        getSalesSummary(from, to),
        getRevenueByDay(from, to),
        getHighValueInventory(100), // Lấy nhiều hơn để hiển thị đầy đủ
        getPeriodComparison(from, to).catch(() => null),
        getTopProducts(from, to, 10),
        getTopCustomers(from, to, 10),
        getSalesByStaff(from, to),
      ]);

      setSummary(summaryData);
      setRevenueByDay(revenueData);
      setHighValueInventory(inventoryData);
      setPeriodComparison(comparisonData);
      setTopProducts(productsData);
      setTopCustomers(customersData);
      setSalesByStaff(staffData);
      
      setInventoryPage(1);
    } catch (error) {
      console.error("Lỗi tải dữ liệu:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleApply = () => {
    loadData();
  };

  const handleExportSales = async (format) => {
    setExporting(true);
    try {
      const from = fromDate ? new Date(fromDate) : null;
      const to = toDate ? new Date(toDate) : null;
      await exportSalesReport(from, to, format);
    } catch (error) {
      console.error("Lỗi xuất báo cáo:", error);
      alert("Lỗi khi xuất báo cáo: " + error.message);
    } finally {
      setExporting(false);
    }
  };

  const handleExportInventory = async (format) => {
    setExporting(true);
    try {
      await exportInventoryReport(format);
    } catch (error) {
      console.error("Lỗi xuất báo cáo:", error);
      alert("Lỗi khi xuất báo cáo: " + error.message);
    } finally {
      setExporting(false);
    }
  };

  const formatDateRange = () => {
    if (!fromDate || !toDate) return "";
    const from = new Date(fromDate).toISOString().split("T")[0];
    const to = new Date(toDate).toISOString().split("T")[0];
    return `Dữ liệu hiển thị cho khoảng thời gian ${from} – ${to}`;
  };

  // Format revenue data for chart
  const chartData = revenueByDay.map((item) => ({
    date: new Date(item.date).toLocaleDateString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
    }),
    revenue: item.revenue,
    orders: item.orderCount,
  }));

  // Format inventory data for chart - hiển thị top 8 (ưu tiên có giá trị cao)
  const inventoryChartData = highValueInventory
    .slice(0, 8) // Lấy top 8 đầu tiên (đã được sắp xếp theo TotalValue)
    .map((item) => ({
      name: item.productName.length > 20
        ? item.productName.substring(0, 20) + "..."
        : item.productName,
      value: item.totalValue,
    }));

  // Tính tổng giá trị tồn kho
  const totalInventoryValue = highValueInventory.reduce(
    (sum, item) => sum + item.totalValue,
    0
  );

  // Tính toán phân trang cho tồn kho
  const inventoryTotalPages = Math.ceil(highValueInventory.length / inventoryPageSize);
  const inventoryStartIndex = (inventoryPage - 1) * inventoryPageSize;
  const inventoryEndIndex = inventoryStartIndex + inventoryPageSize;
  const paginatedInventory = highValueInventory.slice(inventoryStartIndex, inventoryEndIndex);

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">
            Báo cáo & Thống kê
          </h1>
          <p className="text-gray-600">
            Theo dõi hiệu suất bán hàng, tồn kho và xuất file CSV/XLSX.
          </p>
        </div>

        {/* Date Range and Export Controls */}
        <div className="bg-white p-6 rounded-lg shadow mb-6">
          <div className="flex flex-wrap items-end gap-4 mb-4">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Từ ngày
              </label>
              <div className="relative">
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 pr-10"
                />
                <Calendar className="absolute right-3 top-2.5 w-5 h-5 text-gray-400 pointer-events-none" />
              </div>
            </div>
            <div className="flex-1 min-w-[200px]">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Đến ngày
              </label>
              <div className="relative">
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 pr-10"
                />
                <Calendar className="absolute right-3 top-2.5 w-5 h-5 text-gray-400 pointer-events-none" />
              </div>
            </div>
            <button
              onClick={handleApply}
              disabled={loading}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
            >
              Áp dụng
            </button>
          </div>

          {/* Export Buttons */}
          <div className="flex flex-wrap gap-3 mb-4">
            <button
              onClick={() => handleExportSales("csv")}
              disabled={exporting}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 flex items-center gap-2"
            >
              <FileText size={18} />
              Xuất bán hàng CSV
            </button>
            <button
              onClick={() => handleExportSales("xlsx")}
              disabled={exporting}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition disabled:opacity-50 flex items-center gap-2"
            >
              <FileSpreadsheet size={18} />
              Xuất bán hàng XLSX
            </button>
            <button
              onClick={() => handleExportInventory("csv")}
              disabled={exporting}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:opacity-50 flex items-center gap-2"
            >
              <FileText size={18} />
              Xuất tồn kho CSV
            </button>
            <button
              onClick={() => handleExportInventory("xlsx")}
              disabled={exporting}
              className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition disabled:opacity-50 flex items-center gap-2"
            >
              <FileSpreadsheet size={18} />
              Xuất tồn kho XLSX
            </button>
          </div>

          {formatDateRange() && (
            <p className="text-sm text-gray-600">{formatDateRange()}</p>
          )}
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-white p-6 rounded-lg shadow">
            <p className="text-sm text-gray-600 mb-2">Doanh thu thuần</p>
            <p className="text-2xl font-bold text-gray-800">
              {formatCurrency(summary?.netRevenue || 0)}
            </p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <p className="text-sm text-gray-600 mb-2">Tổng chiết khấu</p>
            <p className="text-2xl font-bold text-gray-800">
              {formatCurrency(summary?.totalDiscount || 0)}
            </p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <p className="text-sm text-gray-600 mb-2">Đơn hàng</p>
            <p className="text-2xl font-bold text-gray-800">
              {summary?.totalOrders || 0}
            </p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <p className="text-sm text-gray-600 mb-2">Sản phẩm bán ra</p>
            <p className="text-2xl font-bold text-gray-800">
              {summary?.productsSold || 0}
            </p>
          </div>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Revenue by Day Chart */}
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-xl font-bold mb-4">Doanh thu theo ngày</h2>
            {loading ? (
              <div className="h-[300px] flex items-center justify-center">
                <p className="text-gray-500">Đang tải...</p>
              </div>
            ) : chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis
                    tickFormatter={(v) =>
                      (v / 1000000).toFixed(1) + "M"
                    }
                  />
                  <Tooltip
                    formatter={(value, name) => {
                      if (name === "revenue") {
                        return [formatCurrency(value), "Doanh thu"];
                      }
                      return [value, "Đơn hàng"];
                    }}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="revenue"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    dot={{ r: 4 }}
                    name="Doanh thu"
                  />
                  <Line
                    type="monotone"
                    dataKey="orders"
                    stroke="#f97316"
                    strokeWidth={2}
                    dot={{ r: 4 }}
                    name="Đơn hàng"
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center">
                <p className="text-gray-500">Không có dữ liệu</p>
              </div>
            )}
          </div>

          {/* High Value Inventory Chart */}
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-xl font-bold mb-4">Tồn kho giá trị cao</h2>
            <p className="text-sm text-gray-600 mb-4">
              Tổng giá trị {formatCurrency(totalInventoryValue)}
            </p>
            {loading ? (
              <div className="h-[300px] flex items-center justify-center">
                <p className="text-gray-500">Đang tải...</p>
              </div>
            ) : inventoryChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={inventoryChartData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    type="number"
                    tickFormatter={(v) => (v / 1000000).toFixed(1) + "M"}
                  />
                  <YAxis
                    dataKey="name"
                    type="category"
                    width={120}
                    tick={{ fontSize: 12 }}
                  />
                  <Tooltip
                    formatter={(value) => formatCurrency(value)}
                  />
                  <Legend />
                  <Bar dataKey="value" fill="#10b981" name="Giá trị" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center">
                <p className="text-gray-500">Không có dữ liệu</p>
              </div>
            )}
          </div>
        </div>

        {/* Tables */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Sales Details */}
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-xl font-bold mb-4">Chi tiết bán hàng</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-4 py-2 text-left">Ngày</th>
                    <th className="px-4 py-2 text-right">Doanh thu</th>
                    <th className="px-4 py-2 text-right">Đơn hàng</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan="3" className="px-4 py-8 text-center text-gray-500">
                        Đang tải...
                      </td>
                    </tr>
                  ) : chartData.length > 0 ? (
                    chartData.slice().reverse().map((item, idx) => (
                      <tr key={idx} className="border-b hover:bg-gray-50">
                        <td className="px-4 py-2">{item.date}</td>
                        <td className="px-4 py-2 text-right">
                          {formatCurrency(item.revenue)}
                        </td>
                        <td className="px-4 py-2 text-right">{item.orders}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="3" className="px-4 py-8 text-center text-gray-500">
                        Không có dữ liệu
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Top Inventory */}
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">
                Top tồn kho ({highValueInventory.length} sản phẩm)
              </h2>
              {highValueInventory.length > 0 && (
                <p className="text-sm text-gray-600">
                  Trang {inventoryPage} / {inventoryTotalPages}
                </p>
              )}
            </div>
            <div className="overflow-x-auto">
              <div className="max-h-[500px] overflow-y-auto border border-gray-200 rounded-lg">
                <table className="w-full text-sm">
                  <thead className="bg-gray-100 sticky top-0 z-10">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold">Sản phẩm</th>
                      <th className="px-4 py-3 text-right font-semibold">Số lượng</th>
                      <th className="px-4 py-3 text-right font-semibold">Giá trị</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr>
                        <td colSpan="3" className="px-4 py-8 text-center text-gray-500">
                          Đang tải...
                        </td>
                      </tr>
                    ) : paginatedInventory.length > 0 ? (
                      paginatedInventory.map((item, idx) => (
                        <tr key={inventoryStartIndex + idx} className="border-b hover:bg-gray-50">
                          <td className="px-4 py-3">
                            <div className="flex items-center">
                              <span className="text-gray-400 mr-2 text-xs">
                                #{inventoryStartIndex + idx + 1}
                              </span>
                              <span className="font-medium">
                                {item.productName.length > 35
                                  ? item.productName.substring(0, 35) + "..."
                                  : item.productName}
                              </span>
                            </div>
                            {item.sku && (
                              <p className="text-xs text-gray-500 mt-1">SKU: {item.sku}</p>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className="font-semibold">{item.quantity}</span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className={`font-semibold ${
                              item.totalValue > 0 ? "text-gray-800" : "text-gray-400"
                            }`}>
                              {formatCurrency(item.totalValue)}
                            </span>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="3" className="px-4 py-8 text-center text-gray-500">
                          Không có dữ liệu
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            {highValueInventory.length > inventoryPageSize && (
              <div className="mt-4">
                <Pagination
                  meta={{
                    currentPage: inventoryPage,
                    totalPages: inventoryTotalPages,
                    totalItems: highValueInventory.length,
                    pageSize: inventoryPageSize,
                  }}
                  onPageChange={setInventoryPage}
                />
              </div>
            )}
          </div>
        </div>

        {/* Period Comparison */}
        {periodComparison && (
          <div className="bg-white p-6 rounded-lg shadow mb-6">
            <h2 className="text-xl font-bold mb-4">So sánh với kỳ trước</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-blue-50 rounded-lg">
                <p className="text-sm text-gray-600 mb-2">Doanh thu</p>
                <div className="flex items-center justify-between">
                  <p className="text-2xl font-bold text-gray-800">
                    {formatCurrency(periodComparison.currentPeriod.netRevenue)}
                  </p>
                  <span
                    className={`text-sm font-semibold ${
                      periodComparison.revenueChangePercent >= 0
                        ? "text-green-600"
                        : "text-red-600"
                    }`}
                  >
                    {periodComparison.revenueChangePercent >= 0 ? "↑" : "↓"}{" "}
                    {Math.abs(periodComparison.revenueChangePercent).toFixed(1)}%
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Kỳ trước: {formatCurrency(periodComparison.previousPeriod.netRevenue)}
                </p>
              </div>
              <div className="p-4 bg-green-50 rounded-lg">
                <p className="text-sm text-gray-600 mb-2">Đơn hàng</p>
                <div className="flex items-center justify-between">
                  <p className="text-2xl font-bold text-gray-800">
                    {periodComparison.currentPeriod.totalOrders}
                  </p>
                  <span
                    className={`text-sm font-semibold ${
                      periodComparison.ordersChangePercent >= 0
                        ? "text-green-600"
                        : "text-red-600"
                    }`}
                  >
                    {periodComparison.ordersChangePercent >= 0 ? "↑" : "↓"}{" "}
                    {Math.abs(periodComparison.ordersChangePercent).toFixed(1)}%
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Kỳ trước: {periodComparison.previousPeriod.totalOrders}
                </p>
              </div>
              <div className="p-4 bg-purple-50 rounded-lg">
                <p className="text-sm text-gray-600 mb-2">Sản phẩm bán ra</p>
                <div className="flex items-center justify-between">
                  <p className="text-2xl font-bold text-gray-800">
                    {periodComparison.currentPeriod.productsSold}
                  </p>
                  <span
                    className={`text-sm font-semibold ${
                      periodComparison.productsSoldChangePercent >= 0
                        ? "text-green-600"
                        : "text-red-600"
                    }`}
                  >
                    {periodComparison.productsSoldChangePercent >= 0 ? "↑" : "↓"}{" "}
                    {Math.abs(periodComparison.productsSoldChangePercent).toFixed(1)}%
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Kỳ trước: {periodComparison.previousPeriod.productsSold}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Additional Reports */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Top Products */}
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-xl font-bold mb-4">Top Sản phẩm bán chạy</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-4 py-2 text-left">Sản phẩm</th>
                    <th className="px-4 py-2 text-right">SL bán</th>
                    <th className="px-4 py-2 text-right">Doanh thu</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan="3" className="px-4 py-8 text-center text-gray-500">
                        Đang tải...
                      </td>
                    </tr>
                  ) : topProducts.length > 0 ? (
                    topProducts.map((item, idx) => (
                      <tr key={idx} className="border-b hover:bg-gray-50">
                        <td className="px-4 py-2">
                          <div>
                            <p className="font-semibold">
                              {item.productName.length > 25
                                ? item.productName.substring(0, 25) + "..."
                                : item.productName}
                            </p>
                            {item.categoryName && (
                              <p className="text-xs text-gray-500">{item.categoryName}</p>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-2 text-right">{item.quantitySold}</td>
                        <td className="px-4 py-2 text-right">
                          {formatCurrency(item.revenue)}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="3" className="px-4 py-8 text-center text-gray-500">
                        Không có dữ liệu
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Top Customers */}
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-xl font-bold mb-4">Top Khách hàng</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-4 py-2 text-left">Khách hàng</th>
                    <th className="px-4 py-2 text-right">Đơn hàng</th>
                    <th className="px-4 py-2 text-right">Tổng chi</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan="3" className="px-4 py-8 text-center text-gray-500">
                        Đang tải...
                      </td>
                    </tr>
                  ) : topCustomers.length > 0 ? (
                    topCustomers.map((item, idx) => (
                      <tr key={idx} className="border-b hover:bg-gray-50">
                        <td className="px-4 py-2">
                          <div>
                            <p className="font-semibold">{item.customerName}</p>
                            {item.phone && (
                              <p className="text-xs text-gray-500">{item.phone}</p>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-2 text-right">{item.orderCount}</td>
                        <td className="px-4 py-2 text-right">
                          {formatCurrency(item.totalSpent)}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="3" className="px-4 py-8 text-center text-gray-500">
                        Không có dữ liệu
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Sales by Staff */}
        {salesByStaff.length > 0 && (
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-xl font-bold mb-4">Doanh số theo Nhân viên</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-4 py-2 text-left">Nhân viên</th>
                    <th className="px-4 py-2 text-right">Số đơn</th>
                    <th className="px-4 py-2 text-right">Tổng doanh thu</th>
                    <th className="px-4 py-2 text-right">Đơn trung bình</th>
                  </tr>
                </thead>
                <tbody>
                  {salesByStaff.map((item, idx) => (
                    <tr key={idx} className="border-b hover:bg-gray-50">
                      <td className="px-4 py-2">
                        <div>
                          <p className="font-semibold">
                            {item.fullName || item.userName}
                          </p>
                          <p className="text-xs text-gray-500">{item.userName}</p>
                        </div>
                      </td>
                      <td className="px-4 py-2 text-right">{item.orderCount}</td>
                      <td className="px-4 py-2 text-right">
                        {formatCurrency(item.totalRevenue)}
                      </td>
                      <td className="px-4 py-2 text-right">
                        {formatCurrency(item.averageOrderValue)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ReportsPage;


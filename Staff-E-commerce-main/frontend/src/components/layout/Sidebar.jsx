import React from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, ShoppingCart, Receipt, FileText, Package, Users,
  UserRound, Shield, FolderTree, Truck, PackagePlus, Ruler, Tags,
  ChartNoAxesCombined, History, ChevronDown, LogOut, X, Settings,
} from "lucide-react";
import { logout } from "../../api/apiClient";
import { useAuth } from "../../hook/useAuth";
import bgImg from "../../assets/images/animate.jpg";

const navigationGroups = [
  {
    id: "sales", label: "Bán hàng", icon: ShoppingCart,
    items: [
      { to: "/pos", label: "Bán hàng (POS)", icon: ShoppingCart },
      { to: "/orders", label: "Lịch sử đơn hàng", icon: Receipt },
      { to: "/invoices", label: "Quản lý hóa đơn", icon: FileText },
      { to: "/customers", label: "Khách hàng", icon: UserRound },
      { to: "/promotions", label: "Giảm giá", icon: Tags },
    ],
  },
  {
    id: "products", label: "Sản phẩm", icon: Package,
    items: [
      { to: "/products", label: "Danh sách sản phẩm", icon: Package },
      { to: "/categories", label: "Danh mục sản phẩm", icon: FolderTree },
      { to: "/units", label: "Đơn vị tính", icon: Ruler },
    ],
  },
  {
    id: "purchasing", label: "Nhập hàng", icon: Truck,
    items: [
      { to: "/suppliers", label: "Nhà cung cấp", icon: Truck },
      { to: "/purchase-orders", label: "Phiếu nhập hàng", icon: PackagePlus },
    ],
  },
  {
    id: "system", label: "Hệ thống", icon: Settings, adminOnly: true,
    items: [
      { to: "/employees", label: "Nhân viên", icon: Users },
      { to: "/users", label: "Tài khoản", icon: UserRound },
      { to: "/roles", label: "Phân quyền role", icon: Shield },
      { to: "/audit", label: "Nhật ký hệ thống", icon: History },
    ],
  },
];

export default function Sidebar({ collapsed, onClose }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const matchesPath = (path) => pathname === path || pathname.startsWith(`${path}/`);
  const handleLogout = () => {
    if (confirm("Bạn có chắc muốn đăng xuất?")) {
      logout();
      navigate("/login");
    }
  };
  const linkClass = ({ isActive }) =>
    `flex min-h-10 items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
      isActive ? "bg-primary-50 text-primary-600 font-semibold" : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
    }`;

  return (
    <aside aria-label="Thanh điều hướng quản trị"
      className={`fixed inset-y-0 left-0 z-999 w-64 flex-col overflow-hidden border-r border-gray-200 bg-white ${collapsed ? "hidden md:flex" : "flex"}`}
      style={{ height: "100dvh" }}>
      <div className="flex shrink-0 items-center gap-3 border-b border-gray-100 px-4 py-4">
        <div className="flex-1 text-center">
          <style>{`
            @keyframes animate { to { background-position-x: -500px; } }
            .animated-text {
              background-image: url(${bgImg});
              background-size: cover;
              background-clip: text;
              -webkit-background-clip: text;
              -webkit-text-fill-color: transparent;
              animation: animate 20s linear infinite;
            }
          `}</style>
          <div className="animated-text text-3xl font-extrabold">
            <p className="leading-tight">STORE</p>
            <p className="leading-tight">MANAGER</p>
          </div>
        </div>
        <button type="button" onClick={onClose} aria-label="Đóng menu" className="rounded-lg p-2 hover:bg-gray-100 md:hidden"><X size={18} /></button>
      </div>

      <nav aria-label="Menu quản trị" className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain p-3 [scrollbar-gutter:stable]">
        <NavLink to="/dashboard" className={linkClass} onClick={onClose}>
          <LayoutDashboard size={18} className="shrink-0" /><span>Tổng quan</span>
        </NavLink>
        {navigationGroups.filter((group) => !group.adminOnly || isAdmin).map((group) => {
          const GroupIcon = group.icon;
          const isGroupActive = group.items.some((item) => matchesPath(item.to));
          return (
            <details key={`${group.id}-${pathname}`} open={isGroupActive} className="group/menu">
              <summary className={`flex min-h-11 cursor-pointer list-none items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold transition-colors hover:bg-gray-100 [&::-webkit-details-marker]:hidden ${isGroupActive ? "text-primary-600" : "text-gray-700"}`}>
                <GroupIcon size={18} className="shrink-0" /><span className="flex-1">{group.label}</span>
                <ChevronDown size={16} className="shrink-0 text-gray-400 transition-transform group-open/menu:rotate-180" />
              </summary>
              <div className="ml-5 mt-1 space-y-1 border-l border-gray-200 pl-2">
                {group.items.map((item) => {
                  const ItemIcon = item.icon;
                  return (
                    <NavLink key={item.to} to={item.to} className={linkClass} onClick={onClose}>
                      <ItemIcon size={16} className="shrink-0" /><span>{item.label}</span>
                    </NavLink>
                  );
                })}
              </div>
            </details>
          );
        })}
        {isAdmin && (
          <NavLink to="/reports" className={linkClass} onClick={onClose}>
            <ChartNoAxesCombined size={18} className="shrink-0" /><span>Báo cáo/Thống kê</span>
          </NavLink>
        )}
      </nav>
      <div className="shrink-0 border-t border-gray-200 bg-white p-3">
        <button type="button" className="flex min-h-10 w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm text-gray-700 hover:bg-red-50 hover:text-red-600" onClick={handleLogout}>
          <LogOut size={18} className="shrink-0" /><span>Đăng xuất</span>
        </button>
      </div>
    </aside>
  );
}

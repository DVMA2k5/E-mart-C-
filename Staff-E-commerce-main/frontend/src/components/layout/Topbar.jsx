import React, { useRef, useState } from "react";
import { logout } from "../../api/apiClient";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../hook/useAuth";

const SearchIcon = (props) => (
  <svg
    viewBox="0 0 24 24"
    width="20"
    height="20"
    fill="none"
    stroke="currentColor"
    {...props}
  >
    <path
      d="M21 21l-4.35-4.35"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <circle
      cx="11"
      cy="11"
      r="6"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const BellIcon = (props) => (
  <svg
    viewBox="0 0 24 24"
    width="20"
    height="20"
    fill="none"
    stroke="currentColor"
    {...props}
  >
    <path
      d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6 6 0 10-12 0v3.159c0 .538-.214 1.055-.595 1.436L4 17h5"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M13.73 21a2 2 0 01-3.46 0"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export default function Topbar({ onToggleSidebar }) {
  // const [q, setQ] = useState("");
  const [showUserMenu, setShowUserMenu] = useState(false);
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const menuRef = useRef(null);

  // const handleSearchSubmit = (e) => {
  //   e.preventDefault();
  //   // TODO: call parent search handler or navigate to search page
  //   console.log("Search for:", q);
  // };

  const handleLogout = () => {
    if (confirm("Bạn có chắc muốn đăng xuất?")) {
      logout();
      navigate("/login");
    }
  };

  const getInitials = (name) => {
    if (!name) return "U";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  // ✅ Mapping role sang tiếng Việt
  const getRoleLabel = (role) => {
    const roleMap = {
      Admin: "Quản trị viên",
      Manager: "Quản lý",
      Employee: "Nhân viên",
    };
    return roleMap[role] || role;
  };

  return (
    <header className="flex items-center justify-between bg-white border-b border-gray-200 px-4 py-4">
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleSidebar}
          className="p-2 rounded-md hover:bg-gray-100 focus:outline-none focus:ring"
          aria-label="Toggle sidebar"
        >
          {/* menu icon */}
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            className="text-gray-700 block lg:hidden"
          >
            <path
              d="M4 6h16M4 12h16M4 18h16"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>

        <div className="hidden md:block">
          <>
            <style jsx>{`
              @keyframes typing {
                from {
                  width: 0;
                }
                to {
                  width: 30ch;
                }
              }
            `}</style>

            <h1
              className="font-mono overflow-hidden whitespace-nowrap text-xl font-bold text-gray-800"
              style={{ animation: "typing 2s steps(30) infinite alternate" }}
            >
              Xin chào, {user?.fullName || user?.username || "User"}! 👋
            </h1>
          </>
          <p className="text-sm text-gray-500">
            {new Date().toLocaleDateString("vi-VN", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-4">
        {/* <button className="relative p-2 rounded-md hover:bg-gray-100 focus:outline-none">
          <BellIcon className="text-gray-600" />
          <span className="absolute top-0 right-0 inline-flex items-center justify-center px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white bg-red-500 rounded-full">
            3
          </span>
        </button> */}
        <div className="w-px h-8 bg-gray-200" />
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
            aria-haspopup="true"
            aria-expanded={showUserMenu}
          >
            <div className="relative">
              <div className="w-10 h-10 border-2 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-purple-400 flex items-center justify-center text-sm font-bold shadow-md">
                {loading ? (
                  <div className="animate-spin">⏳</div>
                ) : (
                  getInitials(user?.fullName || user?.username)
                )}
              </div>
              <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></div>
            </div>
            <div className="hidden sm:flex flex-col text-left">
              <span className="text-sm font-medium text-gray-800">
                {loading
                  ? "Đang tải..."
                  : user?.fullName || user?.username || "User"}
              </span>
              <span className="text-xs text-gray-500">
                {loading ? "" : getRoleLabel(user?.role)}
              </span>
            </div>
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              className="text-gray-500"
            >
              <path
                d="M6 9l6 6 6-6"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>

          {showUserMenu && (
            <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-md shadow-lg z-20">
              <div className="px-4 py-3 border-b">
                <p className="text-sm font-medium text-gray-800">
                  {user?.fullName || user?.username}
                </p>
                <p className="text-xs text-gray-500">{user?.email}</p>
              </div>

              <a
                href="/profile"
                className="block px-4 py-2 text-sm hover:bg-gray-50"
              >
                Hồ sơ
              </a>
              <a
                href="/settings"
                className="block px-4 py-2 text-sm hover:bg-gray-50"
              >
                Cài đặt
              </a>
              <div className="border-t" />
              <button
                className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50"
                onClick={() => {
                  handleLogout();
                }}
              >
                Đăng xuất
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

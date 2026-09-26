import { Navigate } from "react-router-dom";
import { getAuthToken } from "../../api/apiClient";

export default function ProtectedRoute({ children }) {
  const token = getAuthToken();

  console.log("🔒 ProtectedRoute check - Token:", token ? "EXISTS" : "MISSING");

  if (!token) {
    console.log("❌ No token, redirecting to /login");
    return <Navigate to="/login" replace />;
  }

  console.log("✅ Token found, rendering protected content");
  return children;
}

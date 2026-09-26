// hooks/useTokenExpiry.js
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getAuthToken, isTokenExpired, logout } from "../api/apiClient";

export function useTokenExpiry() {
  const navigate = useNavigate();

  useEffect(() => {
    const checkToken = () => {
      const token = getAuthToken();
      if (token && isTokenExpired(token)) {
        console.log("⏰ Token expired, logging out...");
        logout();
        navigate("/login", { replace: true });
      }
    };

    // Check every minute
    const interval = setInterval(checkToken, 60000);

    // Check immediately
    checkToken();

    return () => clearInterval(interval);
  }, [navigate]);
}

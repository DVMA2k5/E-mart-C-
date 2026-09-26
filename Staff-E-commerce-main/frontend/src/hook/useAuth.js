import { useState, useEffect } from "react";
import { jwtDecode } from "jwt-decode";

export const useAuth = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("auth_token");

    if (token) {
      try {
        const decoded = jwtDecode(token);

        // ✅ ĐỔI: Map đúng theo claims từ backend
        setUser({
          id: decoded.uid || decoded.sub,
          username:
            decoded[
              "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name"
            ] ||
            decoded.unique_name ||
            decoded.sub,
          email:
            decoded[
              "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress"
            ] ||
            decoded.email ||
            null,
          role:
            decoded[
              "http://schemas.microsoft.com/ws/2008/06/identity/claims/role"
            ] || decoded.role,
          fullName:
            decoded[
              "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname"
            ] ||
            decoded.fullname ||
            decoded[
              "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name"
            ] ||
            decoded.sub,
        });
      } catch (error) {
        console.error("Invalid token:", error);
        localStorage.removeItem("auth_token");
        setUser(null);
      }
    } else {
      setUser(null);
    }

    setLoading(false);
  }, []);

  return { user, loading };
};

import React, { createContext, useContext, useState, useEffect } from "react";
import { useLocation } from "wouter";

interface AdminContextType {
  adminToken: string | null;
  adminLogin: (token: string) => void;
  adminLogout: () => void;
  isAdminAuthenticated: boolean;
}

const AdminContext = createContext<AdminContextType | null>(null);

export function AdminProvider({ children }: { children: React.ReactNode }) {
  const [adminToken, setAdminToken] = useState<string | null>(null);
  const [, navigate] = useLocation();

  useEffect(() => {
    const saved = localStorage.getItem("adminToken");
    if (saved) setAdminToken(saved);
  }, []);

  const adminLogin = (token: string) => {
    setAdminToken(token);
    localStorage.setItem("adminToken", token);
  };

  const adminLogout = () => {
    setAdminToken(null);
    localStorage.removeItem("adminToken");
    navigate("/admin/login");
  };

  return (
    <AdminContext.Provider value={{
      adminToken,
      adminLogin,
      adminLogout,
      isAdminAuthenticated: !!adminToken,
    }}>
      {children}
    </AdminContext.Provider>
  );
}

export function useAdmin() {
  const context = useContext(AdminContext);
  if (!context) throw new Error("useAdmin must be used within AdminProvider");
  return context;
}

export async function adminApiRequest(
  method: string,
  url: string,
  data?: unknown
): Promise<Response> {
  const token = localStorage.getItem("adminToken");
  const headers: Record<string, string> = {};
  if (data) headers["Content-Type"] = "application/json";
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(url, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status}: ${text}`);
  }
  return res;
}

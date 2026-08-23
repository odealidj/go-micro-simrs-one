import { createContext, useContext, useState, useEffect } from "react";
import type { ReactNode } from "react";
import { api } from "./api";

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  role: string | null;
  userId: string | null;
  isAuthenticated: boolean;
  poliCode?: string | null;
  poliName?: string | null;
}

interface AuthContextType extends AuthState {
  login: (access: string, refresh: string, role: string, userId: string, poliCode?: string | null) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [authState, setAuthState] = useState<AuthState>(() => {
    return {
      accessToken: localStorage.getItem("access_token"),
      refreshToken: localStorage.getItem("refresh_token"),
      role: localStorage.getItem("role"),
      userId: localStorage.getItem("user_id"),
      isAuthenticated: !!localStorage.getItem("access_token"),
      poliCode: localStorage.getItem("poli_code"),
      poliName: localStorage.getItem("poli_name"),
    };
  });

  const fetchPoliName = async (token: string, code: string) => {
    try {
      const res = await api.get("/master/polyclinics?page=1&page_size=100", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data && res.data.data) {
        const data = res.data;
        const poli = data.data?.find((p: any) => p.code === code);
        if (poli && poli.name) {
          localStorage.setItem("poli_name", poli.name);
          setAuthState(prev => ({ ...prev, poliName: poli.name }));
        }
      }
    } catch (err) {
      console.error("Failed to fetch poli name", err);
    }
  };

  const login = (access: string, refresh: string, role: string, userId: string, poliCode?: string | null) => {
    localStorage.setItem("access_token", access);
    localStorage.setItem("refresh_token", refresh);
    localStorage.setItem("role", role);
    localStorage.setItem("user_id", userId);
    
    if (poliCode) {
      localStorage.setItem("poli_code", poliCode);
    } else {
      localStorage.removeItem("poli_code");
    }
    
    setAuthState({
      accessToken: access,
      refreshToken: refresh,
      role: role,
      userId: userId,
      isAuthenticated: true,
      poliCode: poliCode || null,
      poliName: null,
    });
    
    if (poliCode) {
      fetchPoliName(access, poliCode);
    }
  };

  const logout = () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    localStorage.removeItem("role");
    localStorage.removeItem("user_id");
    localStorage.removeItem("poli_code");
    localStorage.removeItem("poli_name");
    
    setAuthState({
      accessToken: null,
      refreshToken: null,
      role: null,
      userId: null,
      isAuthenticated: false,
      poliCode: null,
      poliName: null,
    });
  };

  // Sync state if localStorage changes from another tab
  useEffect(() => {
    const handleStorageChange = () => {
      const token = localStorage.getItem("access_token");
      setAuthState({
        accessToken: token,
        refreshToken: localStorage.getItem("refresh_token"),
        role: localStorage.getItem("role"),
        userId: localStorage.getItem("user_id"),
        isAuthenticated: !!token,
        poliCode: localStorage.getItem("poli_code"),
        poliName: localStorage.getItem("poli_name"),
      });
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  return (
    <AuthContext.Provider value={{ ...authState, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

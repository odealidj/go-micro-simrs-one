import { createContext, useContext, useState, useEffect } from "react";
import type { ReactNode } from "react";

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  role: string | null;
  userId: string | null;
  isAuthenticated: boolean;
}

interface AuthContextType extends AuthState {
  login: (access: string, refresh: string, role: string, userId: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [authState, setAuthState] = useState<AuthState>({
    accessToken: localStorage.getItem("access_token"),
    refreshToken: localStorage.getItem("refresh_token"),
    role: localStorage.getItem("role"),
    userId: localStorage.getItem("user_id"),
    isAuthenticated: !!localStorage.getItem("access_token"),
  });

  const login = (access: string, refresh: string, role: string, userId: string) => {
    localStorage.setItem("access_token", access);
    localStorage.setItem("refresh_token", refresh);
    localStorage.setItem("role", role);
    localStorage.setItem("user_id", userId);
    
    setAuthState({
      accessToken: access,
      refreshToken: refresh,
      role: role,
      userId: userId,
      isAuthenticated: true,
    });
  };

  const logout = () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    localStorage.removeItem("role");
    localStorage.removeItem("user_id");
    
    setAuthState({
      accessToken: null,
      refreshToken: null,
      role: null,
      userId: null,
      isAuthenticated: false,
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

"use client";

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";

/* ── Types ───────────────────────────────────────────────────── */
export interface User {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  role: "admin" | "designer" | "client" | "supervisor";
  avatar?: string;
  lastLogin?: string;
  permissions?: Record<string, string>;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

interface AuthContextType extends AuthState {
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  updateUser: (u: Partial<User>) => void;
}

/* ── Demo User ───────────────────────────────────────────────── */
const DEMO_ADMIN: User = {
  id: 1,
  email: "admin@nicara.design",
  firstName: "Nishanth",
  lastName: "Kumar",
  role: "admin",
  lastLogin: new Date().toISOString(),
};

/* ── Context ─────────────────────────────────────────────────── */
const AuthContext = createContext<AuthContextType>({
  user: null, token: null, isLoading: true, isAuthenticated: false,
  login: async () => ({ success: false }),
  logout: () => {},
  updateUser: () => {},
});

export function useAuth() { return useContext(AuthContext); }

/* ── Provider ────────────────────────────────────────────────── */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null, token: null, isLoading: true, isAuthenticated: false,
  });

  /* Hydrate from localStorage */
  useEffect(() => {
    const token = localStorage.getItem("nicara_token");
    const userJson = localStorage.getItem("nicara_user");
    if (token && userJson) {
      try {
        const user = JSON.parse(userJson) as User;
        setState({ user, token, isLoading: false, isAuthenticated: true });
      } catch {
        localStorage.removeItem("nicara_token");
        localStorage.removeItem("nicara_user");
        setState(s => ({ ...s, isLoading: false }));
      }
    } else {
      setState(s => ({ ...s, isLoading: false }));
    }
  }, []);

  /* Login — calls Django REST Token Auth endpoint */
  const login = useCallback(async (email: string, password: string) => {
    try {
      /* When Django backend is ready, use:
        const res = await apiClient.post("/api/auth/login/", { email, password });
        const { token, user } = res;
      */
      // Demo mode — simulate auth
      if (email && password) {
        const token = "demo_token_" + Date.now();
        const user: User = { ...DEMO_ADMIN, email };
        localStorage.setItem("nicara_token", token);
        localStorage.setItem("nicara_user", JSON.stringify(user));
        setState({ user, token, isLoading: false, isAuthenticated: true });
        return { success: true };
      }
      return { success: false, error: "Invalid credentials" };
    } catch (err) {
      return { success: false, error: (err as Error).message || "Login failed" };
    }
  }, []);

  /* Logout */
  const logout = useCallback(() => {
    localStorage.removeItem("nicara_token");
    localStorage.removeItem("nicara_user");
    setState({ user: null, token: null, isLoading: false, isAuthenticated: false });
  }, []);

  /* Update user profile */
  const updateUser = useCallback((updates: Partial<User>) => {
    setState(s => {
      if (!s.user) return s;
      const user = { ...s.user, ...updates };
      localStorage.setItem("nicara_user", JSON.stringify(user));
      return { ...s, user };
    });
  }, []);

  return (
    <AuthContext.Provider value={{ ...state, login, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

/* ── Helper: Get initials ────────────────────────────────────── */
export function getInitials(user: User | null): string {
  if (!user) return "?";
  return (user.firstName?.[0] || "") + (user.lastName?.[0] || "");
}

/* ── Helper: Avatar color ────────────────────────────────────── */
export function avatarColor(name: string): string {
  const colors = ["#C9A96E", "#2dd4a8", "#7B4FA6", "#3b82f6", "#ef4444", "#f59e0b"];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

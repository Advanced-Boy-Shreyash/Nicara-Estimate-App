"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import {
  ApiError, authApi, setSessionExpiredHandler, tokenStore,
  type ApiUser, type AuthPayload,
} from "@/lib/api";

/* ── Types ───────────────────────────────────────────────────── */
export interface User {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  fullName: string;
  role: "admin" | "designer" | "client" | "supervisor";
  phone?: string;
  avatar?: string;
  lastLogin?: string;
  permissions?: Record<string, string>;
}

export interface AuthResult {
  success: boolean;
  error?: string;
  fieldErrors?: Record<string, string[]>;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

interface AuthContextType extends AuthState {
  login: (email: string, password: string) => Promise<AuthResult>;
  logout: () => Promise<void>;
  updateUser: (u: Partial<User>) => void;
  saveProfile: (u: Partial<Pick<User, "firstName" | "lastName" | "phone" | "avatar">>) => Promise<AuthResult>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<AuthResult>;
  acceptInvite: (token: string, password: string) => Promise<AuthResult>;
  resetPassword: (uid: string, token: string, newPassword: string) => Promise<AuthResult>;
  refreshProfile: () => Promise<void>;
}

/* ── Mapping: Django snake_case → UI camelCase ───────────────── */
export function mapUser(api: ApiUser): User {
  return {
    id: api.id,
    email: api.email,
    firstName: api.first_name,
    lastName: api.last_name,
    fullName: api.full_name || `${api.first_name} ${api.last_name}`.trim() || api.email,
    role: api.role,
    phone: api.phone || "",
    avatar: api.avatar_url || undefined,
    lastLogin: api.last_login || undefined,
    permissions: api.permissions ?? {},
  };
}

/** Turn any thrown value into a form-friendly result. */
function toResult(err: unknown): AuthResult {
  if (err instanceof ApiError) {
    return { success: false, error: err.message, fieldErrors: err.errors };
  }
  return { success: false, error: (err as Error)?.message || "Something went wrong." };
}

const UNAUTHENTICATED: AuthState = {
  user: null, token: null, isLoading: false, isAuthenticated: false,
};

/* ── Context ─────────────────────────────────────────────────── */
const AuthContext = createContext<AuthContextType>({
  ...UNAUTHENTICATED,
  isLoading: true,
  login: async () => ({ success: false }),
  logout: async () => {},
  updateUser: () => {},
  saveProfile: async () => ({ success: false }),
  changePassword: async () => ({ success: false }),
  acceptInvite: async () => ({ success: false }),
  resetPassword: async () => ({ success: false }),
  refreshProfile: async () => {},
});

export function useAuth() { return useContext(AuthContext); }

/* ── Provider ────────────────────────────────────────────────── */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null, token: null, isLoading: true, isAuthenticated: false,
  });
  const mounted = useRef(true);

  const applySession = useCallback((payload: AuthPayload) => {
    tokenStore.saveTokens(payload.token);
    tokenStore.saveUser(payload.user);
    const user = mapUser(payload.user);
    setState({ user, token: payload.token.access, isLoading: false, isAuthenticated: true });
    return user;
  }, []);

  const clearSession = useCallback(() => {
    tokenStore.clear();
    if (mounted.current) setState(UNAUTHENTICATED);
  }, []);

  /* A 401 the refresh token could not rescue — drop the session. */
  useEffect(() => {
    mounted.current = true;
    setSessionExpiredHandler(() => {
      if (mounted.current) setState(UNAUTHENTICATED);
    });
    return () => {
      mounted.current = false;
      setSessionExpiredHandler(null);
    };
  }, []);

  /* Hydrate from localStorage, then confirm the token against the backend.
     localStorage is unreadable during prerender, so the session can only be
     resolved after mount — hence the state writes below. */
  useEffect(() => {
    const cached = tokenStore.user<ApiUser>();
    const access = tokenStore.access();

    if (!access || !cached) {
      tokenStore.clear();
      // eslint-disable-next-line react-hooks/set-state-in-effect -- resolving session from an external store
      setState(UNAUTHENTICATED);
      return;
    }

    // Show the cached identity immediately; verify in the background so a
    // revoked or expired session cannot linger in the UI.
    setState({ user: mapUser(cached), token: access, isLoading: false, isAuthenticated: true });

    authApi.me()
      .then(fresh => {
        if (!mounted.current) return;
        tokenStore.saveUser(fresh);
        setState(s => ({ ...s, user: mapUser(fresh), token: tokenStore.access() }));
      })
      .catch(err => {
        if (!mounted.current) return;
        // Network hiccups keep the cached session; a rejected token ends it.
        if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
          clearSession();
        }
      });
  }, [clearSession]);

  /* Login */
  const login = useCallback(async (email: string, password: string): Promise<AuthResult> => {
    try {
      const payload = await authApi.login(email.trim(), password);
      applySession(payload);
      return { success: true };
    } catch (err) {
      return toResult(err);
    }
  }, [applySession]);

  /* Logout — blacklist the refresh token server-side, then clear locally. */
  const logout = useCallback(async () => {
    const refresh = tokenStore.refresh();
    if (refresh) {
      try {
        await authApi.logout(refresh);
      } catch {
        // Offline or already-expired token: the local session still ends.
      }
    }
    clearSession();
  }, [clearSession]);

  /* Local-only user patch (optimistic UI) */
  const updateUser = useCallback((updates: Partial<User>) => {
    setState(s => {
      if (!s.user) return s;
      const user = { ...s.user, ...updates };
      const cached = tokenStore.user<ApiUser>();
      if (cached) {
        tokenStore.saveUser({
          ...cached,
          first_name: user.firstName,
          last_name: user.lastName,
          phone: user.phone ?? "",
          avatar_url: user.avatar ?? "",
        });
      }
      return { ...s, user };
    });
  }, []);

  /* Persist profile changes to the backend */
  const saveProfile = useCallback(async (updates: Partial<Pick<User, "firstName" | "lastName" | "phone" | "avatar">>): Promise<AuthResult> => {
    try {
      const fresh = await authApi.updateMe({
        ...(updates.firstName !== undefined ? { first_name: updates.firstName } : {}),
        ...(updates.lastName !== undefined ? { last_name: updates.lastName } : {}),
        ...(updates.phone !== undefined ? { phone: updates.phone } : {}),
        ...(updates.avatar !== undefined ? { avatar_url: updates.avatar } : {}),
      });
      tokenStore.saveUser(fresh);
      setState(s => ({ ...s, user: mapUser(fresh) }));
      return { success: true };
    } catch (err) {
      return toResult(err);
    }
  }, []);

  /* Change password — the backend hands back a fresh token pair. */
  const changePassword = useCallback(async (currentPassword: string, newPassword: string): Promise<AuthResult> => {
    try {
      const res = await authApi.changePassword(currentPassword, newPassword);
      tokenStore.saveTokens(res.token);
      setState(s => ({ ...s, token: res.token.access }));
      return { success: true };
    } catch (err) {
      return toResult(err);
    }
  }, []);

  /* Accept an invitation — sets the password and signs the user in. */
  const acceptInvite = useCallback(async (token: string, password: string): Promise<AuthResult> => {
    try {
      applySession(await authApi.acceptInvite(token, password));
      return { success: true };
    } catch (err) {
      return toResult(err);
    }
  }, [applySession]);

  /* Complete a password reset — also signs the user in. */
  const resetPassword = useCallback(async (uid: string, token: string, newPassword: string): Promise<AuthResult> => {
    try {
      applySession(await authApi.confirmPasswordReset(uid, token, newPassword));
      return { success: true };
    } catch (err) {
      return toResult(err);
    }
  }, [applySession]);

  /* Re-read the profile (e.g. after an admin changes your permissions) */
  const refreshProfile = useCallback(async () => {
    try {
      const fresh = await authApi.me();
      tokenStore.saveUser(fresh);
      if (mounted.current) setState(s => ({ ...s, user: mapUser(fresh) }));
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) clearSession();
    }
  }, [clearSession]);

  return (
    <AuthContext.Provider value={{
      ...state, login, logout, updateUser, saveProfile,
      changePassword, acceptInvite, resetPassword, refreshProfile,
    }}>
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

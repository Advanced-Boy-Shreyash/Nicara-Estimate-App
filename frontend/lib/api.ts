// ── NICARA Project OS — Django REST Framework API Layer ──────
//
// Talks to the Django backend at NEXT_PUBLIC_API_URL (default
// http://localhost:8000/api). Access tokens are short lived; when one expires
// this layer transparently redeems the refresh token and replays the request.

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

const ACCESS_KEY = "nicara_token";
const REFRESH_KEY = "nicara_refresh";
const USER_KEY = "nicara_user";

/* ── Error type ──────────────────────────────────────────────
   Every backend error arrives as { detail, errors?, code? }
   (see Backend/nicara/exceptions.py). */

/** DRF PageNumberPagination envelope (PAGE_SIZE = 50). */
export interface Paginated<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export class ApiError extends Error {
  readonly status: number;
  readonly errors: Record<string, string[]>;
  readonly code?: string;

  constructor(message: string, status: number, errors: Record<string, string[]> = {}, code?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.errors = errors;
    this.code = code;
  }

  /** First message recorded against a specific form field, if any. */
  fieldError(field: string): string | undefined {
    return this.errors[field]?.[0];
  }
}

/* ── Token storage ───────────────────────────────────────────
   localStorage keeps the session alive across reloads. */

export interface TokenPair {
  access: string;
  refresh: string;
}

export const tokenStore = {
  access(): string | null {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(ACCESS_KEY);
  },
  refresh(): string | null {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(REFRESH_KEY);
  },
  user<T>(): T | null {
    if (typeof window === "undefined") return null;
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      localStorage.removeItem(USER_KEY);
      return null;
    }
  },
  saveTokens(tokens: TokenPair) {
    if (typeof window === "undefined") return;
    localStorage.setItem(ACCESS_KEY, tokens.access);
    localStorage.setItem(REFRESH_KEY, tokens.refresh);
  },
  saveUser(user: unknown) {
    if (typeof window === "undefined") return;
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  },
  clear() {
    if (typeof window === "undefined") return;
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
    localStorage.removeItem(USER_KEY);
  },
};

/* ── Session expiry hook ─────────────────────────────────────
   AuthProvider registers a callback so an unrecoverable 401 can
   clear React state and bounce the user to /login. */

let onSessionExpired: (() => void) | null = null;

export function setSessionExpiredHandler(handler: (() => void) | null) {
  onSessionExpired = handler;
}

/* ── Refresh (single-flight) ─────────────────────────────────
   Concurrent requests that all hit a 401 share one refresh call. */

let refreshInFlight: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  if (refreshInFlight) return refreshInFlight;

  const refresh = tokenStore.refresh();
  if (!refresh) return null;

  refreshInFlight = (async () => {
    try {
      const response = await fetch(`${BASE_URL}/auth/token/refresh/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh }),
      });
      if (!response.ok) return null;

      const data = (await response.json()) as { access: string; refresh?: string };
      // ROTATE_REFRESH_TOKENS is on, so the response usually carries a new one.
      tokenStore.saveTokens({ access: data.access, refresh: data.refresh ?? refresh });
      return data.access;
    } catch {
      return null;
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}

/* ── Core fetch wrapper ──────────────────────────────────────*/

interface FetchOptions extends RequestInit {
  /** Skip the Authorization header (login, password reset, accept invite). */
  anonymous?: boolean;
}

async function parseError(response: Response): Promise<ApiError> {
  let body: { detail?: string; errors?: Record<string, string[]>; code?: string } = {};
  try {
    body = await response.json();
  } catch {
    /* empty or non-JSON body */
  }

  const fallback =
    response.status === 401
      ? "Your session has expired. Please sign in again."
      : response.status === 403
        ? "You do not have permission to do that."
        : response.status === 429
          ? "Too many attempts. Please wait a moment and try again."
          : response.status >= 500
            ? "The server ran into a problem. Please try again."
            : `Request failed (${response.status})`;

  return new ApiError(body.detail || fallback, response.status, body.errors ?? {}, body.code);
}

async function apiFetch<T>(endpoint: string, options: FetchOptions = {}): Promise<T> {
  const { anonymous, ...init } = options;

  const send = (token: string | null) => {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...((init.headers as Record<string, string>) || {}),
    };
    if (token) headers.Authorization = `Bearer ${token}`;
    return fetch(`${BASE_URL}${endpoint}`, { ...init, headers });
  };

  let response: Response;
  try {
    response = await send(anonymous ? null : tokenStore.access());
  } catch {
    throw new ApiError(
      "Cannot reach the server. Is the Django backend running on port 8000?",
      0,
    );
  }

  // Access token expired — refresh once and replay.
  if (response.status === 401 && !anonymous && tokenStore.refresh()) {
    const fresh = await refreshAccessToken();
    if (fresh) {
      response = await send(fresh);
    } else {
      tokenStore.clear();
      onSessionExpired?.();
    }
  }

  if (!response.ok) throw await parseError(response);
  if (response.status === 204) return undefined as T;

  const text = await response.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

/* ── Auth ─────────────────────────────────────────────────────*/

export interface ApiUser {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  full_name: string;
  role: "admin" | "designer" | "client" | "supervisor";
  phone?: string;
  avatar_url?: string;
  is_active?: boolean;
  last_login?: string | null;
  date_joined?: string;
  invite_accepted?: boolean;
  permissions?: Record<string, string>;
}

export interface AuthPayload {
  token: TokenPair;
  user: ApiUser;
  detail?: string;
}

export const authApi = {
  login: (email: string, password: string) =>
    apiFetch<AuthPayload>("/auth/login/", {
      method: "POST",
      body: JSON.stringify({ email, password }),
      anonymous: true,
    }),

  logout: (refresh: string) =>
    apiFetch<{ detail: string }>("/auth/logout/", {
      method: "POST",
      body: JSON.stringify({ refresh }),
    }),

  me: () => apiFetch<ApiUser>("/auth/me/"),

  updateMe: (data: Partial<Pick<ApiUser, "first_name" | "last_name" | "phone" | "avatar_url">>) =>
    apiFetch<ApiUser>("/auth/me/", { method: "PATCH", body: JSON.stringify(data) }),

  changePassword: (currentPassword: string, newPassword: string) =>
    apiFetch<{ detail: string; token: TokenPair }>("/auth/change-password/", {
      method: "POST",
      body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
    }),

  requestPasswordReset: (email: string) =>
    apiFetch<{ detail: string }>("/auth/password-reset/", {
      method: "POST",
      body: JSON.stringify({ email }),
      anonymous: true,
    }),

  confirmPasswordReset: (uid: string, token: string, newPassword: string) =>
    apiFetch<AuthPayload>("/auth/password-reset/confirm/", {
      method: "POST",
      body: JSON.stringify({ uid, token, new_password: newPassword }),
      anonymous: true,
    }),

  acceptInvite: (token: string, password: string) =>
    apiFetch<AuthPayload>("/auth/accept-invite/", {
      method: "POST",
      body: JSON.stringify({ token, password }),
      anonymous: true,
    }),

  users: () => apiFetch<ApiUser[] | { results: ApiUser[] }>("/auth/users/"),

  invite: (data: { email: string; first_name: string; last_name: string; role: string; message?: string }) =>
    apiFetch<{ detail: string; user: ApiUser; invite_url?: string }>("/auth/invite/", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  permissions: () => apiFetch<unknown[]>("/auth/iam/permissions/"),

  updatePermissions: (data: unknown) =>
    apiFetch<{ detail: string }>("/auth/iam/permissions/", {
      method: "PUT",
      body: JSON.stringify(data),
    }),
};

// ── Projects ──────────────────────────────────────────────────

export const projectsApi = {
  list: (params: { stage?: string; search?: string } = {}) => {
    const query = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v) as [string, string][]
    );
    const qs = query.toString();
    return apiFetch<Paginated<unknown>>(`/projects/${qs ? `?${qs}` : ""}`);
  },
  get: (id: number) => apiFetch<unknown>(`/projects/${id}/`),
  create: (data: unknown) =>
    apiFetch<unknown>("/projects/", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  /** Client Details tab saves here. */
  update: (id: number, data: unknown) =>
    apiFetch<unknown>(`/projects/${id}/`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  delete: (id: number) =>
    apiFetch<void>(`/projects/${id}/`, { method: "DELETE" }),
  dashboard: () => apiFetch<unknown>("/projects/dashboard/"),
  /** Stages, property types, estimate statuses, payment modes. */
  meta: () => apiFetch<unknown>("/projects/meta/"),
};

// ── Initial Engagement: Design Requirements ───────────────────

export const designRequirementsApi = {
  list: (projectId: number) =>
    apiFetch<Paginated<unknown>>(`/projects/${projectId}/design-requirements/`),
  create: (projectId: number, data: unknown) =>
    apiFetch<unknown>(`/projects/${projectId}/design-requirements/`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  /** Replace the whole grid in one call. */
  saveAll: (projectId: number, rows: unknown[]) =>
    apiFetch<unknown[]>(`/projects/${projectId}/design-requirements/bulk/`, {
      method: "PUT",
      body: JSON.stringify({ rows }),
    }),
  update: (projectId: number, id: number, data: unknown) =>
    apiFetch<unknown>(`/projects/${projectId}/design-requirements/${id}/`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  delete: (projectId: number, id: number) =>
    apiFetch<void>(`/projects/${projectId}/design-requirements/${id}/`, { method: "DELETE" }),
};

// ── Initial Engagement: Deliverables (FL, Mood Board, 3D, …) ──

export const deliverablesApi = {
  list: (projectId: number, type?: string) =>
    apiFetch<Paginated<unknown>>(
      `/projects/${projectId}/deliverables/${type ? `?type=${type}` : ""}`
    ),
  create: (projectId: number, data: unknown) =>
    apiFetch<unknown>(`/projects/${projectId}/deliverables/`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  update: (projectId: number, id: number, data: unknown) =>
    apiFetch<unknown>(`/projects/${projectId}/deliverables/${id}/`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  delete: (projectId: number, id: number) =>
    apiFetch<void>(`/projects/${projectId}/deliverables/${id}/`, { method: "DELETE" }),
};

// ── Estimates ─────────────────────────────────────────────────

export const estimatesApi = {
  list: (projectId: number, type?: string) =>
    apiFetch<Paginated<unknown>>(
      `/projects/${projectId}/estimates/${type ? `?type=${type}` : ""}`
    ),
  get: (projectId: number, estimateId: number) =>
    apiFetch<unknown>(`/projects/${projectId}/estimates/${estimateId}/`),
  create: (projectId: number, data: { type: string; title?: string }) =>
    apiFetch<unknown>(`/projects/${projectId}/estimates/`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  update: (projectId: number, estimateId: number, data: unknown) =>
    apiFetch<unknown>(`/projects/${projectId}/estimates/${estimateId}/`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  // Workflow
  send: (projectId: number, estimateId: number) =>
    apiFetch<unknown>(`/projects/${projectId}/estimates/${estimateId}/send/`, { method: "POST" }),
  approve: (projectId: number, estimateId: number, clientRemarks = "") =>
    apiFetch<unknown>(`/projects/${projectId}/estimates/${estimateId}/approve/`, {
      method: "POST",
      body: JSON.stringify({ client_remarks: clientRemarks }),
    }),
  requestRevision: (projectId: number, estimateId: number, clientRemarks: string) =>
    apiFetch<unknown>(`/projects/${projectId}/estimates/${estimateId}/request-revision/`, {
      method: "POST",
      body: JSON.stringify({ client_remarks: clientRemarks }),
    }),
  /** Copy into a new draft — a revision, or initial → final. */
  duplicate: (projectId: number, estimateId: number, type?: string) =>
    apiFetch<unknown>(`/projects/${projectId}/estimates/${estimateId}/duplicate/`, {
      method: "POST",
      body: JSON.stringify(type ? { type } : {}),
    }),

  // Line items
  items: (projectId: number, estimateId: number) =>
    apiFetch<Paginated<unknown>>(`/projects/${projectId}/estimates/${estimateId}/items/`),
  addItem: (projectId: number, estimateId: number, data: unknown) =>
    apiFetch<unknown>(`/projects/${projectId}/estimates/${estimateId}/items/`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  /** Push catalogue items onto the estimate; defaults come from the Item. */
  addFromCatalog: (
    projectId: number,
    estimateId: number,
    items: { item_id: number; [key: string]: unknown }[]
  ) =>
    apiFetch<unknown>(`/projects/${projectId}/estimates/${estimateId}/items/add-from-catalog/`, {
      method: "POST",
      body: JSON.stringify({ items }),
    }),
  updateItem: (projectId: number, estimateId: number, itemId: number, data: unknown) =>
    apiFetch<unknown>(`/projects/${projectId}/estimates/${estimateId}/items/${itemId}/`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  deleteItem: (projectId: number, estimateId: number, itemId: number) =>
    apiFetch<void>(`/projects/${projectId}/estimates/${estimateId}/items/${itemId}/`, {
      method: "DELETE",
    }),
};

// ── Initial Engagement: Booking Form ──────────────────────────

export const bookingApi = {
  /** 404 until a booking form has been created for the project. */
  get: (projectId: number) => apiFetch<unknown>(`/projects/${projectId}/booking-form/`),
  create: (projectId: number, data: unknown = {}) =>
    apiFetch<unknown>(`/projects/${projectId}/booking-form/`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  update: (projectId: number, data: unknown) =>
    apiFetch<unknown>(`/projects/${projectId}/booking-form/`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
};

// ── Items catalogue ───────────────────────────────────────────

export const itemsApi = {
  list: (params: { category?: number; search?: string; room?: string } = {}) => {
    const query = new URLSearchParams();
    if (params.category) query.set("category", String(params.category));
    if (params.search) query.set("search", params.search);
    if (params.room) query.set("default_room", params.room);
    const qs = query.toString();
    return apiFetch<Paginated<unknown>>(`/items/${qs ? `?${qs}` : ""}`);
  },
  get: (id: number) => apiFetch<unknown>(`/items/${id}/`),
  create: (data: unknown) =>
    apiFetch<unknown>("/items/", { method: "POST", body: JSON.stringify(data) }),
  update: (id: number, data: unknown) =>
    apiFetch<unknown>(`/items/${id}/`, { method: "PATCH", body: JSON.stringify(data) }),
  delete: (id: number) => apiFetch<void>(`/items/${id}/`, { method: "DELETE" }),

  categories: () => apiFetch<Paginated<unknown>>("/items/categories/"),
  createCategory: (data: unknown) =>
    apiFetch<unknown>("/items/categories/", { method: "POST", body: JSON.stringify(data) }),

  /** Bill of materials for an item — drives future rate build-up. */
  components: (itemId: number) => apiFetch<Paginated<unknown>>(`/items/${itemId}/components/`),
  addComponent: (itemId: number, data: unknown) =>
    apiFetch<unknown>(`/items/${itemId}/components/`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  /** Units, calc methods, rooms and categories for the item form. */
  meta: () => apiFetch<unknown>("/items/meta/"),
};

// ── Vendors: Material Suppliers & Contractors ─────────────────

export const vendorsApi = {
  list: (params: { search?: string; city?: string; trade?: string } = {}) => {
    const query = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v) as [string, string][]
    );
    const qs = query.toString();
    return apiFetch<Paginated<unknown>>(`/vendors/${qs ? `?${qs}` : ""}`);
  },
  suppliers: (search?: string) =>
    apiFetch<Paginated<unknown>>(`/vendors/suppliers/${search ? `?search=${search}` : ""}`),
  contractors: (search?: string) =>
    apiFetch<Paginated<unknown>>(`/vendors/contractors/${search ? `?search=${search}` : ""}`),
  get: (id: number) => apiFetch<unknown>(`/vendors/${id}/`),
  createSupplier: (data: unknown) =>
    apiFetch<unknown>("/vendors/suppliers/", { method: "POST", body: JSON.stringify(data) }),
  createContractor: (data: unknown) =>
    apiFetch<unknown>("/vendors/contractors/", { method: "POST", body: JSON.stringify(data) }),
  update: (id: number, data: unknown) =>
    apiFetch<unknown>(`/vendors/${id}/`, { method: "PATCH", body: JSON.stringify(data) }),
  /** Deactivates rather than deletes — history keeps pointing at the vendor. */
  delete: (id: number) => apiFetch<void>(`/vendors/${id}/`, { method: "DELETE" }),

  contacts: (vendorId: number) => apiFetch<Paginated<unknown>>(`/vendors/${vendorId}/contacts/`),
  addContact: (vendorId: number, data: unknown) =>
    apiFetch<unknown>(`/vendors/${vendorId}/contacts/`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  documents: (vendorId: number) => apiFetch<Paginated<unknown>>(`/vendors/${vendorId}/documents/`),

  /** Vendor types, trades, payment terms and counts. */
  meta: () => apiFetch<unknown>("/vendors/meta/"),
};

// NOTE: There is no standalone Clients or Procurement endpoint yet — client
// details live on the Project record, and procurement is not built. Those
// helpers were removed rather than left pointing at 404s.

// ── Design phase: Measurements & Material Selections ──────────

export const measurementsApi = {
  list: (projectId: number) =>
    apiFetch<Paginated<unknown>>(`/projects/${projectId}/measurements/`),
  create: (projectId: number, data: unknown) =>
    apiFetch<unknown>(`/projects/${projectId}/measurements/`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  update: (projectId: number, id: number, data: unknown) =>
    apiFetch<unknown>(`/projects/${projectId}/measurements/${id}/`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
};

export const materialSelectionsApi = {
  list: (projectId: number) =>
    apiFetch<Paginated<unknown>>(`/projects/${projectId}/material-selections/`),
  create: (projectId: number, data: unknown) =>
    apiFetch<unknown>(`/projects/${projectId}/material-selections/`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  update: (projectId: number, id: number, data: unknown) =>
    apiFetch<unknown>(`/projects/${projectId}/material-selections/${id}/`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
};

// ── Execution: Stages, Payments, Quality ──────────────────────

export const executionApi = {
  stages: (projectId: number) =>
    apiFetch<Paginated<unknown>>(`/projects/${projectId}/execution-stages/`),
  addStage: (projectId: number, data: unknown) =>
    apiFetch<unknown>(`/projects/${projectId}/execution-stages/`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateStage: (projectId: number, id: number, data: unknown) =>
    apiFetch<unknown>(`/projects/${projectId}/execution-stages/${id}/`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  qualityChecks: (projectId: number) =>
    apiFetch<Paginated<unknown>>(`/projects/${projectId}/quality-checks/`),
  addQualityCheck: (projectId: number, data: unknown) =>
    apiFetch<unknown>(`/projects/${projectId}/quality-checks/`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
};

export const paymentsApi = {
  list: (projectId: number) =>
    apiFetch<Paginated<unknown>>(`/projects/${projectId}/payments/`),
  record: (projectId: number, data: unknown) =>
    apiFetch<unknown>(`/projects/${projectId}/payments/`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  update: (projectId: number, paymentId: number, data: unknown) =>
    apiFetch<unknown>(`/projects/${projectId}/payments/${paymentId}/`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
};

// ── File Upload ───────────────────────────────────────────────

export const fileApi = {
  upload: async (projectId: number, file: File, category: string) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("category", category);

    const token = tokenStore.access();
    const response = await fetch(`${BASE_URL}/projects/${projectId}/files/`, {
      method: "POST",
      // No Content-Type — the browser sets the multipart boundary.
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    });

    if (!response.ok) throw await parseError(response);
    return response.json();
  },
  download: (fileId: string) => `${BASE_URL}/files/${fileId}/download/`,
};

// ── Component Library ─────────────────────────────────────────

export const libraryApi = {
  categories: () => apiFetch<unknown[]>("/library/categories/"),
  categoryDetail: (id: number) => apiFetch<unknown>(`/library/categories/${id}/`),
  createCategory: (data: unknown) =>
    apiFetch<unknown>("/library/categories/", { method: "POST", body: JSON.stringify(data) }),
  brands: (categoryId?: number) =>
    apiFetch<unknown[]>(categoryId ? `/library/brands/?category=${categoryId}` : "/library/brands/"),
  createBrand: (data: unknown) =>
    apiFetch<unknown>("/library/brands/", { method: "POST", body: JSON.stringify(data) }),
  items: (brandId?: number) =>
    apiFetch<unknown[]>(brandId ? `/library/items/?brand=${brandId}` : "/library/items/"),
  createItem: (data: unknown) =>
    apiFetch<unknown>("/library/items/", { method: "POST", body: JSON.stringify(data) }),
  updateItem: (id: number, data: unknown) =>
    apiFetch<unknown>(`/library/items/${id}/`, { method: "PUT", body: JSON.stringify(data) }),
  deleteItem: (id: number) =>
    apiFetch<void>(`/library/items/${id}/`, { method: "DELETE" }),
  services: () => apiFetch<unknown[]>("/library/services/"),
  createService: (data: unknown) =>
    apiFetch<unknown>("/library/services/", { method: "POST", body: JSON.stringify(data) }),
  updateService: (id: number, data: unknown) =>
    apiFetch<unknown>(`/library/services/${id}/`, { method: "PUT", body: JSON.stringify(data) }),
  deleteService: (id: number) =>
    apiFetch<void>(`/library/services/${id}/`, { method: "DELETE" }),
};

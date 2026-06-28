// ── NICARA Project OS — Django REST Framework API Layer ──────
//
// This service layer is designed to integrate seamlessly with Django REST Framework.
// Currently uses mock/local data. When your Django backend is ready, simply update
// the BASE_URL and remove the mock fallbacks.

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

/**
 * Get CSRF token from cookie (Django standard).
 */
function getCSRFToken(): string {
  if (typeof document === "undefined") return "";
  const match = document.cookie.match(/csrftoken=([^;]+)/);
  return match ? match[1] : "";
}

/**
 * Get auth token from localStorage.
 */
function getAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("nicara_token");
}

/**
 * Base fetch wrapper with Django REST Framework headers.
 */
async function apiFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getAuthToken();
  const csrf = getCSRFToken();

  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(csrf ? { "X-CSRFToken": csrf } : {}),
    ...((options.headers as Record<string, string>) || {}),
  };

  const response = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers,
    credentials: "include", // Send cookies for session auth
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({
      detail: "Network error",
    }));
    throw new Error(error.detail || `API Error: ${response.status}`);
  }

  return response.json();
}

// ── Projects ──────────────────────────────────────────────────

export const projectsApi = {
  list: () => apiFetch<unknown[]>("/projects/"),
  get: (id: number) => apiFetch<unknown>(`/projects/${id}/`),
  create: (data: unknown) =>
    apiFetch<unknown>("/projects/", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  update: (id: number, data: unknown) =>
    apiFetch<unknown>(`/projects/${id}/`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  delete: (id: number) =>
    apiFetch<void>(`/projects/${id}/`, { method: "DELETE" }),
};

// ── Estimates ─────────────────────────────────────────────────

export const estimatesApi = {
  list: (projectId: number) =>
    apiFetch<unknown[]>(`/projects/${projectId}/estimates/`),
  addItem: (projectId: number, data: unknown) =>
    apiFetch<unknown>(`/projects/${projectId}/estimates/`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateItem: (projectId: number, itemId: number, data: unknown) =>
    apiFetch<unknown>(`/projects/${projectId}/estimates/${itemId}/`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  deleteItem: (projectId: number, itemId: number) =>
    apiFetch<void>(`/projects/${projectId}/estimates/${itemId}/`, {
      method: "DELETE",
    }),
};

// ── Vendors ───────────────────────────────────────────────────

export const vendorsApi = {
  listService: () => apiFetch<unknown[]>("/vendors/service/"),
  listProduct: () => apiFetch<unknown[]>("/vendors/product/"),
  create: (data: unknown) =>
    apiFetch<unknown>("/vendors/", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  update: (id: number, data: unknown) =>
    apiFetch<unknown>(`/vendors/${id}/`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  delete: (id: number) =>
    apiFetch<void>(`/vendors/${id}/`, { method: "DELETE" }),
};

// ── Clients ───────────────────────────────────────────────────

export const clientsApi = {
  list: () => apiFetch<unknown[]>("/clients/"),
  create: (data: unknown) =>
    apiFetch<unknown>("/clients/", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  update: (id: number, data: unknown) =>
    apiFetch<unknown>(`/clients/${id}/`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  delete: (id: number) =>
    apiFetch<void>(`/clients/${id}/`, { method: "DELETE" }),
};

// ── Procurement ───────────────────────────────────────────────

export const procurementApi = {
  list: (projectId: number) =>
    apiFetch<unknown[]>(`/projects/${projectId}/procurement/`),
  create: (projectId: number, data: unknown) =>
    apiFetch<unknown>(`/projects/${projectId}/procurement/`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  update: (projectId: number, itemId: string, data: unknown) =>
    apiFetch<unknown>(`/projects/${projectId}/procurement/${itemId}/`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  delete: (projectId: number, itemId: string) =>
    apiFetch<void>(`/projects/${projectId}/procurement/${itemId}/`, {
      method: "DELETE",
    }),
};

// ── Payments ──────────────────────────────────────────────────

export const paymentsApi = {
  list: (projectId: number) =>
    apiFetch<unknown[]>(`/projects/${projectId}/payments/`),
  record: (projectId: number, data: unknown) =>
    apiFetch<unknown>(`/projects/${projectId}/payments/`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  update: (projectId: number, paymentId: number, data: unknown) =>
    apiFetch<unknown>(`/projects/${projectId}/payments/${paymentId}/`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
};

// ── File Upload ───────────────────────────────────────────────

export const fileApi = {
  upload: async (projectId: number, file: File, category: string) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("category", category);

    const token = getAuthToken();
    const csrf = getCSRFToken();

    const response = await fetch(
      `${BASE_URL}/projects/${projectId}/files/`,
      {
        method: "POST",
        headers: {
          ...(token ? { Authorization: `Token ${token}` } : {}),
          ...(csrf ? { "X-CSRFToken": csrf } : {}),
        },
        credentials: "include",
        body: formData,
      }
    );

    if (!response.ok) {
      throw new Error("File upload failed");
    }

    return response.json();
  },
  download: (fileId: string) =>
    `${BASE_URL}/files/${fileId}/download/`,
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

// ── Auth ──────────────────────────────────────────────────────

export const authApi = {
  login: (email: string, password: string) =>
    apiFetch<{ token: { access: string; refresh: string }; user: unknown }>("/auth/login/", {
      method: "POST", body: JSON.stringify({ email, password }),
    }),
  logout: (refresh: string) =>
    apiFetch<void>("/auth/logout/", { method: "POST", body: JSON.stringify({ refresh }) }),
  me: () => apiFetch<unknown>("/auth/me/"),
  users: () => apiFetch<unknown[]>("/auth/users/"),
  invite: (data: unknown) =>
    apiFetch<unknown>("/auth/invite/", { method: "POST", body: JSON.stringify(data) }),
  permissions: () => apiFetch<unknown[]>("/auth/iam/permissions/"),
  updatePermissions: (data: unknown) =>
    apiFetch<unknown>("/auth/iam/permissions/", { method: "PUT", body: JSON.stringify(data) }),
};

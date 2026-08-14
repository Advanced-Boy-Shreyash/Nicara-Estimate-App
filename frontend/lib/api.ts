// ── NICARA Project OS — Django REST Framework API Layer ──────
//
// Talks to the Django backend at NEXT_PUBLIC_API_URL (default
// http://localhost:8000/api). Access tokens are short lived; when one expires
// this layer transparently redeems the refresh token and replays the request.

import type {
  BookingForm, CatalogMaterial, CatalogMeta, CatalogRoom, CatalogZone, Client,
  CrmMeta, CrmNote, Deliverable, DeliverableType, DesignRequirement, Estimate,
  EstimateItem, EstimateListItem, EstimateType, Furniture, FurniturePart, Item,
  ItemCategory, ItemMeta, Lead, LeadPipeline, MaterialOption, ModuleRegistry,
  MyPermissions, PartMaterial, PermissionMatrixRow, Project, ProjectListItem,
  ProjectMeta, Vendor, VendorMeta,
} from "@/lib/apiTypes";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

const ACCESS_KEY = "nicara_token";
const REFRESH_KEY = "nicara_refresh";
const USER_KEY = "nicara_user";

/* ── Error type ──────────────────────────────────────────────
   Every backend error arrives as { detail, errors?, code? }
   (see Backend/nicara/exceptions.py). */

/**
 * Trigger a browser download for an endpoint that returns a file.
 *
 * Uses fetch + a blob URL rather than a plain link because the download
 * endpoints need the Authorization header.
 */
export async function downloadFile(endpoint: string, fallbackName: string): Promise<void> {
  const token = tokenStore.access();
  const response = await fetch(`${BASE_URL}${endpoint}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  if (!response.ok) throw await parseError(response);

  // Prefer the server's filename from Content-Disposition.
  const disposition = response.headers.get("Content-Disposition") || "";
  const match = disposition.match(/filename="?([^"]+)"?/);
  const filename = match?.[1] || fallbackName;

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Revoke on the next tick so the click has definitely been handled.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

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

/**
 * Multipart POST/PATCH for file uploads.
 *
 * Deliberately does not set Content-Type — the browser must add the multipart
 * boundary itself.
 */
async function apiUpload<T>(
  endpoint: string,
  form: FormData,
  method: "POST" | "PATCH" = "POST"
): Promise<T> {
  const send = (token: string | null) =>
    fetch(`${BASE_URL}${endpoint}`, {
      method,
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form,
    });

  let response: Response;
  try {
    response = await send(tokenStore.access());
  } catch {
    throw new ApiError("Cannot reach the server. Is the Django backend running?", 0);
  }

  if (response.status === 401 && tokenStore.refresh()) {
    const fresh = await refreshAccessToken();
    if (fresh) {
      response = await send(fresh);
    } else {
      tokenStore.clear();
      onSessionExpired?.();
    }
  }

  if (!response.ok) throw await parseError(response);
  return response.json() as Promise<T>;
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
    return apiFetch<Paginated<ProjectListItem>>(`/projects/${qs ? `?${qs}` : ""}`);
  },
  get: (id: number) => apiFetch<Project>(`/projects/${id}/`),
  create: (data: Partial<Project>) =>
    apiFetch<Project>("/projects/", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  /** Client Details tab saves here. */
  update: (id: number, data: Partial<Project>) =>
    apiFetch<Project>(`/projects/${id}/`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  delete: (id: number) =>
    apiFetch<void>(`/projects/${id}/`, { method: "DELETE" }),
  dashboard: () =>
    apiFetch<{
      total_projects: number;
      stage_counts: Record<string, number>;
      total_budget: number;
      total_paid: number;
      total_pending: number;
      overdue_payments: number;
    }>("/projects/dashboard/"),
  /** Stages, property types, estimate statuses, payment modes. */
  meta: () => apiFetch<ProjectMeta>("/projects/meta/"),
};

// ── Initial Engagement: Design Requirements ───────────────────

export type DesignRequirementInput = Omit<DesignRequirement, "id" | "sort_order">;

export const designRequirementsApi = {
  list: (projectId: number) =>
    apiFetch<Paginated<DesignRequirement>>(`/projects/${projectId}/design-requirements/`),
  create: (projectId: number, data: Partial<DesignRequirementInput>) =>
    apiFetch<DesignRequirement>(`/projects/${projectId}/design-requirements/`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  /** Replace the whole grid in one call. */
  saveAll: (projectId: number, rows: Partial<DesignRequirementInput>[]) =>
    apiFetch<DesignRequirement[]>(`/projects/${projectId}/design-requirements/bulk/`, {
      method: "PUT",
      body: JSON.stringify({ rows }),
    }),
  update: (projectId: number, id: number, data: Partial<DesignRequirementInput>) =>
    apiFetch<DesignRequirement>(`/projects/${projectId}/design-requirements/${id}/`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  delete: (projectId: number, id: number) =>
    apiFetch<void>(`/projects/${projectId}/design-requirements/${id}/`, { method: "DELETE" }),
};

// ── Initial Engagement: Deliverables (FL, Mood Board, 3D, …) ──

export const deliverablesApi = {
  list: (projectId: number, type?: DeliverableType) =>
    apiFetch<Paginated<Deliverable>>(
      `/projects/${projectId}/deliverables/${type ? `?type=${type}` : ""}`
    ),
  create: (projectId: number, data: Partial<Deliverable>) =>
    apiFetch<Deliverable>(`/projects/${projectId}/deliverables/`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  /**
   * Create a version with a file attached. Sent as multipart; the server
   * stores the original and generates thumbnail + preview derivatives.
   */
  upload: (projectId: number, form: FormData) =>
    apiUpload<Deliverable>(`/projects/${projectId}/deliverables/`, form),
  uploadTo: (projectId: number, id: number, form: FormData) =>
    apiUpload<Deliverable>(`/projects/${projectId}/deliverables/${id}/`, form, "PATCH"),
  update: (projectId: number, id: number, data: Partial<Deliverable>) =>
    apiFetch<Deliverable>(`/projects/${projectId}/deliverables/${id}/`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  delete: (projectId: number, id: number) =>
    apiFetch<void>(`/projects/${projectId}/deliverables/${id}/`, { method: "DELETE" }),

  // Approval workflow
  submit: (projectId: number, id: number) =>
    apiFetch<Deliverable>(`/projects/${projectId}/deliverables/${id}/submit/`, {
      method: "POST",
    }),
  approve: (projectId: number, id: number, remarks = "") =>
    apiFetch<Deliverable>(`/projects/${projectId}/deliverables/${id}/approve/`, {
      method: "POST",
      body: JSON.stringify({ remarks }),
    }),
  requestRevision: (projectId: number, id: number, remarks: string) =>
    apiFetch<Deliverable>(`/projects/${projectId}/deliverables/${id}/request-revision/`, {
      method: "POST",
      body: JSON.stringify({ remarks }),
    }),
};

// ── IAM ───────────────────────────────────────────────────────

export const iamApi = {
  /** Module registry + role templates for rendering the matrix. */
  modules: () => apiFetch<ModuleRegistry>("/auth/iam/modules/"),
  /** The signed-in user's own map — used to filter the nav. */
  mine: () => apiFetch<MyPermissions>("/auth/iam/my-permissions/"),
  matrix: () => apiFetch<PermissionMatrixRow[]>("/auth/iam/permissions/"),
  save: (permissions: { user_id: string; page_id: string; level: string }[]) =>
    apiFetch<{ detail: string }>("/auth/iam/permissions/", {
      method: "PUT",
      body: JSON.stringify({ permissions }),
    }),
  applyTemplate: (userId: number, role: string) =>
    apiFetch<{ detail: string; permissions: Record<string, string> }>(
      "/auth/iam/apply-template/",
      { method: "POST", body: JSON.stringify({ user_id: userId, role }) }
    ),
};

// ── CRM: Leads & Clients ──────────────────────────────────────

export const leadsApi = {
  list: (params: { stage?: string; search?: string } = {}) => {
    const query = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v) as [string, string][]
    );
    query.set("page_size", "200");
    return apiFetch<Paginated<Lead>>(`/crm/leads/?${query.toString()}`);
  },
  get: (id: number) => apiFetch<Lead>(`/crm/leads/${id}/`),
  create: (data: Partial<Lead>) =>
    apiFetch<Lead>("/crm/leads/", { method: "POST", body: JSON.stringify(data) }),
  update: (id: number, data: Partial<Lead>) =>
    apiFetch<Lead>(`/crm/leads/${id}/`, { method: "PATCH", body: JSON.stringify(data) }),
  pipeline: () => apiFetch<LeadPipeline>("/crm/leads/pipeline/"),
  notes: (id: number) => apiFetch<Paginated<CrmNote>>(`/crm/leads/${id}/notes/`),
  addNote: (id: number, data: { kind: string; body: string; follow_up_on?: string | null }) =>
    apiFetch<CrmNote>(`/crm/leads/${id}/notes/`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  /** Won lead → Client + Project. */
  convert: (id: number, data: { project_name?: string; existing_client_id?: number } = {}) =>
    apiFetch<{ detail: string; project_id: number; client_id: number | null; lead: Lead }>(
      `/crm/leads/${id}/convert/`,
      { method: "POST", body: JSON.stringify(data) }
    ),
};

export const clientsApi = {
  list: (search = "") =>
    apiFetch<Paginated<Client>>(
      `/crm/clients/?page_size=200${search ? `&search=${encodeURIComponent(search)}` : ""}`
    ),
  get: (id: number) => apiFetch<Client>(`/crm/clients/${id}/`),
  create: (data: Partial<Client>) =>
    apiFetch<Client>("/crm/clients/", { method: "POST", body: JSON.stringify(data) }),
  update: (id: number, data: Partial<Client>) =>
    apiFetch<Client>(`/crm/clients/${id}/`, { method: "PATCH", body: JSON.stringify(data) }),
  delete: (id: number) => apiFetch<void>(`/crm/clients/${id}/`, { method: "DELETE" }),
  addNote: (id: number, data: { kind: string; body: string }) =>
    apiFetch<CrmNote>(`/crm/clients/${id}/notes/`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
};

export const crmApi = {
  meta: () => apiFetch<CrmMeta>("/crm/meta/"),
};

// ── Catalogue: Rooms → Furniture → Materials ──────────────────

export const catalogApi = {
  meta: () => apiFetch<CatalogMeta>("/catalog/meta/"),

  // Rooms
  rooms: () => apiFetch<Paginated<CatalogRoom>>("/catalog/rooms/?page_size=200"),
  createRoom: (data: Partial<CatalogRoom>) =>
    apiFetch<CatalogRoom>("/catalog/rooms/", { method: "POST", body: JSON.stringify(data) }),
  updateRoom: (id: number, data: Partial<CatalogRoom>) =>
    apiFetch<CatalogRoom>(`/catalog/rooms/${id}/`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteRoom: (id: number) => apiFetch<void>(`/catalog/rooms/${id}/`, { method: "DELETE" }),

  // Zones
  zones: () => apiFetch<Paginated<CatalogZone>>("/catalog/zones/?page_size=200"),
  createZone: (data: Partial<CatalogZone>) =>
    apiFetch<CatalogZone>("/catalog/zones/", { method: "POST", body: JSON.stringify(data) }),
  updateZone: (id: number, data: Partial<CatalogZone>) =>
    apiFetch<CatalogZone>(`/catalog/zones/${id}/`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteZone: (id: number) => apiFetch<void>(`/catalog/zones/${id}/`, { method: "DELETE" }),

  // Materials + their priced options
  materials: (withOptions = false) =>
    apiFetch<Paginated<CatalogMaterial>>(
      `/catalog/materials/?page_size=200${withOptions ? "&with_options=1" : ""}`
    ),
  material: (id: number) => apiFetch<CatalogMaterial>(`/catalog/materials/${id}/`),
  createMaterial: (data: Partial<CatalogMaterial>) =>
    apiFetch<CatalogMaterial>("/catalog/materials/", { method: "POST", body: JSON.stringify(data) }),
  updateMaterial: (id: number, data: Partial<CatalogMaterial>) =>
    apiFetch<CatalogMaterial>(`/catalog/materials/${id}/`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteMaterial: (id: number) => apiFetch<void>(`/catalog/materials/${id}/`, { method: "DELETE" }),

  options: (materialId: number) =>
    apiFetch<Paginated<MaterialOption>>(`/catalog/materials/${materialId}/options/?page_size=200`),
  createOption: (materialId: number, data: Partial<MaterialOption>) =>
    apiFetch<MaterialOption>(`/catalog/materials/${materialId}/options/`, {
      method: "POST", body: JSON.stringify(data),
    }),
  updateOption: (materialId: number, id: number, data: Partial<MaterialOption>) =>
    apiFetch<MaterialOption>(`/catalog/materials/${materialId}/options/${id}/`, {
      method: "PATCH", body: JSON.stringify(data),
    }),
  deleteOption: (materialId: number, id: number) =>
    apiFetch<void>(`/catalog/materials/${materialId}/options/${id}/`, { method: "DELETE" }),

  // Furniture → parts → part-materials
  furniture: (roomId?: number) =>
    apiFetch<Paginated<Furniture>>(
      `/catalog/furniture/?page_size=200${roomId ? `&room=${roomId}` : ""}`
    ),
  furnitureDetail: (id: number) => apiFetch<Furniture>(`/catalog/furniture/${id}/`),
  createFurniture: (data: Partial<Furniture>) =>
    apiFetch<Furniture>("/catalog/furniture/", { method: "POST", body: JSON.stringify(data) }),
  updateFurniture: (id: number, data: Partial<Furniture>) =>
    apiFetch<Furniture>(`/catalog/furniture/${id}/`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteFurniture: (id: number) => apiFetch<void>(`/catalog/furniture/${id}/`, { method: "DELETE" }),

  createPart: (furnitureId: number, data: Partial<FurniturePart>) =>
    apiFetch<FurniturePart>(`/catalog/furniture/${furnitureId}/parts/`, {
      method: "POST", body: JSON.stringify(data),
    }),
  updatePart: (id: number, data: Partial<FurniturePart>) =>
    apiFetch<FurniturePart>(`/catalog/furniture/parts/${id}/`, {
      method: "PATCH", body: JSON.stringify(data),
    }),
  deletePart: (id: number) => apiFetch<void>(`/catalog/furniture/parts/${id}/`, { method: "DELETE" }),

  addPartMaterial: (partId: number, data: Partial<PartMaterial>) =>
    apiFetch<PartMaterial>(`/catalog/furniture/parts/${partId}/materials/`, {
      method: "POST", body: JSON.stringify(data),
    }),
  updatePartMaterial: (id: number, data: Partial<PartMaterial>) =>
    apiFetch<PartMaterial>(`/catalog/furniture/part-materials/${id}/`, {
      method: "PATCH", body: JSON.stringify(data),
    }),
  deletePartMaterial: (id: number) =>
    apiFetch<void>(`/catalog/furniture/part-materials/${id}/`, { method: "DELETE" }),
};

// ── Estimates ─────────────────────────────────────────────────

export type EstimateItemInput = Partial<
  Pick<EstimateItem, "area" | "item" | "description" | "length" | "breadth" |
       "height" | "unit" | "remarks"> & { qty: number | string; rate: number | string; gst_pct: number | string }
>;

export const estimatesApi = {
  list: (projectId: number, type?: EstimateType) =>
    apiFetch<Paginated<EstimateListItem>>(
      `/projects/${projectId}/estimates/${type ? `?type=${type}` : ""}`
    ),
  get: (projectId: number, estimateId: number) =>
    apiFetch<Estimate>(`/projects/${projectId}/estimates/${estimateId}/`),
  create: (projectId: number, data: { type: EstimateType; title?: string }) =>
    apiFetch<Estimate>(`/projects/${projectId}/estimates/`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  update: (projectId: number, estimateId: number, data: Partial<Estimate>) =>
    apiFetch<Estimate>(`/projects/${projectId}/estimates/${estimateId}/`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  // Workflow
  send: (projectId: number, estimateId: number) =>
    apiFetch<Estimate>(`/projects/${projectId}/estimates/${estimateId}/send/`, { method: "POST" }),
  approve: (projectId: number, estimateId: number, clientRemarks = "") =>
    apiFetch<Estimate>(`/projects/${projectId}/estimates/${estimateId}/approve/`, {
      method: "POST",
      body: JSON.stringify({ client_remarks: clientRemarks }),
    }),
  requestRevision: (projectId: number, estimateId: number, clientRemarks: string) =>
    apiFetch<Estimate>(`/projects/${projectId}/estimates/${estimateId}/request-revision/`, {
      method: "POST",
      body: JSON.stringify({ client_remarks: clientRemarks }),
    }),
  /** Copy into a new draft — a revision, or initial → final. */
  duplicate: (projectId: number, estimateId: number, type?: EstimateType) =>
    apiFetch<Estimate>(`/projects/${projectId}/estimates/${estimateId}/duplicate/`, {
      method: "POST",
      body: JSON.stringify(type ? { type } : {}),
    }),

  // Downloads — rendered server-side so every copy is identical.
  downloadPdf: (projectId: number, estimateId: number) =>
    downloadFile(`/projects/${projectId}/estimates/${estimateId}/pdf/`, "estimate.pdf"),
  downloadExcel: (projectId: number, estimateId: number) =>
    downloadFile(`/projects/${projectId}/estimates/${estimateId}/excel/`, "estimate.xlsx"),

  // Line items
  items: (projectId: number, estimateId: number) =>
    apiFetch<Paginated<EstimateItem>>(`/projects/${projectId}/estimates/${estimateId}/items/`),
  addItem: (projectId: number, estimateId: number, data: EstimateItemInput) =>
    apiFetch<EstimateItem>(`/projects/${projectId}/estimates/${estimateId}/items/`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  /** Push catalogue items onto the estimate; defaults come from the Item. */
  addFromCatalog: (
    projectId: number,
    estimateId: number,
    items: ({ item_id: number } & EstimateItemInput)[]
  ) =>
    apiFetch<{ detail: string; items: EstimateItem[]; estimate: Estimate }>(
      `/projects/${projectId}/estimates/${estimateId}/items/add-from-catalog/`,
      { method: "POST", body: JSON.stringify({ items }) }
    ),
  updateItem: (projectId: number, estimateId: number, itemId: number, data: EstimateItemInput) =>
    apiFetch<EstimateItem>(`/projects/${projectId}/estimates/${estimateId}/items/${itemId}/`, {
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
  /** Throws ApiError with status 404 until a booking form has been created. */
  get: (projectId: number) => apiFetch<BookingForm>(`/projects/${projectId}/booking-form/`),
  create: (projectId: number, data: Partial<BookingForm> = {}) =>
    apiFetch<BookingForm>(`/projects/${projectId}/booking-form/`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  update: (projectId: number, data: Partial<BookingForm>) =>
    apiFetch<BookingForm>(`/projects/${projectId}/booking-form/`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  downloadPdf: (projectId: number) =>
    downloadFile(`/projects/${projectId}/booking-form/pdf/`, "booking-form.pdf"),
};

// ── Items catalogue ───────────────────────────────────────────

export type ItemInput = Partial<Omit<Item, "id" | "code" | "category_name" | "category_icon" | "unit_display">>;

export const itemsApi = {
  list: (params: { category?: number; search?: string; room?: string } = {}) => {
    const query = new URLSearchParams();
    if (params.category) query.set("category", String(params.category));
    if (params.search) query.set("search", params.search);
    if (params.room) query.set("default_room", params.room);
    query.set("page_size", "200"); // the catalogue is small; fetch it in one go
    return apiFetch<Paginated<Item>>(`/items/?${query.toString()}`);
  },
  get: (id: number) => apiFetch<Item>(`/items/${id}/`),
  create: (data: ItemInput) =>
    apiFetch<Item>("/items/", { method: "POST", body: JSON.stringify(data) }),
  update: (id: number, data: ItemInput) =>
    apiFetch<Item>(`/items/${id}/`, { method: "PATCH", body: JSON.stringify(data) }),
  delete: (id: number) => apiFetch<void>(`/items/${id}/`, { method: "DELETE" }),

  categories: () => apiFetch<Paginated<ItemCategory>>("/items/categories/"),
  createCategory: (data: Partial<ItemCategory>) =>
    apiFetch<ItemCategory>("/items/categories/", { method: "POST", body: JSON.stringify(data) }),

  /** Bill of materials for an item — drives future rate build-up. */
  components: (itemId: number) => apiFetch<Paginated<unknown>>(`/items/${itemId}/components/`),
  addComponent: (itemId: number, data: unknown) =>
    apiFetch<unknown>(`/items/${itemId}/components/`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  /** Units, calc methods, rooms and categories for the item form. */
  meta: () => apiFetch<ItemMeta>("/items/meta/"),
};

// ── Vendors: Material Suppliers & Contractors ─────────────────

export type VendorInput = Partial<
  Omit<Vendor, "id" | "code" | "type_display" | "trade_display" | "payment_terms_display">
>;

export const vendorsApi = {
  suppliers: (search = "") =>
    apiFetch<Paginated<Vendor>>(
      `/vendors/suppliers/?page_size=200${search ? `&search=${encodeURIComponent(search)}` : ""}`
    ),
  contractors: (search = "") =>
    apiFetch<Paginated<Vendor>>(
      `/vendors/contractors/?page_size=200${search ? `&search=${encodeURIComponent(search)}` : ""}`
    ),
  get: (id: number) => apiFetch<Vendor>(`/vendors/${id}/`),
  createSupplier: (data: VendorInput) =>
    apiFetch<Vendor>("/vendors/suppliers/", { method: "POST", body: JSON.stringify(data) }),
  createContractor: (data: VendorInput) =>
    apiFetch<Vendor>("/vendors/contractors/", { method: "POST", body: JSON.stringify(data) }),
  update: (id: number, data: VendorInput) =>
    apiFetch<Vendor>(`/vendors/${id}/`, { method: "PATCH", body: JSON.stringify(data) }),
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
  meta: () => apiFetch<VendorMeta>("/vendors/meta/"),
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

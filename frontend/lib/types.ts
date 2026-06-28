// ── NICARA Project OS — TypeScript Interfaces ───────────────

// ── Color & Theme ─────────────────────────────────────────────
export interface ColorPalette {
  gold: string;
  dark: string;
  cream: string;
  light: string;
  teal: string;
  blue: string;
  blueBd: string;
  blueTx: string;
  purple: string;
  green: string;
  red: string;
}

// ── Roles ─────────────────────────────────────────────────────
export type RoleId = "admin" | "designer" | "client" | "supervisor";

export interface RoleConfig {
  label: string;
  icon: string;
  color: string;
  bg: string;
  tabs: string[];
  sidebarFull: boolean;
}

// ── Projects ──────────────────────────────────────────────────
export interface Project {
  id: number;
  name: string;
  type: string;
  area: string;
  status: string;
  progress: number;
  location: string;
  city: string;
  role: RoleId;
}

// ── Estimate Items ────────────────────────────────────────────
export interface EstimateItem {
  si: number;
  area: string;
  item: string;
  w: string;
  wi: string;
  h: string;
  hi: string;
  d: string;
  di: string;
  amount: number;
}

export interface PaymentSchedule {
  no: number;
  mode: string;
  stage: string;
  amount: number;
}

// ── Vendors / Clients / Designers ─────────────────────────────
export interface ServiceVendor {
  name: string;
  cat: string;
  contact: string;
  phone: string;
  projects: number;
  rating: string;
}

export interface ProductVendor {
  name: string;
  cat: string;
  contact: string;
  phone: string;
  lead: string;
  rating: string;
}

export interface Client {
  name: string;
  email: string;
  phone: string;
  project: string;
  status: string;
  budget: string;
}

export interface Designer {
  name: string;
  role: string;
  spec: string;
  projs: number;
  email: string;
}

// ── Tabs ──────────────────────────────────────────────────────
export interface TabDef {
  id: string;
  label: string;
}

// ── Detail Breakdown Rows ─────────────────────────────────────
export interface DetailRow {
  type: string;
  spec: string;
  brand: string;
  model: string;
  qty: number | string;
  unit: string;
  price: number;
  cost: number;
  gst: number;
  total: number;
}

// ── Estimate Table Rows ───────────────────────────────────────
export interface EstimateTableRow {
  id: number;
  si: number;
  area: string;
  category: string;
  subcat: string;
  item: string;
  finish: string;
  vendorType: string;
  factorySite: string;
  length: string;
  width: string;
  height: string;
  depth: string;
  qty: string;
  unit: string;
  budgetNote: string;
  amtEx: number;
  gstPct: number;
  summaryCategory: string;
  customItem?: string;
}

export interface FinalEstimateRow extends EstimateTableRow {
  vendorCode: string;
  vendorName: string;
  rateEx: number;
  payStage: string;
  dueDate: string;
  paidDate: string;
  bank: string;
  expected: number;
  actual: number;
}

// ── Versions (Furniture Layout / Mood Board) ──────────────────
export interface LayoutVersion {
  id: string;
  label: string;
  date: string;
  uploadedBy?: string;
  file: string;
  notes: string;
  status: "pending" | "approved" | "denied";
  comment: string;
}

// ── Client Requirements Form ──────────────────────────────────
export interface ClientFormData {
  clientId: string;
  name: string;
  phone: string;
  email: string;
  developer: string;
  project: string;
  unit: string;
  superArea: string;
  carpetArea: string;
  budget: string;
  startDate: string;
  endDate: string;
  city: string;
  purpose: string;
  use: string;
  type: string;
  style: string;
  notes: string;
  floorPlanFile?: string;
}

export interface RoomData {
  selected: boolean;
  req: string;
}

// ── Interior Styles ───────────────────────────────────────────
export interface InteriorStyle {
  id: string;
  name: string;
  emoji: string;
  desc: string;
  palette: string[];
  keywords: string[];
  img: string;
}

// ── Email Templates ───────────────────────────────────────────
export interface EmailTemplate {
  label?: string;
  subject: string;
  body: string;
}

// ── Procurement ───────────────────────────────────────────────
export interface ProcurementRow {
  id: string;
  cat: string;
  material: string;
  brand: string;
  model: string;
  qty: number;
  unit: string;
  price: number;
  vendor: string;
  status: string;
}

export interface ProcurementCategory {
  cat: string;
  items: string[];
}

// ── Itemized Dues ─────────────────────────────────────────────
export interface ItemizedRow {
  id: number;
  si: number;
  area: string;
  category: string;
  subcat: string;
  item: string;
  vendor: string;
  amtEx: number;
  gstPct: number;
  payStage: string;
  dueDate: string;
  paidDate: string;
  bank: string;
}

// ── Service Tab ───────────────────────────────────────────────
export interface ServiceRow {
  id: string;
  siNo: number;
  area: string;
  item: string;
  type: string;
  spec: string;
  qty: number;
  unit: string;
  rate: number;
  cost: number;
}

// ── PO Orders ─────────────────────────────────────────────────
export interface POOrder {
  id: string;
  poId: string;
  title: string;
  vendor: string;
  date: string;
  status: string;
  type: "procurement" | "service";
  rows: Array<Record<string, unknown>>;
}

// ── Material Option Selectors ─────────────────────────────────
export interface PlywoodOption {
  label: string;
  brand: string;
  model: string;
  thick: string;
  price: number;
  perUnit: string;
}

export interface HardwareOption {
  label: string;
  brand: string;
  model: string;
}

export interface KitchenAccOption {
  label: string;
  brand: string;
  model: string;
  total: number;
}

export interface FinishOption {
  label: string;
  brand: string;
  finish: string;
  pricePerSheet: number;
}

// ── Django REST Framework API Types ───────────────────────────
export interface ApiResponse<T> {
  data: T;
  status: number;
  message?: string;
}

export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface ApiError {
  detail: string;
  code?: string;
  field_errors?: Record<string, string[]>;
}

// ── Data Table ────────────────────────────────────────────────
export interface DataColumn {
  key: string;
  label: string;
  bold?: boolean;
}

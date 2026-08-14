/**
 * Shapes returned by the Django REST API.
 *
 * Field names are snake_case because that is exactly what the backend sends —
 * no mapping layer, so what you read here is what you see in the network tab.
 */

/* ── Shared ──────────────────────────────────────────────────── */

export interface Choice {
  value: string;
  label: string;
}

export type ProjectStage = "lead" | "design" | "execution" | "completed";
export type EstimateType = "initial" | "intermediate" | "final";
export type EstimateStatus = "draft" | "sent" | "approved" | "revision";
export type DeliverableType =
  | "furniture_layout" | "mood_board" | "model_3d"
  | "render" | "final_render" | "working_drawing";
export type DeliverableStatus = "draft" | "pending" | "approved" | "revision";
export type BookingStatus = "draft" | "sent" | "signed" | "cancelled";

/* ── Projects ────────────────────────────────────────────────── */

export interface ProjectListItem {
  id: number;
  name: string;
  client_name: string;
  client_phone: string;
  developer: string;
  unit_no: string;
  city: string;
  state: string;
  area: string;
  property_type: string;
  project_type: string;
  purpose: string;
  interior_style: string;
  stage: ProjectStage;
  progress: number;
  budget: string | null;
  start_date: string | null;
  target_date: string | null;
  design_owner_name: string;
  site_manager_name: string;
  created_at: string;
}

export interface EstimateSummary {
  id: number;
  type: EstimateType;
  version: number;
  status: EstimateStatus;
  item_count: number;
  total: number;
}

export interface Project extends ProjectListItem {
  client_email: string;
  client_address: string;
  pincode: string;
  notes?: string;
  design_requirements: DesignRequirement[];
  deliverables: Deliverable[];
  measurements: Measurement[];
  material_selections: MaterialSelection[];
  execution_stages: ExecutionStage[];
  payment_milestones: PaymentMilestone[];
  quality_checks: QualityCheck[];
  booking_form: BookingForm | null;
  estimates_summary: EstimateSummary[];
}

/* ── Design & Execution phase records ────────────────────────── */

export interface Measurement {
  id: number;
  room: string;
  plan_verified: boolean;
  east: string;
  west: string;
  north: string;
  south: string;
  other_details: string;
  proof_checked_by: string;
  status: "complete" | "pending" | "issue";
}

export interface MaterialSelection {
  id: number;
  category: string;
  room: string;
  wall_area: string;
  price_range: string;
  supplier_name: string;
  brand_name: string;
  catalog: string;
  item_code: string;
  supplier_price: string;
  availability: string;
}

export interface ExecutionStage {
  id: number;
  name: string;
  vendor: string;
  start_date: string | null;
  end_date: string | null;
  status: "upcoming" | "in-progress" | "completed" | "delayed";
  progress: number;
  payment: string;
  payment_status: "pending" | "partial" | "paid";
  sort_order: number;
}

export interface PaymentMilestone {
  id: number;
  milestone: string;
  amount: string;
  due_date: string;
  paid_date: string | null;
  status: "pending" | "partial" | "paid" | "overdue";
  mode: string;
  reference: string;
}

export interface QualityCheck {
  id: number;
  area: string;
  check_type: string;
  date: string;
  inspector: string;
  status: "pending" | "pass" | "fail";
  remarks: string;
}

export interface ProjectMeta {
  stages: Choice[];
  property_types: Choice[];
  project_types: Choice[];
  purposes: Choice[];
  estimate_types: Choice[];
  estimate_statuses: Choice[];
  deliverable_types: Choice[];
  booking_statuses: Choice[];
  payment_modes: Choice[];
}

/* ── Initial Engagement ──────────────────────────────────────── */

export interface DesignRequirement {
  id: number;
  room: string;
  unit: string;
  length: string;
  breadth: string;
  height: string;
  finishing: string;
  remarks: string;
  design_required: boolean;
  sort_order: number;
}

export interface Deliverable {
  id: number;
  type: DeliverableType;
  type_display: string;
  /** Machine-readable order within its type. */
  version_no: number;
  /** Human label — "Ver 2". */
  version: string;
  /** The live version for this type — the one shown to the client. */
  is_current: boolean;
  supersedes: number | null;
  file: string | null;
  file_url: string | null;
  file_name: string;
  file_size: number;
  file_size_display: string;
  /** 400px derivative for grids; null for non-images. */
  thumbnail_url: string | null;
  /** 1600px derivative for the lightbox. */
  preview_url: string | null;
  status: DeliverableStatus;
  status_display: string;
  remarks: string;
  submitted_at: string | null;
  submitted_by_name: string;
  reviewed_at: string | null;
  reviewed_by_name: string;
  review_remarks: string;
  uploaded_by_name: string;
  date: string;
  created_at: string;
}

/** One row of a line item's material breakdown (bill of materials). */
export interface EstimateItemComponent {
  id: number;
  estimate_item: number;
  sno: number;
  basic_component: string;
  detail: string;
  brand: string;
  model: string;
  qty: string;
  unit: string;
  price: string;
  amount: string;
  catalog_material: number | null;
  catalog_option: number | null;
}

export interface EstimateItem {
  id: number;
  catalog_item: number | null;
  catalog_item_code: string | null;
  sno: number;
  area: string;
  zone: string;
  finishing: string;
  category: string;
  subcategory: string;
  item: string;
  description: string;
  length: string;
  breadth: string;
  height: string;
  qty: string;
  unit: string;
  rate: string;
  amount: string;
  gst_pct: string;
  gst_amount: string;
  total_with_gst: string;
  remarks: string;
  /** The material breakdown; when present, `amount` is its sum. */
  components: EstimateItemComponent[];
  has_components: boolean;
}

export interface Estimate {
  id: number;
  project: number;
  type: EstimateType;
  type_display: string;
  version: number;
  status: EstimateStatus;
  status_display: string;
  title: string;
  notes: string;
  discount_pct: string;
  discount_amount: string;
  valid_until: string | null;
  items: EstimateItem[];
  item_count: number;
  subtotal: string;
  total_discount: string;
  taxable_amount: string;
  gst_total: string;
  grand_total: string;
  sent_at: string | null;
  sent_by_name: string;
  approved_at: string | null;
  approved_by_name: string;
  client_remarks: string;
  created_at: string;
}

/** The lighter row returned when listing estimates. */
export interface EstimateListItem {
  id: number;
  type: EstimateType;
  type_display: string;
  version: number;
  status: EstimateStatus;
  status_display: string;
  title: string;
  item_count: number;
  total: number;
  valid_until: string | null;
  created_at: string;
}

export interface BookingForm {
  id: number;
  booking_number: string;
  booking_date: string;
  estimate: number | null;
  total_value: string;
  advance_amount: string;
  advance_received: boolean;
  advance_received_on: string | null;
  payment_mode: string;
  payment_reference: string;
  payment_link: string;
  status: BookingStatus;
  status_display: string;
  terms_accepted: boolean;
  signed_by_name: string;
  signed_at: string | null;
  scope_summary: string;
  terms: string;
  notes: string;
  balance_due: string;
  client_name: string;
  client_phone: string;
  client_email: string;
  project_name: string;
  developer: string;
  unit_no: string;
}

/* ── Items catalogue ─────────────────────────────────────────── */

export interface ItemCategory {
  id: number;
  name: string;
  code: string;
  icon: string;
  description: string;
  sort_order: number;
  is_active: boolean;
  item_count: number;
}

export interface Item {
  id: number;
  code: string;
  name: string;
  category: number;
  category_name: string;
  category_icon: string;
  description: string;
  default_room: string;
  unit: string;
  unit_display: string;
  calc_method: string;
  default_length: string;
  default_breadth: string;
  default_height: string;
  default_qty: string;
  default_rate: string;
  min_rate: string;
  max_rate: string;
  gst_pct: string;
  margin_pct: string;
  is_active: boolean;
}

export interface ItemMeta {
  units: Choice[];
  calc_methods: Choice[];
  component_types: Choice[];
  rooms: string[];
  categories: ItemCategory[];
  counts: { items: number; categories: number };
}

/* ── IAM ─────────────────────────────────────────────────────── */

export type PermissionLevel = "none" | "view" | "edit" | "full";

export interface ModuleEntry {
  id: string;
  label: string;
  icon: string;
}

export interface ModuleGroup {
  group: string;
  modules: ModuleEntry[];
}

export interface ModuleRegistry {
  groups: ModuleGroup[];
  levels: Choice[];
  role_templates: Record<string, Record<string, PermissionLevel>>;
}

export interface MyPermissions {
  is_admin: boolean;
  /** Admin, or explicitly granted full access to the `iam` module. */
  can_manage_iam: boolean;
  permissions: Record<string, PermissionLevel>;
}

export interface PermissionMatrixRow {
  user: {
    id: number;
    email: string;
    full_name: string;
    role: string;
    is_active: boolean;
  };
  permissions: Record<string, PermissionLevel>;
  is_admin: boolean;
}

/* ── CRM: Leads & Clients ────────────────────────────────────── */

export interface CrmNote {
  id: number;
  lead: number | null;
  client: number | null;
  kind: string;
  kind_display: string;
  body: string;
  follow_up_on: string | null;
  created_by_name: string;
  created_at: string;
}

export interface Lead {
  id: number;
  code: string;
  name: string;
  email: string;
  phone: string;
  project_name: string;
  developer: string;
  unit_no?: string;
  city: string;
  state?: string;
  property_type: string;
  area: string;
  requirement?: string;
  estimated_budget: string | null;
  stage: string;
  stage_display: string;
  source: string;
  source_display: string;
  priority: string;
  owner: number | null;
  owner_name: string;
  next_follow_up: string | null;
  lost_reason?: string;
  converted_client?: number | null;
  converted_project: number | null;
  converted_at?: string | null;
  notes?: CrmNote[];
  is_open?: boolean;
  created_at: string;
}

export interface LeadPipeline {
  stages: (Choice & { count: number })[];
  open: number;
  won: number;
  lost: number;
}

export interface Client {
  id: number;
  code: string;
  name: string;
  client_type: string;
  type_display: string;
  company_name: string;
  email: string;
  phone: string;
  alt_phone?: string;
  address?: string;
  city: string;
  state: string;
  pincode?: string;
  gst_number: string;
  pan_number?: string;
  notes?: string;
  is_active: boolean;
  project_count: number;
  projects?: { id: number; name: string; stage: string; progress: number }[];
  crm_notes?: CrmNote[];
  created_at: string;
}

export interface CrmMeta {
  lead_stages: Choice[];
  lead_sources: Choice[];
  priorities: Choice[];
  client_types: Choice[];
  note_kinds: Choice[];
  counts: { open_leads: number; clients: number };
}

/* ── Catalogue (Rooms → Furniture → Materials) ───────────────── */

export interface CatalogRoom {
  id: number;
  code: string;
  name: string;
  icon: string;
  description: string;
  sort_order: number;
  is_active: boolean;
  furniture_count: number;
}

export interface CatalogZone {
  id: number;
  code: string;
  name: string;
  sort_order: number;
  is_active: boolean;
}

export interface MaterialOption {
  id: number;
  material: number;
  material_name?: string;
  detail: string;
  brand: string;
  model_no: string;
  size: string;
  price: string;
  unit: string;
  notes?: string;
  library_item?: number | null;
  label: string;
  sort_order: number;
  is_active: boolean;
}

export interface CatalogMaterial {
  id: number;
  code: string;
  name: string;
  default_unit: string;
  icon: string;
  option_count: number;
  price_from?: number | null;
  options?: MaterialOption[];
  sort_order: number;
  is_active: boolean;
}

export interface PartMaterial {
  id: number;
  part: number;
  material: number;
  material_name: string;
  default_option: number | null;
  option_label: string;
  qty_per_unit: string;
  unit: string;
  wastage_pct: string;
  unit_price: string;
  line_cost: string;
  notes: string;
  sort_order: number;
}

export interface FurniturePart {
  id: number;
  furniture: number;
  name: string;
  notes: string;
  materials: PartMaterial[];
  material_cost: string;
  sort_order: number;
  is_active: boolean;
}

export interface Furniture {
  id: number;
  code: string;
  name: string;
  description: string;
  rooms: number[];
  room_names: string[];
  default_unit: string;
  default_length?: string;
  default_breadth?: string;
  default_height?: string;
  base_rate: string;
  gst_pct: string;
  margin_pct: string;
  part_count: number;
  parts?: FurniturePart[];
  material_cost?: string;
  suggested_rate?: string;
  sort_order: number;
  is_active: boolean;
}

export interface CatalogMeta {
  units: Choice[];
  counts: {
    rooms: number;
    zones: number;
    furniture: number;
    materials: number;
    options: number;
  };
}

/* ── Vendors ─────────────────────────────────────────────────── */

export type VendorType = "material_supplier" | "contractor";

export interface Vendor {
  id: number;
  code: string;
  name: string;
  vendor_type: VendorType;
  type_display: string;
  legal_name?: string;
  contact_person: string;
  phone: string;
  alt_phone?: string;
  email: string;
  website?: string;
  address?: string;
  city: string;
  state: string;
  pincode?: string;
  gst_number: string;
  pan_number?: string;
  bank_name?: string;
  bank_account_name?: string;
  bank_account_number?: string;
  bank_ifsc?: string;
  upi_id?: string;
  payment_terms: string;
  payment_terms_display: string;
  credit_days: number;
  advance_pct?: string;
  brands_supplied: string;
  lead_time_days: number;
  min_order_value: string;
  delivers_on_site?: boolean;
  trade: string;
  trade_display: string;
  specialization?: string;
  team_size: number;
  labour_rate_per_day: string;
  rating: string;
  is_preferred: boolean;
  is_active: boolean;
  notes?: string;
}

export interface VendorMeta {
  vendor_types: Choice[];
  trades: Choice[];
  payment_terms: Choice[];
  document_types: Choice[];
  counts: { suppliers: number; contractors: number };
}

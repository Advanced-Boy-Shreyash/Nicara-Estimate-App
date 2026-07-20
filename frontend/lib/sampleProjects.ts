/**
 * NICARA Sample Project Data
 * Two complete projects with data for every tab/phase
 */

// ── Project Stages ──
export type ProjectStage = "lead" | "design" | "execution";

export interface FullProject {
  id: number;
  name: string;
  stage: ProjectStage;
  clientName: string;
  clientPhone: string;
  clientEmail: string;
  clientAddress: string;
  developer: string;
  unitNo: string;
  city: string;
  state: string;
  pincode: string;
  type: string;           // Residential / Commercial
  purpose: string;        // Self / Rental
  interiorStyle: string;
  area: string;
  projectType: string;    // 3BHK, 4BHK Villa etc.
  designOwner: string;
  siteManager: string;
  startDate: string;
  targetDate: string;
  progress: number;
  status: string;
  budget: string;
  designRequirements: DesignReqRow[];
  furnitureLayouts: VersionEntry[];
  moodBoards: VersionEntry[];
  initialEstimate: EstimateRow[];
  measurements: MeasurementRoom[];
  models3d: VersionEntry[];
  intermediateEstimate: EstimateRow[];
  renders: VersionEntry[];
  materialSelections: MaterialSelectionCategory[];
  finalEstimate: EstimateRow[];
  finalRenders: VersionEntry[];
  workingDrawings: VersionEntry[];
  executionStages: ExecutionStage[];
  paymentSchedule: PaymentEntry[];
  qualityChecks: QualityCheck[];
}

export interface DesignReqRow {
  id: number;
  room: string;
  unit: string;
  l: string;
  b: string;
  h: string;
  finishing: string;
  remarks: string;
  designRequired: boolean;
}

export interface VersionEntry {
  id: number;
  date: string;
  version: string;
  fileName: string;
  uploadedBy: string;
  status: "approved" | "pending" | "revision";
  remarks: string;
}

export interface EstimateRow {
  id: number;
  sno: number;
  area: string;
  item: string;
  description: string;
  l: string;
  b: string;
  h: string;
  qty: number;
  unit: string;
  rate: number;
  amount: number;
  gstPct: number;
}

export interface MeasurementRoom {
  id: number;
  room: string;
  plan: string;
  east: string;
  west: string;
  north: string;
  south: string;
  other: string;
  proofCheckedBy: string;
  status: "complete" | "pending" | "issue";
}

export interface MaterialSelectionCategory {
  category: string;
  items: MaterialSelectionItem[];
}

export interface MaterialSelectionItem {
  id: number;
  room: string;
  wall: string;
  priceRange: string;
  supplierName: string;
  brandName: string;
  catalog: string;
  itemCode: string;
  supplierPrice: number;
  availability: "In Stock" | "2-3 weeks" | "4-6 weeks" | "Order";
}

export interface ExecutionStage {
  id: number;
  name: string;
  vendor: string;
  startDate: string;
  endDate: string;
  status: "completed" | "in-progress" | "upcoming" | "delayed";
  progress: number;
  payment: number;
  paymentStatus: "paid" | "partial" | "pending";
}

export interface PaymentEntry {
  id: number;
  milestone: string;
  amount: number;
  dueDate: string;
  paidDate: string;
  status: "paid" | "partial" | "pending" | "overdue";
  mode: string;
  reference: string;
}

export interface QualityCheck {
  id: number;
  area: string;
  checkType: string;
  date: string;
  inspector: string;
  status: "pass" | "fail" | "pending";
  remarks: string;
}

// ════════════════════════════════════════════════════════════
// PROJECT 1: Sharma Residence (Design Phase — Intermediate Estimate)
// ════════════════════════════════════════════════════════════

const sharmaDesignReqs: DesignReqRow[] = [
  { id: 1, room: "Master Bedroom", unit: "Wardrobe", l: "8'0\"", b: "2'0\"", h: "8'0\"", finishing: "Laminate", remarks: "Mirror on one shutter", designRequired: true },
  { id: 2, room: "Master Bedroom", unit: "Study Table", l: "4'0\"", b: "1'6\"", h: "2'6\"", finishing: "Veneer", remarks: "With bookshelf above", designRequired: true },
  { id: 3, room: "Master Bedroom", unit: "TV Unit", l: "6'0\"", b: "1'3\"", h: "4'0\"", finishing: "Laminate", remarks: "Wall mounted panel", designRequired: true },
  { id: 4, room: "Master Bedroom", unit: "False Ceiling", l: "14'0\"", b: "12'0\"", h: "-", finishing: "Gypsum", remarks: "Cove lighting", designRequired: true },
  { id: 5, room: "Kids Room", unit: "Wardrobe", l: "6'0\"", b: "2'0\"", h: "8'0\"", finishing: "Laminate", remarks: "Pastel blue color", designRequired: true },
  { id: 6, room: "Kids Room", unit: "Study Table", l: "3'6\"", b: "1'6\"", h: "2'6\"", finishing: "Laminate", remarks: "With pin-up board", designRequired: true },
  { id: 7, room: "Kids Room", unit: "Bed Headboard", l: "5'0\"", b: "0'4\"", h: "4'0\"", finishing: "Upholstery", remarks: "Soft padded", designRequired: false },
  { id: 8, room: "Drawing Room", unit: "TV Unit", l: "8'0\"", b: "1'3\"", h: "1'0\"", finishing: "Veneer", remarks: "Walnut finish", designRequired: true },
  { id: 9, room: "Drawing Room", unit: "Shoe Rack", l: "3'0\"", b: "1'0\"", h: "4'0\"", finishing: "Laminate", remarks: "Near entrance", designRequired: true },
  { id: 10, room: "Drawing Room", unit: "False Ceiling", l: "18'0\"", b: "14'0\"", h: "-", finishing: "Gypsum", remarks: "Peripheral + center piece", designRequired: true },
  { id: 11, room: "Kitchen", unit: "Kitchen Cabinet - Base", l: "10'0\"", b: "2'0\"", h: "2'10\"", finishing: "Acrylic", remarks: "Soft-close hinges", designRequired: true },
  { id: 12, room: "Kitchen", unit: "Kitchen Cabinet - Wall", l: "10'0\"", b: "1'0\"", h: "2'6\"", finishing: "Acrylic", remarks: "Glass shutters for crockery", designRequired: true },
  { id: 13, room: "Kitchen", unit: "Kitchen Tall Unit", l: "2'6\"", b: "2'0\"", h: "7'0\"", finishing: "Acrylic", remarks: "With pull-out baskets", designRequired: true },
  { id: 14, room: "Kitchen", unit: "Loft", l: "10'0\"", b: "1'6\"", h: "1'6\"", finishing: "Laminate", remarks: "Storage above cabinets", designRequired: false },
  { id: 15, room: "Guest Bedroom", unit: "Wardrobe", l: "6'0\"", b: "2'0\"", h: "8'0\"", finishing: "Laminate", remarks: "Simple design", designRequired: true },
  { id: 16, room: "Guest Bedroom", unit: "Dressing Table", l: "3'0\"", b: "1'6\"", h: "5'0\"", finishing: "Veneer", remarks: "With LED mirror", designRequired: true },
];

const sharmaFLVersions: VersionEntry[] = [
  { id: 1, date: "2026-06-18", version: "Ver 1", fileName: "sharma_fl_v1.pdf", uploadedBy: "Nishanth K", status: "revision", remarks: "Kitchen island position needs change" },
  { id: 2, date: "2026-06-25", version: "Ver 2", fileName: "sharma_fl_v2.pdf", uploadedBy: "Nishanth K", status: "approved", remarks: "Final approved layout" },
];

const sharmaMBVersions: VersionEntry[] = [
  { id: 1, date: "2026-06-20", version: "Ver 1", fileName: "sharma_mb_v1.pdf", uploadedBy: "Priya S", status: "revision", remarks: "Client wants warmer tones" },
  { id: 2, date: "2026-06-28", version: "Ver 2", fileName: "sharma_mb_v2.pdf", uploadedBy: "Priya S", status: "approved", remarks: "Final approved mood board" },
];

const sharmaInitialEstimate: EstimateRow[] = [
  { id: 1, sno: 1, area: "Master Bedroom", item: "Wardrobe 8'x2'x8'", description: "16mm BWP ply with laminate finish, mirror on one shutter", l: "8'0\"", b: "2'0\"", h: "8'0\"", qty: 1, unit: "unit", rate: 145000, amount: 145000, gstPct: 18 },
  { id: 2, sno: 2, area: "Master Bedroom", item: "Study Table + Bookshelf", description: "16mm BWP ply with veneer finish", l: "4'0\"", b: "1'6\"", h: "2'6\"", qty: 1, unit: "unit", rate: 42000, amount: 42000, gstPct: 18 },
  { id: 3, sno: 3, area: "Master Bedroom", item: "TV Unit Wall Panel", description: "Wall mounted panel with back-lit groove", l: "6'0\"", b: "1'3\"", h: "4'0\"", qty: 1, unit: "unit", rate: 68000, amount: 68000, gstPct: 18 },
  { id: 4, sno: 4, area: "Master Bedroom", item: "False Ceiling", description: "Gypsum false ceiling with cove LED lighting", l: "14'0\"", b: "12'0\"", h: "-", qty: 168, unit: "sft", rate: 165, amount: 27720, gstPct: 18 },
  { id: 5, sno: 5, area: "Kids Room", item: "Wardrobe 6'x2'x8'", description: "16mm BWP ply with pastel blue laminate", l: "6'0\"", b: "2'0\"", h: "8'0\"", qty: 1, unit: "unit", rate: 115000, amount: 115000, gstPct: 18 },
  { id: 6, sno: 6, area: "Kids Room", item: "Study Table + Pinboard", description: "16mm BWP ply with laminate + soft-board panel", l: "3'6\"", b: "1'6\"", h: "2'6\"", qty: 1, unit: "unit", rate: 35000, amount: 35000, gstPct: 18 },
  { id: 7, sno: 7, area: "Drawing Room", item: "TV Unit Console", description: "Walnut veneer with concealed cable management", l: "8'0\"", b: "1'3\"", h: "1'0\"", qty: 1, unit: "unit", rate: 88000, amount: 88000, gstPct: 18 },
  { id: 8, sno: 8, area: "Drawing Room", item: "Shoe Rack Cabinet", description: "16mm ply with laminate, ventilated design", l: "3'0\"", b: "1'0\"", h: "4'0\"", qty: 1, unit: "unit", rate: 28000, amount: 28000, gstPct: 18 },
  { id: 9, sno: 9, area: "Drawing Room", item: "False Ceiling", description: "Gypsum peripheral + center piece with down-lights", l: "18'0\"", b: "14'0\"", h: "-", qty: 252, unit: "sft", rate: 175, amount: 44100, gstPct: 18 },
  { id: 10, sno: 10, area: "Kitchen", item: "Base Cabinets L-shape", description: "BWR ply with acrylic shutters, soft-close hinges, granite top", l: "10'0\"", b: "2'0\"", h: "2'10\"", qty: 1, unit: "unit", rate: 225000, amount: 225000, gstPct: 18 },
  { id: 11, sno: 11, area: "Kitchen", item: "Wall Cabinets", description: "BWR ply with acrylic + glass shutters", l: "10'0\"", b: "1'0\"", h: "2'6\"", qty: 1, unit: "unit", rate: 135000, amount: 135000, gstPct: 18 },
  { id: 12, sno: 12, area: "Kitchen", item: "Tall Unit with Baskets", description: "BWR ply with pull-out wire baskets", l: "2'6\"", b: "2'0\"", h: "7'0\"", qty: 1, unit: "unit", rate: 85000, amount: 85000, gstPct: 18 },
  { id: 13, sno: 13, area: "Guest Bedroom", item: "Wardrobe 6'x2'x8'", description: "16mm BWP ply with laminate finish", l: "6'0\"", b: "2'0\"", h: "8'0\"", qty: 1, unit: "unit", rate: 105000, amount: 105000, gstPct: 18 },
  { id: 14, sno: 14, area: "Guest Bedroom", item: "Dressing Table + LED Mirror", description: "Veneer finish with integrated LED back-lit mirror", l: "3'0\"", b: "1'6\"", h: "5'0\"", qty: 1, unit: "unit", rate: 45000, amount: 45000, gstPct: 18 },
];

const sharmaMeasurements: MeasurementRoom[] = [
  { id: 1, room: "Master Bedroom", plan: "✓", east: "14'2\"", west: "14'1\"", north: "12'3\"", south: "12'3\"", other: "Window: 5'x4' (N)", proofCheckedBy: "Rahul M", status: "complete" },
  { id: 2, room: "Kids Room", plan: "✓", east: "12'0\"", west: "11'11\"", north: "10'6\"", south: "10'6\"", other: "Window: 4'x4' (E)", proofCheckedBy: "Rahul M", status: "complete" },
  { id: 3, room: "Drawing Room", plan: "✓", east: "18'4\"", west: "18'3\"", north: "14'1\"", south: "14'0\"", other: "Balcony door: 6'x7' (W)", proofCheckedBy: "Nishanth K", status: "complete" },
  { id: 4, room: "Kitchen", plan: "✓", east: "10'2\"", west: "10'1\"", north: "8'6\"", south: "8'6\"", other: "Window: 3'x3' (N), Service door (E)", proofCheckedBy: "Rahul M", status: "complete" },
  { id: 5, room: "Guest Bedroom", plan: "✓", east: "12'0\"", west: "12'1\"", north: "10'0\"", south: "10'0\"", other: "Window: 4'x4' (S)", proofCheckedBy: "—", status: "pending" },
];

const sharma3DModels: VersionEntry[] = [
  { id: 1, date: "2026-07-05", version: "Ver 1", fileName: "sharma_3d_v1_master.jpg", uploadedBy: "Priya S", status: "approved", remarks: "Master Bedroom 3D view" },
  { id: 2, date: "2026-07-05", version: "Ver 1", fileName: "sharma_3d_v1_kitchen.jpg", uploadedBy: "Priya S", status: "approved", remarks: "Kitchen 3D view" },
  { id: 3, date: "2026-07-08", version: "Ver 1", fileName: "sharma_3d_v1_drawing.jpg", uploadedBy: "Priya S", status: "pending", remarks: "Drawing Room 3D view" },
];

const sharmaRenders: VersionEntry[] = [
  { id: 1, date: "2026-07-12", version: "Ver 1", fileName: "sharma_render_master_v1.jpg", uploadedBy: "Priya S", status: "approved", remarks: "Master bedroom render" },
  { id: 2, date: "2026-07-12", version: "Ver 1", fileName: "sharma_render_kitchen_v1.jpg", uploadedBy: "Priya S", status: "pending", remarks: "Kitchen render — awaiting review" },
];

const sharmaMaterialSelections: MaterialSelectionCategory[] = [
  {
    category: "Plywood",
    items: [
      { id: 1, room: "Master Bedroom", wall: "Wardrobe", priceRange: "₹85-95/sft", supplierName: "Raj Timber", brandName: "Austin", catalog: "Lincoln BWP", itemCode: "AUS-LN-16", supplierPrice: 92, availability: "In Stock" },
      { id: 2, room: "Kitchen", wall: "Base Cabinets", priceRange: "₹90-100/sft", supplierName: "Raj Timber", brandName: "Austin", catalog: "Lincoln BWR", itemCode: "AUS-LR-16", supplierPrice: 95, availability: "In Stock" },
    ],
  },
  {
    category: "Laminates",
    items: [
      { id: 3, room: "Master Bedroom", wall: "Wardrobe Shutters", priceRange: "₹1200-1800/sheet", supplierName: "D Decor Hub", brandName: "Greenlam", catalog: "Mikasa Oak", itemCode: "GL-MO-445", supplierPrice: 1450, availability: "In Stock" },
      { id: 4, room: "Kids Room", wall: "Wardrobe", priceRange: "₹1200-1800/sheet", supplierName: "D Decor Hub", brandName: "Greenlam", catalog: "Sky Blue Matte", itemCode: "GL-SB-221", supplierPrice: 1350, availability: "2-3 weeks" },
      { id: 5, room: "Drawing Room", wall: "TV Unit", priceRange: "₹1800-2500/sheet", supplierName: "D Decor Hub", brandName: "Merino", catalog: "Walnut Dark", itemCode: "MR-WD-889", supplierPrice: 2100, availability: "In Stock" },
    ],
  },
  {
    category: "Hardware",
    items: [
      { id: 6, room: "Kitchen", wall: "All Cabinets", priceRange: "₹350-500/pair", supplierName: "Metro Hardware", brandName: "Hettich", catalog: "Sensys 8645i", itemCode: "HT-SC-8645", supplierPrice: 420, availability: "In Stock" },
      { id: 7, room: "All Rooms", wall: "Wardrobes", priceRange: "₹300-450/pair", supplierName: "Metro Hardware", brandName: "Hettich", catalog: "Onsys 0-Crank", itemCode: "HT-ON-110", supplierPrice: 380, availability: "In Stock" },
    ],
  },
  {
    category: "Kitchen Accessories",
    items: [
      { id: 8, room: "Kitchen", wall: "Base Unit", priceRange: "₹3500-5000", supplierName: "Kitchen World", brandName: "Kaff", catalog: "Pull-out Basket Set", itemCode: "KF-PB-600", supplierPrice: 4200, availability: "2-3 weeks" },
      { id: 9, room: "Kitchen", wall: "Corner", priceRange: "₹8000-12000", supplierName: "Kitchen World", brandName: "Kaff", catalog: "Magic Corner", itemCode: "KF-MC-900", supplierPrice: 9500, availability: "4-6 weeks" },
    ],
  },
];

const sharmaPayments: PaymentEntry[] = [
  { id: 1, milestone: "Booking Advance", amount: 50000, dueDate: "2026-06-15", paidDate: "2026-06-15", status: "paid", mode: "NEFT", reference: "NEFT-2026-0615-001" },
  { id: 2, milestone: "Design Phase - P1", amount: 200000, dueDate: "2026-07-01", paidDate: "2026-07-02", status: "paid", mode: "UPI", reference: "UPI-2026-0702-042" },
  { id: 3, milestone: "Intermediate Estimate Approval", amount: 300000, dueDate: "2026-07-20", paidDate: "", status: "pending", mode: "", reference: "" },
  { id: 4, milestone: "Material Procurement", amount: 500000, dueDate: "2026-08-01", paidDate: "", status: "pending", mode: "", reference: "" },
];

// ════════════════════════════════════════════════════════════
// PROJECT 2: Kapoor Villa (Execution Phase — Carpentry)
// ════════════════════════════════════════════════════════════

const kapoorDesignReqs: DesignReqRow[] = [
  { id: 1, room: "Master Bedroom Suite", unit: "Walk-in Wardrobe", l: "10'0\"", b: "6'0\"", h: "9'0\"", finishing: "Veneer", remarks: "Italian walnut", designRequired: true },
  { id: 2, room: "Master Bedroom Suite", unit: "Bed Back Panel", l: "12'0\"", b: "0'6\"", h: "10'0\"", finishing: "Upholstery + Veneer", remarks: "Leather + walnut combo", designRequired: true },
  { id: 3, room: "Master Bedroom Suite", unit: "Dressing Room", l: "8'0\"", b: "4'0\"", h: "9'0\"", finishing: "Veneer", remarks: "With vanity counter", designRequired: true },
  { id: 4, room: "Living Room", unit: "Entertainment Wall", l: "16'0\"", b: "1'6\"", h: "10'0\"", finishing: "Veneer + Stone", remarks: "85\" TV recess + Italian stone", designRequired: true },
  { id: 5, room: "Living Room", unit: "Bar Unit", l: "6'0\"", b: "2'0\"", h: "3'6\"", finishing: "Veneer", remarks: "With wine rack + LED", designRequired: true },
  { id: 6, room: "Living Room", unit: "False Ceiling", l: "24'0\"", b: "18'0\"", h: "-", finishing: "Gypsum + Wood", remarks: "Layered with wood beams", designRequired: true },
  { id: 7, room: "Home Office", unit: "Full Office Setup", l: "12'0\"", b: "10'0\"", h: "9'0\"", finishing: "Veneer", remarks: "L-desk + library wall + seating", designRequired: true },
  { id: 8, room: "Kitchen", unit: "Island Kitchen", l: "14'0\"", b: "10'0\"", h: "3'0\"", finishing: "PU Paint", remarks: "Quartz top, waterfall edge", designRequired: true },
  { id: 9, room: "Kitchen", unit: "Wall Cabinets + Tall Units", l: "14'0\"", b: "1'0\"", h: "4'0\"", finishing: "PU Paint", remarks: "Handle-less push-to-open", designRequired: true },
  { id: 10, room: "Kids Room 1", unit: "Bunk Bed + Wardrobe", l: "8'0\"", b: "4'0\"", h: "9'0\"", finishing: "Laminate", remarks: "Custom bunk with storage steps", designRequired: true },
  { id: 11, room: "Kids Room 2", unit: "Wardrobe + Study", l: "8'0\"", b: "2'0\"", h: "9'0\"", finishing: "Laminate", remarks: "Pastel green theme", designRequired: true },
  { id: 12, room: "Guest Bedroom", unit: "Wardrobe + TV Unit", l: "8'0\"", b: "2'0\"", h: "9'0\"", finishing: "Laminate", remarks: "Minimal elegant", designRequired: true },
  { id: 13, room: "Pooja Room", unit: "Custom Pooja Unit", l: "4'0\"", b: "2'0\"", h: "7'0\"", finishing: "Solid Teak", remarks: "Traditional carved design", designRequired: true },
  { id: 14, room: "Entrance", unit: "Foyer Console + Mirror", l: "5'0\"", b: "1'6\"", h: "3'0\"", finishing: "Veneer + Brass", remarks: "Statement piece with brass inlay", designRequired: true },
];

const kapoorInitialEstimate: EstimateRow[] = [
  { id: 1, sno: 1, area: "Master Bedroom Suite", item: "Walk-in Wardrobe", description: "BWP ply, Italian walnut veneer, brass handles, LED strips", l: "10'0\"", b: "6'0\"", h: "9'0\"", qty: 1, unit: "unit", rate: 485000, amount: 485000, gstPct: 18 },
  { id: 2, sno: 2, area: "Master Bedroom Suite", item: "Bed Back Panel", description: "Veneer + Italian leather upholstery", l: "12'0\"", b: "0'6\"", h: "10'0\"", qty: 1, unit: "unit", rate: 165000, amount: 165000, gstPct: 18 },
  { id: 3, sno: 3, area: "Master Bedroom Suite", item: "Dressing Room", description: "Full vanity with backlit mirror, veneer finish", l: "8'0\"", b: "4'0\"", h: "9'0\"", qty: 1, unit: "unit", rate: 210000, amount: 210000, gstPct: 18 },
  { id: 4, sno: 4, area: "Living Room", item: "Entertainment Wall", description: "Veneer + Italian stone cladding, 85\" TV recess", l: "16'0\"", b: "1'6\"", h: "10'0\"", qty: 1, unit: "unit", rate: 420000, amount: 420000, gstPct: 18 },
  { id: 5, sno: 5, area: "Living Room", item: "Bar Unit", description: "Walnut veneer, wine rack, LED lighting, granite top", l: "6'0\"", b: "2'0\"", h: "3'6\"", qty: 1, unit: "unit", rate: 185000, amount: 185000, gstPct: 18 },
  { id: 6, sno: 6, area: "Living Room", item: "False Ceiling", description: "Gypsum layered + teak wood beams, cove lighting", l: "24'0\"", b: "18'0\"", h: "-", qty: 432, unit: "sft", rate: 250, amount: 108000, gstPct: 18 },
  { id: 7, sno: 7, area: "Home Office", item: "Office Setup", description: "L-desk + floor-to-ceiling library + visitor seating nook", l: "12'0\"", b: "10'0\"", h: "9'0\"", qty: 1, unit: "unit", rate: 320000, amount: 320000, gstPct: 18 },
  { id: 8, sno: 8, area: "Kitchen", item: "Island Kitchen Complete", description: "PU paint, quartz waterfall, Hafele fittings", l: "14'0\"", b: "10'0\"", h: "3'0\"", qty: 1, unit: "unit", rate: 680000, amount: 680000, gstPct: 18 },
  { id: 9, sno: 9, area: "Kitchen", item: "Wall + Tall Units", description: "PU paint, handle-less push-to-open, SS internals", l: "14'0\"", b: "1'0\"", h: "4'0\"", qty: 1, unit: "unit", rate: 310000, amount: 310000, gstPct: 18 },
  { id: 10, sno: 10, area: "Kids Room 1", item: "Custom Bunk + Wardrobe", description: "BWP ply with colourful laminate, storage steps", l: "8'0\"", b: "4'0\"", h: "9'0\"", qty: 1, unit: "unit", rate: 195000, amount: 195000, gstPct: 18 },
  { id: 11, sno: 11, area: "Kids Room 2", item: "Wardrobe + Study Combo", description: "BWP ply, pastel green laminate with open shelves", l: "8'0\"", b: "2'0\"", h: "9'0\"", qty: 1, unit: "unit", rate: 155000, amount: 155000, gstPct: 18 },
  { id: 12, sno: 12, area: "Guest Bedroom", item: "Wardrobe + TV Unit", description: "BWP ply, elegant laminate finish", l: "8'0\"", b: "2'0\"", h: "9'0\"", qty: 1, unit: "unit", rate: 140000, amount: 140000, gstPct: 18 },
  { id: 13, sno: 13, area: "Pooja Room", item: "Custom Pooja Unit", description: "Solid teak wood, traditional carving, brass bell", l: "4'0\"", b: "2'0\"", h: "7'0\"", qty: 1, unit: "unit", rate: 175000, amount: 175000, gstPct: 18 },
  { id: 14, sno: 14, area: "Entrance", item: "Foyer Console + Mirror", description: "Veneer with brass inlay, oval mirror with brass frame", l: "5'0\"", b: "1'6\"", h: "3'0\"", qty: 1, unit: "unit", rate: 95000, amount: 95000, gstPct: 18 },
];

const kapoorExecutionStages: ExecutionStage[] = [
  { id: 1, name: "Floor Protection & House Safety", vendor: "SafeGuard Services", startDate: "2026-06-20", endDate: "2026-06-22", status: "completed", progress: 100, payment: 35000, paymentStatus: "paid" },
  { id: 2, name: "False Ceiling — All Rooms", vendor: "Skyline Interiors", startDate: "2026-06-23", endDate: "2026-07-05", status: "completed", progress: 100, payment: 280000, paymentStatus: "paid" },
  { id: 3, name: "Electrical Work", vendor: "PowerTech Electricals", startDate: "2026-06-25", endDate: "2026-07-10", status: "completed", progress: 100, payment: 185000, paymentStatus: "paid" },
  { id: 4, name: "Carpentry — Master Bedroom", vendor: "Shree Furniture Works", startDate: "2026-07-05", endDate: "2026-07-25", status: "in-progress", progress: 65, payment: 400000, paymentStatus: "partial" },
  { id: 5, name: "Carpentry — Living + Office", vendor: "Shree Furniture Works", startDate: "2026-07-10", endDate: "2026-08-05", status: "in-progress", progress: 35, payment: 500000, paymentStatus: "partial" },
  { id: 6, name: "Carpentry — Kitchen", vendor: "Shree Furniture Works", startDate: "2026-07-15", endDate: "2026-08-15", status: "in-progress", progress: 20, payment: 600000, paymentStatus: "pending" },
  { id: 7, name: "Carpentry — Kids + Guest", vendor: "Shree Furniture Works", startDate: "2026-07-20", endDate: "2026-08-10", status: "upcoming", progress: 0, payment: 350000, paymentStatus: "pending" },
  { id: 8, name: "Glass & Mirror Work", vendor: "Crystal Glass Works", startDate: "2026-08-10", endDate: "2026-08-20", status: "upcoming", progress: 0, payment: 120000, paymentStatus: "pending" },
  { id: 9, name: "Painting — All Areas", vendor: "ColorPro Painters", startDate: "2026-08-15", endDate: "2026-09-01", status: "upcoming", progress: 0, payment: 165000, paymentStatus: "pending" },
  { id: 10, name: "Final Cleanup & Handover", vendor: "CleanPro Services", startDate: "2026-09-01", endDate: "2026-09-05", status: "upcoming", progress: 0, payment: 25000, paymentStatus: "pending" },
];

const kapoorPayments: PaymentEntry[] = [
  { id: 1, milestone: "Booking Advance", amount: 200000, dueDate: "2026-05-15", paidDate: "2026-05-15", status: "paid", mode: "NEFT", reference: "NEFT-2026-0515-KV01" },
  { id: 2, milestone: "Design Approval - P1", amount: 500000, dueDate: "2026-06-01", paidDate: "2026-06-02", status: "paid", mode: "NEFT", reference: "NEFT-2026-0602-KV02" },
  { id: 3, milestone: "Material Procurement - P2", amount: 800000, dueDate: "2026-06-15", paidDate: "2026-06-15", status: "paid", mode: "RTGS", reference: "RTGS-2026-0615-KV03" },
  { id: 4, milestone: "Carpentry Start - P3", amount: 600000, dueDate: "2026-07-01", paidDate: "2026-07-03", status: "paid", mode: "UPI", reference: "UPI-2026-0703-KV04" },
  { id: 5, milestone: "Mid-Execution - P4", amount: 700000, dueDate: "2026-07-20", paidDate: "", status: "overdue", mode: "", reference: "" },
  { id: 6, milestone: "Pre-Handover - P5", amount: 543000, dueDate: "2026-08-25", paidDate: "", status: "pending", mode: "", reference: "" },
];

const kapoorQualityChecks: QualityCheck[] = [
  { id: 1, area: "All Rooms", checkType: "Floor Protection", date: "2026-06-22", inspector: "Anil K", status: "pass", remarks: "All floors properly covered" },
  { id: 2, area: "Living + Master", checkType: "False Ceiling Level", date: "2026-07-05", inspector: "Suresh B", status: "pass", remarks: "Level within tolerance" },
  { id: 3, area: "All Rooms", checkType: "Electrical Points", date: "2026-07-10", inspector: "Suresh B", status: "pass", remarks: "All 87 points verified" },
  { id: 4, area: "Master Bedroom", checkType: "Wardrobe Alignment", date: "2026-07-18", inspector: "Anil K", status: "pass", remarks: "Plumb and level OK" },
  { id: 5, area: "Kitchen", checkType: "Cabinet Fitment", date: "2026-07-20", inspector: "Anil K", status: "pending", remarks: "Scheduled for next week" },
];

// ════════════════════════════════════════════════════════════
// EXPORT
// ════════════════════════════════════════════════════════════

export const SAMPLE_PROJECTS: FullProject[] = [
  {
    id: 101,
    name: "Sharma Residence",
    stage: "design",
    clientName: "Ms. Anita Sharma",
    clientPhone: "+91 98765 43210",
    clientEmail: "anita.sharma@gmail.com",
    clientAddress: "C-204, Raheja Classique, Andheri West, Mumbai",
    developer: "Prestige Lakeside - Tower B",
    unitNo: "B-1204",
    city: "Mumbai",
    state: "Maharashtra",
    pincode: "400053",
    type: "Residential",
    purpose: "Self",
    interiorStyle: "Contemporary",
    area: "1,850 sqft",
    projectType: "3BHK Apartment",
    designOwner: "Nishanth K",
    siteManager: "Suresh B",
    startDate: "2026-06-10",
    targetDate: "2026-10-30",
    progress: 42,
    status: "Active",
    budget: "₹18,50,000",
    designRequirements: sharmaDesignReqs,
    furnitureLayouts: sharmaFLVersions,
    moodBoards: sharmaMBVersions,
    initialEstimate: sharmaInitialEstimate,
    measurements: sharmaMeasurements,
    models3d: sharma3DModels,
    intermediateEstimate: sharmaInitialEstimate.map(e => ({ ...e, rate: Math.round(e.rate * 1.05), amount: Math.round(e.amount * 1.05) })),
    renders: sharmaRenders,
    materialSelections: sharmaMaterialSelections,
    finalEstimate: [],
    finalRenders: [],
    workingDrawings: [],
    executionStages: [],
    paymentSchedule: sharmaPayments,
    qualityChecks: [],
  },
  {
    id: 102,
    name: "Kapoor Villa",
    stage: "execution",
    clientName: "Mr. Rajesh Kapoor",
    clientPhone: "+91 99001 22334",
    clientEmail: "rajesh.kapoor@kapoorgroup.com",
    clientAddress: "14, Windmere Estate, Whitefield, Bangalore",
    developer: "DLF Pinnacle - Phase 2",
    unitNo: "Villa 14",
    city: "Bangalore",
    state: "Karnataka",
    pincode: "560066",
    type: "Residential",
    purpose: "Self",
    interiorStyle: "Modern Luxury",
    area: "4,200 sqft",
    projectType: "4BHK Independent Villa",
    designOwner: "Priya S",
    siteManager: "Anil K",
    startDate: "2026-05-01",
    targetDate: "2026-09-15",
    progress: 58,
    status: "Active",
    budget: "₹46,18,000",
    designRequirements: kapoorDesignReqs,
    furnitureLayouts: [
      { id: 1, date: "2026-05-12", version: "Ver 1", fileName: "kapoor_fl_v1.pdf", uploadedBy: "Priya S", status: "revision", remarks: "Bar unit repositioned" },
      { id: 2, date: "2026-05-18", version: "Ver 2", fileName: "kapoor_fl_v2.pdf", uploadedBy: "Priya S", status: "approved", remarks: "Final layout" },
    ],
    moodBoards: [
      { id: 1, date: "2026-05-15", version: "Ver 1", fileName: "kapoor_mb_v1.pdf", uploadedBy: "Priya S", status: "approved", remarks: "Modern luxury theme" },
    ],
    initialEstimate: kapoorInitialEstimate,
    measurements: [
      { id: 1, room: "Master Bedroom Suite", plan: "✓", east: "22'4\"", west: "22'3\"", north: "16'1\"", south: "16'0\"", other: "French windows (S)", proofCheckedBy: "Anil K", status: "complete" },
      { id: 2, room: "Living Room", plan: "✓", east: "24'6\"", west: "24'5\"", north: "18'2\"", south: "18'1\"", other: "Double height (N wall)", proofCheckedBy: "Anil K", status: "complete" },
      { id: 3, room: "Home Office", plan: "✓", east: "12'3\"", west: "12'2\"", north: "10'1\"", south: "10'0\"", other: "Bay window (E)", proofCheckedBy: "Anil K", status: "complete" },
      { id: 4, room: "Kitchen", plan: "✓", east: "14'2\"", west: "14'1\"", north: "10'6\"", south: "10'5\"", other: "Utility door (N)", proofCheckedBy: "Suresh B", status: "complete" },
      { id: 5, room: "Kids Room 1", plan: "✓", east: "14'0\"", west: "13'11\"", north: "12'1\"", south: "12'0\"", other: "Window (W)", proofCheckedBy: "Suresh B", status: "complete" },
      { id: 6, room: "Kids Room 2", plan: "✓", east: "12'0\"", west: "12'1\"", north: "11'0\"", south: "11'0\"", other: "Window (E)", proofCheckedBy: "Suresh B", status: "complete" },
    ],
    models3d: [
      { id: 1, date: "2026-05-28", version: "Ver 1", fileName: "kapoor_3d_v1.jpg", uploadedBy: "Priya S", status: "approved", remarks: "All rooms 3D model" },
      { id: 2, date: "2026-06-02", version: "Ver 2", fileName: "kapoor_3d_v2.jpg", uploadedBy: "Priya S", status: "approved", remarks: "Updated kitchen island" },
    ],
    intermediateEstimate: kapoorInitialEstimate.map(e => ({ ...e, rate: Math.round(e.rate * 1.03), amount: Math.round(e.amount * 1.03) })),
    renders: [
      { id: 1, date: "2026-06-08", version: "Ver 1", fileName: "kapoor_render_all_v1.zip", uploadedBy: "Priya S", status: "approved", remarks: "All room renders approved" },
    ],
    materialSelections: sharmaMaterialSelections.map(c => ({
      ...c,
      items: c.items.map(i => ({ ...i, supplierPrice: Math.round(i.supplierPrice * 1.15) }))
    })),
    finalEstimate: kapoorInitialEstimate.map(e => ({ ...e, rate: Math.round(e.rate * 1.08), amount: Math.round(e.amount * 1.08) })),
    finalRenders: [
      { id: 1, date: "2026-06-15", version: "Final", fileName: "kapoor_final_renders.zip", uploadedBy: "Priya S", status: "approved", remarks: "Final approved" },
    ],
    workingDrawings: [
      { id: 1, date: "2026-06-18", version: "Ver 1", fileName: "kapoor_wd_set.dwg", uploadedBy: "Rahul M", status: "approved", remarks: "Complete working drawing set" },
    ],
    executionStages: kapoorExecutionStages,
    paymentSchedule: kapoorPayments,
    qualityChecks: kapoorQualityChecks,
  },
];

// Helper
export function getProjectTotals(items: EstimateRow[]) {
  const subtotal = items.reduce((s, i) => s + i.amount, 0);
  const gst = items.reduce((s, i) => s + (i.amount * i.gstPct / 100), 0);
  return { subtotal, gst, total: subtotal + gst, count: items.length };
}

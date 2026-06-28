// ── NICARA Project OS — All Constants & Data ────────────────
import type {
  InteriorStyle,
  EstimateItem,
  PaymentSchedule,
  ServiceVendor,
  ProductVendor,
  Client,
  Designer,
  Project,
  TabDef,
  EmailTemplate,
  EstimateTableRow,
  FinalEstimateRow,
  DetailRow,
  ProcurementCategory,
  ProcurementRow,
  ItemizedRow,
  ServiceRow,
  POOrder,
  PlywoodOption,
  HardwareOption,
  KitchenAccOption,
  FinishOption,
  RoleConfig,
  RoleId,
} from "./types";
import { fmt } from "./utils";

// ── Role Configuration ────────────────────────────────────────
export const ROLE_CONFIG: Record<RoleId, RoleConfig> = {
  admin: {
    label: "Admin", icon: "👑", color: "#7B4FA6", bg: "#F5F0FF",
    tabs: ["clientreq", "furniture", "moodboard", "initial", "design", "final", "pm", "handover", "dashboard"],
    sidebarFull: true,
  },
  designer: {
    label: "Designer", icon: "✏️", color: "#1E40AF", bg: "#EFF6FF",
    tabs: ["clientreq", "furniture", "moodboard", "initial", "design"],
    sidebarFull: false,
  },
  client: {
    label: "Client", icon: "👤", color: "#C9A96E", bg: "#FFF8EC",
    tabs: ["clientreq"],
    sidebarFull: false,
  },
  supervisor: {
    label: "Site Supervisor", icon: "🏗", color: "#059669", bg: "#F0FDF4",
    tabs: ["final", "design", "pm"],
    sidebarFull: false,
  },
};

// ── Status Colors ─────────────────────────────────────────────
export const STATUS_COLORS: Record<string, string> = {
  Design: "#C9A96E",
  Execution: "#7CB9A8",
  Handover: "#A8C5DA",
  "Initial Estimate": "#D4A5A5",
  Active: "#7CB9A8",
};

// ── Tabs ──────────────────────────────────────────────────────
export const TABS: TabDef[] = [
  { id: "clientreq", label: "Client Requirements" },
  { id: "furniture", label: "Furniture Layout" },
  { id: "moodboard", label: "Mood Board" },
  { id: "initial", label: "Initial Estimate" },
  { id: "design", label: "Design" },
  { id: "final", label: "Final Estimate" },
  { id: "pm", label: "Project Management" },
  { id: "handover", label: "Handover" },
  { id: "dashboard", label: "Dashboard" },
];

// ── Projects ──────────────────────────────────────────────────
export const PROJECTS: Project[] = [
  { id: 1, name: "Sharma Residence", type: "3BHK Apartment", area: "1850 sqft", status: "Design", progress: 45, location: "Bandra, Mumbai", city: "Mumbai", role: "admin" },
  { id: 2, name: "Kapoor Villa", type: "Independent Villa", area: "4200 sqft", status: "Execution", progress: 72, location: "Juhu, Mumbai", city: "Mumbai", role: "designer" },
  { id: 3, name: "Mehta Office", type: "Commercial", area: "2100 sqft", status: "Handover", progress: 95, location: "BKC, Mumbai", city: "Mumbai", role: "client" },
  { id: 4, name: "Patel Home", type: "2BHK Apartment", area: "1100 sqft", status: "Initial Estimate", progress: 18, location: "Powai, Mumbai", city: "Mumbai", role: "supervisor" },
  { id: 5, name: "Singh Penthouse", type: "Penthouse", area: "3200 sqft", status: "Design", progress: 30, location: "Worli, Mumbai", city: "Mumbai", role: "admin" },
];

// ── Estimate Items ────────────────────────────────────────────
export const ESTIMATE_ITEMS: EstimateItem[] = [
  { si: 1, area: "Design", item: "Design", w: "", wi: "", h: "", hi: "", d: "", di: "", amount: 69606 },
  { si: 2, area: "Drawing", item: "West Wall Beadings", w: "-", wi: "-", h: "-", hi: "-", d: "-", di: "-", amount: 8124 },
  { si: 3, area: "Drawing", item: "East Wall TV Unit with ledge", w: "8", wi: "0", h: "1", hi: "0", d: "1", di: "3", amount: 116799 },
  { si: 4, area: "Suite 3", item: "Wardrobe", w: "8", wi: "0", h: "8", hi: "0", d: "2", di: "0", amount: 249989 },
  { si: 5, area: "Suite 3", item: "Study & Dressing ledge with Mirror", w: "12", wi: "0", h: "0", hi: "1", d: "1", di: "3", amount: 82342 },
  { si: 6, area: "Suite 3", item: "Bed back panel (Punning)", w: "-", wi: "-", h: "-", hi: "-", d: "-", di: "-", amount: 8220 },
  { si: 7, area: "Suite 1", item: "Wardrobe", w: "8", wi: "0", h: "8", hi: "0", d: "2", di: "0", amount: 267982 },
  { si: 8, area: "Suite 1", item: "TV Console", w: "4", wi: "6", h: "0", hi: "10", d: "1", di: "3", amount: 39706 },
  { si: 9, area: "Suite 1", item: "Bookshelf", w: "2", wi: "6", h: "6", hi: "6", d: "1", di: "3", amount: 80590 },
  { si: 10, area: "Suite 1", item: "Dressing with Mirror", w: "2", wi: "0", h: "0", hi: "10", d: "1", di: "3", amount: 35747 },
  { si: 11, area: "Suite 1", item: "Bed back Wall", w: "12", wi: "9", h: "9", hi: "0", d: "-", di: "-", amount: 24373 },
  { si: 12, area: "Master Bedroom", item: "Bed back Wall", w: "4", wi: "6", h: "6", hi: "0", d: "-", di: "-", amount: 8124 },
  { si: 13, area: "Master Bedroom", item: "Wardrobe", w: "9", wi: "0", h: "9", hi: "0", d: "2", di: "0", amount: 294259 },
  { si: 14, area: "Master Bedroom", item: "Walk-in Closet Wardrobe with Loft", w: "6", wi: "0", h: "9", hi: "0", d: "2", di: "0", amount: 157930 },
  { si: 15, area: "Master Bedroom", item: "Dressing with Mirror", w: "2", wi: "0", h: "0", hi: "10", d: "1", di: "3", amount: 35747 },
  { si: 16, area: "Master Bedroom", item: "WIC Profile Bifold Door", w: "4", wi: "0", h: "8", hi: "0", d: "0", di: "1", amount: 112147 },
  { si: 17, area: "Master Bedroom", item: "TV Console", w: "4", wi: "6", h: "0", hi: "10", d: "1", di: "3", amount: 39706 },
  { si: 18, area: "Suite 2", item: "Wardrobe", w: "8", wi: "0", h: "8", hi: "0", d: "2", di: "0", amount: 267982 },
  { si: 19, area: "Suite 2", item: "Study and Dressing ledge", w: "8", wi: "0", h: "0", hi: "1", d: "1", di: "3", amount: 20008 },
  { si: 20, area: "Suite 2", item: "Bookshelf", w: "2", wi: "6", h: "6", hi: "6", d: "1", di: "3", amount: 80590 },
  { si: 21, area: "Suite 2", item: "Walk-in Closet with Loft Extension", w: "6", wi: "0", h: "9", hi: "0", d: "2", di: "0", amount: 160351 },
  { si: 22, area: "Suite 2", item: "Dressing with Mirror", w: "2", wi: "0", h: "0", hi: "10", d: "1", di: "3", amount: 35747 },
  { si: 23, area: "Suite 2", item: "WIC Profile Bifold Door", w: "4", wi: "0", h: "8", hi: "0", d: "0", di: "1", amount: 0 },
  { si: 24, area: "Suite 2", item: "Bed back Wall", w: "12", wi: "0", h: "9", hi: "0", d: "-", di: "-", amount: 34122 },
  { si: 25, area: "Living", item: "Crockery Unit", w: "7", wi: "0", h: "9", hi: "0", d: "1", di: "6", amount: 314012 },
  { si: 26, area: "Living 2", item: "Beading Patti and Wallpaper", w: "-", wi: "-", h: "-", hi: "-", d: "-", di: "-", amount: 15611 },
  { si: 27, area: "Living 2", item: "TV Console Unit", w: "8", wi: "0", h: "1", hi: "6", d: "1", di: "3", amount: 49733 },
  { si: 28, area: "Pooja Wall", item: "Arches", w: "4", wi: "6", h: "7", hi: "6", d: "0", di: "3", amount: 115477 },
  { si: 29, area: "Pooja", item: "Pooja Unit", w: "4", wi: "6", h: "3", hi: "0", d: "1", di: "3", amount: 110964 },
  { si: 30, area: "Pooja", item: "Pooja Doors", w: "4", wi: "6", h: "7", hi: "0", d: "0", di: "2", amount: 59785 },
  { si: 31, area: "Kitchen", item: "Base Wall and Loft", w: "26", wi: "6", h: "2", hi: "9", d: "2", di: "0", amount: 921471 },
  { si: 32, area: "False Ceiling", item: "False Ceiling", w: "-", wi: "-", h: "-", hi: "-", d: "-", di: "-", amount: 95580 },
  { si: 33, area: "Electrical", item: "Electrical Works", w: "-", wi: "-", h: "-", hi: "-", d: "-", di: "-", amount: 107528 },
  { si: 34, area: "Wooden Ceiling", item: "Wooden False Ceiling", w: "-", wi: "-", h: "-", hi: "-", d: "-", di: "-", amount: 57603 },
  { si: 35, area: "Lights", item: "Lights", w: "-", wi: "-", h: "-", hi: "-", d: "-", di: "-", amount: 95182 },
  { si: 36, area: "Painting", item: "Ceiling — Plain", w: "-", wi: "-", h: "-", hi: "-", d: "-", di: "-", amount: 114696 },
  { si: 37, area: "Painting", item: "Walls Plain", w: "-", wi: "-", h: "-", hi: "-", d: "-", di: "-", amount: 71685 },
  { si: 38, area: "Site Mgmt", item: "Site Management", w: "-", wi: "-", h: "-", hi: "-", d: "-", di: "-", amount: 49560 },
  { si: 39, area: "Transport", item: "Transport & Hamali", w: "-", wi: "-", h: "-", hi: "-", d: "-", di: "-", amount: 63720 },
  { si: 40, area: "Debris", item: "Debris Management", w: "-", wi: "-", h: "-", hi: "-", d: "-", di: "-", amount: 35400 },
  { si: 41, area: "Cleaning", item: "Deep Cleaning", w: "-", wi: "-", h: "-", hi: "-", d: "-", di: "-", amount: 28320 },
  { si: 42, area: "Washrooms", item: "Glass Partitions", w: "-", wi: "-", h: "-", hi: "-", d: "-", di: "-", amount: 81774 },
];

export const TOTAL = ESTIMATE_ITEMS.reduce((s, i) => s + i.amount, 0);

// ── Payment Schedule ──────────────────────────────────────────
export const PAY_SCHED: PaymentSchedule[] = [
  { no: 1, mode: "Bank", stage: "P1", amount: 70000 },
  { no: 2, mode: "Cash", stage: "P1", amount: 900000 },
  { no: 3, mode: "Bank", stage: "P2", amount: 1600000 },
  { no: 4, mode: "Cash", stage: "P2", amount: 1000000 },
  { no: 5, mode: "Bank", stage: "P3", amount: 1000000 },
  { no: 6, mode: "Cash", stage: "P3", amount: 48293 },
];

// ── Vendors ───────────────────────────────────────────────────
export const SERVICE_VENDORS: ServiceVendor[] = [
  { name: "Kumar Carpentry", cat: "Carpentry", contact: "Vijay Kumar", phone: "98200 44444", projects: 15, rating: "★★★★★" },
  { name: "Bright Electricals", cat: "Electrical", contact: "Ramesh Kumar", phone: "98200 11111", projects: 8, rating: "★★★★★" },
  { name: "Apex Ceiling", cat: "False Ceiling", contact: "Suresh Nair", phone: "98200 22222", projects: 12, rating: "★★★★★" },
  { name: "FreshCoat Painters", cat: "Painting", contact: "Ali Hassan", phone: "98200 33333", projects: 6, rating: "★★★★☆" },
];

export const PRODUCT_VENDORS: ProductVendor[] = [
  { name: "Austin Lincoln", cat: "Plywood (BWP)", contact: "Sales", phone: "98200 66666", lead: "3 days", rating: "★★★★★" },
  { name: "Greenlam Industries", cat: "Laminates", contact: "Sales", phone: "98200 77777", lead: "7 days", rating: "★★★★★" },
  { name: "Hettich India", cat: "Hardware", contact: "Dealer", phone: "98200 88888", lead: "5 days", rating: "★★★★★" },
  { name: "Alt Lights", cat: "Lighting", contact: "Design", phone: "98200 99999", lead: "10 days", rating: "★★★★☆" },
];

// ── Clients ───────────────────────────────────────────────────
export const CLIENTS: Client[] = [
  { name: "Ms X", email: "client@email.com", phone: "—", project: "ABC Homes D2704", status: "Active", budget: fmt(TOTAL) },
  { name: "Rajesh Sharma", email: "rajesh@gmail.com", phone: "98100 11111", project: "Sharma Residence", status: "Active", budget: "₹21L" },
  { name: "Priya Kapoor", email: "priya@gmail.com", phone: "98100 22222", project: "Kapoor Villa", status: "Active", budget: "₹38L" },
];

// ── Designers ─────────────────────────────────────────────────
export const DESIGNERS: Designer[] = [
  { name: "Ananya Rao", role: "Lead Designer", spec: "Contemporary", projs: 24, email: "ananya@nicara.in" },
  { name: "Karan Mehta", role: "Senior Designer", spec: "Japandi", projs: 18, email: "karan@nicara.in" },
  { name: "Dev Pillai", role: "3D Visualiser", spec: "Renders", projs: 31, email: "dev@nicara.in" },
];

// ── Rooms ─────────────────────────────────────────────────────
export const DEFAULT_ROOMS = [
  "Foyer", "Living Room", "Dining Room", "Kitchen", "Master Bedroom",
  "Bedroom 2", "Bedroom 3", "Master Bathroom", "Common Bathroom",
  "Balcony", "Study", "Pooja Room", "Kids Room", "Utility",
  "Bar Unit", "Home Theatre",
];

// ── Email Templates ───────────────────────────────────────────
export const WELCOME_EMAIL: EmailTemplate = {
  subject: "Welcome to NICARA — Your Design Journey Begins",
  body: "Hi [Client Name],\n\nThank you for reaching out to NICARA.\n\nEvery space holds a certain energy — a story waiting to be shaped.\nWe see this as the beginning of something special.\n\nTo start, we invite you to a complimentary design & execution consultation.\n\nAs part of this experience, we will create:\n• A furniture layout\n• A mood board\n• An initial estimate\n\nWarmly,\nTeam NICARA",
};

export const PAYMENT_REQUEST_EMAIL: EmailTemplate = {
  subject: "Payment Request — NICARA Project",
  body: "Hi [Client Name],\n\nAs per our project schedule, we would like to request the next payment milestone.\n\nPayment Details:\n• Stage: [Stage Name]\n• Amount: [Amount]\n• Mode: Bank Transfer / Cash\n\nKindly process the payment at your earliest convenience.\n\nWarmly,\nTeam NICARA",
};

export const PAYMENT_ACK_EMAIL: EmailTemplate = {
  subject: "Payment Received — Thank You | NICARA",
  body: "Hi [Client Name],\n\nWe are delighted to confirm that we have received your payment. Thank you!\n\nPayment Summary:\n• Stage: [Stage Name]\n• Amount Received: [Amount]\n• Date: [Date]\n\nWith warm regards,\nTeam NICARA",
};

export const DESIGN_SIGNOFF_EMAIL: EmailTemplate = {
  subject: "Design Sign-Off Request — [Project Name] | NICARA",
  body: "Hi [Client Name],\n\nWe are excited to share that your design is ready for sign-off!\n\nWhat's included:\n• Furniture layout plans\n• 3D visualisations\n• Material selections\n• Lighting and ceiling design\n\nWarmly,\nTeam NICARA",
};

export const SHARE_DESIGNS_EMAIL: EmailTemplate = {
  subject: "Your Design Presentation — [Project Name] | NICARA",
  body: "Hi [Client Name],\n\nIt is our pleasure to share the design presentation for your project.\n\nAttached you will find:\n• Furniture layout\n• Mood board\n• 3D renders\n• Preliminary estimate\n\nWarmly,\nTeam NICARA",
};

export const PROJECT_COMPLETION_EMAIL: EmailTemplate = {
  subject: "Your Home is Ready — Project Completion | NICARA",
  body: "Hi [Client Name],\n\nWe are thrilled to announce that your project is now complete!\n\nHandover Package:\n• Warranty cards\n• Vendor contact list\n• Care and maintenance guide\n• As-built drawings\n\nThank you for trusting NICARA.\n\nWith warm regards,\nTeam NICARA",
};

// ── Interior Styles ───────────────────────────────────────────
export const INTERIOR_STYLES: InteriorStyle[] = [
  { id: "contemporary", name: "Contemporary", emoji: "🏙", desc: "Clean lines, neutral palette, open spaces. Minimal ornamentation — function meets elegance.", palette: ["#E8E0D5", "#3D3530", "#C9A96E", "#7CB9A8", "#FAF8F5"], keywords: ["Minimal", "Open", "Neutral tones", "Functional", "Sleek"], img: "linear-gradient(135deg,#E8E0D5 0%,#C9A96E 40%,#3D3530 100%)" },
  { id: "neoclassical", name: "Neo-Classical", emoji: "🏛", desc: "Symmetry, ornate details, marble textures. Timeless grandeur reinterpreted.", palette: ["#F5F0E8", "#8B7355", "#D4AF6E", "#2C2C2C", "#FFFFFF"], keywords: ["Symmetry", "Ornate", "Marble", "Gold accents", "Grand"], img: "linear-gradient(135deg,#F5F0E8 0%,#D4AF6E 40%,#2C2C2C 100%)" },
  { id: "transitional", name: "Transitional", emoji: "🌿", desc: "Best of traditional and contemporary. Comfortable, classic shapes with updated finishes.", palette: ["#DDD5C8", "#6B5B45", "#C4A882", "#4A4A4A", "#F2EDE5"], keywords: ["Balanced", "Warm", "Classic shapes", "Modern finish", "Versatile"], img: "linear-gradient(135deg,#DDD5C8 0%,#C4A882 40%,#4A4A4A 100%)" },
  { id: "japandi", name: "Japandi", emoji: "🍃", desc: "Japanese minimalism meets Scandinavian hygge. Wabi-sabi textures, natural wood, calm neutrals.", palette: ["#E8E3DA", "#5C4A3A", "#9CAF88", "#D4C4A8", "#2A2A2A"], keywords: ["Zen", "Natural wood", "Wabi-sabi", "Earthy", "Calm"], img: "linear-gradient(135deg,#E8E3DA 0%,#9CAF88 40%,#5C4A3A 100%)" },
  { id: "industrial", name: "Industrial", emoji: "⚙️", desc: "Raw materials, exposed elements, urban edge. Steel, concrete and reclaimed wood.", palette: ["#3A3A3A", "#8B8B8B", "#C4724A", "#D4C4A8", "#1A1A1A"], keywords: ["Raw", "Urban", "Exposed brick", "Metal accents", "Edgy"], img: "linear-gradient(135deg,#3A3A3A 0%,#8B8B8B 40%,#C4724A 100%)" },
  { id: "bohemian", name: "Bohemian", emoji: "🎨", desc: "Layered textures, vibrant patterns, eclectic mix. Artistic, free-spirited, globally inspired.", palette: ["#C4724A", "#6B8E5E", "#D4A843", "#9B6B9B", "#E8D5C0"], keywords: ["Eclectic", "Colourful", "Textured", "Artistic", "Free-spirited"], img: "linear-gradient(135deg,#C4724A 0%,#D4A843 40%,#6B8E5E 100%)" },
  { id: "mediterranean", name: "Mediterranean", emoji: "🌊", desc: "Warm terracottas, mosaic tiles, arched doorways. Sun-soaked, textured and inviting.", palette: ["#C4724A", "#4A7B9D", "#D4C4A8", "#8B6B4A", "#E8E0D0"], keywords: ["Warm", "Terracotta", "Arches", "Mosaic", "Coastal"], img: "linear-gradient(135deg,#C4724A 0%,#4A7B9D 50%,#D4C4A8 100%)" },
  { id: "art-deco", name: "Art Deco", emoji: "💎", desc: "Bold geometry, luxurious materials, metallic finishes. Glamorous and dramatic.", palette: ["#1A1A1A", "#C9A96E", "#2C4A3E", "#8B0000", "#F5F0E8"], keywords: ["Geometric", "Glamorous", "Metallic", "Bold", "Luxurious"], img: "linear-gradient(135deg,#1A1A1A 0%,#C9A96E 40%,#2C4A3E 100%)" },
  { id: "coastal", name: "Coastal", emoji: "🐚", desc: "Breezy blues, natural linens, driftwood tones. Relaxed beachside living.", palette: ["#87CEEB", "#F5F0E8", "#8B7355", "#4A7B9D", "#C8D8C0"], keywords: ["Airy", "Blue tones", "Natural linen", "Relaxed", "Beachy"], img: "linear-gradient(135deg,#87CEEB 0%,#4A7B9D 40%,#F5F0E8 100%)" },
  { id: "maximalist", name: "Maximalist", emoji: "✨", desc: "More is more. Rich patterns, bold colours, layered accessories. Every corner tells a story.", palette: ["#8B2252", "#D4A843", "#2C4A8B", "#6B8E5E", "#C4724A"], keywords: ["Bold", "Layered", "Pattern", "Opulent", "Statement"], img: "linear-gradient(135deg,#8B2252 0%,#D4A843 40%,#2C4A8B 100%)" },
];

// ── Dropdown Data ─────────────────────────────────────────────
export const DD_AREAS = ["Kitchen", "Living Room", "Master Bedroom", "Bedroom 2", "Bedroom 3", "Dining", "Pooja", "Study", "Kids Room", "Bathrooms", "Balcony", "False Ceiling", "Electrical", "Painting", "Site Services"];
export const DD_CATEGORIES: Record<string, string[]> = {
  Kitchen: ["Cabinetry", "Hardware", "Service", "Stone Work"],
  "Living Room": ["Cabinetry", "Panelling", "Service"],
  "Master Bedroom": ["Cabinetry", "Hardware", "Service"],
  "Bedroom 2": ["Cabinetry", "Hardware", "Service"],
  "Bedroom 3": ["Cabinetry", "Hardware", "Service"],
  Dining: ["Cabinetry", "Service"],
  Pooja: ["Cabinetry", "Service"],
  Study: ["Cabinetry", "Service"],
  "Kids Room": ["Cabinetry", "Service"],
  Bathrooms: ["Glass Work", "Service"],
  Balcony: ["Cabinetry", "Service"],
  "False Ceiling": ["Ceiling Work"],
  Electrical: ["Wiring", "Lighting"],
  Painting: ["Painting Work"],
  "Site Services": ["Transport", "Debris", "Cleaning", "Site Management"],
};
export const DD_SUBCATEGORIES: Record<string, string[]> = {
  Cabinetry: ["Wardrobe", "Walk-in Closet", "TV Unit", "Crockery Unit", "Base Unit", "Wall Unit", "Loft Unit", "Pooja Unit", "Study Table", "Bookshelf", "Dressing Unit"],
  Hardware: ["Hinges", "Drawer Channels", "Handles", "Locks", "Sink & Tap", "Basket Accessories"],
  Service: ["Carpentry", "Fabrication", "Installation", "Polish"],
  "Stone Work": ["Granite Countertop", "Wall Backsplash", "Stone Fixing"],
  Panelling: ["Wall Panel", "Beading", "Feature Wall"],
  "Glass Work": ["Shower Enclosure", "Glass Partition"],
  "Ceiling Work": ["Gypsum False Ceiling", "Wooden Feature Ceiling", "Cornice"],
  Wiring: ["Full Electrical Works", "MCB Board", "Light Provisions"],
  Lighting: ["Downlights", "Profile Lights", "Spot Lights"],
  "Painting Work": ["Walls Plain", "Ceiling Plain", "Feature Wall", "Textured"],
  Transport: ["Transport & Hamali"],
  Debris: ["Debris Removal"],
  Cleaning: ["Deep Cleaning"],
  "Site Management": ["Site Supervision"],
};
export const DD_ITEMS: Record<string, string[]> = {
  Wardrobe: ["2 Door Wardrobe", "3 Door Wardrobe", "4 Door Wardrobe", "Sliding Wardrobe", "Swing Wardrobe"],
  "Walk-in Closet": ["Walk-in Closet with Loft", "Walk-in Closet Standard"],
  "TV Unit": ["TV Console Unit", "TV Console with Storage"],
  "Crockery Unit": ["Crockery Unit with Glass", "Full-height Crockery Unit"],
  "Base Unit": ["Kitchen Base Unit — Laminate", "Kitchen Base Unit — Acrylic"],
  "Wall Unit": ["Kitchen Wall Unit — Laminate", "Kitchen Wall Unit — Acrylic"],
  "Loft Unit": ["Kitchen Loft Unit"],
  "Gypsum False Ceiling": ["Gypsum False Ceiling — Plain", "Gypsum False Ceiling — Cove"],
};
export const DD_FINISH = ["Laminate", "Acrylic", "Veneer", "PU Finish", "Duco Paint", "HPL", "Glass", "Granite", "Gypsum", "Hafele", "Hettich", "Modular", "—"];
export const DD_VENDOR = ["Product Vendor", "Service Vendor", "Product Vendor + Service", "Direct Purchase"];
export const DD_FACTORY = ["Factory", "Site", "Factory + Site"];
export const DD_UNITS = ["Sqft", "Rft", "Nos", "Sets", "Sheets", "Lump", "Kg", "Meters"];
export const DD_PAY_STAGE = ["50% Advance", "100% Advance", "Start Stage", "Mid Stage", "Completion Stage", "Handover", "On Delivery"];
export const DD_PAID = ["Pending", "Paid", "Partial"];

// ── Material Options ──────────────────────────────────────────
export const PLYWOOD_OPTIONS: PlywoodOption[] = [
  { label: "Austin Lincoln BWP 16mm", brand: "Austin", model: "Lincoln BWP", thick: "16mm", price: 3520, perUnit: "sheet" },
  { label: "Austin Lincoln BWP 12mm", brand: "Austin", model: "Lincoln BWP", thick: "12mm", price: 3040, perUnit: "sheet" },
  { label: "Austin Lincoln BWP 8mm", brand: "Austin", model: "Lincoln BWP", thick: "8mm", price: 2560, perUnit: "sheet" },
  { label: "Century Sainik MR 16mm", brand: "Century", model: "Sainik MR", thick: "16mm", price: 2800, perUnit: "sheet" },
  { label: "Greenply Gold BWP 16mm", brand: "Greenply", model: "Gold BWP", thick: "16mm", price: 3200, perUnit: "sheet" },
];

export const HARDWARE_OPTIONS: HardwareOption[] = [
  { label: "Hettich Premium", brand: "Hettich", model: "Onsys 0-Crank Soft Close" },
  { label: "Hettich Standard", brand: "Hettich", model: "Onsys Standard" },
  { label: "Hafele Premium", brand: "Hafele", model: "Matrix Soft Close" },
  { label: "Ebco Standard", brand: "Ebco", model: "Standard Line" },
];

export const KITCHEN_ACC_OPTIONS: KitchenAccOption[] = [
  { label: "Hettich Architech Baskets", brand: "Hettich", model: "Architech 4\" Tandem Basket", total: 25550 },
  { label: "Hafele Magic Corner", brand: "Hafele", model: "Magic Corner S", total: 18000 },
  { label: "Ebco Standard Pack", brand: "Ebco", model: "SS Baskets + Cutlery", total: 12000 },
];

export const FINISH_OPTIONS: FinishOption[] = [
  { label: "Greenlam Matt Laminate", brand: "Greenlam", finish: "Matt", pricePerSheet: 3000 },
  { label: "Greenlam Gloss Laminate", brand: "Greenlam", finish: "Gloss", pricePerSheet: 3500 },
  { label: "Acrylic — Fern RM6104", brand: "Acrylic", finish: "Fern RM6104", pricePerSheet: 4500 },
  { label: "Thermo Foil White", brand: "Thermo", finish: "White Foil", pricePerSheet: 2800 },
  { label: "HPL Panel", brand: "Greenlam", finish: "HPL", pricePerSheet: 5000 },
];

// ── Sample Estimate Table Rows ────────────────────────────────
export const SAMPLE_EST_ROWS: EstimateTableRow[] = [
  { id: 101, si: 1, area: "Design", category: "Design Fee", subcat: "Design + Drawings", item: "Design Fee", finish: "—", vendorType: "Service Vendor", factorySite: "Factory", length: "-", width: "-", height: "-", depth: "-", qty: "2360", unit: "Sft", budgetNote: "₹25/sft", amtEx: 58988, gstPct: 18, summaryCategory: "Furniture" },
  { id: 102, si: 2, area: "Drawing", category: "Panelling", subcat: "Beading", item: "West Wall Beadings", finish: "Melamine", vendorType: "Procurement", factorySite: "Site", length: "-", width: "-", height: "-", depth: "-", qty: "20", unit: "Rft", budgetNote: "₹255/rft", amtEx: 5100, gstPct: 18, summaryCategory: "Furniture" },
  { id: 103, si: 3, area: "Drawing", category: "Cabinetry", subcat: "TV Unit", item: "East Wall TV Unit with Ledge", finish: "Laminate", vendorType: "Product Vendor", factorySite: "Factory", length: "8", width: "1.3", height: "1", depth: "-", qty: "1", unit: "Set", budgetNote: "₹1,16,799", amtEx: 90000, gstPct: 18, summaryCategory: "Furniture" },
  { id: 104, si: 4, area: "Suite 3", category: "Cabinetry", subcat: "Wardrobe", item: "Wardrobe", finish: "Laminate", vendorType: "Product Vendor", factorySite: "Factory", length: "8", width: "2", height: "8", depth: "-", qty: "1", unit: "Set", budgetNote: "₹2,49,000", amtEx: 212000, gstPct: 18, summaryCategory: "Furniture" },
  { id: 105, si: 5, area: "Suite 3", category: "Cabinetry", subcat: "Study Table", item: "Study & Dressing Ledge with Mirror", finish: "Thermo Laminate", vendorType: "Product Vendor", factorySite: "Factory", length: "12", width: "1.3", height: "1", depth: "-", qty: "1", unit: "Set", budgetNote: "₹82,000", amtEx: 70000, gstPct: 18, summaryCategory: "Furniture" },
  { id: 106, si: 7, area: "Suite 1", category: "Cabinetry", subcat: "Wardrobe", item: "Wardrobe", finish: "Laminate", vendorType: "Product Vendor", factorySite: "Factory", length: "8", width: "2", height: "8", depth: "-", qty: "1", unit: "Set", budgetNote: "₹2,67,000", amtEx: 228000, gstPct: 18, summaryCategory: "Furniture" },
  { id: 112, si: 13, area: "False Ceiling", category: "Ceiling Work", subcat: "False Ceiling", item: "False Ceiling", finish: "Gypsum", vendorType: "Service Vendor", factorySite: "Site", length: "-", width: "-", height: "-", depth: "-", qty: "1", unit: "Lump", budgetNote: "₹95,580", amtEx: 81000, gstPct: 18, summaryCategory: "Ceiling" },
  { id: 113, si: 14, area: "Electrical", category: "Wiring", subcat: "Full Electrical", item: "Electrical Works", finish: "—", vendorType: "Service Vendor", factorySite: "Site", length: "-", width: "-", height: "-", depth: "-", qty: "1", unit: "Lump", budgetNote: "₹1,07,528", amtEx: 91000, gstPct: 18, summaryCategory: "Electrical" },
  { id: 116, si: 16, area: "Site Services", category: "Site Service", subcat: "Debris Removal", item: "Debris Management", finish: "—", vendorType: "Service Vendor", factorySite: "Site", length: "-", width: "-", height: "-", depth: "-", qty: "1", unit: "Lump", budgetNote: "₹35,400", amtEx: 30000, gstPct: 18, summaryCategory: "Other" },
  { id: 117, si: 18, area: "Site Services", category: "Site Service", subcat: "Deep Cleaning", item: "Deep Cleaning", finish: "—", vendorType: "Service Vendor", factorySite: "Site", length: "-", width: "-", height: "-", depth: "-", qty: "1", unit: "Lump", budgetNote: "₹28,320", amtEx: 24000, gstPct: 18, summaryCategory: "Other" },
];

// ── Sample Detail Breakdown ───────────────────────────────────
export const SAMPLE_DETAIL: Record<number, DetailRow[]> = {
  101: [
    { type: "Spec Purpose", spec: "Design", brand: "", model: "", qty: "2360", unit: "Sft", price: 25, cost: 58988, gst: 18, total: 69606 },
  ],
  102: [
    { type: "Procurement", spec: "Teak Beading", brand: "", model: '1½" x 2"', qty: "20", unit: "Rft", price: 35, cost: 700, gst: 18, total: 1115 },
    { type: "Procurement cum Service", spec: "Polishing", brand: "Melamine", model: "Matt Finish", qty: "20", unit: "Rft", price: 220, cost: 4400, gst: 18, total: 7009 },
  ],
  103: [
    { type: "Spec Purpose", spec: "Doors", brand: "", model: "1 nos", qty: "1", unit: "Nos", price: 0, cost: 0, gst: 18, total: 0 },
    { type: "Procurement", spec: "Core Material 16mm BWP Ply", brand: "Austin", model: "Lincoln BWP", qty: "4", unit: "Sheets", price: 3520, cost: 14080, gst: 18, total: 22429 },
    { type: "Procurement", spec: "Box Hinges", brand: "Hettich", model: "Onsys 0-Crank Soft Close", qty: "6", unit: "Sets", price: 260, cost: 1560, gst: 18, total: 2485 },
    { type: "Service", spec: "Carpentry", brand: "", model: "Box", qty: "21.5", unit: "Sft", price: 360, cost: 7740, gst: 18, total: 12330 },
    { type: "Procurement cum Service", spec: "Glass", brand: "", model: "Aluminium Profile with Glass", qty: "15.5", unit: "Sft", price: 950, cost: 14725, gst: 18, total: 23457 },
  ],
  104: [
    { type: "Spec Purpose", spec: "Doors", brand: "", model: "7 nos", qty: "7", unit: "Nos", price: 0, cost: 0, gst: 18, total: 0 },
    { type: "Procurement", spec: "Core Material 16mm BWP Ply", brand: "Austin", model: "Lincoln BWP", qty: "11", unit: "Sheets", price: 3520, cost: 38720, gst: 18, total: 61681 },
    { type: "Procurement", spec: "Box Hinges", brand: "Hettich", model: "Onsys 0-Crank Soft Close", qty: "13", unit: "Sets", price: 260, cost: 3380, gst: 18, total: 5384 },
    { type: "Service", spec: "Carpentry", brand: "", model: "Box", qty: "64", unit: "Sft", price: 360, cost: 23040, gst: 18, total: 36703 },
    { type: "Procurement", spec: "Handles/Knobs", brand: "Handles", model: "For Shutters", qty: "8", unit: "Nos", price: 1200, cost: 9600, gst: 18, total: 15293 },
  ],
  112: [
    { type: "Service", spec: "Gypsum Board Ceiling", brand: "Saint-Gobain", model: "12.5mm", qty: "1000", unit: "Sft", price: 65, cost: 65000, gst: 18, total: 103545 },
    { type: "Service", spec: "POP Cornice", brand: "", model: "As required", qty: "1", unit: "Lump", price: 8000, cost: 8000, gst: 18, total: 12744 },
  ],
  113: [
    { type: "Service", spec: "Full Wiring", brand: "Finolex", model: "As required", qty: "1", unit: "Lump", price: 40000, cost: 40000, gst: 18, total: 63720 },
    { type: "Procurement", spec: "Switches", brand: "Legrand", model: "Arteor Series", qty: "60", unit: "Nos", price: 450, cost: 27000, gst: 18, total: 43011 },
  ],
  116: [
    { type: "Service", spec: "Debris Removal", brand: "", model: "Lump Sum", qty: "1", unit: "Lump", price: 30000, cost: 30000, gst: 18, total: 47790 },
  ],
};

// ── Final Estimate Sample Rows ────────────────────────────────
export const SAMPLE_FINAL_ROWS: FinalEstimateRow[] = [
  { id: 201, si: 3, area: "Drawing", category: "Cabinetry", subcat: "TV Unit", item: "East Wall TV Unit", vendorCode: "PV001", vendorName: "Austin Lincoln", vendorType: "Product Vendor", finish: "Laminate", factorySite: "Factory", length: "8", width: "1.3", height: "1", depth: "-", qty: "1", unit: "Set", rateEx: 90000, amtEx: 90000, gstPct: 18, payStage: "50% Advance", dueDate: "15 Jul", paidDate: "Paid", bank: "HDFC/UPI", expected: 106200, actual: 106200, summaryCategory: "Furniture", budgetNote: "" },
  { id: 202, si: 4, area: "Suite 3", category: "Cabinetry", subcat: "Wardrobe", item: "Wardrobe", vendorCode: "PV002", vendorName: "Greenlam Dealer", vendorType: "Product Vendor", finish: "Laminate", factorySite: "Factory", length: "8", width: "2", height: "8", depth: "-", qty: "1", unit: "Set", rateEx: 212000, amtEx: 212000, gstPct: 18, payStage: "50% Advance", dueDate: "18 Jul", paidDate: "Pending", bank: "Axis/UPI", expected: 250160, actual: 255000, summaryCategory: "Furniture", budgetNote: "" },
  { id: 205, si: 12, area: "False Ceiling", category: "Ceiling Work", subcat: "False Ceiling", item: "False Ceiling", vendorCode: "SV002", vendorName: "Apex Ceiling", vendorType: "Service Vendor", finish: "Gypsum", factorySite: "Site", length: "-", width: "-", height: "-", depth: "-", qty: "1", unit: "Lump", rateEx: 81000, amtEx: 81000, gstPct: 18, payStage: "Start Stage", dueDate: "05 Jul", paidDate: "Paid", bank: "HDFC/UPI", expected: 95580, actual: 95580, summaryCategory: "Ceiling", budgetNote: "" },
  { id: 206, si: 13, area: "Electrical", category: "Wiring", subcat: "Full Electrical", item: "Electrical Works", vendorCode: "SV003", vendorName: "Bright Electricals", vendorType: "Service Vendor", finish: "—", factorySite: "Site", length: "-", width: "-", height: "-", depth: "-", qty: "1", unit: "Lump", rateEx: 91000, amtEx: 91000, gstPct: 18, payStage: "Start Stage", dueDate: "06 Jul", paidDate: "Paid", bank: "HDFC/UPI", expected: 107380, actual: 107380, summaryCategory: "Electrical", budgetNote: "" },
];

// ── Procurement Categories ────────────────────────────────────
export const PROCUREMENT_CATEGORIES: ProcurementCategory[] = [
  { cat: "Plywood & Board", items: ["Core Material 16mm BWP Ply", "Core Material 12mm BWP Ply", "Core Material 8mm BWP Ply", "Block Board 19mm"] },
  { cat: "Laminates & Finish", items: ["Laminate Sheet — Matt", "Laminate Sheet — Gloss", "Acrylic Sheet", "Thermo Foil Sheet", "HPL Sheet", "Edge Banding Tape"] },
  { cat: "Hardware", items: ["Box Hinges (Soft Close)", "Draw Channels", "Handles/Knobs", "Tower Bolts", "Drawer Locks", "Hanger Pipe"] },
  { cat: "Kitchen Accessories", items: ["Tandem Basket", "Corner Magic Unit", "Cutlery Tray", "Thali Tray", "Sink & Tap Set", "Chimney"] },
  { cat: "Glass & Profile", items: ["Clear Glass 5mm", "Frosted Glass 5mm", "Fluted Glass", "Aluminium Profile Gold", "Aluminium Profile Black"] },
  { cat: "Electrical", items: ["Wiring — Finolex 2.5sqmm", "Switches — Modular", "MCB Board", "Downlight Fittings", "Profile Light Strip"] },
  { cat: "Adhesives & Consumables", items: ["Fevicol SH — Bonding", "Abro Masking Tape", "M-Seal", "Silicon Sealant", "Nails & Screws Box"] },
];

export const INIT_PROC_ROWS: ProcurementRow[] = [
  { id: "p1", cat: "Plywood & Board", material: "Core Material 16mm BWP Ply", brand: "Austin", model: "Lincoln BWP", qty: 109, unit: "Sheets", price: 3520, vendor: "PlyMart Suppliers", status: "Ordered" },
  { id: "p2", cat: "Plywood & Board", material: "Core Material 12mm BWP Ply", brand: "Austin", model: "Lincoln BWP", qty: 15, unit: "Sheets", price: 3040, vendor: "PlyMart Suppliers", status: "Ordered" },
  { id: "p3", cat: "Hardware", material: "Box Hinges (Soft Close)", brand: "Hettich", model: "Onsys 0-Crank", qty: 127, unit: "Sets", price: 260, vendor: "Hafele India", status: "Ordered" },
  { id: "p4", cat: "Hardware", material: "Draw Channels", brand: "Hettich", model: "Quadro 18\"", qty: 46, unit: "Sets", price: 2600, vendor: "Hafele India", status: "Pending" },
  { id: "p5", cat: "Laminates & Finish", material: "Laminate Sheet — Matt", brand: "Greenlam", model: "White Matt", qty: 10, unit: "Sheets", price: 3000, vendor: "Greenlam Dealer", status: "Pending" },
  { id: "p6", cat: "Kitchen Accessories", material: "Tandem Basket", brand: "Hettich", model: "Architech", qty: 4, unit: "Nos", price: 3650, vendor: "Hafele India", status: "Pending" },
];

// ── Itemized Dues ─────────────────────────────────────────────
export const ITEMIZED_ROWS: ItemizedRow[] = [
  { id: 301, si: 1, area: "Design", category: "Design Fee", subcat: "Design + Drawings", item: "Design Fee", vendor: "NICARA", amtEx: 58988, gstPct: 18, payStage: "50% Advance", dueDate: "01 Jun", paidDate: "Paid", bank: "HDFC/UPI" },
  { id: 302, si: 3, area: "Drawing", category: "Cabinetry", subcat: "TV Unit", item: "East Wall TV Unit with Ledge", vendor: "Kumar Carpentry", amtEx: 90000, gstPct: 18, payStage: "50% Advance", dueDate: "15 Jul", paidDate: "Paid", bank: "HDFC/UPI" },
  { id: 303, si: 4, area: "Suite 3", category: "Cabinetry", subcat: "Wardrobe", item: "Wardrobe", vendor: "Kumar Carpentry", amtEx: 212000, gstPct: 18, payStage: "50% Advance", dueDate: "18 Jul", paidDate: "Pending", bank: "Axis/UPI" },
  { id: 304, si: 5, area: "Suite 3", category: "Cabinetry", subcat: "Study Table", item: "Study & Dressing Ledge", vendor: "Kumar Carpentry", amtEx: 70000, gstPct: 18, payStage: "50% Advance", dueDate: "18 Jul", paidDate: "Pending", bank: "Axis/UPI" },
  { id: 305, si: 7, area: "Suite 1", category: "Cabinetry", subcat: "Wardrobe", item: "Wardrobe", vendor: "Kumar Carpentry", amtEx: 228000, gstPct: 18, payStage: "50% Advance", dueDate: "20 Jul", paidDate: "Pending", bank: "ICICI/UPI" },
  { id: 309, si: 11, area: "Kitchen", category: "Cabinetry", subcat: "Modular Kitchen", item: "Kitchen Base + Wall + Loft", vendor: "Kumar Carpentry", amtEx: 124000, gstPct: 18, payStage: "Start Stage", dueDate: "10 Jul", paidDate: "Paid", bank: "Axis/UPI" },
  { id: 311, si: 13, area: "False Ceiling", category: "Ceiling Work", subcat: "Gypsum Ceiling", item: "False Ceiling", vendor: "Apex Ceiling", amtEx: 81000, gstPct: 18, payStage: "Start Stage", dueDate: "05 Jul", paidDate: "Paid", bank: "HDFC/UPI" },
  { id: 312, si: 14, area: "Electrical", category: "Wiring", subcat: "Full Electrical", item: "Full Electrical Works", vendor: "Bright Electricals", amtEx: 91000, gstPct: 18, payStage: "Start Stage", dueDate: "06 Jul", paidDate: "Paid", bank: "HDFC/UPI" },
  { id: 314, si: 16, area: "Painting", category: "Painting Work", subcat: "Ceiling Plain", item: "Ceiling Paint — Plain", vendor: "FreshCoat", amtEx: 97200, gstPct: 18, payStage: "Completion Stage", dueDate: "Handover", paidDate: "Pending", bank: "HDFC/UPI" },
  { id: 315, si: 17, area: "Site Services", category: "Site Service", subcat: "Debris Removal", item: "Debris Management", vendor: "Site Team", amtEx: 30000, gstPct: 18, payStage: "Completion Stage", dueDate: "Handover", paidDate: "Pending", bank: "" },
];

// ── Execution Task Definitions ────────────────────────────────
export const ITEM_TASKS = ["Structure", "Finishing", "Laminate", "Handle"];
export const TASK_STATUS_OPTS = ["Not Started", "In Progress", "Completed"];

// ── Sidebar Navigation ────────────────────────────────────────
export const NAV_ITEMS = [
  { id: "servicevendors", label: "Service Vendor Data Bank", icon: "🔧" },
  { id: "productvendors", label: "Product Vendor Data Bank", icon: "📦" },
  { id: "clients", label: "Client Database", icon: "👤" },
  { id: "designers", label: "Designer Database", icon: "✏️" },
  { id: "projects", label: "Projects", icon: "🏠" },
];

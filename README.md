# NICARA Project OS

**Interior Design & Build — Project Management Platform**

Premium CRM + Estimate + Component Library software for interior design firms.

---

## 1. How to run it locally

Two servers. Open two terminals.

### Terminal 1 — Backend (Django, port 8000)

```bash
cd Backend
.venv\Scripts\python.exe manage.py runserver 8000
```

### Terminal 2 — Frontend (Next.js, port 3000)

```bash
cd frontend
npm run dev
```

Then open **http://localhost:3000** and sign in.

| Where | URL |
| ----- | --- |
| App | http://localhost:3000 |
| API root | http://127.0.0.1:8000/api/ |
| Django admin | http://127.0.0.1:8000/admin/ |

### Login credentials

| Account | Email | Password | Role |
| ------- | ----- | -------- | ---- |
| Superuser / admin | `admin@nicara.design` | `Nicara@2026!` | admin (Django superuser) |
| Demo designer | `designer.demo@nicara.design` | `Kestrel@Moonlit7` | designer |

> There is **no username** — login is by email.
> These live in `Backend/.env` (`ADMIN_EMAIL` / `ADMIN_PASSWORD`), which is
> gitignored. Change them before this goes anywhere real.

### First-time setup (only if `.venv` or `node_modules` are missing)

```bash
cd Backend
python -m venv .venv
.venv\Scripts\python.exe -m pip install -r requirements.txt
copy .env.example .env
.venv\Scripts\python.exe manage.py migrate
.venv\Scripts\python.exe manage.py bootstrap_admin
.venv\Scripts\python.exe manage.py seed_items
.venv\Scripts\python.exe manage.py seed_vendors
```

```bash
cd frontend
npm install
copy .env.example .env.local
```

> **Windows note:** call `.venv\Scripts\python.exe -m pip`, not `pip.exe` —
> the Application Control policy on this machine blocks the copied `pip.exe`.

### Everyday commands

| Task | Command |
| ---- | ------- |
| Run all backend tests (104) | `.venv\Scripts\python.exe manage.py test` |
| Test one app | `.venv\Scripts\python.exe manage.py test items` |
| Make migrations after a model change | `.venv\Scripts\python.exe manage.py makemigrations` |
| Apply migrations | `.venv\Scripts\python.exe manage.py migrate` |
| Create another admin | `.venv\Scripts\python.exe manage.py bootstrap_admin --email x@y.com --password '...'` |
| Reload the item catalogue | `.venv\Scripts\python.exe manage.py seed_items --reset` |
| Reload vendors | `.venv\Scripts\python.exe manage.py seed_vendors --reset` |
| Full demo project data | `.venv\Scripts\python.exe manage.py shell < seed_data.py` |
| Frontend type check | `npx tsc --noEmit` |
| Frontend lint | `npm run lint` |

---

## 2. Where everything lives

```
Nicara-Estimate-App/
├── Backend/                     ← Django REST API (port 8000)
│   ├── .venv/                   virtualenv (gitignored)
│   ├── .env                     secrets + admin seed creds (gitignored)
│   ├── db.sqlite3               dev database (gitignored)
│   ├── manage.py
│   ├── seed_data.py             full demo project data
│   │
│   ├── nicara/                  PROJECT CONFIG
│   │   ├── settings.py          apps, JWT, CORS, throttling, security
│   │   ├── urls.py              mounts every app under /api/
│   │   └── exceptions.py        uniform { detail, errors, code } errors
│   │
│   ├── accounts/                WHO CAN LOG IN
│   │   ├── models.py            User (email login), LoginAttempt, PagePermission
│   │   ├── validators.py        password complexity rule
│   │   └── management/commands/bootstrap_admin.py
│   │
│   ├── projects/                THE PROJECT LIFECYCLE
│   │   └── models.py            Project, DesignRequirement, ProjectDeliverable,
│   │                            Estimate, EstimateItem, BookingForm,
│   │                            Measurement, MaterialSelection,
│   │                            ExecutionStage, PaymentMilestone, QualityCheck
│   │
│   ├── items/                   THE ITEMS CATALOGUE  ← new
│   │   ├── models.py            ItemCategory, Item, ItemComponent (BOM)
│   │   └── management/commands/seed_items.py
│   │
│   ├── vendors/                 SUPPLIERS & CONTRACTORS  ← new
│   │   ├── models.py            Vendor, VendorContact, VendorDocument
│   │   └── management/commands/seed_vendors.py
│   │
│   └── library/                 RAW MATERIAL LIBRARY
│       └── models.py            MaterialCategory → MaterialBrand → MaterialItem,
│                                ServiceItem
│
└── frontend/                    ← Next.js 16 app (port 3000)
    ├── .env.local               NEXT_PUBLIC_API_URL (gitignored)
    ├── app/
    │   ├── login/               sign in
    │   ├── forgot-password/     request a reset link
    │   ├── reset-password/      set a new password from the emailed link
    │   ├── accept-invite/       activate an invited account
    │   └── estimate/page.tsx    the whole app shell + project detail tabs
    ├── components/
    │   ├── auth/                AppShell (route guard), AuthCard
    │   ├── engagement/          Initial Engagement tabs — all API-backed:
    │   │                        ClientDetails, DesignRequirements,
    │   │                        DeliverablesTab, EstimateTab, BookingFormTab
    │   ├── items/               ItemsPage — catalogue browser + editor
    │   ├── vendors/             VendorsPage — suppliers and contractors
    │   ├── admin/               IAM + user management (still mock)
    │   ├── tabs/                older mock tab components (unused)
    │   └── ui/                  Modal, Form inputs, States, Toast, Avatar
    └── lib/
        ├── api.ts               every API call + token refresh
        ├── apiTypes.ts          TypeScript shapes matching the DRF payloads
        ├── auth.tsx             useAuth() session state
        ├── hooks.ts             useApiData + rupee formatting
        └── sampleProjects.ts    legacy mock data (no longer rendered)
```

### Which app does what

| App | Owns |
| --- | ---- |
| `accounts` | Login, JWT tokens, invites, password reset, page permissions |
| `projects` | Projects and everything hanging off them across all three phases |
| `items` | The master catalogue of sellable items — feeds estimate lines |
| `vendors` | Material suppliers and contractors |
| `library` | Raw material database (brands, models, rates) used by item BOMs |

---

## 3. What was built in this round

### A. Vendors — Material Suppliers & Contractors

One `Vendor` table with a `vendor_type` discriminator, because both share the
commercial fields that matter. Type-specific fields are grouped separately.

**Shared:** code (auto: `SUP-…` / `CON-…`), name, legal name, contact person,
phone, alt phone, email, website, address, city, state, pincode, **GSTIN**,
**PAN**, bank name / account name / account number / IFSC / UPI, payment terms,
credit days, advance %, rating, preferred flag, active flag, notes.

**Supplier only:** linked library categories, brands supplied, lead time (days),
minimum order value, delivers-on-site.

**Contractor only:** trade (carpentry, false ceiling, electrical, plumbing,
painting, flooring, glass, civil, fabrication, HVAC, upholstery, cleaning),
specialization, team size, labour rate per day.

Plus `VendorContact` (many people per firm) and `VendorDocument` (GST cert, PAN,
cancelled cheque, agreement, rate card, catalogue).

| Endpoint | Purpose |
| -------- | ------- |
| `GET/POST /api/vendors/` | All vendors (`?vendor_type=&city=&trade=&search=`) |
| `GET/POST /api/vendors/suppliers/` | Material suppliers only — POST forces the type |
| `GET/POST /api/vendors/contractors/` | Contractors only — POST forces the type |
| `GET/PATCH/DELETE /api/vendors/{id}/` | DELETE deactivates, never destroys |
| `GET/POST /api/vendors/{id}/contacts/` | Extra contact people |
| `GET/POST /api/vendors/{id}/documents/` | Compliance paperwork |
| `GET /api/vendors/meta/` | Trades, payment terms, doc types, counts |

Seeded: **6 suppliers, 7 contractors** matching the names already used in the UI.

### B. Items module

The single place where "what can we sell" is defined.

- **`ItemCategory`** — Carpentry, Modular Kitchen, False Ceiling, Furniture, Specialty.
- **`Item`** — auto code, name, category, description, default room, unit
  (unit/nos/sft/rft/sqm/set/lot/lumpsum), calculation method (per unit / L×B /
  L×H / running length / lump sum), default L·B·H, default qty, default rate,
  min & max rate guard rails, GST %, margin %, image, notes.
- **`ItemComponent`** — the bill of materials: links to a library `MaterialItem`
  or `ServiceItem`, qty per unit, wastage %, optional rate override.
  `component_cost` and `suggested_rate` already compute off it.

**Seeded with the 28 items currently shown in Initial Estimate**, carrying their
real descriptions, dimensions, units and rates — e.g. `Wardrobe 8'x2'x8'`
(Master Bedroom, 8'0"×2'0"×8'0", ₹1,45,000/unit),
`Base Cabinets L-shape` (₹2,25,000), `False Ceiling — Gypsum` (168 sft @ ₹165).

| Endpoint | Purpose |
| -------- | ------- |
| `GET/POST /api/items/` | Catalogue (`?category=&search=&default_room=`) |
| `GET/PATCH/DELETE /api/items/{id}/` | DELETE retires the item |
| `GET/POST /api/items/categories/` | Categories |
| `GET/POST /api/items/{id}/components/` | Bill of materials |
| `GET /api/items/meta/` | Units, calc methods, rooms, categories |

> Quote **calculations** are deliberately not wired yet, as agreed. The data
> model for them (`ItemComponent`, `margin_pct`, `calc_method`) is in place, and
> rates are entered directly on the Item until that lands.

### C. Initial Engagement — complete backend

All five sub-tabs:

| Sub-tab | Endpoint |
| ------- | -------- |
| **Client Details** | `PATCH /api/projects/{id}/` |
| **Design Requirements** | `GET/POST /api/projects/{id}/design-requirements/`<br>`PUT …/design-requirements/bulk/` saves the whole grid at once |
| **FL & Mood Board** | `GET/POST /api/projects/{id}/deliverables/?type=furniture_layout｜mood_board` |
| **Initial Estimate** | `GET/POST /api/projects/{id}/estimates/` |
| **Booking Form** | `GET/POST/PATCH /api/projects/{id}/booking-form/` |

**Estimate workflow**

| Action | Endpoint |
| ------ | -------- |
| Send for approval | `POST …/estimates/{id}/send/` (refuses if there are no line items) |
| Client approves | `POST …/estimates/{id}/approve/` |
| Client wants changes | `POST …/estimates/{id}/request-revision/` |
| Revise / promote to final | `POST …/estimates/{id}/duplicate/` `{"type":"final"}` |
| Add lines from catalogue | `POST …/estimates/{eid}/items/add-from-catalog/` |

- Version numbers are assigned **server-side**, so two designers revising at the
  same time cannot collide.
- Line `amount` is always `qty × rate` — the field is read-only on input.
- Totals (`subtotal`, `total_discount`, `taxable_amount`, `gst_total`,
  `grand_total`) are computed from the lines and rounded to paise, so a stale
  stored total can never be served.

**Booking Form** — auto `BKG-YYYY-NNNN` number, snapshots the agreed value
(defaults from the approved initial estimate), records the advance
(amount / received / date / mode / reference / payment link) and the signature
(terms accepted, signed by, signed at, signature file), and exposes
`balance_due`.

---

## 4. Authentication

Email + password against Django, issuing **JWT** access/refresh pairs.

| Method | Endpoint | Purpose |
| ------ | -------- | ------- |
| POST | `/api/auth/login/` | Email + password → `{ token: { access, refresh }, user }` |
| POST | `/api/auth/token/refresh/` | Rotate an expiring access token |
| POST | `/api/auth/logout/` | Blacklist the refresh token |
| GET / PATCH | `/api/auth/me/` | Read / update the current profile |
| POST | `/api/auth/change-password/` | Change password, returns a fresh token pair |
| POST | `/api/auth/password-reset/` | Email a reset link |
| POST | `/api/auth/password-reset/confirm/` | Complete the reset |
| POST | `/api/auth/invite/` | Admin-only: invite a user |
| POST | `/api/auth/accept-invite/` | Set a password and activate |
| GET | `/api/auth/users/` | Admin-only: list users |
| GET / PUT | `/api/auth/iam/permissions/` | Page-level permission matrix |

**Production-grade bits:** Argon2 hashing; 10+ char passwords with mixed case,
digit and symbol; account lockout after 5 failures in 15 minutes; 10 logins/min
and 5 password resets/hour rate limits; refresh-token rotation with blacklisting;
identical responses for unknown email vs wrong password (no user enumeration);
a login audit trail at `/admin/accounts/loginattempt/`; and HSTS + secure cookies
that switch on automatically when `DJANGO_DEBUG=False`.

Invitation and reset emails print to the **console** in development — copy the
link out of the Django terminal.

### How the frontend talks to it

`lib/api.ts` holds the token store and a fetch wrapper that transparently
refreshes an expired access token (single-flight, so concurrent requests share
one refresh) and replays the original request. Responses are typed against
`lib/apiTypes.ts`, so the shapes in the UI match what Django actually sends.
`lib/hooks.ts` supplies `useApiData` — loading, error and `reload()` — which
every screen uses, and `components/auth/AppShell.tsx` guards protected routes.

---

## 5. Conventions worth knowing

- **Every API response for a failure** is `{ detail, errors?, code? }`.
- **List endpoints are paginated** (DRF `PageNumberPagination`, 50/page): read
  `response.results`, not the response itself.
- **Nothing deletes.** Vendors, items and users deactivate; projects and
  estimates keep their history.
- **`project` is never accepted in a request body** for nested resources — it
  comes from the URL.
- **Money is `Decimal`**, rounded to 2 places at the boundary. Never `float`.

---

## 6. Test coverage

```bash
cd Backend
.venv\Scripts\python.exe manage.py test
```

**104 tests, all passing:**

| App | Tests | Covers |
| --- | ----- | ------ |
| `accounts` | 30 | Login, lockout, throttling, token rotation & revocation, password change/reset, invites, admin-only access |
| `projects` | 43 | All five Initial Engagement sub-tabs, estimate totals & discounts, workflow transitions, catalogue → estimate, booking form |
| `items` | 17 | Catalogue CRUD, code generation, BOM cost & margin maths, seed idempotency |
| `vendors` | 14 | Supplier/contractor scoping, GST & rating validation, contacts, soft delete |

---

## 7. Demo walkthrough

Everything below is live against the database — no mock data.

1. **Projects** → the list, KPIs and search all come from `/api/projects/`.
2. Open **Sharma Residence** → **Initial Engagement**:
   - **Client Details** — edit any field, hit *Save Changes*, reload the page:
     the value persists.
   - **Design Requirements** — 16 rows, editable inline. Add or delete rows and
     *Save Requirements* replaces the grid in one call.
   - **FL & Mood Board** — version tables; add a version, flip its status.
   - **Initial Estimate** — v1 is approved and locked. Hit **Duplicate to
     Revise** → v2 draft → **+ Add from Catalogue**, tick a few items, adjust
     room and qty, add them. Totals recompute on the server.
   - **Booking Form** — *Create Booking Form*; it picks up the approved
     estimate value automatically and issues `BKG-2026-NNNN`. Record the
     advance, then *Mark Signed*.
3. **Catalogue → Items** — 28 items grouped by category with rates and ranges.
   Add or edit one; it appears in the estimate picker immediately.
4. **Vendors → Material Suppliers / Contractors** — 6 and 7 records. *Edit* opens
   the full form (GST, PAN, bank, terms, and the supplier- or contractor-only
   fields). Bad GSTIN or a rating over 5 is rejected by the backend.
5. **Dashboard** — KPIs and progress bars from `/api/projects/dashboard/`.

## 8. IAM — module access permissions

Permissions are defined once in `Backend/accounts/modules.py` and used by three
things, so they cannot drift apart: the `PagePermission` choices, the API
enforcement, and the matrix the frontend renders.

- **22 modules** across Main, Project Phases, Tasks, Vendors, Customers,
  Finance, Catalogue and Admin.
- **Four levels**, ordered: `none < view < edit < full`. Read requests need
  `view`; writes need `edit`.
- **Actually enforced.** `HasModulePermission` gates each endpoint — a user
  with `view` on Items gets `200` on a list and `403` on a create.
- **Configured by an admin, or by whoever holds it.** `IsAdminOrHasIAM` allows
  an administrator *or* any user granted `full` on the `iam` module.
- **Role templates** (admin / designer / supervisor / client) seed a new user's
  matrix on invite and can be re-applied from the UI.
- Admins hold every module implicitly — their rows are locked in the matrix.
- The sidebar hides modules the user cannot reach; the API is still the gate.

| Endpoint | Purpose |
| -------- | ------- |
| `GET /api/auth/iam/modules/` | Module registry + role templates |
| `GET /api/auth/iam/my-permissions/` | The signed-in user's own map |
| `GET / PUT /api/auth/iam/permissions/` | The full matrix |
| `POST /api/auth/iam/apply-template/` | Reset a user to their role default |

Screen: **Admin → User Permissions**.

## 9. Approvals, versioning and media

**FL & Mood Board** (and 3D, renders, working drawings) are fully versioned:

- `version_no` increments server-side per project + type; `is_current` marks the
  one live version, and `supersedes` chains them.
- Workflow: `draft → submit → approve | request-revision`, recording who
  reviewed it, when, and why. A revision requires remarks.
- Approving an older version makes it current again.

| Endpoint | Purpose |
| -------- | ------- |
| `POST …/deliverables/{id}/submit/` | Send for approval |
| `POST …/deliverables/{id}/approve/` | Approve (becomes the live version) |
| `POST …/deliverables/{id}/request-revision/` | Send back with remarks |

**Media storage.** Uploads are multipart; `Backend/nicara/media.py` generates a
400 px thumbnail and a 1600 px preview with Pillow, applies EXIF rotation and
strips the EXIF block (it carries GPS). Galleries load the derivatives; the
original stays downloadable. Non-images pass through untouched.

## 10. Exports

Rendered server-side so every copy a client receives is identical, and the
numbers come from the same code that computes them on screen.

| Endpoint | Output |
| -------- | ------ |
| `GET …/estimates/{id}/pdf/` | Quotation PDF — letterhead, items grouped by area, totals, payment schedule, terms, signature block |
| `GET …/estimates/{id}/excel/` | `.xlsx` with live numbers, GST per line, and a Payment Schedule sheet |
| `GET …/booking-form/pdf/` | Booking form with agreed value, advance, balance and signature |

Buttons live on the Initial Estimate tab (**📄 PDF**, **📊 Excel**) and the
Booking Form tab (**📄 Download PDF**).

> The Excel in the repo is the *app layout* spec, not an estimate template, so
> the export mirrors the on-screen estimate and the existing NICARA quote
> styling. Send the real estimate template and I will match it exactly.

## 11. Leads & Clients (CRM)

`Backend/crm/` adds the pre-sales pipeline and the customer book.

- **Lead** — 10 stages from New Enquiry through Furniture Layout, Mood Board,
  Initial Estimate, Decision, Booking, to Won or Closed Lost. Source, priority,
  owner, follow-up date, and an auto `LD-YYYY-NNNN` code.
- **Convert** — a won lead creates a Client *and* a Project seeded from the
  enquiry, then links all three. Converting twice is refused, not duplicated.
- **Client** — billing details (GSTIN, PAN), auto `CL-` code, and the list of
  projects attached to them.
- **CrmNote** — activity log on either; stage changes are logged automatically.
- Closing a lead as lost requires a reason.

Screens: **Customers → Leads** and **Customers → Clients**.

## 12. Still to do

- Quote calculation engine (item BOM → cost → margin → rate).
- Design/Execution phase screens are **read-only** — measurements, material
  selections, execution stages, payments and quality render live data but have
  no edit forms yet.
- Tasks, Finance, Raw Material and the Stage/Site masters have no backend
  module yet and still show a placeholder.
- Digital signature capture on the booking form (status and signatory are
  recorded; a drawn/typed signature image is not).
- Payment-gateway link generation for the booking advance (the field exists and
  renders in the PDF; nothing generates the URL).

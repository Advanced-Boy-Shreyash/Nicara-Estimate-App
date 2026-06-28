# NICARA Project OS

**Interior Design & Build — Project Management Platform**

Premium CRM + Estimate + Component Library software for interior design firms.

## Project Structure

```
├── frontend/          ← Next.js 16 (deployed to Vercel)
├── backend/           ← Django REST Framework (deployed to MilesWeb)
├── docs/              ← Documentation
│   └── drf_guide.md   ← DRF beginner guide
└── sampleCode/        ← Reference code
```

## Quick Start

### Frontend
```bash
cd frontend
npm install
npm run dev
# → http://localhost:3000
```

### Backend
```bash
cd backend
python -m venv venv
venv\Scripts\activate          # Windows
pip install -r requirements.txt
python manage.py migrate
python manage.py createsuperuser
python manage.py loaddata library/fixtures/initial_library.json
python manage.py runserver
# → http://127.0.0.1:8000
```

## Features

- **Projects & Estimates** — Full project lifecycle management
- **Component Library** — Materials database (plywood, hardware, finishes)
- **PDF Quotes** — Direct PDF download matching professional template
- **IAM** — Page-level access control per user
- **User Management** — Invite-only registration with email
- **Vendor & Client Database** — CRM functionality

## Documentation

See [DRF Guide](docs/drf_guide.md) for backend setup instructions.

# CarbonFlow — Scope 3 Carbon Accounting Platform

## Overview

CarbonFlow is a Phase 1 SaaS application for Scope 3 supply chain carbon accounting. It enables companies to collect carbon emissions data from their suppliers, calculate total CO₂, and generate PDF reports.

## Architecture

```
/
├── frontend/          React + Vite + Tailwind CSS (port 5000)
│   ├── src/
│   │   ├── pages/    Landing, Login, Signup, Dashboard, Suppliers, Reports, SupplierForm
│   │   ├── components/ Sidebar, ProtectedRoute
│   │   ├── context/  AuthContext (Firebase Auth)
│   │   └── services/ api.js (REST calls to backend)
│   └── vite.config.js (proxies /api → localhost:3001)
└── backend/           Node.js + Express (port 3001)
    ├── controllers/   auth, suppliers, emissions, reports
    ├── routes/        auth, suppliers, emissions, reports
    ├── services/      emissionsCalculator.js
    ├── models/        db.js (PostgreSQL with schema init)
    └── middleware/    auth.js (Firebase Admin token verify)
```

## Tech Stack

- **Frontend**: React 18, Vite 5, Tailwind CSS 3, React Router 6
- **Backend**: Node.js, Express.js
- **Auth**: Firebase Authentication (email/password)
- **Database**: PostgreSQL (Replit built-in, via DATABASE_URL)
- **PDF**: jsPDF + jsPDF-autotable
- **Theme**: Dark slate with green brand (#16a34a)

## Database Schema

- `companies` — id, name, email, firebase_uid, created_at
- `suppliers` — id, company_id, name, email_or_phone, status, submission_token, created_at
- `emissions` — id, supplier_id, electricity_usage, fuel_usage, transport_distance, total_co2, created_at

## Key Features (Phase 1)

1. Company signup/login via Firebase Auth
2. Supplier management with unique submission token links
3. Supplier form (no login required) via `/supplier/:token`
4. CO₂ calculation: electricity × 0.233 + fuel × 2.68 + transport × 0.1
5. Dashboard with real-time stats
6. PDF report generation with supplier breakdown

## Environment Variables

- `FIREBASE_API_KEY`, `FIREBASE_AUTH_DOMAIN`, `FIREBASE_PROJECT_ID`, `FIREBASE_APP_ID` — Firebase config (secrets)
- `DATABASE_URL` — PostgreSQL connection (Replit managed)
- `FIREBASE_SERVICE_ACCOUNT_JSON` — Firebase Admin SDK credential (optional, for production token verification)
- `PORT` — Backend port (default 3001)

## Development

The single workflow starts both servers:
- Backend: `cd backend && node server.js` on port 3001
- Frontend: `cd frontend && npm run dev` on port 5000
- Vite proxies `/api/*` → `http://localhost:3001`

## User Roles

- **Company**: Signs up, manages suppliers, views dashboard, downloads reports
- **Supplier**: Receives a unique link, submits data via form (no login required)

## SEO

- `frontend/index.html` — full meta tags, Open Graph, Twitter Card, JSON-LD (Organization, WebSite, SoftwareApplication), `<noscript>` SEO fallback
- `frontend/public/robots.txt` — allows public routes, blocks `/dashboard`, `/api`, `/supplier/<token>`, etc.
- `frontend/public/sitemap.xml` — public routes only (`/`, `/how-to-use`, `/signup`, `/login`)
- `frontend/public/site.webmanifest` — PWA manifest
- `frontend/public/og-image.svg` — 1200x630 social share image
- `frontend/src/hooks/useSEO.js` — per-page hook for title, description, canonical, OG/Twitter, JSON-LD. Called from Landing, Login, Signup, HowToUse, Blog, BlogPost
- `frontend/src/data/blogPosts.js` — blog post content data; add new posts here
- `frontend/src/pages/Blog.jsx` — `/blog` index page
- `frontend/src/pages/BlogPost.jsx` — `/blog/:slug` article page (renders BlogPosting JSON-LD)
- Footer links to Blog added on Landing and HowToUse pages
- Site URL is configurable via `VITE_SITE_URL` env var (defaults to `https://carbonflow.app`). Replace the hard-coded URLs in `index.html`, `robots.txt`, and `sitemap.xml` with the real production domain when published

## Future Expansion

Planned: BRSR/CBAM compliance, AI insights, supplier accounts, third-party integrations

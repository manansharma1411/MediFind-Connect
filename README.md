# MediFind Connect

> **The collaborative intelligence network for medicine access.**

---

## 1. Project Overview

**MediFind Connect** is a next-generation healthcare platform that bridges the gap between medicine seekers and local pharmacy networks. While standard search portals merely list static store directories, MediFind Connect transforms community pharmacies into an interconnected, collaborative intelligence network. 

By unifying patient-facing availability search with B2B inter-pharmacy inventory sharing and regional shortage intelligence, MediFind Connect minimizes prescription stockouts, improves emergency access, and balances medicine distribution across urban neighborhoods.

---

## 2. The Five Core Modules

MediFind Connect is structured into five distinct operational modules:

1. **Patient Discovery & Navigation Portal**
   * Instant, typo-tolerant search across verified local pharmacy stock.
   * Real-time availability status (*In Stock*, *Low Stock*, *Out of Stock*).
   * Transparent medicine price comparisons and active pharmacy operating hours.
   * Integrated turn-by-turn map routing via Leaflet and OpenStreetMap.
   * Temporary "Hold for Pickup" reservation requests.

2. **Community Pharmacy Operations Console**
   * Centralized catalog management for local pharmacists.
   * Fast-entry inventory stock adjustments and batch tracking.
   * Real-time low-stock and upcoming expiration alerts.
   * Digital order and patient hold queue management.

3. **Collaborative Inter-Pharmacy Network (B2B Transfer)**
   * Regional pharmacy discovery for locating out-of-stock emergency medications.
   * Peer-to-peer transfer requisitions between neighboring network stores.
   * Digital waybill generation, runner dispatch, and secure OTP handoff confirmation.
   * Mutual transfer settlement ledger and audit logs.

4. **Regional Shortage Radar & Predictive Restock**
   * Real-time aggregation of unfulfilled patient search spikes.
   * Geographic scarcity heatmaps identifying emerging neighborhood stockouts.
   * Intelligent restock suggestions based on neighborhood consumption velocity.

5. **Network Governance & Trust Layer**
   * Pharmacy verification and drug license credential checks.
   * Standardized salt/generic master drug reference mapping.
   * Secure, auditable transaction and movement histories.

---

## 3. Technology Direction

* **Frontend Architecture (Person A):**
  * **Framework:** React 18 + Vite + TypeScript (Single Page Application)
  * **Styling & Design System:** Tailwind CSS v3 with clinical design tokens
  * **Icons:** Lucide React
  * **Mapping:** Leaflet & React-Leaflet with OpenStreetMap tiles (100% free, zero required API keys)
  * **Analytics & Intelligence Charts:** Recharts
  * **State & Routing:** React Router v6 + modular React Context / hooks
* **Backend & Data Architecture (Person B):**
  * Node.js / Express or modern TypeScript backend
  * Relational Database / PostgreSQL (Supabase)
  * RESTful JSON APIs & real-time webhook updates

---

## 4. Team Responsibilities & Ownership

To ensure clean velocity without merge conflicts on separate machines, the project follows strict functional separation:

| Team Member | Functional Domain | Primary Ownership | Strict Boundaries |
| :--- | :--- | :--- | :--- |
| **Person A** | Senior Frontend Architect & UI/UX Designer | `frontend/`, UI/UX specifications, design tokens, frontend documentation | Must not alter backend code, SQL migrations, or database configurations. |
| **Person B** | Senior Backend Engineer & Database Architect | `backend/`, database models, SQL migrations, authentication, API endpoints | Must not alter frontend components, styling, or client routing. |

---

## 5. Architectural Blueprint

```
MediFind-Connect/
├── docs/
│   ├── architecture/       # System diagrams, component models, data flows
│   └── api-contracts/      # Shared OpenAPI / TypeScript contract specifications
├── frontend/               # React + TypeScript client application (Person A)
│   ├── src/
│   │   ├── components/     # Modular UI primitives (patient, pharmacy, collaboration)
│   │   ├── context/        # Client state (Auth, Location, Network)
│   │   ├── pages/          # 26 specialized application views
│   │   ├── services/       # API client abstractions
│   │   └── types/          # Strict TypeScript interfaces
│   └── package.json
├── backend/                # Server, routes, and business logic (Person B)
│   ├── src/
│   │   ├── controllers/
│   │   ├── models/
│   │   ├── routes/
│   │   └── services/
│   └── package.json
├── .gitignore              # Strict repository exclusion rules
└── README.md               # Project documentation
```

---

## 6. Current Development Status

* **Phase 0:** Frontend & UI/UX Visual Reference Audit — **Completed**.
* **Phase 1:** Environment Setup & Repository Foundation — **In Progress**.
* **Phase 2 (Upcoming):** Design System Foundation & Component Scaffolding.
* *Note:* Application source code (`frontend/` and `backend/`) has not yet been initialized. All feature modules listed above represent planned architectural targets.

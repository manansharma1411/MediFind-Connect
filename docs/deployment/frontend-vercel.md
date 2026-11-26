# Production Deployment Guide: MediFind Connect Frontend on Vercel

This guide documents the complete manual procedure for deploying the **MediFind Connect Frontend** (`frontend/`) to [Vercel](https://vercel.com) and connecting it to Person B's Render backend API.

---

## 1. Vercel Account Setup

1. Navigate to [vercel.com/signup](https://vercel.com/signup).
2. Choose **Continue with GitHub** to link your GitHub account directly.
3. Complete account verification if prompted.

---

## 2. GitHub Repository Connection

1. From your Vercel Dashboard, click **Add New...** → **Project**.
2. Under **Import Git Repository**, locate `manansharma1411/MediFind-Connect`.
   * If the repository is not visible, click **Adjust GitHub App Permissions** and grant Vercel access to `MediFind-Connect`.
3. Click **Import** next to `MediFind-Connect`.

---

## 3. Root Directory Configuration

Because MediFind Connect is a monorepo containing both `frontend/` and `backend/`, you **must** configure the Root Directory before deploying:

1. In the **Configure Project** screen, locate **Root Directory**.
2. Click **Edit** and select or enter:
   ```text
   frontend
   ```
3. Confirm the selection. Vercel will now read `frontend/package.json` and `frontend/package-lock.json`.

---

## 4. Framework Selection

* **Framework Preset:** `Next.js` (Vercel auto-detects Next.js once Root Directory is set to `frontend`).

---

## 5. Build and Installation Settings

Leave or verify the following settings under **Build and Output Settings**:

| Setting | Value | Notes |
| :--- | :--- | :--- |
| **Framework Preset** | `Next.js` | Auto-detected |
| **Root Directory** | `frontend` | **CRITICAL:** Required for monorepo |
| **Install Command** | `npm ci` (or default `npm install`) | Uses existing `frontend/package-lock.json` |
| **Build Command** | `npm run build` | Executes `next build` from `frontend/package.json` |
| **Output Directory** | *(Default / Leave empty)* | Managed automatically by Vercel's Next.js adapter |

---

## 6. Environment Variable Setup

Before clicking **Deploy**, expand the **Environment Variables** section and add:

| Name | Value | Environment |
| :--- | :--- | :--- |
| `NEXT_PUBLIC_API_BASE_URL` | `https://<your-render-service>.onrender.com` | Production (and Preview if testing against staging/Render) |

> [!IMPORTANT]
> * Replace `https://<your-render-service>.onrender.com` with the **actual live Render backend URL** provided by Person B.
> * **Never** use `http://localhost:5000` in Vercel's Production environment.
> * **Never** place private backend or Supabase `service_role` secrets into `NEXT_PUBLIC_*` variables—anything prefixed with `NEXT_PUBLIC_` is bundled into browser JavaScript.
> * Whether you enter the Render URL with or without `/api` (e.g., `https://medifind-backend.onrender.com` or `https://medifind-backend.onrender.com/api`), `src/services/apiClient.ts` normalizes the path so `/api` is never duplicated.

---

## 7. Production Deployment Steps

1. Verify **Root Directory** is `frontend`.
2. Verify **Environment Variables** contains `NEXT_PUBLIC_API_BASE_URL`.
3. Click **Deploy**.
4. Vercel will clone `main`, install dependencies from `frontend/package-lock.json`, run `npm run build`, and publish your Next.js App Router build.
5. Once complete, Vercel will display your live production domain (e.g., `https://<project-name>.vercel.app`).
6. Open your live URL and verify that the landing page loads and the `BackendHealthBadge` queries `/api/health` cleanly.

---

## 8. Preview Deployments (Pull Requests & Feature Branches)

* Whenever you push commits to `feature/person-a-frontend` or open a Pull Request against `main`, Vercel automatically creates an isolated **Preview Deployment** with its own unique URL (e.g., `https://<project-name>-git-feature-person-a-frontend-<scope>.vercel.app`).
* Preview deployments allow you to test UI changes before merging into `main`.
* Only commits merged into `main` update the **Production** deployment.

---

## 9. How to Inspect Deployment Logs

1. Open your project in the **Vercel Dashboard**.
2. Click the **Deployments** tab and select any deployment.
3. Expand **Building** to inspect `npm ci`, TypeScript checking, and `next build` logs.
4. Click **Runtime Logs** (or **Logs**) to inspect server-side or edge execution logs.

---

## 10. CORS Coordination with Person B (Render Backend)

Once Vercel assigns your production domain, send the exact **Vercel Production URL** (without a trailing slash) to **Person B** so they can add it to `FRONTEND_ORIGIN` in Render:

```text
https://<your-vercel-project>.vercel.app
```

*(Example format for Person B's Render `FRONTEND_ORIGIN`: `https://<your-vercel-project>.vercel.app,http://localhost:3000`)*

If you also want Preview Deployments to talk to Render, coordinate with Person B on whether to allow your specific preview URL.

---

## 11. Common Build & Routing Errors

| Error / Symptom | Cause | Solution |
| :--- | :--- | :--- |
| **`404: NOT_FOUND` or missing `package.json` during build** | Root Directory was left at repository root instead of `frontend`. | Go to **Settings → General → Root Directory**, set it to `frontend`, and redeploy. |
| **API calls hit `https://.../api/api/health`** | Duplicate `/api` prefix. | Handled automatically by `apiClient.resolveUrl()`, which strips duplicate `/api` segments. |
| **`API Standby (Backend Offline)` or CORS error in browser console** | `NEXT_PUBLIC_API_BASE_URL` missing/incorrect, Render free tier sleeping, or Vercel domain missing from Render `FRONTEND_ORIGIN`. | Verify `NEXT_PUBLIC_API_BASE_URL` in Vercel **Settings → Environment Variables**, redeploy (env vars are baked at build time), and confirm Person B added your exact `https://...vercel.app` origin. |
| **Windows local build Turbopack panic (`@tailwindcss/turbopack`)** | Node 24 + Windows IPC issue in Turbopack CSS loader. | On Vercel (Linux), `npm run build` runs cleanly. Locally on Windows, run `npx next build --webpack` if Turbopack panics. |

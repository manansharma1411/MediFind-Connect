# Production Deployment Guide: MediFind Connect Backend on Render

This guide outlines the complete manual procedure for deploying the **MediFind Connect Backend API** to [Render](https://render.com) as a managed Web Service.

---

## 1. Prerequisites
* A Render account ([render.com](https://render.com)).
* GitHub account with access to the shared repository: `https://github.com/manansharma1411/MediFind-Connect`.
* Your Supabase project URL, Anon Key, and Service Role Key (from your Supabase dashboard).

---

## 2. Step-by-Step Render Web Service Setup

### 2.1 Create New Web Service
1. Log in to your [Render Dashboard](https://dashboard.render.com).
2. Click the **`+ New`** button in the top navigation bar and select **`Web Service`**.
3. Under **Connect a repository**, select the repository: `manansharma1411/MediFind-Connect`.
   *(If not visible, click "Configure GitHub App" to grant Render access to the repository).*

### 2.2 Configure Service Parameters
Configure the service settings exactly as specified below:

| Setting | Value to Enter | Explanation |
| :--- | :--- | :--- |
| **Name** | `medifind-connect-backend` | Unique identifier for your service on Render |
| **Region** | `Singapore (Southeast Asia)` or `Frankfurt (EU Central)` | Choose the closest region to India for optimal latency |
| **Branch** | `main` | Production branch to deploy from |
| **Root Directory** | `backend` | **CRITICAL:** Tells Render to build from the `backend/` folder |
| **Runtime** | `Node` | Standard Node.js execution runtime |
| **Build Command** | `npm install && npm run build` | Installs dependencies and runs `tsc` to compile TypeScript into `dist/` |
| **Start Command** | `npm start` | Runs the compiled production server (`node dist/server.js`) |
| **Instance Type** | `Free` | Free tier ($0/month) |

---

## 3. Environment Variables Configuration

In the Render Web Service creation screen, scroll down to the **Environment Variables** section and manually add the following keys:

| Variable Name | Required Value | Notes |
| :--- | :--- | :--- |
| `NODE_ENV` | `production` | Enables production security optimizations and hides internal error traces |
| `PORT` | `10000` | Render default port (Render injects this dynamically if omitted) |
| `FRONTEND_ORIGIN` | `https://your-frontend.vercel.app,http://localhost:5173` | Comma-separated list of allowed origins. Add Person A's Vercel URL when ready |
| `SUPABASE_URL` | `https://your-project-id.supabase.co` | Your live Supabase project URL |
| `SUPABASE_ANON_KEY` | *(Your Supabase anon key)* | Public key from Supabase Project Settings -> API |
| `SUPABASE_SERVICE_ROLE_KEY` | *(Your Supabase service-role key)* | Secret administrative key from Supabase. **Never share publicly** |

> [!WARNING]
> Do NOT commit real secrets into Git. Enter them directly into the Render Dashboard interface under **Environment**.

---

## 4. Health Check Configuration

Render uses an automated health-check probe to confirm zero-downtime deployments before routing public traffic:

1. Scroll down to **Advanced** settings in your Render Web Service.
2. Under **Health Check Path**, enter:
   ```text
   /api/health
   ```
3. When Render spins up the container, it will probe `http://localhost:<PORT>/api/health`. If it receives HTTP `200 OK`, the deployment is marked **Live**.

---

## 5. Verifying the Live Deployment

### 5.1 Inspecting Deployment Logs
1. Click on your service in the Render Dashboard.
2. Navigate to the **Logs** tab.
3. You should observe:
   ```text
   ==> Running build command 'npm install && npm run build'...
   ==> Build successful 🎉
   ==> Starting service with 'npm start'...
   {"timestamp":"...","level":"INFO","message":"MediFind Connect API Service started successfully","meta":{"port":10000,"host":"0.0.0.0","environment":"production","healthCheck":"/api/health"}}
   ==> Service is live 🎉
   ```

### 5.2 Testing the Live Endpoints
Once live, Render assigns your service a public URL (e.g., `https://medifind-connect-backend.onrender.com`).

Verify using curl or your browser:

1. **Test Liveness Endpoint:**
   ```bash
   curl -i https://<your-render-url>.onrender.com/api/health
   ```
   **Expected Response (200 OK):**
   ```json
   {
     "success": true,
     "message": "MediFind Connect API is running",
     "data": {
       "status": "ok",
       "message": "MediFind Connect API is running",
       "app": "MediFind Connect API",
       "version": "1.0.0",
       "environment": "production",
       "timestamp": "..."
     },
     "timestamp": "..."
   }
   ```

2. **Test Supabase Readiness Endpoint:**
   ```bash
   curl -i https://<your-render-url>.onrender.com/api/readiness
   ```
   **Expected Response (200 OK):**
   ```json
   {
     "success": true,
     "data": {
       "status": "ready",
       "database": {
         "configured": true,
         "connected": true,
         "latencyMs": 42,
         "message": "Supabase PostgreSQL connection verified."
       }
     }
   }
   ```

---

## 6. Common Deployment Failures & Troubleshooting

### Issue 1: "Service timed out waiting for port"
* **Cause:** The server listened only on `127.0.0.1` (localhost) rather than `0.0.0.0`.
* **Fix:** In `backend/src/server.ts`, we explicitly bind to `0.0.0.0` (`app.listen(env.PORT, '0.0.0.0', ...)`).

### Issue 2: "Cannot find module dist/server.js"
* **Cause:** `npm run build` was omitted or failed.
* **Fix:** Ensure the Render Build Command is set to `npm install && npm run build`.

### Issue 3: "CORS error: Origin not allowed"
* **Cause:** Person A's frontend domain is not listed in `FRONTEND_ORIGIN`.
* **Fix:** Go to Render Dashboard -> Environment -> Edit `FRONTEND_ORIGIN` to include Person A's Vercel production URL.

### Issue 4: Render Free Tier Spin-Down (Cold Starts)
* **Behavior:** On Render's Free tier, services spin down after 15 minutes of inactivity. The first request after idle can take ~30–50 seconds.
* **Mitigation:** Normal behavior for development/free tier. The health check automatically warms up the instance.

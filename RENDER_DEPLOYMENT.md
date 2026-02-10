# Deployment Guide — Render + Supabase

## Architecture

- **App Server:** Render (free tier) — runs Node.js + Express + Puppeteer
- **Database:** Supabase (free tier) — managed PostgreSQL with 500MB storage

## Prerequisites

- GitHub repository with this project
- [Render](https://render.com) account (free)
- [Supabase](https://supabase.com) account (free)

## Step 1: Set Up Supabase Database

1. Go to [supabase.com](https://supabase.com) and create a new project
   - Choose a **region close to Oregon** (e.g., US West) to minimize latency with Render
   - Set a strong database password — save it
2. Wait for the project to finish provisioning (~2 minutes)
3. Go to **Settings → Database → Connection string**
4. Copy **two** connection strings:

| Variable | Which one | Port | Purpose |
|----------|-----------|------|---------|
| `DATABASE_URL` | **Transaction mode (Pooler)** | `6543` | App runtime queries |
| `DIRECT_URL` | **Session mode (Pooler)** | `5432` | Prisma migrations |

> Append `?pgbouncer=true` to `DATABASE_URL` if not already present.

Example:
```
DATABASE_URL=postgresql://postgres.[ref]:[password]@aws-0-us-west-1.pooler.supabase.com:6543/postgres?pgbouncer=true
DIRECT_URL=postgresql://postgres.[ref]:[password]@aws-0-us-west-1.pooler.supabase.com:5432/postgres
```

## Step 2: Deploy to Render

### Option A: Blueprint (Recommended)

1. Push code to GitHub
2. Go to [Render Dashboard](https://dashboard.render.com)
3. Click **"New" → "Blueprint"**
4. Connect your GitHub repository
5. Render auto-detects `render.yaml` and creates the web service
6. Click **"Apply"**
7. Go to **Web Service → Environment** and set:
   - `DATABASE_URL` → Supabase pooled connection string (port 6543)
   - `DIRECT_URL` → Supabase direct connection string (port 5432)
8. Click **"Manual Deploy" → "Deploy latest commit"**

### Option B: Manual Setup

1. Go to [Render Dashboard](https://dashboard.render.com)
2. Click **"New" → "Web Service"**
3. Connect your GitHub repository
4. Configure:
   - **Name:** `tes-forms`
   - **Environment:** `Node`
   - **Region:** Oregon
   - **Branch:** `main`
   - **Build Command:**
     ```
     npm install && PUPPETEER_CACHE_DIR=/opt/render/project/.cache/puppeteer npx puppeteer browsers install chrome && npm run build && node scripts/init-database.js
     ```
   - **Start Command:** `npm start`
   - **Plan:** Free
5. Add environment variables:

| Key | Value |
|-----|-------|
| `NODE_ENV` | `production` |
| `DATABASE_URL` | Supabase pooled connection string (port 6543) |
| `DIRECT_URL` | Supabase direct connection string (port 5432) |
| `PUPPETEER_CACHE_DIR` | `/opt/render/project/.cache/puppeteer` |

> **Note:** `PUPPETEER_EXECUTABLE_PATH` is not needed. The app automatically finds Chrome in the cache directory.

6. Click **"Create Web Service"**

## Step 3: Run Initial Migration

Migrations run during the build step. If you need to run them manually:

1. In Render Dashboard → Web Service → **Shell** (or connect locally)
2. Run:
   ```bash
   npx prisma migrate deploy
   ```

Or create the first migration locally:
```bash
npx prisma migrate dev --name init
```
Then commit `prisma/migrations/` and push to GitHub. Render will apply it on next deploy.

## Post-Deployment

### Verify Everything Works

1. Visit `https://your-app-name.onrender.com`
2. Create a test application
3. Click "Save & Export PDF" to verify PDF generation
4. Check Supabase Dashboard → Table Editor to see the saved data

### Monitor

- **App logs:** Render Dashboard → Web Service → Logs
- **Database:** Supabase Dashboard → Table Editor / SQL Editor
- First request after idle takes ~30-50s (Render free tier cold start)
- Subsequent requests: <2s

## Troubleshooting

### Database Connection Fails

**Error:** `Can't reach database server`

- Verify `DATABASE_URL` and `DIRECT_URL` are set correctly in Render
- Check Supabase project is not paused (free tier pauses after 7 days of inactivity — click "Restore" in dashboard)

### PDF Generation Fails

**Error:** `Failed to launch the browser process!`

- Ensure `PUPPETEER_CACHE_DIR` is set to `/opt/render/project/.cache/puppeteer`
- Check build logs to confirm Chrome was installed
- Verify the build command includes `npx puppeteer browsers install chrome`

### Prisma Migration Fails

**Error:** `Migration failed to apply`

- Ensure `DIRECT_URL` is set (Prisma needs a direct connection, not pooled, for migrations)
- Try running `npx prisma migrate deploy` from Render Shell

### Supabase Project Paused

Supabase free tier pauses projects after **7 days of inactivity**. To prevent this:
- Your app's regular traffic keeps the project active
- If paused, go to Supabase Dashboard and click "Restore project"

## Free Tier Limits

### Render (Web Service)
| Resource | Limit |
|----------|-------|
| Hours | 750 hours/month |
| RAM | 512 MB |
| Cold Start | ~30-50s after 15 min idle |
| Build Minutes | Unlimited |

### Supabase (Database)
| Resource | Limit |
|----------|-------|
| Storage | 500 MB |
| Bandwidth | 5 GB/month |
| API Requests | Unlimited |
| Pause Policy | After 7 days inactivity |

## Upgrade Path

If you outgrow the free tier:
- **Render Starter ($7/mo):** No cold starts, always on
- **Supabase Pro ($25/mo):** 8 GB storage, no pausing, daily backups

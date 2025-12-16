# Render Deployment Guide

## Prerequisites
- GitHub repository with this project
- Render account (free): https://render.com

## Deployment Steps

### 1. Push Code to GitHub
```bash
git init
git add .
git commit -m "Initial commit - ready for Render"
git remote add origin <your-repo-url>
git push -u origin main
```

### 2. Create New Web Service on Render

**Option A: Using render.yaml (Recommended)**
1. Go to https://dashboard.render.com
2. Click "New" → "Blueprint"
3. Connect your GitHub repository
4. Render will auto-detect `render.yaml` and create:
   - Web service (tes-forms)
   - PostgreSQL database (tes-forms-db)
5. Click "Apply" to deploy

**Option B: Manual Setup**
1. Go to https://dashboard.render.com
2. Click "New" → "PostgreSQL"
   - Name: `tes-forms-db`
   - Plan: Free
   - Region: Oregon (or preferred)
   - Click "Create Database"
3. Click "New" → "Web Service"
   - Connect GitHub repository
   - Name: `tes-forms`
   - Environment: `Node`
   - Region: Same as database
   - Branch: `main`
   - Build Command: `npm install && npm run build && npx prisma migrate deploy`
   - Start Command: `npm start`
   - Plan: Free
   
### 3. Configure Environment Variables
In the Web Service settings, add:

| Key | Value |
|-----|-------|
| `NODE_ENV` | `production` |
| `DATABASE_URL` | *Copy from PostgreSQL instance* |
| `PUPPETEER_SKIP_CHROMIUM_DOWNLOAD` | `true` |
| `PUPPETEER_EXECUTABLE_PATH` | `/usr/bin/chromium-browser` |

**To get DATABASE_URL:**
1. Open your PostgreSQL database in Render dashboard
2. Copy "Internal Database URL" (starts with `postgresql://`)
3. Paste into `DATABASE_URL` environment variable

### 4. Deploy
- First deploy happens automatically
- Monitor logs in Render dashboard
- Look for: `🚀 Server running on http://0.0.0.0:<PORT>`

### 5. Initial Database Migration
Migrations run automatically during build via `npx prisma migrate deploy`.

If you need to create the first migration:
1. Locally run: `npx prisma migrate dev --name init`
2. Commit the new migration file in `prisma/migrations/`
3. Push to GitHub
4. Render will apply it on next deploy

## Post-Deployment

### Access Your App
Your app will be available at: `https://tes-forms.onrender.com` (or your custom name)

### Test PDF Generation
1. Visit: `https://your-app.onrender.com`
2. Create a test application
3. Click "Save & Export PDF"
4. Verify PDF downloads correctly

### Monitor Performance
- First request after idle: ~50s (cold start)
- Subsequent requests: <2s
- Check logs in Render dashboard for errors

## Troubleshooting

### PDF Generation Fails
**Error:** `Error: Failed to launch the browser process!`

**Solution:** Verify Puppeteer environment variables are set:
```bash
PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
```

Check build logs show Chrome installation succeeded.

### Database Connection Fails
**Error:** `Can't reach database server`

**Solution:** 
1. Verify `DATABASE_URL` is set correctly (use Internal URL, not External)
2. Ensure web service and database are in same region
3. Check database is active (free tier suspends after 90 days inactivity)

### Build Fails on Prisma Migration
**Error:** `Migration failed to apply`

**Solution:**
- Render free PostgreSQL sometimes needs manual migration
- Use Render Shell to run: `npx prisma migrate deploy`

### Out of Memory (RAM)
**Error:** `JavaScript heap out of memory`

**Solution:**
- Free tier has 512 MB RAM limit
- Puppeteer uses ~200 MB per PDF generation
- If multiple concurrent requests fail, consider paid plan ($7/mo = 512 MB → 1 GB)

## Maintenance

### Update Environment Variable
1. Dashboard → Web Service → Environment
2. Edit variable → Save
3. Redeploy (click "Manual Deploy")

### View Logs
Dashboard → Web Service → Logs (real-time)

### Redeploy
- **Automatic:** Push to GitHub `main` branch
- **Manual:** Dashboard → Manual Deploy → Deploy latest commit

### Backup Database
```bash
# Download backup from Render dashboard
# Or use pg_dump via Render Shell:
pg_dump $DATABASE_URL > backup.sql
```

## Free Tier Limits

| Resource | Limit |
|----------|-------|
| Web Service | 750 hours/month (24/7 for 1 app) |
| Database Storage | 1 GB |
| Database Bandwidth | Unlimited within Render |
| Build Minutes | Unlimited |
| Cold Start | ~50 seconds after 15 min idle |

## Upgrade Path
If you outgrow free tier:
- **Starter Plan ($7/mo):** No cold starts, 512 MB RAM
- **Standard Plan ($25/mo):** 2 GB RAM, horizontal scaling

## Support Resources
- Render Docs: https://render.com/docs
- Puppeteer on Render: https://render.com/docs/web-services#puppeteer
- Community: https://community.render.com

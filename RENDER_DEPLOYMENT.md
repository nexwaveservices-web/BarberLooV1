# BarberLoo — Render Deployment Guide (Production)

Website: **https://barberloo.in**  
Brand Pronunciation: **BarberLo** (*Barber-low*)  
Repository: **nexwaveservices-web/BarberLooV1**  

This repository is pre-configured for one-click or manual deployment to **Render** (https://render.com) as a full-stack Node.js + React web service.

---

## Method 1: Blueprint Deployment (Recommended — Instant Setup)

Render will automatically read `render.yaml` from this repository:

1. Log in to your [Render Dashboard](https://dashboard.render.com).
2. Click **New +** in the top navigation bar and select **Blueprint**.
3. Connect your GitHub repository: `nexwaveservices-web/BarberLooV1`.
4. Render will detect `render.yaml` and configure the Web Service automatically.
5. In the environment variables prompt, enter your secrets:
   - `RAZORPAY_KEY_SECRET`: *(Your private Razorpay Key Secret from Razorpay Dashboard)*
   - `RAZORPAY_WEBHOOK_SECRET`: *(Your private Razorpay Webhook Secret)*
   - `DATABASE_URL`: *(Your Supabase or PostgreSQL connection string, e.g. `postgresql://...`)*
6. Click **Apply**. Render will run `npm install && npm run build` and launch `npm start`.

---

## Method 2: Manual Web Service Setup

If you prefer to configure the Web Service manually:

### 1. Create Web Service
1. In Render Dashboard, click **New +** -> **Web Service**.
2. Select your repository: `nexwaveservices-web/BarberLooV1`.
3. Fill in the following basic service settings:
   - **Name**: `barberloo` (or `barberloo-web`)
   - **Region**: `Singapore` (closest to India / Asia users) or `Frankfurt` / `Oregon`
   - **Branch**: `main`
   - **Runtime**: `Node`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
   - **Plan**: `Free` or `Starter` ($7/mo for zero spin-down)

### 2. Configure Advanced Settings
- **Health Check Path**: `/healthz` (or `/api/health`)
- **Auto-Deploy**: `Yes` (deploys on every git push to `main`)

### 3. Environment Variables

Under **Environment Variables** in Render, add the following key-value pairs:

| Variable Key | Value | Description |
|---|---|---|
| `NODE_ENV` | `production` | Enables production static asset serving & security |
| `PORT` | *(Leave empty)* | Render automatically assigns and binds `PORT` (e.g. 10000) |
| `VITE_SUPABASE_URL` | `https://ddusvfylhifoniobzmcq.supabase.co` | Supabase Cloud API URL |
| `VITE_SUPABASE_ANON_KEY` | `sb_publishable_bUpxVfRsVPz_d0qg1QrrNA_m7zM66t6` | Supabase Public Anon Key |
| `RAZORPAY_KEY_ID` | `rzp_live_TxxTT810pVluT8` | Razorpay Live Key ID |
| `RAZORPAY_KEY_SECRET` | *(Private Key Secret)* | Private Razorpay Secret Key (Never expose to client) |
| `RAZORPAY_WEBHOOK_SECRET` | *(Private Webhook Secret)* | Private Razorpay Webhook Signing Secret |
| `VITE_RAZORPAY_KEY_ID` | `rzp_live_TxxTT810pVluT8` | Client-Side Razorpay Key ID |
| `DATABASE_URL` | *(Optional / Recommended)* | Postgres connection string for direct SQL queries |

---

## Connecting Custom Domain (`barberloo.in`)

1. In your Render Web Service settings, go to **Settings** -> **Custom Domains**.
2. Click **Add Custom Domain** and enter:
   - `barberloo.in`
   - `www.barberloo.in`
3. Update your DNS records at your domain registrar (Hostinger / GoDaddy / Cloudflare):
   - **CNAME Record**: `www` -> `<your-service-name>.onrender.com`
   - **ANAME/ALIAS Record** or **A Record**: `@` -> `216.24.57.1` (Render's Apex IP)
4. Render will automatically issue free, auto-renewing Let's Encrypt SSL certificates.

---

## Verifying Deployment

Once deployed on Render, verify:
- **Health check**: `https://<your-service>.onrender.com/healthz` (returns `{"status":"ok","service":"barberloo"}`)
- **Homepage & Booking**: `https://<your-service>.onrender.com/`
- **Razorpay Live Checkout**: Tested and verified with key `rzp_live_TxxTT810pVluT8`

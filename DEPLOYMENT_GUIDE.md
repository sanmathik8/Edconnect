# Deployment Guide for Recom

This guide explains how to deploy the application to free hosting services: **Render** (Backend) and **Vercel** (Frontend).

## Prerequisites
1.  **GitHub Account**: You must push this code to a GitHub repository.
2.  **Render Account**: [Sign up here](https://render.com/).
3.  **Vercel Account**: [Sign up here](https://vercel.com/).
4.  **Neon Account (Optional)**: [Sign up here](https://neon.tech/) for a free PostgreSQL database.

---

## 1. Push Code to GitHub

First, create a new repository on GitHub and push your code:

```bash
git init
git add .
git commit -m "Initial commit for deployment"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
git push -u origin main
```

---

## 2. Deploy Backend (Render)

1.  Go to your [Render Dashboard](https://dashboard.render.com/).
2.  Click **New +** -> **Web Service**.
3.  Connect your GitHub repository.
4.  **Configuration**:
    *   **Name**: `recom-backend` (or similar)
    *   **Root Directory**: `backend` (Important!)
    *   **Runtime**: `Docker`
    *   **Instance Type**: `Free`
5.  **Environment Variables** (Add these):
    *   `SECRET_KEY`: (Generate a random string)
    *   `DEBUG`: `False`
    *   `ALLOWED_HOSTS`: `*`
    *   `CORS_ALLOWED_ORIGINS`: `https://YOUR-VERCEL-FRONTEND-URL.vercel.app` (You will update this later after deploying frontend)
    *   `DATABASE_URL`: (Paste your Neon/Supabase connection string here. If empty, it uses SQLite which **wipes data on restart**).
    *   `AI_FEATURES_ENABLED`: `False` (Recommended for Free Tier to save RAM).
6.  Click **Create Web Service**.
7.  Wait for deployment. Copy your Backend URL (e.g., `https://recom-backend.onrender.com`).

---

## 3. Deploy Frontend (Vercel)

1.  Go to your [Vercel Dashboard](https://vercel.com/dashboard).
2.  Click **Add New...** -> **Project**.
3.  Import your GitHub repository.
4.  **Project Configuration**:
    *   **Framework Preset**: Next.js
    *   **Root Directory**: Click "Edit" and select `frontend`.
5.  **Environment Variables**:
    *   `NEXT_PUBLIC_API_URL`: `https://recom-backend.onrender.com/api` (Use the URL from Step 2).
6.  Click **Deploy**.

---

## 4. Final Connection

1.  Once Vercel finishes, copy your **Frontend URL** (e.g., `https://recom-frontend.vercel.app`).
2.  Go back to **Render** -> **Environment**.
3.  Edit `CORS_ALLOWED_ORIGINS` and add your Vercel URL (remove any trailing slash).
    *   Example: `https://recom-frontend.vercel.app`
4.  **Save Changes** (Render will redeploy).

## 5. Troubleshooting
*   **Database Wiped?**: Use Neon/Supabase instead of SQLite.
*   **"Bad Request (400)"**: Check `ALLOWED_HOSTS` in Render env vars.
*   **"CORS Error"**: Check `CORS_ALLOWED_ORIGINS` in Render env vars.

Good luck!

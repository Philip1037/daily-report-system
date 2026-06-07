# Deploying to Render & Supabase

This guide outlines the steps required to set up **Supabase** as the database/storage layer and deploy the **Daily Report System** web application on **Render.com**.

---

## Part 1: Supabase Setup

Supabase will store users, departments, and reports in database tables, and save uploaded proof-of-work images in a storage bucket.

### 1. Create the Database Tables
Go to your **Supabase Project Dashboard**, click on **SQL Editor** in the left menu, click **New Query**, paste the following SQL schema, and click **Run**:

```sql
-- 1. Create 'users' table
CREATE TABLE IF NOT EXISTS users (
    username TEXT PRIMARY KEY,
    password TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('worker', 'management'))
);

-- Seed default user accounts (matching local database seeds)
INSERT INTO users (username, password, role) 
VALUES 
('innovativesl', 'innovative1037', 'worker'),
('admin', 'admin1037', 'management')
ON CONFLICT (username) DO NOTHING;

-- 2. Create 'departments' table
CREATE TABLE IF NOT EXISTS departments (
    name TEXT PRIMARY KEY
);

-- Seed default departments
INSERT INTO departments (name) 
VALUES 
('Engineering'), 
('Sales'), 
('HR'), 
('Marketing'), 
('Finance'), 
('Operations'), 
('Customer Support')
ON CONFLICT (name) DO NOTHING;

-- 3. Create 'reports' table
CREATE TABLE IF NOT EXISTS reports (
    id TEXT PRIMARY KEY,
    "employeeName" TEXT NOT NULL,
    department TEXT NOT NULL,
    content TEXT NOT NULL,
    "imagePath" TEXT, -- Stores JSON array of image URLs (or single string for backwards compatibility)
    "submittedBy" TEXT REFERENCES users(username) ON DELETE SET NULL,
    "createdAt" TIMESTAMPTZ DEFAULT NOW()
);
```

### 2. Configure Storage Bucket for Images
Reports support uploading up to 5 proof-of-work images. We must create a Supabase storage bucket named `report-images`.

1. Go to your **Supabase Dashboard** -> **Storage**.
2. Click **New Bucket**.
3. Set the Bucket Name exactly to: **`report-images`**.
4. Toggle the **Public bucket** switch to **Enabled** (so public URLs can be generated for rendering reports).
5. Click **Save** or **Create**.
6. Select the `report-images` bucket, click **Policies**, and ensure public select permissions are enabled. You can set the following storage policies under **Storage Policies**:
   - **Allowed operations**: Select `Insert`, `Select`, and `Delete` for authenticated users (or anon/all if you wish to simplify testing).

---

## Part 2: Render.com Deployment

Render will host the Node.js web server. Since you've pushed the code to GitHub, Render can deploy it directly and automatically trigger redeployments on push.

### 1. Create a Web Service on Render
1. Log into [Render.com](https://render.com).
2. Click **New +** -> **Web Service**.
3. Connect your GitHub account and select your repository: **`daily-report-system`**.
4. Configure the Web Service settings:
   - **Name**: `daily-report-system` (or any custom name)
   - **Environment**: `Node`
   - **Region**: Choose the region closest to you
   - **Branch**: `main`
   - **Build Command**: `npm install`
   - **Start Command**: `node server.js`
   - **Plan**: `Free` (or any tier of your choice)

### 2. Configure Environment Variables
In the Render Web Service configuration dashboard, click the **Variables** (or **Environment**) tab and add the following keys:

| Key | Value | Notes |
| :--- | :--- | :--- |
| `SUPABASE_URL` | *Your Supabase project URL* | e.g. `https://yourprojectid.supabase.co` |
| `SUPABASE_KEY` | *Your Supabase API Key* | The `anon` or `service_role` key found in API settings |
| `PORT` | `10000` | Render usually sets this automatically, but you can define it. |
| `NODE_ENV` | `production` | Recommended for production optimization. |

### 3. Deploy
1. Click **Create Web Service** at the bottom of the page.
2. Render will pull your repository, install the dependencies, link to your Supabase database, and start the server.
3. Once the build log states `Server is running at http://localhost:10000` (or similar), click the public URL provided at the top of the Render page (e.g. `https://daily-report-system.onrender.com`) to open your live web application!

# Setup Guide - Database & Authentication

## What Was Fixed

The login issue was caused by each group member potentially using a **different or disconnected MongoDB database**. The credentials weren't hardcoded—they just didn't exist in the shared database.

### Changes Made:
1. ✅ Added **automatic demo account seeding** on server startup
2. ✅ All group members now have access to: `gabrielcarpio12343@gmail.com` / `Warlordid619`
3. ✅ Demo account is created only once per database

## Setup Instructions for Group Members

### Step 1: Set up MongoDB Atlas (if not done)
1. Go to https://www.mongodb.com/cloud/atlas
2. Create a free cluster
3. Get your connection string from the "Connect" button
4. Format: `mongodb+srv://username:password@cluster-name.mongodb.net/thesis_software`

### Step 2: Configure Backend
Create `.env` files in both locations:

**`Backend/.env`:**
```
MONGODB_URI=mongodb+srv://ilcarpio3956qc_db_user:<db_password>@cluster0.roo7wsb.mongodb.net/?appName=Cluster0
MONGODB_DB=thesis_software
PORT=4000
MONGODB_TLS_INSECURE=true
```

**`server/.env`:**
```
MONGODB_URI=mongodb+srv://ilcarpio3956qc_db_user:<db_password>@cluster0.roo7wsb.mongodb.net/?appName=Cluster0
MONGODB_DB=thesis_software
PORT=4000
MONGODB_TLS_INSECURE=true
```

### Step 3: Configure Frontend
Create `FrontEnd/.env`:
```
VITE_API_BASE_URL=http://localhost:4000
```

### Step 4: Start the Servers

**API Server** (run from `Backend/` or `server/`):
```bash
npm install
npm run dev
```

**Frontend** (run from `FrontEnd/`):
```bash
npm install
npm run dev
```

### Step 5: Login
- **Email:** `gabrielcarpio12343@gmail.com`
- **Password:** `Warlordid619`

The demo account will be created automatically when the backend starts up.

## Important Notes

- ✅ **All group members must use the same `MONGODB_URI`** to see shared accounts and data
- ✅ New user signups will be stored in the same database
- ✅ The demo account persists—subsequent server restarts will just verify it exists
- ⚠️ **Never commit `.env` files to git** (they contain credentials)

## Troubleshooting

**"Invalid email or password":**
- Ensure backend is running (`npm run dev`)
- Check that `MONGODB_URI` is correct and network access is enabled on MongoDB Atlas
- If you get an SSL/TLS handshake error, try adding `MONGODB_TLS_INSECURE=true` locally and restart the API
- Verify you're all connected to the same database

**API connection fails:**
- Make sure `VITE_API_BASE_URL` in frontend `.env` matches your backend port
- Default is `http://localhost:4000`

**"Email is already registered" on signup:**
- This is expected if the email already exists—just use a different email or login instead

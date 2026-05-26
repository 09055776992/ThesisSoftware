# SCHOLAR System - Complete Setup Guide

## System Architecture Overview

This system consists of **three main components** that must all be running:

| Component | Technology | Port | Purpose |
|-----------|-----------|------|---------|
| **Frontend** | React + Vite | 5173 | User interface (Student & Admin panels) |
| **Backend** | Node.js + Express | 5000 | Main API, authentication, scholarship management |
| **AI-Backend** | Python + FastAPI | 8000 | BERT document analysis, SHAP explainability |

---

## Prerequisites

### Required Software
1. **Node.js** (v18 or higher): https://nodejs.org
2. **Python** (3.11 recommended): https://python.org
3. **Git**: https://git-scm.com
4. **MongoDB** (local or Atlas): https://mongodb.com

### Verify Installation
```bash
node --version    # Should show v18.x or higher
npm --version     # Should show 9.x or higher
python --version  # Should show 3.11.x
pip --version     # Should show 23.x or higher
```

---

## Step-by-Step Setup

### Step 1: Clone and Checkout the Branch

```bash
# Clone the repository
git clone https://github.com/09055776992/ThesisSoftware.git
cd ThesisSoftware

# Checkout the feature branch (or main)
git checkout feature/modernbert-migration

# Or for the latest features
git checkout NewFeature
```

---

### Step 2: Configure Environment Variables

**⚠️ IMPORTANT:** Create `.env` files in the following locations. **NEVER commit these files to GitHub** (they are already in `.gitignore`).

#### A. Backend `.env` (`Backend/.env`)

```env
# MongoDB Connection (choose one)
# Option 1: Local MongoDB
MONGODB_URI=mongodb://localhost:27017/scholar_db

# Option 2: MongoDB Atlas (cloud)
# MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/scholar_db

# Server Port
PORT=5000

# JWT Secret (generate a random string)
JWT_SECRET=your_random_secret_key_here_change_this

# Email Configuration (for notifications - optional)
EMAIL_SERVICE=gmail
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_password

# AI-Backend URL
AI_BACKEND_URL=http://localhost:8000
```

#### B. Frontend `.env` (`FrontEnd/.env`)

```env
# Backend API URL
VITE_API_BASE_URL=http://localhost:5000

# AI-Backend URL (if needed directly from frontend)
VITE_AI_BACKEND_URL=http://localhost:8000
```

#### C. AI-Backend (no `.env` needed for basic setup)

The AI-Backend uses default configuration. Optional environment variables:

```env
# Optional: HuggingFace token for higher rate limits
HF_TOKEN=your_huggingface_token_here
```

---

### Step 3: Start MongoDB

#### Option A: Local MongoDB (if installed)
```bash
# Windows
net start MongoDB

# Or run manually
"C:\Program Files\MongoDB\Server\7.0\bin\mongod.exe" --dbpath="C:\data\db"
```

#### Option B: MongoDB Atlas (Cloud - Recommended for group work)
1. Go to https://www.mongodb.com/atlas
2. Create a free cluster
3. Get your connection string: `mongodb+srv://username:password@cluster.mongodb.net/`
4. Add it to `Backend/.env` as `MONGODB_URI`

---

### Step 4: Install and Start the Backend

```bash
# Navigate to Backend
cd Backend

# Install dependencies
npm install

# Start the server
npm start
# OR
node server.js
```

**Expected output:**
```
Server running on port http://localhost:5000
MongoDB Connected: scholar_db
Demo account ready: gabrielcarpio12343@gmail.com
```

**Keep this terminal open.** Backend must run continuously.

---

### Step 5: Install and Start the AI-Backend

```bash
# Navigate to AI-Backend (in a NEW terminal)
cd AI-Backend

# Install Python dependencies
pip install -r requirements.txt

# First run will download ModernBERT model (~440MB, cached for future runs)
# Start the server
python -m uvicorn main:app --reload --port 8000
```

**Expected output:**
```
[ModernBERT] Loading tokenizer and model...
[ModernBERT] Model loaded successfully (8192 token context).

  SCHOLAR AI Backend is running
  URL:  http://localhost:8000
  Docs: http://localhost:8000/docs
```

**Keep this terminal open.** AI-Backend must run continuously.

**⚠️ First time only:** ModernBERT downloads automatically. Takes ~30 seconds.

---

### Step 6: Install and Start the Frontend

```bash
# Navigate to FrontEnd (in a NEW terminal)
cd FrontEnd

# Install dependencies
npm install

# Start the development server
npm run dev
```

**Expected output:**
```
  VITE v5.x  ready in xxx ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: use --host to expose
```

**Keep this terminal open.** Frontend must run continuously.

---

### Step 7: Access the Application

Open your browser and go to:

| URL | Purpose |
|-----|---------|
| http://localhost:5173 | **Main Application** (Frontend) |
| http://localhost:5000/api/scholarships | Backend API test |
| http://localhost:8000/docs | AI-Backend API documentation |

---

### Step 8: Login

**Demo Account (auto-created when backend starts):**
- **Email:** `gabrielcarpio12343@gmail.com`
- **Password:** `Warlordid619`

Or create a new account through the registration page.

---

## System Check (All Services Running)

You should have **3 terminal windows** open:

| Terminal | Command | Status |
|----------|---------|--------|
| 1 | `cd Backend && npm start` | Backend on port 5000 ✅ |
| 2 | `cd AI-Backend && python -m uvicorn main:app --port 8000` | AI-Backend on port 8000 ✅ |
| 3 | `cd FrontEnd && npm run dev` | Frontend on port 5173 ✅ |

**Quick health check:**
```bash
# In a new terminal
curl http://localhost:5000/api/scholarships
curl http://localhost:8000/health
```

---

## Troubleshooting

### "Cannot connect to backend" errors
- ✅ Check `Backend/.env` has correct `MONGODB_URI`
- ✅ Verify Backend terminal shows "Server running on port 5000"
- ✅ Check `FrontEnd/.env` has `VITE_API_BASE_URL=http://localhost:5000`

### "AI-Backend not responding"
- ✅ Check AI-Backend terminal for "[ModernBERT] Model loaded"
- ✅ First run downloads model (~440MB) — wait for completion
- ✅ Verify port 8000 is not in use: `netstat -ano | findstr 8000`

### MongoDB connection errors
- ✅ Start MongoDB service: `net start MongoDB` (Windows)
- ✅ Or use MongoDB Atlas cloud database
- ✅ Check firewall isn't blocking port 27017

### "Module not found" errors
- ✅ Run `npm install` in both `Backend/` and `FrontEnd/`
- ✅ Run `pip install -r requirements.txt` in `AI-Backend/`

### ModernBERT download fails
- ✅ Check internet connection
- ✅ Optional: Set HuggingFace token for higher rate limits
- ✅ Clear cache and retry: `rmdir /s %USERPROFILE%\.cache\huggingface`

### Git "LF will be replaced by CRLF" warnings
These are normal on Windows. Safe to ignore, or run:
```bash
git config core.autocrlf true
```

---

## Development Tips

### Making Code Changes
1. Edit files in your IDE
2. Frontend auto-refreshes on save
3. Backend/AI-Backend may need restart for some changes

### Adding New Dependencies
- **Frontend/Backend:** `npm install <package>`
- **AI-Backend:** Add to `requirements.txt`, then `pip install -r requirements.txt`

### Database Reset (if needed)
```bash
# WARNING: Deletes all data
# Use MongoDB Compass or run in mongosh:
use scholar_db
db.dropDatabase()
```

---

## Important Notes for Group Work

- ✅ **All members must use the same MongoDB database** (share Atlas connection string)
- ✅ **Each member runs their own local servers** (ports 5000, 8000, 5173)
- ✅ **Never commit `.env` files** — they contain credentials
- ✅ **Use different Git branches** for parallel development
- ✅ **Pull before pushing** to avoid conflicts: `git pull origin main`

---

## Architecture Summary

```
┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐
│   FRONTEND      │──────▶│    BACKEND      │──────▶│   AI-BACKEND    │
│   (React)       │      │  (Node/Express) │      │  (Python/FastAPI)│
│   Port: 5173    │      │   Port: 5000    │      │   Port: 8000    │
└─────────────────┘      └────────┬────────┘      └─────────────────┘
                                  │
                                  ▼
                         ┌─────────────────┐
                         │    MongoDB      │
                         │   (Database)    │
                         └─────────────────┘
```

**Questions?** Check the README.md files in each folder or ask in the group chat.


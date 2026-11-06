# 📖 SCHOLAR System — Complete Setup & User Guide

A step-by-step guide on what to install, how to set up the project, and how to use the system.

---

## 🛠️ Part 1: What to Install First (One-Time Only)

Before touching the code, make sure the following programs are installed on your computer:

### 1. Node.js (v18 or v20 LTS)
* **Download:** https://nodejs.org/ (Choose the **LTS** version)
* Run the installer and click **Next** through all steps.
* **Verify installation** (Open Command Prompt / PowerShell):
  ```bash
  node --version
  npm --version
  ```
  *(Expected: `v18.x` or higher)*

### 2. Python (Recommended: 3.11)
* **Download:** https://www.python.org/downloads/release/python-3119/
* Scroll down to **Files** and click **Windows installer (64-bit)**.
* ⚠️ **CRITICAL STEP DURING INSTALLATION:**
  * When the installer opens, **CHECK THE BOX** at the bottom:  
    ☑️ **"Add python.exe to PATH"**
  * Then click **Install Now**.
* **Verify installation:**
  ```bash
  python --version
  pip --version
  ```
  *(Expected: `Python 3.11.x`)*

### 3. Git
* **Download:** https://git-scm.com/downloads
* Install with default options.

### 4. VS Code (Code Editor)
* **Download:** https://code.visualstudio.com/

---

## 🚀 Part 2: First-Time Project Setup

### Step 1: Open the Project in VS Code
1. Open **VS Code**.
2. Click **File** → **Open Folder...**
3. Select the `Thesis Software` folder.

---

### Step 2: Create the Environment (`.env`) Files
Because `.env` files contain sensitive credentials, they are not saved on GitHub. You must create them locally.

#### A. Create `Backend/.env`
1. Inside the `Backend` folder, create a new file named `.env`.
2. Paste the following configuration:

```env
MONGODB_URI=mongodb+srv://ilcarpio3956qc_db_user:warlordid619%25@thesissoftware.qqlqauz.mongodb.net/?appName=ThesisSoftware
PORT=5000
FRONTEND_BASE_URL=http://localhost:5173
AI_SERVICE_URL=http://localhost:8000
DEMO_EMAIL=demo@example.com
DEMO_PASSWORD=Demo123456
JWT_SECRET=7be6ecf003e5245683257c450cbaf1d9a81f990662d4d308ccf355576ca8dbfe9ed8759b82350205493a43fc27882fa0
EMAIL_USER=scholar12343@gmail.com
EMAIL_PASS=wzdjowcpahwbsxtj
EMAIL_FROM=SCHOLAR System <scholar12343@gmail.com>
```

#### B. Create `FrontEnd/.env`
1. Inside the `FrontEnd` folder, create a new file named `.env`.
2. Paste the following configuration:

```env
VITE_API_URL=http://localhost:5000
VITE_API_BASE_URL=http://localhost:5000
VITE_API_PROXY_TARGET=http://localhost:5000
```

---

### Step 3: Install Backend Dependencies
1. Open a terminal in VS Code (**Terminal** → **New Terminal**, or press ``Ctrl + ` ``).
2. Run:
   ```bash
   cd Backend
   npm install
   ```
3. Wait until it finishes and returns to the command prompt.

---

### Step 4: Install Frontend Dependencies
1. In the terminal (or open a second terminal tab), run:
   ```bash
   cd FrontEnd
   npm install
   ```
2. Wait until the installation completes.

---

### Step 5: Install AI Backend Dependencies
1. Open a new terminal tab.
2. Run:
   ```powershell
   cd AI-Backend
   python -m venv venv
   venv\Scripts\activate
   pip install -r requirements.txt
   ```
   > ⏳ **Note:** This step downloads PyTorch, Transformers, and OCR tools (~1.5 GB). It may take 5–10 minutes depending on your internet connection.

---

## ▶️ Part 3: Running the System (Every Time You Work)

You must have **3 terminals running at the same time**. Do not close them while using the system.

### Terminal 1: Backend Server (Node.js)
```bash
cd Backend
node index.js
```
* Status: Runs on **http://localhost:5000**
* Look for: `Database connected` and `Server running on port 5000`

### Terminal 2: Frontend Client (Vite React)
```bash
cd FrontEnd
npm run dev
```
* Status: Runs on **http://localhost:5173**
* Look for: `Local: http://localhost:5173/`

### Terminal 3: AI Backend Server (FastAPI ModernBERT)
```powershell
cd AI-Backend
venv\Scripts\activate
python -m uvicorn main:app --reload --port 8000
```
* Status: Runs on **http://localhost:8000**
* Interactive API docs: **http://localhost:8000/docs**
* *(On the first run, it will automatically download the ModernBERT model cache ~440MB. Wait until you see the startup notice).*

---

## 💻 Part 4: How to Use the System

Once all 3 terminals are running:
1. Open your web browser (Chrome, Edge, or Firefox).
2. Go to: **http://localhost:5173**

---

### 1. Student Workflow
* **Sign Up / Sign In:**
  * Go to `http://localhost:5173/auth/signin` or click **Sign In**.
  * Use the demo credentials (`demo@example.com` / `Demo123456`) or create a new student account.
* **Complete Student Profile:**
  * Fill in personal info, academic details (GWA/GPA), annual family income, and barangay/residency info.
* **Find Matches:**
  * Visit the **Matches** page to see scholarships ranked by how well your profile fits their eligibility criteria.
* **Apply for a Scholarship:**
  * Select a scholarship and click **Apply**.
  * Upload required documents (Certificate of Registration, Transcript of Records, Certificate of Indigency, etc.).
* **Track Application:**
  * Go to **My Applications** to see status updates (Pending, Under Review, Accepted, or Rejected).

---

### 2. Provider Workflow
* **Provider Portal Access:**
  * Go to `http://localhost:5173/auth/signin` and log in with a provider account.
* **Create a Scholarship:**
  * Navigate to **Scholarships** → **Create Scholarship**.
  * Set scholarship name, funding amount, slots, deadlines, and requirements (minimum GWA, max income, required documents).
* **Review Applications:**
  * Open **Applications** to view students who submitted requirements.
  * Update applicant statuses and communicate with applicants.

---

### 3. Admin Workflow & AI Evaluation
* **Admin Login:**
  * Access the admin portal at: `http://localhost:5173/admin/signin`
* **AI Document Verification & Ranking:**
  * Navigate to **Admin Applications** or **Scholarships**.
  * Click on a scholarship to see submitted applicant documents.
  * The AI Backend analyzes documents using ModernBERT:
    * Extracts GWA/GPA automatically from transcripts.
    * Scores document authenticity and checks for required keywords.
    * Computes a multi-criteria weighted score (GPA 30%, Financial Need 25%, Document Completeness 20%, Authenticity 15%, Category 10%).
    * Provides SHAP explainability breakdowns for why a student received their ranking.
* **Approve / Reject:**
  * Review the AI score and explanations, then make the final approval or rejection decision.

---

## 🔧 Part 5: Common Problems & Quick Fixes

### 1. `python` or `pip` is not recognized
* **Cause:** Python was installed without checking "Add python.exe to PATH".
* **Fix:** Re-run the Python installer, select **Modify**, check **Add Python to PATH**, and finish. Restart your terminal.

### 2. PowerShell says: `running scripts is disabled on this system`
* **Cause:** Windows PowerShell security policy blocks local scripts.
* **Fix:** In PowerShell, run this command once:
  ```powershell
  Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
  ```
  Then re-run `venv\Scripts\activate`.

### 3. Error: `EADDRINUSE` (Port already in use)
* **Cause:** An old node or uvicorn process is still running in the background.
* **Fix (Windows Command Prompt or PowerShell):**
  * To free port 5000: `npx kill-port 5000`
  * To free port 8000: `npx kill-port 8000`
  * Or simply restart your computer.

### 4. AI Backend shows `CUDA error` or `Torch not found`
* **Cause:** Missing CPU-compatible PyTorch build.
* **Fix:** Inside `AI-Backend` with `venv` activated, run:
  ```bash
  pip install torch --index-url https://download.pytorch.org/whl/cpu
  pip install -r requirements.txt
  ```

### 5. `uvicorn: command not found`
* **Fix:** Always invoke uvicorn using python module syntax:
  ```bash
  python -m uvicorn main:app --reload --port 8000
  ```

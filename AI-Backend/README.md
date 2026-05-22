# SCHOLAR AI Backend

Python FastAPI service that provides BERT document analysis,
5-criterion scholarship scoring, and SHAP explainable AI.

---

## Requirements

- Python 3.10+
- ~1.5 GB free disk space (PyTorch + BERT model cache)
- Internet connection on first run (downloads BERT model automatically)

---

## Setup (do this once per machine)

### 1. Open a terminal in this folder

```bash
cd "E:\Thesis Software\AI-Backend"
```

### 2. Create a virtual environment

```bash
python -m venv venv
```

### 3. Activate the virtual environment

**Windows:**
```bash
venv\Scripts\activate
```

**Mac/Linux:**
```bash
source venv/bin/activate
```

You should see `(venv)` appear in your terminal prompt.

### 4. Install dependencies

```bash
pip install -r requirements.txt
```

> Note: PyTorch (~700MB) and the BERT model (~440MB) will be downloaded
> automatically. This only happens once — they are cached locally.

---

## Running the Server

Make sure the virtual environment is activated first, then:

```bash
uvicorn main:app --reload --port 8000
```

The server starts at: **http://localhost:8000**

Interactive API docs: **http://localhost:8000/docs**

---

## All 3 Servers (run in separate terminals)

| Terminal | Command | Port |
|----------|---------|------|
| 1 | `node index.js` (in Backend/) | 5000 |
| 2 | `npm run dev` (in FrontEnd/) | 5173 |
| 3 | `uvicorn main:app --reload --port 8000` (here) | 8000 |

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Check if server is running |
| POST | `/analyze-document` | BERT document analysis |
| POST | `/rank-students` | Score and rank all applicants |
| POST | `/explain-score` | SHAP explanation for one score |
| POST | `/train-explainer` | Train SHAP model on historical data |

---

## How It Works

```
Student submits documents
        ↓
BERT analyzes document text
  - Verifies document type matches content
  - Extracts GWA if present
  - Produces authenticity confidence score (0-100%)
        ↓
Scoring system weights 5 criteria:
  - GPA                   30%
  - Financial Need        25%
  - Document Completeness 20%
  - Document Authenticity 15%
  - Special Category      10%
        ↓
SHAP explains why each student scored that way
  - Simple mode: weighted contribution (default)
  - SHAP mode: activated after 10+ historical records
        ↓
Students ranked highest score first
Admin sees rankings with AI explanations
Student sees only their own score
```

---

## Troubleshooting

**"ModuleNotFoundError"**
→ Virtual environment is not activated. Run `venv\Scripts\activate` first.

**"Address already in use"**
→ Something is already on port 8000. Use `--port 8001` and update
  `AI_SERVICE_URL` in `Backend/.env`.

**First run is slow**
→ Normal. BERT model is downloading (~440MB). Wait 2-5 minutes.

**CUDA/GPU errors**
→ The code automatically falls back to CPU. No action needed.

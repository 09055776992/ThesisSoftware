---
title: SCHOLAR AI Backend
emoji: 🎓
colorFrom: blue
colorTo: green
sdk: gradio
sdk_version: 6.31.0
app_file: app.py
pinned: false
license: mit
---

# SCHOLAR AI Backend

FastAPI + ModernBERT document analysis and SHAP explainable scholarship ranking service.

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check |
| POST | `/analyze-document` | BERT document analysis |
| POST | `/analyze-document-file` | OCR + BERT analysis |
| POST | `/rank-students` | Score and rank applicants |
| POST | `/explain-score` | SHAP explanation |

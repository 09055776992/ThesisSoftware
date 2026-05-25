"""
SCHOLAR AI Backend — FastAPI Server
Port: 8000

Endpoints:
  GET  /health                  — health check
  POST /analyze-document        — BERT document analysis (raw text input)
  POST /analyze-document-file   — OCR + BERT analysis (file upload: PDF, JPG, PNG, TXT)
  POST /rank-students           — score + rank all applicants for a scholarship
  POST /explain-score           — SHAP explanation for a single score breakdown
  POST /train-explainer         — train SHAP model on historical data
"""

from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Dict, Optional
from contextlib import asynccontextmanager
import traceback

from bert_analyzer import bert_analyzer
from scoring import scoring_system
from explainer import explainer
from document_ingestion import extract_text_from_file

# ---------------------------------------------------------------------------
# Lifespan (replaces deprecated @app.on_event)
# ---------------------------------------------------------------------------
@asynccontextmanager
async def lifespan(app: FastAPI):
    print("\n" + "="*50)
    print("  SCHOLAR AI Backend is running")
    print("  URL:  http://localhost:8000")
    print("  Docs: http://localhost:8000/docs")
    print("="*50 + "\n")
    yield

# ---------------------------------------------------------------------------
# App setup
# ---------------------------------------------------------------------------
app = FastAPI(
    title="SCHOLAR AI Backend",
    description="BERT document analysis + SHAP-explained scholarship ranking",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5000",
        "http://localhost:5173",
        "http://localhost:4000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------

class DocumentAnalysisRequest(BaseModel):
    text: str = Field(..., description="Raw text extracted from the document")
    doc_type: str = Field(..., description="Type: TOR, enrollment, QCitizen_ID, indigency, etc.")


class StudentData(BaseModel):
    student_id: str
    student_name: str
    gpa: Optional[float] = None
    income_category: Optional[str] = ""
    financial_need: Optional[int] = 1
    special_categories: Optional[Dict] = {}
    education_level: Optional[str] = ""
    submitted_at: Optional[str] = "9999-12-31"   # ISO string for FCFS tiebreaker


class ScoreRequest(BaseModel):
    students: List[StudentData]
    scholarship_id: str
    scholarship: Dict
    applications: List[Dict] = []


class ExplainRequest(BaseModel):
    score_breakdown: Dict = Field(
        ...,
        example={
            "gpa_score": 85.0,
            "financial_score": 90.0,
            "document_completeness": 100.0,
            "document_authenticity": 75.0,
            "special_category_score": 80.0,
        }
    )


class TrainRequest(BaseModel):
    historical_scores: List[Dict] = Field(
        ...,
        description="List of score_breakdown dicts each with a total_score field"
    )


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@app.get("/health")
async def health_check():
    """Quick health check — confirms all modules loaded."""
    return {
        "status": "running",
        "bert_loaded": True,
        "shap_ready": True,
        "explainer_mode": "simple" if explainer.use_simple_explainer else "shap",
        "historical_records": len(explainer._historical_scores),
    }


@app.post("/analyze-document-file")
async def analyze_document_file(
    file: UploadFile = File(..., description="Document file: PDF, JPG, PNG, or TXT"),
    doc_type: str = Form(..., description="Type: TOR, enrollment, QCitizen_ID, indigency, etc."),
):
    """
    Accepts a raw file upload (PDF, image, or text), extracts text via OCR or
    PDF parsing, then runs the full BERT analysis pipeline.

    Returns the same shape as /analyze-document plus ingestion metadata
    (source, char_count, ocr_failed) so the caller knows how text was obtained.
    """
    try:
        file_bytes = await file.read()
        ingestion = extract_text_from_file(file_bytes, file.filename or "upload")

        if not ingestion["success"]:
            return {
                "success": False,
                "doc_type": doc_type,
                "ocr_failed": True,
                "reason": ingestion["reason"],
                "source": ingestion["source"],
                "authenticity": {
                    "doc_type": doc_type,
                    "is_authentic": False,
                    "confidence": 0.0,
                    "matched_terms": 0,
                    "total_expected_terms": 0,
                    "reason": ingestion["reason"],
                },
                "extracted_gwa": None,
                "analysis": {"analyzed": False, "reason": ingestion["reason"], "text_length": 0, "token_count": 0},
            }

        text = ingestion["text"]
        authenticity = bert_analyzer.verify_document_authenticity(text, doc_type)
        extracted_gwa = bert_analyzer.extract_gwa_from_text(text)
        analysis = bert_analyzer.analyze_document_text(text)

        return {
            "success": True,
            "doc_type": doc_type,
            "ocr_failed": False,
            "source": ingestion["source"],
            "char_count": ingestion["char_count"],
            "authenticity": authenticity,
            "extracted_gwa": extracted_gwa,
            "analysis": analysis,
        }

    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/analyze-document")
async def analyze_document(request: DocumentAnalysisRequest):
    """
    Analyzes a document using BERT.

    Returns:
    - authenticity check (keyword-based confidence score)
    - extracted GWA (if found in text)
    - basic text analysis (token count, length)
    """
    try:
        authenticity = bert_analyzer.verify_document_authenticity(
            request.text,
            request.doc_type,
        )
        extracted_gwa = bert_analyzer.extract_gwa_from_text(request.text)
        analysis = bert_analyzer.analyze_document_text(request.text)

        return {
            "success": True,
            "doc_type": request.doc_type,
            "authenticity": authenticity,
            "extracted_gwa": extracted_gwa,
            "analysis": analysis,
        }

    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/rank-students")
async def rank_students(request: ScoreRequest):
    """
    Scores and ranks all students for a scholarship.

    For each student:
    1. Calculates 5-criterion weighted score
    2. Generates SHAP explanation
    3. Accumulates score for SHAP model training

    Returns ranked list with scores and explanations.
    """
    try:
        if not request.students:
            return {
                "success": True,
                "scholarship_id": request.scholarship_id,
                "total_applicants": 0,
                "rankings": [],
            }

        scored_students = []

        for i, student in enumerate(request.students):
            # Get matching application data if available
            application = (
                request.applications[i]
                if i < len(request.applications)
                else {}
            )
            submitted_docs = application.get("submittedDocuments", [])
            authenticity_results = application.get("authenticityResults", [])

            # Score the student
            score_result = scoring_system.score_student(
                student.dict(),
                request.scholarship,
                submitted_docs,
                authenticity_results,
            )

            # Accumulate for SHAP training (before explanation so model can grow)
            explainer.add_historical_score(
                score_result["score_breakdown"],
                score_result["total_score"],
            )

            scored_students.append({
                "student_id":      student.student_id,
                "student_name":    student.student_name,
                "total_score":     score_result["total_score"],
                "score_breakdown": score_result["score_breakdown"],
                "submitted_at":    student.submitted_at or "9999-12-31",
                "weights_used":    score_result["weights_used"],
            })

        # Rank all students (tiebreaker logic lives here)
        ranked = scoring_system.rank_students(scored_students)

        # Generate SHAP explanation per student AFTER ranking (so tiebreaker_note is available)
        for student in ranked:
            tiebreaker_note = student.get("tiebreaker_note") or ""
            student["shap_explanation"] = explainer.explain_score(
                student["score_breakdown"],
                tiebreaker_note,
            )

        return {
            "success": True,
            "scholarship_id": request.scholarship_id,
            "total_applicants": len(ranked),
            "rankings": ranked,
        }

    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/explain-score")
async def explain_score(request: ExplainRequest):
    """
    Generates a SHAP explanation for a single score breakdown.
    Useful for re-explaining an already-scored student without re-ranking.
    """
    try:
        explanation = explainer.explain_score(request.score_breakdown)
        return {"success": True, "explanation": explanation}

    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/train-explainer")
async def train_explainer(request: TrainRequest):
    """
    Manually trains the SHAP model on historical scoring data.
    Requires at least 10 records. Once trained, /rank-students
    will use SHAP values instead of simple weighted explanations.
    """
    try:
        if len(request.historical_scores) < 10:
            return {
                "success": False,
                "message": f"Need at least 10 records to train. Got {len(request.historical_scores)}.",
                "mode": "simple",
            }

        explainer.train_explainer(request.historical_scores)

        return {
            "success": True,
            "message": f"SHAP model trained on {len(request.historical_scores)} records.",
            "mode": "shap" if not explainer.use_simple_explainer else "simple",
        }

    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=False)

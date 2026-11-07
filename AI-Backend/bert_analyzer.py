"""
BERT Document Analyzer
Handles document authenticity verification and GWA extraction
using BERT embeddings and keyword matching.

Lazy-loads the model on first use so it works with HF ZeroGPU,
which only provides GPU access inside @spaces.GPU decorated functions.
"""

import re
import numpy as np
from rapidfuzz import fuzz
from document_ingestion import _normalize_ocr_text

# ---------------------------------------------------------------------------
# Expected keyword sets per document type
# ---------------------------------------------------------------------------
EXPECTED_TERMS: dict[str, list[str]] = {
    "TOR": [
        "transcript", "grades", "units", "grade point", "academic",
        "weighted average", "general weighted", "semester", "subject",
        "gwa", "gpa", "course", "college", "school"
    ],
    "gradesTranscript": [
        "transcript", "grades", "units", "grade point", "academic",
        "weighted average", "general weighted", "semester", "subject",
        "gwa", "gpa", "course", "college", "school"
    ],
    "enrollment": [
        "enrolled", "enrollment", "registered", "registration", "student",
        "school year", "semester", "certificate of enrollment",
        "currently enrolled", "date enrolled", "subject", "units",
        "student id", "year level", "student type", "regular",
        "schedule", "total load", "subject title", "assessment"
    ],
    "enrollmentProof": [
        "enrolled", "enrollment", "registered", "registration", "student",
        "school year", "semester", "certificate of enrollment",
        "currently enrolled", "date enrolled", "subject", "units",
        "student id", "year level", "student type", "regular",
        "schedule", "total load", "subject title", "assessment"
    ],
    "QCitizen_ID": [
        "quezon city", "citizen", "resident", "identification",
        "qc", "barangay", "address", "card", "republic of the philippines"
    ],
    "qCitizenId": [
        "quezon city", "citizen", "resident", "identification",
        "qc", "barangay", "address", "card", "republic of the philippines"
    ],
    "indigency": [
        "indigent", "certificate", "barangay", "income",
        "poverty", "low income", "marginalized", "certify"
    ],
    "birth_certificate": [
        "birth", "born", "date of birth", "civil registry",
        "psa", "philippine statistics", "registered"
    ],
    "good_moral": [
        "good moral", "character", "conduct", "behavior",
        "certify", "student", "school"
    ],
    "income_tax": [
        "income", "tax", "bir", "return", "annual",
        "gross", "compensation", "revenue"
    ],
}

# GWA extraction patterns (Philippine scale)
GWA_PATTERNS = [
    r"GWA\s*[:\-]?\s*([1-5]\.[0-9]{1,2})",
    r"GPA\s*[:\-]?\s*([0-9]+\.[0-9]{1,2})",
    r"General\s+Weighted\s+Average\s*[:\-]?\s*([1-5]\.[0-9]{1,2})",
    r"([1-5]\.[0-9]{1,2})\s*GWA",
    r"Average\s*[:\-]?\s*([1-5]\.[0-9]{1,2})",
]


class BERTDocumentAnalyzer:
    """
    Uses BERT to produce text embeddings and performs keyword-based
    document authenticity verification.

    The model is loaded lazily on first use — required for HF ZeroGPU
    which only allocates GPU inside @spaces.GPU decorated functions.
    """

    def __init__(self):
        # Defer all heavy imports and model loading to first use
        self._loaded = False
        self.device = None
        self.tokenizer = None
        self.model = None

    def _ensure_loaded(self):
        """Load model on first use (lazy init for ZeroGPU compatibility)."""
        if self._loaded:
            return
        import torch
        from transformers import AutoModel, AutoTokenizer

        print("[ModernBERT] Loading tokenizer and model (first run may take a few minutes)...")
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        print(f"[ModernBERT] Using device: {self.device}")

        model_id = "answerdotai/ModernBERT-base"
        self.tokenizer = AutoTokenizer.from_pretrained(model_id)
        self.model = AutoModel.from_pretrained(model_id)
        self.model.to(self.device)
        self.model.eval()
        self._loaded = True
        print("[ModernBERT] Model loaded successfully (8192 token context).")

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def analyze_document_text(self, text: str) -> dict:
        """
        Basic analysis of document text.
        Returns token count and a flag confirming analysis ran.
        """
        if not text or not text.strip():
            return {"analyzed": False, "reason": "Empty text", "text_length": 0, "token_count": 0}

        self._ensure_loaded()
        inputs = self.tokenizer(
            text,
            return_tensors="pt",
            truncation=True,
            max_length=8192,
        )
        token_count = int(inputs["input_ids"].shape[1])

        return {
            "analyzed": True,
            "text_length": len(text),
            "token_count": token_count,
        }

    def get_text_embeddings(self, text: str) -> np.ndarray:
        """
        Returns the [CLS] token embedding for the input text.
        This 768-dimensional vector represents the overall meaning of the text.
        """
        import torch
        self._ensure_loaded()
        inputs = self.tokenizer(
            text,
            return_tensors="pt",
            truncation=True,
            max_length=8192,
            padding=True,
        )
        inputs = {k: v.to(self.device) for k, v in inputs.items()}

        with torch.no_grad():
            outputs = self.model(**inputs)

        cls_embedding = outputs.last_hidden_state[:, 0, :]
        return cls_embedding.cpu().numpy()

    # Minimum rapidfuzz partial_ratio score (0-100) to count a keyword as matched.
    FUZZY_THRESHOLD: int = 80

    def verify_document_authenticity(self, text: str, doc_type: str) -> dict:
        """
        Checks whether the document text contains the keywords expected
        for the given document type. Uses rapidfuzz for fuzzy matching —
        does NOT require the BERT model.
        """
        if not text or not text.strip():
            return {
                "doc_type": doc_type,
                "is_authentic": False,
                "confidence": 0.0,
                "matched_terms": 0,
                "total_expected_terms": 0,
                "reason": "No text provided for analysis",
            }

        if not text or len(text.strip()) < 15:
            return {
                "doc_type": doc_type,
                "is_authentic": False,
                "confidence": 0.0,
                "matched_terms": 0,
                "total_expected_terms": 0,
                "reason": "Insufficient readable text in document (possible photo/selfie)",
            }

        terms = EXPECTED_TERMS.get(doc_type, [])
        if not terms:
            has_substance = len(text.strip()) >= 50
            return {
                "doc_type": doc_type,
                "is_authentic": has_substance,
                "confidence": 50.0 if has_substance else 0.0,
                "matched_terms": 0,
                "total_expected_terms": 0,
                "reason": f"Unknown document type '{doc_type}'" if has_substance else "Document lacks verifiable text content",
            }

        text_lower = text.lower()
        matched = []
        match_scores = {}

        for term in terms:
            score = fuzz.partial_ratio(term, text_lower)
            match_scores[term] = score
            if score >= self.FUZZY_THRESHOLD:
                matched.append(term)

        confidence = len(matched) / len(terms)
        is_auth = (confidence >= 0.20) and (len(matched) >= 1)

        return {
            "doc_type": doc_type,
            "is_authentic": is_auth,
            "confidence": round(confidence * 100, 2),
            "matched_terms": len(matched),
            "matched_keywords": matched,
            "total_expected_terms": len(terms),
            "fuzzy_threshold": self.FUZZY_THRESHOLD,
            "match_scores": match_scores,
            "reason": None if is_auth else f"Document failed authenticity check: missing expected {doc_type} keywords",
        }

    def extract_gwa_from_text(self, text: str) -> float | None:
        """
        Attempts to extract a GWA/GPA value from document text
        using regex patterns. Does NOT require the BERT model.
        """
        if not text:
            return None

        text = _normalize_ocr_text(text)

        for pattern in GWA_PATTERNS:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                try:
                    value = float(match.group(1))
                    if 1.0 <= value <= 5.0:
                        return value
                except ValueError:
                    continue

        return None

    def compute_document_similarity(self, text_a: str, text_b: str) -> float:
        """
        Computes cosine similarity between two documents using BERT embeddings.
        """
        emb_a = self.get_text_embeddings(text_a)
        emb_b = self.get_text_embeddings(text_b)

        dot = np.dot(emb_a.flatten(), emb_b.flatten())
        norm_a = np.linalg.norm(emb_a)
        norm_b = np.linalg.norm(emb_b)

        if norm_a == 0 or norm_b == 0:
            return 0.0

        return float(dot / (norm_a * norm_b))


# ---------------------------------------------------------------------------
# Singleton — imported by main.py
# Model is NOT loaded here; it loads lazily on first API call.
# ---------------------------------------------------------------------------
bert_analyzer = BERTDocumentAnalyzer()

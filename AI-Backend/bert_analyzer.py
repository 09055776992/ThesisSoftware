"""
BERT Document Analyzer
Handles document authenticity verification and GWA extraction
using BERT embeddings and keyword matching.
"""

import re
import torch
import numpy as np
from transformers import AutoModel, AutoTokenizer

# ---------------------------------------------------------------------------
# Expected keyword sets per document type
# ---------------------------------------------------------------------------
EXPECTED_TERMS: dict[str, list[str]] = {
    "TOR": [
        "transcript", "grades", "units", "grade point", "academic",
        "weighted average", "general weighted", "semester", "subject"
    ],
    "enrollment": [
        "enrolled", "enrollment", "registered", "student",
        "school year", "semester", "certificate of enrollment",
        "currently enrolled"
    ],
    "QCitizen_ID": [
        "quezon city", "citizen", "resident", "identification",
        "qc", "barangay", "address"
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
    """

    def __init__(self):
        print("[ModernBERT] Loading tokenizer and model (first run may take a few minutes)...")
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        print(f"[ModernBERT] Using device: {self.device}")

        # Load ModernBERT for embeddings (8192 context, Flash Attention support)
        model_id = "answerdotai/ModernBERT-base"
        self.tokenizer = AutoTokenizer.from_pretrained(model_id)
        self.model = AutoModel.from_pretrained(model_id)  # Standard attention (Flash Attn optional)
        self.model.to(self.device)
        self.model.eval()

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

        inputs = self.tokenizer(
            text,
            return_tensors="pt",
            truncation=True,
            max_length=8192,  # ModernBERT supports 16x longer context
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
        Used for future similarity comparisons.
        """
        inputs = self.tokenizer(
            text,
            return_tensors="pt",
            truncation=True,
            max_length=8192,  # ModernBERT supports 16x longer context
            padding=True,
        )
        inputs = {k: v.to(self.device) for k, v in inputs.items()}

        with torch.no_grad():
            outputs = self.model(**inputs)

        # [CLS] token is at position 0
        cls_embedding = outputs.last_hidden_state[:, 0, :]
        return cls_embedding.cpu().numpy()

    def verify_document_authenticity(self, text: str, doc_type: str) -> dict:
        """
        Checks whether the document text contains the keywords expected
        for the given document type.

        Confidence = matched_terms / total_expected_terms
        is_authentic = confidence >= 0.4 (at least 40% of keywords found)
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

        terms = EXPECTED_TERMS.get(doc_type, [])
        if not terms:
            # Unknown document type — give neutral score
            return {
                "doc_type": doc_type,
                "is_authentic": True,
                "confidence": 50.0,
                "matched_terms": 0,
                "total_expected_terms": 0,
                "reason": f"Unknown document type '{doc_type}' — neutral score applied",
            }

        text_lower = text.lower()
        matched = [term for term in terms if term in text_lower]
        confidence = len(matched) / len(terms)

        return {
            "doc_type": doc_type,
            "is_authentic": confidence >= 0.4,
            "confidence": round(confidence * 100, 2),
            "matched_terms": len(matched),
            "matched_keywords": matched,
            "total_expected_terms": len(terms),
        }

    def extract_gwa_from_text(self, text: str) -> float | None:
        """
        Attempts to extract a GWA/GPA value from document text
        using regex patterns. Returns None if not found.
        """
        if not text:
            return None

        for pattern in GWA_PATTERNS:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                try:
                    value = float(match.group(1))
                    # Validate Philippine GWA range (1.0 – 5.0)
                    if 1.0 <= value <= 5.0:
                        return value
                except ValueError:
                    continue

        return None

    def compute_document_similarity(self, text_a: str, text_b: str) -> float:
        """
        Computes cosine similarity between two documents using BERT embeddings.
        Returns a value between 0 (completely different) and 1 (identical meaning).
        Useful for detecting duplicate or copied documents.
        """
        emb_a = self.get_text_embeddings(text_a)
        emb_b = self.get_text_embeddings(text_b)

        # Cosine similarity
        dot = np.dot(emb_a.flatten(), emb_b.flatten())
        norm_a = np.linalg.norm(emb_a)
        norm_b = np.linalg.norm(emb_b)

        if norm_a == 0 or norm_b == 0:
            return 0.0

        return float(dot / (norm_a * norm_b))


# ---------------------------------------------------------------------------
# Singleton — imported by main.py
# ---------------------------------------------------------------------------
bert_analyzer = BERTDocumentAnalyzer()

"""
Scholarship Scoring System
Weights 5 criteria to produce a total score (0-100) per student per scholarship.

Weights:
  GPA                   30%
  Financial Need        25%
  Document Completeness 20%
  Document Authenticity 15%
  Special Category      10%
"""

import numpy as np
from dataclasses import dataclass, field
from typing import Dict, List, Optional


# ---------------------------------------------------------------------------
# Data class for a scored student
# ---------------------------------------------------------------------------
@dataclass
class StudentScore:
    student_id: str
    student_name: str
    scholarship_id: str
    total_score: float
    rank: int
    score_breakdown: Dict
    shap_explanation: Dict = field(default_factory=dict)


# ---------------------------------------------------------------------------
# Income category → financial need score mapping
# ---------------------------------------------------------------------------
INCOME_SCORES: dict[str, float] = {
    # Poverty threshold (highest priority)
    "Under ₱25,000":       100.0,
    "under ₱25,000":       100.0,
    "under-25000":         100.0,
    "under_25000":         100.0,
    "₱10,000 – ₱25,000":  100.0,
    "₱10,000 - ₱25,000":  100.0,
    "₱10,000–₱25,000":    100.0,
    # Lower-middle income
    "₱25,000 – ₱50,000":   70.0,
    "₱25,000 - ₱50,000":   70.0,
    "₱25,000–₱50,000":     70.0,
    # Middle income
    "₱50,000 – ₱100,000":  40.0,
    "₱50,000 - ₱100,000":  40.0,
    "₱50,000–₱100,000":    40.0,
    # Upper income
    "₱100,000+":            10.0,
    "above ₱100,000":       10.0,
}

# Special category → bonus score mapping
SPECIAL_CATEGORY_SCORES: dict[str, float] = {
    "isFromIndigenousFamily":   100.0,
    "isPersonWithDisability":   100.0,
    "isPWD":                    100.0,
    "isSoloParent":              80.0,
    "isIndigent":                80.0,
    "isAthlete":                 60.0,
    "isArtist":                  60.0,
    "isSKOfficial":              50.0,
    "isStudentLeader":           50.0,
    "isStudentCouncilLeader":    50.0,
    "hasAcademicHonors":         40.0,
}


class ScholarshipScoringSystem:
    """
    Scores a student's application for a specific scholarship
    using 5 weighted criteria.
    """

    WEIGHTS = {
        "gpa":                    30,   # 30% — academic performance
        "financial_need":         25,   # 25% — economic need
        "document_completeness":  20,   # 20% — all docs submitted
        "document_authenticity":  15,   # 15% — BERT verification
        "special_category":       10,   # 10% — PWD, solo parent, etc.
    }

    # ------------------------------------------------------------------
    # Individual criterion scorers
    # ------------------------------------------------------------------

    def calculate_gpa_score(self, gpa: Optional[float], min_gpa: float) -> float:
        """
        Scores GPA on the Philippine scale where 1.0 is the highest grade.

        Rules:
        - If GPA not provided → 0
        - If GPA > min_gpa (fails requirement) → 0
        - If GPA == min_gpa (exactly meets minimum) → 60
        - If GPA == 1.0 (perfect) → 100
        - Linear interpolation between 60 and 100 for values between 1.0 and min_gpa
        """
        if gpa is None:
            return 0.0

        try:
            gpa = float(gpa)
            min_gpa = float(min_gpa)
        except (TypeError, ValueError):
            return 0.0

        # Does not meet minimum requirement
        if gpa > min_gpa:
            return 0.0

        # Range between perfect (1.0) and minimum
        max_possible = min_gpa - 1.0
        student_excess = min_gpa - gpa

        if max_possible <= 0:
            return 60.0

        score = 60.0 + (student_excess / max_possible) * 40.0
        return round(min(100.0, max(0.0, score)), 2)

    def calculate_financial_need_score(
        self,
        income_category: str,
        financial_need: int,
    ) -> float:
        """
        Scores financial need. Higher need = higher score.

        Combines:
        - Income category score (from lookup table)
        - Self-reported financial need (1–5 scale)
        """
        income_score = INCOME_SCORES.get(str(income_category).strip(), 50.0)

        # financial_need is 1–5; normalize to 0–100
        try:
            need_val = max(1, min(5, int(financial_need)))
        except (TypeError, ValueError):
            need_val = 1

        need_score = (need_val / 5.0) * 100.0

        # Weighted average: income category carries more weight
        combined = (income_score * 0.6) + (need_score * 0.4)
        return round(combined, 2)

    def calculate_document_score(
        self,
        submitted_docs: List[dict],
        required_docs: List[str],
        authenticity_results: List[dict],
    ) -> tuple[float, float]:
        """
        Returns (completeness_score, authenticity_score) both 0–100.

        Completeness: what fraction of required documents were submitted.
        Authenticity: average BERT confidence across submitted documents.
        """
        # --- Completeness ---
        if not required_docs:
            completeness = 100.0
        else:
            submitted_types = [
                str(d.get("documentType", d.get("type", "")))
                for d in submitted_docs
            ]
            matched = sum(1 for req in required_docs if req in submitted_types)
            completeness = (matched / len(required_docs)) * 100.0

        # --- Authenticity ---
        if authenticity_results:
            confidences = [
                float(r.get("confidence", 50.0))
                for r in authenticity_results
            ]
            authenticity = float(np.mean(confidences))
        else:
            # No BERT results yet — neutral score
            authenticity = 50.0

        return round(completeness, 2), round(authenticity, 2)

    def calculate_special_category_score(self, special_categories: dict) -> float:
        """
        Returns the highest applicable special category bonus score.
        Takes the maximum (not sum) to avoid double-counting.
        """
        if not special_categories:
            return 0.0

        matched_scores = [
            score
            for key, score in SPECIAL_CATEGORY_SCORES.items()
            if special_categories.get(key, False)
        ]

        return float(max(matched_scores)) if matched_scores else 0.0

    # ------------------------------------------------------------------
    # Main scoring entry point
    # ------------------------------------------------------------------

    def score_student(
        self,
        student: dict,
        scholarship: dict,
        submitted_docs: List[dict],
        authenticity_results: List[dict],
    ) -> dict:
        """
        Calculates the total weighted score for one student
        against one scholarship.

        Returns a dict with total_score, score_breakdown, and weights_used.
        """
        # Resolve minimum GPA from scholarship data
        min_gpa = (
            scholarship.get("minimumGPA")
            or scholarship.get("minimumGpa")
            or scholarship.get("eligibilityCriteria", {}).get("minGWA")
            or scholarship.get("eligibilityCriteria", {}).get("minGPA")
            or 3.0  # default fallback
        )

        # --- Individual scores ---
        gpa_score = self.calculate_gpa_score(
            student.get("gpa"),
            float(min_gpa),
        )

        financial_score = self.calculate_financial_need_score(
            student.get("incomeCategory", ""),
            student.get("financialNeed", 1),
        )

        doc_completeness, doc_authenticity = self.calculate_document_score(
            submitted_docs,
            scholarship.get("requiredDocuments", []),
            authenticity_results,
        )

        special_score = self.calculate_special_category_score(
            student.get("specialCategories", {}),
        )

        # --- Weighted total ---
        total = (
            (gpa_score          * self.WEIGHTS["gpa"]                    / 100)
            + (financial_score  * self.WEIGHTS["financial_need"]         / 100)
            + (doc_completeness * self.WEIGHTS["document_completeness"]  / 100)
            + (doc_authenticity * self.WEIGHTS["document_authenticity"]  / 100)
            + (special_score    * self.WEIGHTS["special_category"]       / 100)
        )

        return {
            "total_score": round(total, 2),
            "score_breakdown": {
                "gpa_score":              round(gpa_score, 2),
                "financial_score":        round(financial_score, 2),
                "document_completeness":  round(doc_completeness, 2),
                "document_authenticity":  round(doc_authenticity, 2),
                "special_category_score": round(special_score, 2),
            },
            "weights_used": self.WEIGHTS,
        }

    def rank_students(self, scored_students: List[dict]) -> List[dict]:
        """
        Sorts students by:
          1. total_score          — highest first (primary)
          2. financial_score      — highest first (tiebreaker level 1)
          3. submitted_at         — earliest first, FCFS (tiebreaker level 2)
        Annotates each student with tiebreaker_used and tiebreaker_note.
        """
        sorted_students = sorted(
            scored_students,
            key=lambda x: (
                -x["total_score"],
                -x["score_breakdown"].get("financial_score", 0),
                x.get("submitted_at", "9999-12-31"),   # ISO string — lexicographic sort works
            ),
        )

        for i, student in enumerate(sorted_students):
            student["rank"] = i + 1

            if i > 0:
                prev = sorted_students[i - 1]
                same_total = round(student["total_score"], 2) == round(prev["total_score"], 2)
                same_financial = round(
                    student["score_breakdown"].get("financial_score", 0), 2
                ) == round(
                    prev["score_breakdown"].get("financial_score", 0), 2
                )

                if same_total and same_financial:
                    student["tiebreaker_used"] = "first_come_first_served"
                    student["tiebreaker_note"] = (
                        "Ranked by earliest application submission date (first come, first served)."
                    )
                elif same_total:
                    student["tiebreaker_used"] = "financial_status"
                    student["tiebreaker_note"] = (
                        "Ranked by financial need score as the tiebreaker."
                    )
                else:
                    student["tiebreaker_used"] = None
                    student["tiebreaker_note"] = None
            else:
                student["tiebreaker_used"] = None
                student["tiebreaker_note"] = None

        return sorted_students


# ---------------------------------------------------------------------------
# Singleton — imported by main.py
# ---------------------------------------------------------------------------
scoring_system = ScholarshipScoringSystem()

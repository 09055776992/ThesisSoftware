"""
SHAP Explainer
Generates human-readable explanations for why a student received their score.

Two modes:
1. Simple (default) — rule-based weighted contribution explanation.
   Used when fewer than 10 historical scores are available.
2. SHAP (advanced) — trains a GradientBoostingRegressor on historical data
   and uses TreeExplainer to compute SHAP values.
   Activated automatically once 10+ historical scores are collected.
"""

import numpy as np
import shap
from sklearn.ensemble import GradientBoostingRegressor
from typing import Optional


# ---------------------------------------------------------------------------
# Human-readable explanations per factor and performance level
# ---------------------------------------------------------------------------
EXPLANATIONS: dict[str, dict[str, str]] = {
    "GPA Score": {
        "high":   "Your academic performance is excellent, significantly boosting your ranking.",
        "medium": "Your GPA meets the requirement but there is room for improvement.",
        "low":    "Your GPA is at or near the minimum requirement, lowering your score.",
        "zero":   "Your GPA does not meet the minimum requirement for this scholarship.",
    },
    "Financial Need Score": {
        "high":   "Your financial situation indicates high need, giving you priority for this scholarship.",
        "medium": "Your income level shows moderate financial need.",
        "low":    "Your income level suggests lower financial need for this scholarship.",
        "zero":   "No financial need information was provided.",
    },
    "Document Completeness": {
        "high":   "All required documents were submitted completely.",
        "medium": "Most documents were submitted but some are missing.",
        "low":    "Several required documents are missing, significantly reducing your score.",
        "zero":   "No documents were submitted.",
    },
    "Document Authenticity": {
        "high":   "Your submitted documents were verified as authentic by our system.",
        "medium": "Most documents appear authentic but some could not be fully verified.",
        "low":    "Some documents could not be verified as authentic.",
        "zero":   "Documents could not be analyzed.",
    },
    "Special Category Score": {
        "high":   "Your special category qualification gives you additional priority.",
        "medium": "You have a recognized special category qualification.",
        "low":    "A special category was noted but provides limited additional score.",
        "zero":   "No special category qualification was detected for this scholarship.",
    },
}

FEATURE_NAMES = [
    "GPA Score",
    "Financial Need Score",
    "Document Completeness",
    "Document Authenticity",
    "Special Category Score",
]

WEIGHTS = {
    "GPA Score":              0.30,
    "Financial Need Score":   0.25,
    "Document Completeness":  0.20,
    "Document Authenticity":  0.15,
    "Special Category Score": 0.10,
}


def _score_level(score: float) -> str:
    """Maps a 0–100 score to a human-readable level."""
    if score == 0:
        return "zero"
    if score >= 75:
        return "high"
    if score >= 50:
        return "medium"
    return "low"


class ScholarshipExplainer:
    """
    Generates SHAP-based or rule-based explanations for student scores.
    """

    def __init__(self):
        self.model: Optional[GradientBoostingRegressor] = None
        self.explainer: Optional[shap.TreeExplainer] = None
        self.use_simple_explainer: bool = True
        self._historical_scores: list = []

    # ------------------------------------------------------------------
    # Training (called when enough historical data is available)
    # ------------------------------------------------------------------

    def add_historical_score(self, score_breakdown: dict, total_score: float):
        """
        Accumulates historical scoring data.
        Automatically trains the SHAP model once 10+ records exist.
        """
        self._historical_scores.append({
            **score_breakdown,
            "total_score": total_score,
        })

        if len(self._historical_scores) >= 10 and self.use_simple_explainer:
            self.train_explainer(self._historical_scores)

    def train_explainer(self, historical_scores: list):
        """
        Trains a GradientBoostingRegressor on historical scoring data
        so SHAP can explain predictions with actual feature contributions.
        """
        if len(historical_scores) < 10:
            self.use_simple_explainer = True
            return

        try:
            X = np.array([
                [
                    s.get("gpa_score", 0),
                    s.get("financial_score", 0),
                    s.get("document_completeness", 0),
                    s.get("document_authenticity", 0),
                    s.get("special_category_score", 0),
                ]
                for s in historical_scores
            ])
            y = np.array([s.get("total_score", 0) for s in historical_scores])

            self.model = GradientBoostingRegressor(
                n_estimators=100,
                max_depth=3,
                random_state=42,
            )
            self.model.fit(X, y)
            self.explainer = shap.TreeExplainer(self.model)
            self.use_simple_explainer = False
            print(f"[SHAP] Trained on {len(historical_scores)} records. SHAP mode active.")

        except Exception as e:
            print(f"[SHAP] Training failed, falling back to simple explainer: {e}")
            self.use_simple_explainer = True

    # ------------------------------------------------------------------
    # Main explanation entry point
    # ------------------------------------------------------------------

    def explain_score(self, score_breakdown: dict, tiebreaker_note: str = "") -> dict:
        """
        Generates an explanation for a student's score breakdown.
        Uses SHAP if model is trained, otherwise uses simple weighted explanation.
        Optionally appends a tiebreaker note to the summary.
        """
        if self.use_simple_explainer or self.explainer is None:
            return self._simple_explanation(score_breakdown, tiebreaker_note)
        return self._shap_explanation(score_breakdown, tiebreaker_note)

    # ------------------------------------------------------------------
    # Simple (rule-based) explanation
    # ------------------------------------------------------------------

    def _simple_explanation(self, score_breakdown: dict, tiebreaker_note: str = "") -> dict:
        """
        Explains the score using weighted contributions.
        Each factor's contribution = raw_score × weight.
        """
        scores = {
            "GPA Score":              score_breakdown.get("gpa_score", 0),
            "Financial Need Score":   score_breakdown.get("financial_score", 0),
            "Document Completeness":  score_breakdown.get("document_completeness", 0),
            "Document Authenticity":  score_breakdown.get("document_authenticity", 0),
            "Special Category Score": score_breakdown.get("special_category_score", 0),
        }

        contributions = []
        for factor in FEATURE_NAMES:
            raw_score = float(scores.get(factor, 0))
            weight = WEIGHTS[factor]
            contribution = raw_score * weight
            level = _score_level(raw_score)

            contributions.append({
                "factor":        factor,
                "shap_value":    round(contribution, 2),
                "raw_score":     round(raw_score, 2),
                "weight_percent": int(weight * 100),
                "impact":        "positive" if raw_score >= 50 else "negative",
                "level":         level,
                "explanation":   EXPLANATIONS[factor][level],
            })

        # Sort by absolute contribution (most impactful first)
        contributions.sort(key=lambda x: abs(x["shap_value"]), reverse=True)

        return {
            "mode":         "simple",
            "contributions": contributions,
            "summary":      self._generate_summary(contributions, tiebreaker_note),
            "top_strength": contributions[0] if contributions else None,
            "top_weakness": contributions[-1] if contributions else None,
        }

    # ------------------------------------------------------------------
    # SHAP explanation (used when model is trained)
    # ------------------------------------------------------------------

    def _shap_explanation(self, score_breakdown: dict, tiebreaker_note: str = "") -> dict:
        """
        Uses SHAP TreeExplainer to compute feature contributions.
        """
        features = np.array([[
            score_breakdown.get("gpa_score", 0),
            score_breakdown.get("financial_score", 0),
            score_breakdown.get("document_completeness", 0),
            score_breakdown.get("document_authenticity", 0),
            score_breakdown.get("special_category_score", 0),
        ]])

        try:
            shap_values = self.explainer.shap_values(features)

            contributions = []
            for i, factor in enumerate(FEATURE_NAMES):
                raw_score = float(features[0][i])
                sv = float(shap_values[0][i])
                level = _score_level(raw_score)

                contributions.append({
                    "factor":        factor,
                    "shap_value":    round(sv, 2),
                    "raw_score":     round(raw_score, 2),
                    "weight_percent": int(WEIGHTS[factor] * 100),
                    "impact":        "positive" if sv > 0 else "negative",
                    "level":         level,
                    "explanation":   EXPLANATIONS[factor][level],
                })

            contributions.sort(key=lambda x: abs(x["shap_value"]), reverse=True)

            return {
                "mode":          "shap",
                "contributions":  contributions,
                "summary":       self._generate_summary(contributions, tiebreaker_note),
                "top_strength":  contributions[0] if contributions else None,
                "top_weakness":  contributions[-1] if contributions else None,
            }

        except Exception as e:
            print(f"[SHAP] Explanation failed, falling back to simple: {e}")
            return self._simple_explanation(score_breakdown, tiebreaker_note)

    # ------------------------------------------------------------------
    # Summary generator
    # ------------------------------------------------------------------

    def _generate_summary(self, contributions: list, tiebreaker_note: str = "") -> str:
        """
        Generates a plain-English summary of the student's strengths
        and areas for improvement, with optional tiebreaker note.
        """
        strengths = [c["factor"] for c in contributions if c["raw_score"] >= 75]
        weaknesses = [c["factor"] for c in contributions if c["raw_score"] < 50]

        parts = []

        if strengths:
            parts.append(f"Strong performance in: {', '.join(strengths)}.")

        if weaknesses:
            parts.append(f"Areas for improvement: {', '.join(weaknesses)}.")

        if not strengths and not weaknesses:
            parts.append("Average performance across all criteria.")

        if tiebreaker_note:
            parts.append(f"Note: {tiebreaker_note}")

        return " ".join(parts)


# ---------------------------------------------------------------------------
# Singleton — imported by main.py
# ---------------------------------------------------------------------------
explainer = ScholarshipExplainer()

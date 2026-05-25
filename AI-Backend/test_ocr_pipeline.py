"""
test_ocr_pipeline.py
Unit + integration tests for the OCR pre-processing layer and ModernBERT pipeline.

Unit tests use unittest.mock to avoid loading EasyOCR / ModernBERT weights.
The live integration block at the bottom runs only when executed directly
(python test_ocr_pipeline.py) and requires a real file at:
    e:\\Thesis Software\\test_inputs\\sample_tor.jpg
"""

import sys
import types
import importlib
import unittest
from unittest.mock import MagicMock, patch


# ===========================================================================
# Lightweight stubs — prevent EasyOCR and ModernBERT from loading during tests
# ===========================================================================

def _stub_easyocr():
    """Replace easyocr with a stub so the module-level Reader() call is harmless."""
    mock_reader = MagicMock()
    mock_reader.readtext.return_value = []          # default: returns empty list

    mock_easyocr = types.ModuleType("easyocr")
    mock_easyocr.Reader = MagicMock(return_value=mock_reader)

    sys.modules["easyocr"] = mock_easyocr
    return mock_reader                              # returned so tests can configure it


def _stub_transformers():
    """Replace transformers AutoModel/AutoTokenizer with silent stubs."""
    mock_transformers = types.ModuleType("transformers")

    mock_tokenizer = MagicMock()
    mock_tokenizer.return_value = {"input_ids": MagicMock(shape=(1, 10))}
    mock_transformers.AutoTokenizer = MagicMock()
    mock_transformers.AutoTokenizer.from_pretrained = MagicMock(return_value=mock_tokenizer)

    mock_model = MagicMock()
    mock_transformers.AutoModel = MagicMock()
    mock_transformers.AutoModel.from_pretrained = MagicMock(return_value=mock_model)

    sys.modules["transformers"] = mock_transformers


def _stub_torch():
    """Stub torch so BERTDocumentAnalyzer.__init__ doesn't crash."""
    mock_torch = types.ModuleType("torch")
    mock_torch.device = MagicMock(return_value="cpu")
    mock_torch.cuda = MagicMock()
    mock_torch.cuda.is_available = MagicMock(return_value=False)
    mock_torch.no_grad = MagicMock(return_value=MagicMock(__enter__=MagicMock(return_value=None),
                                                           __exit__=MagicMock(return_value=False)))
    sys.modules["torch"] = mock_torch


def _stub_pdf2image():
    mock_pdf2image = types.ModuleType("pdf2image")
    mock_pdf2image.convert_from_path = MagicMock(return_value=[])
    sys.modules["pdf2image"] = mock_pdf2image


def _stub_pdfplumber():
    mock_pdf = types.ModuleType("pdfplumber")
    mock_context = MagicMock()
    mock_context.__enter__ = MagicMock(return_value=MagicMock(pages=[]))
    mock_context.__exit__ = MagicMock(return_value=False)
    mock_pdf.open = MagicMock(return_value=mock_context)
    sys.modules["pdfplumber"] = mock_pdf


def _stub_PIL():
    import numpy as np

    mock_pil = types.ModuleType("PIL")
    mock_image_mod = types.ModuleType("PIL.Image")

    # Image.open(path).convert("RGB") must return something np.array() accepts
    mock_img_instance = MagicMock()
    mock_img_instance.convert.return_value = mock_img_instance
    mock_img_instance.__array__ = MagicMock(return_value=np.zeros((10, 10, 3), dtype=np.uint8))

    mock_image_cls = MagicMock()
    mock_image_cls.open = MagicMock(return_value=mock_img_instance)
    mock_image_cls.Image = mock_image_cls

    mock_image_mod.open = mock_image_cls.open
    mock_image_mod.Image = mock_image_cls

    sys.modules["PIL"] = mock_pil
    sys.modules["PIL.Image"] = mock_image_mod
    mock_pil.Image = mock_image_mod


# Install all stubs BEFORE importing our modules
_MOCK_OCR_READER = _stub_easyocr()
_stub_transformers()
_stub_torch()
_stub_pdf2image()
_stub_pdfplumber()
_stub_PIL()

# Now safe to import — no heavy models will load
import document_ingestion                          # noqa: E402
from document_ingestion import (                   # noqa: E402
    _normalize_ocr_text,
    extract_text_from_file,
    extract_text_from_image,
    _extract_pdf_digital,
)

# Patch the module-level ocr_reader with our controllable mock
document_ingestion.ocr_reader = _MOCK_OCR_READER

# Patch Image inside document_ingestion so Image.open() works with our stub
import numpy as _np
_mock_img = MagicMock()
_mock_img.convert.return_value = _mock_img
_mock_img.__array__ = MagicMock(return_value=_np.zeros((10, 10, 3), dtype=_np.uint8))
document_ingestion.Image = MagicMock()
document_ingestion.Image.open = MagicMock(return_value=_mock_img)

# Import bert_analyzer pieces we need (class only, not the singleton)
from bert_analyzer import BERTDocumentAnalyzer, EXPECTED_TERMS  # noqa: E402


# ===========================================================================
# Helper: build a BERTDocumentAnalyzer without loading actual weights
# ===========================================================================

def _make_analyzer() -> BERTDocumentAnalyzer:
    """Instantiates BERTDocumentAnalyzer bypassing __init__ model loading."""
    analyzer = object.__new__(BERTDocumentAnalyzer)
    analyzer.device = "cpu"
    analyzer.tokenizer = MagicMock()
    analyzer.model = MagicMock()
    return analyzer


# ===========================================================================
# 1. OCR Normalization tests  (_normalize_ocr_text)
# ===========================================================================

class TestOCRNormalization(unittest.TestCase):

    def test_leading_l_lowercase_fixed(self):
        """'l.50' (lowercase L) must become '1.50'"""
        self.assertEqual(_normalize_ocr_text("GWA: l.50"), "GWA: 1.50")

    def test_leading_I_uppercase_fixed(self):
        """'I.75' (uppercase I) must become '1.75'"""
        self.assertEqual(_normalize_ocr_text("GWA: I.75"), "GWA: 1.75")

    def test_leading_O_uppercase_fixed(self):
        """'O.5' (uppercase O) must become '0.5'"""
        self.assertEqual(_normalize_ocr_text("Average: O.50"), "Average: 0.50")

    def test_trailing_l_in_decimal_fixed(self):
        """'1.l5' must become '1.15'"""
        self.assertEqual(_normalize_ocr_text("1.l5 GWA"), "1.15 GWA")

    def test_trailing_I_in_decimal_fixed(self):
        """'2.I0' must become '2.10'"""
        self.assertEqual(_normalize_ocr_text("GPA: 2.I0"), "GPA: 2.10")

    def test_clean_text_unchanged(self):
        """Text with no OCR errors must pass through unmodified."""
        clean = "GWA: 1.75 semester grades transcript"
        self.assertEqual(_normalize_ocr_text(clean), clean)

    def test_empty_string_returns_empty(self):
        self.assertEqual(_normalize_ocr_text(""), "")

    def test_none_returns_none(self):
        self.assertIsNone(_normalize_ocr_text(None))

    def test_excess_whitespace_collapsed(self):
        """Multiple spaces collapsed to single space."""
        result = _normalize_ocr_text("GWA:  1.75")
        self.assertEqual(result, "GWA: 1.75")


# ===========================================================================
# 2. GWA extraction tests  (BERTDocumentAnalyzer.extract_gwa_from_text)
# ===========================================================================

class TestGWAExtraction(unittest.TestCase):

    def setUp(self):
        self.analyzer = _make_analyzer()

    def test_clean_gwa_extracted(self):
        """Standard 'GWA: 1.75' must return 1.75."""
        self.assertEqual(self.analyzer.extract_gwa_from_text("GWA: 1.75"), 1.75)

    def test_ocr_l_misread_normalized_and_extracted(self):
        """'GWA: l.50' OCR noise must normalize and return 1.5."""
        self.assertEqual(self.analyzer.extract_gwa_from_text("GWA: l.50"), 1.5)

    def test_ocr_I_misread_normalized_and_extracted(self):
        """'GWA: I.50' OCR noise must normalize and return 1.5."""
        self.assertEqual(self.analyzer.extract_gwa_from_text("GWA: I.50"), 1.5)

    def test_ocr_I_75_extracted(self):
        """'GWA: I.75' must return 1.75."""
        self.assertEqual(self.analyzer.extract_gwa_from_text("GWA: I.75"), 1.75)

    def test_general_weighted_average_pattern(self):
        """Long-form label must be matched."""
        text = "General Weighted Average: 2.00"
        self.assertEqual(self.analyzer.extract_gwa_from_text(text), 2.0)

    def test_gpa_label_pattern(self):
        """GPA label must also match."""
        self.assertEqual(self.analyzer.extract_gwa_from_text("GPA: 1.50"), 1.5)

    def test_value_after_gwa_pattern(self):
        """'1.75 GWA' reversed format must match."""
        self.assertEqual(self.analyzer.extract_gwa_from_text("1.75 GWA"), 1.75)

    def test_out_of_range_value_ignored(self):
        """Value 5.5 is outside 1.0–5.0 — must return None."""
        self.assertIsNone(self.analyzer.extract_gwa_from_text("GWA: 5.50"))

    def test_no_gwa_returns_none(self):
        """Text with no GWA pattern must return None."""
        self.assertIsNone(self.analyzer.extract_gwa_from_text("This document has no grade info"))

    def test_empty_text_returns_none(self):
        self.assertIsNone(self.analyzer.extract_gwa_from_text(""))

    def test_none_text_returns_none(self):
        self.assertIsNone(self.analyzer.extract_gwa_from_text(None))


# ===========================================================================
# 3. Fuzzy authenticity verification  (BERTDocumentAnalyzer.verify_document_authenticity)
# ===========================================================================

class TestVerifyDocumentAuthenticity(unittest.TestCase):

    def setUp(self):
        self.analyzer = _make_analyzer()

    # --- TOR tests ---

    def test_clean_tor_is_authentic(self):
        """Clean TOR text must be authentic with high confidence."""
        text = ("transcript of records grades units grade point academic "
                "weighted average general weighted semester subject")
        result = self.analyzer.verify_document_authenticity(text, "TOR")
        self.assertTrue(result["is_authentic"])
        self.assertGreater(result["confidence"], 40.0)

    def test_ocr_typo_7ranscript_still_passes(self):
        """'7ranscript' OCR typo must still fuzzy-match 'transcript'."""
        text = ("7ranscript of records 6rades units grade point academic "
                "weighted average general weighted semester subject")
        result = self.analyzer.verify_document_authenticity(text, "TOR")
        self.assertTrue(result["is_authentic"],
                        msg=f"Expected authentic but got confidence={result['confidence']}")
        self.assertGreater(result["confidence"], 40.0)

    def test_ocr_typo_enrollrnent_still_passes(self):
        """'enrollrnent' OCR typo must still fuzzy-match 'enrollment'."""
        text = ("enrollrnent certificate registered student "
                "school year semester currently enrolled")
        result = self.analyzer.verify_document_authenticity(text, "enrollment")
        self.assertTrue(result["is_authentic"])
        self.assertGreater(result["confidence"], 40.0)

    def test_wrong_doc_type_fails(self):
        """Completely wrong document content must fail authenticity."""
        text = "invoice price total amount due payment receipt"
        result = self.analyzer.verify_document_authenticity(text, "TOR")
        self.assertFalse(result["is_authentic"])

    def test_empty_text_fails(self):
        """Empty text must return is_authentic=False."""
        result = self.analyzer.verify_document_authenticity("", "TOR")
        self.assertFalse(result["is_authentic"])
        self.assertEqual(result["confidence"], 0.0)

    def test_unknown_doc_type_returns_neutral(self):
        """Unknown doc_type must return neutral 50.0 confidence."""
        result = self.analyzer.verify_document_authenticity("some text", "unknown_type")
        self.assertEqual(result["confidence"], 50.0)
        self.assertTrue(result["is_authentic"])

    def test_result_contains_match_scores(self):
        """Result dict must include fuzzy_threshold and match_scores fields."""
        text = "transcript grades semester subject academic"
        result = self.analyzer.verify_document_authenticity(text, "TOR")
        self.assertIn("fuzzy_threshold", result)
        self.assertIn("match_scores", result)
        self.assertEqual(result["fuzzy_threshold"], 80)

    def test_indigency_keywords_match(self):
        """Indigency document with correct keywords must pass."""
        text = "indigent certificate barangay income poverty low income marginalized certify"
        result = self.analyzer.verify_document_authenticity(text, "indigency")
        self.assertTrue(result["is_authentic"])

    def test_birth_certificate_keywords_match(self):
        """Birth certificate with PSA keywords must pass."""
        text = "birth certificate born date of birth civil registry psa philippine statistics registered"
        result = self.analyzer.verify_document_authenticity(text, "birth_certificate")
        self.assertTrue(result["is_authentic"])


# ===========================================================================
# 4. File router tests  (extract_text_from_file)
# ===========================================================================

class TestFileRouter(unittest.TestCase):

    def setUp(self):
        """Reset mock call history before each test."""
        _MOCK_OCR_READER.readtext.reset_mock()

    def test_jpg_invokes_ocr_reader(self):
        """Uploading a .jpg must call ocr_reader.readtext exactly once."""
        _MOCK_OCR_READER.readtext.return_value = ["transcript", "grades", "semester"]

        result = extract_text_from_file(b"fake-image-bytes", "sample.jpg")

        _MOCK_OCR_READER.readtext.assert_called_once()
        self.assertEqual(result["source"], "ocr_image")

    def test_jpeg_extension_also_routes_to_ocr(self):
        """.jpeg extension must also route to EasyOCR."""
        _MOCK_OCR_READER.readtext.return_value = ["enrolled", "student"]

        result = extract_text_from_file(b"fake-image-bytes", "doc.jpeg")

        _MOCK_OCR_READER.readtext.assert_called_once()
        self.assertEqual(result["source"], "ocr_image")

    def test_png_extension_routes_to_ocr(self):
        _MOCK_OCR_READER.readtext.return_value = ["quezon city", "barangay"]

        result = extract_text_from_file(b"fake-png-bytes", "id.png")

        _MOCK_OCR_READER.readtext.assert_called_once()
        self.assertEqual(result["source"], "ocr_image")

    def test_txt_does_not_invoke_ocr(self):
        """.txt file must NOT call ocr_reader — text is decoded directly."""
        content = b"GWA: 1.75 transcript grades semester"
        result = extract_text_from_file(content, "grades.txt")

        _MOCK_OCR_READER.readtext.assert_not_called()
        self.assertEqual(result["source"], "plaintext")
        self.assertTrue(result["success"])
        self.assertIn("1.75", result["text"])

    def test_unsupported_extension_fails_gracefully(self):
        """.docx upload must return success=False without crashing."""
        result = extract_text_from_file(b"some bytes", "document.docx")
        self.assertFalse(result["success"])
        self.assertTrue(result["ocr_failed"])
        self.assertIn("Unsupported", result["reason"])

    def test_ocr_returns_text_normalized_in_result(self):
        """OCR output with 'l.50' must be normalized to '1.50' in result text."""
        _MOCK_OCR_READER.readtext.return_value = ["GWA: l.50 transcript grades semester"]

        result = extract_text_from_file(b"fake-image-bytes", "tor.jpg")

        self.assertTrue(result["success"])
        self.assertIn("1.50", result["text"],
                      msg=f"Expected '1.50' in normalized text but got: {result['text']}")

    def test_ocr_empty_result_fails_gracefully(self):
        """If EasyOCR returns nothing, result must flag ocr_failed=True without crashing."""
        _MOCK_OCR_READER.readtext.return_value = []

        result = extract_text_from_file(b"blank-image", "blank.jpg")

        self.assertFalse(result["success"])
        self.assertTrue(result["ocr_failed"])
        self.assertEqual(result["text"], "")


# ===========================================================================
# 5. Live integration block — runs only via `python test_ocr_pipeline.py`
# ===========================================================================

def run_live_integration():
    """
    Loads REAL EasyOCR + ModernBERT and processes an actual file.
    Requires:  e:\\Thesis Software\\test_inputs\\sample_tor.jpg
    """
    SAMPLE_PATH = r"e:\Thesis Software\test_inputs\sample_tor.pdf"
    import os

    print("\n" + "=" * 60)
    print("  LIVE INTEGRATION TEST")
    print("=" * 60)

    if not os.path.exists(SAMPLE_PATH):
        print(f"[SKIP] Sample file not found: {SAMPLE_PATH}")
        print("       Create the directory and place a TOR photo there to run this test.")
        return

    print(f"[INFO] File found: {SAMPLE_PATH}")
    print("[INFO] Loading real EasyOCR + ModernBERT (this may take 1–2 minutes)...")

    # Reload modules with real dependencies (stubs only apply to unittest above)
    for mod in ["document_ingestion", "bert_analyzer", "easyocr", "pdfplumber",
                "pdf2image", "PIL", "PIL.Image", "torch", "transformers"]:
        sys.modules.pop(mod, None)

    import document_ingestion as di
    from bert_analyzer import bert_analyzer as real_analyzer

    with open(SAMPLE_PATH, "rb") as f:
        file_bytes = f.read()

    sample_filename = os.path.basename(SAMPLE_PATH)   # preserves correct extension
    print("\n[STEP 1] Extracting text via OCR...")
    ingestion = di.extract_text_from_file(file_bytes, sample_filename)

    if not ingestion["success"]:
        print(f"[FAIL] OCR failed: {ingestion['reason']}")
        return

    extracted_text = ingestion["text"]
    print(f"[OK]   Source     : {ingestion['source']}")
    print(f"[OK]   Char count : {ingestion['char_count']}")
    print(f"\n--- Extracted Text (first 500 chars) ---")
    print(extracted_text[:500])
    print("----------------------------------------")

    print("\n[STEP 2] Extracting GWA...")
    gwa = real_analyzer.extract_gwa_from_text(extracted_text)
    if gwa is not None:
        print(f"[OK]   GWA extracted: {gwa}")
    else:
        print("[INFO] No GWA value found in extracted text.")

    print("\n[STEP 3] ModernBERT authenticity verification (testing all doc types)...")
    doc_types = ["TOR", "enrollment", "good_moral", "indigency", "birth_certificate",
                 "QCitizen_ID", "income_tax"]
    best_type = None
    best_confidence = 0.0
    for dt in doc_types:
        auth = real_analyzer.verify_document_authenticity(extracted_text, dt)
        marker = " ◄ AUTHENTIC" if auth["is_authentic"] else ""
        print(f"   {dt:<22} confidence={auth['confidence']:6.2f}%  "
              f"matched={auth['matched_terms']}/{auth['total_expected_terms']}{marker}")
        if auth["confidence"] > best_confidence:
            best_confidence = auth["confidence"]
            best_type = dt

    print(f"\n[OK]   Best match    : {best_type} ({best_confidence:.2f}%)")
    print("\n[DONE] Live integration test complete.")


if __name__ == "__main__":
    run_live_integration()
else:
    # When imported by pytest, run the unit test suite
    unittest.main(module=__name__, argv=[""], exit=False, verbosity=0)

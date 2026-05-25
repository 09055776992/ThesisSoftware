"""
Document Ingestion Layer
Routes uploaded files (digital PDF, scanned PDF, image) to the appropriate
text-extraction method and normalizes the output before passing it to
ModernBERT (bert_analyzer.py).

Extraction pipeline:
  .pdf  → pdfplumber (digital)  ──► if < 50 chars → pdf2image + easyocr (scanned)
  .jpg/.jpeg/.png → easyocr directly
  .txt  → read as plain text

OCR normalization:
  Fixes common misreads (l.50 → 1.50, I.75 → 1.75, O.5 → 0.5) before
  any regex pattern (GWA extraction) is applied.
"""

import re
import io
import os
import tempfile
import logging

import pdfplumber
import easyocr
from pdf2image import convert_from_path
from PIL import Image

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# EasyOCR singleton — loaded once at startup, never re-initialized per request
# ---------------------------------------------------------------------------
print("[OCR] Initializing EasyOCR reader (English) — first run downloads model...")
ocr_reader = easyocr.Reader(["en"], gpu=False, verbose=False)
print("[OCR] EasyOCR ready.")

# ---------------------------------------------------------------------------
# Supported extensions
# ---------------------------------------------------------------------------
PDF_EXTENSIONS  = {".pdf"}
IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".bmp", ".tiff", ".webp"}
TEXT_EXTENSIONS  = {".txt"}

# Minimum character count for pdfplumber output to be considered valid
_PDF_TEXT_MIN_CHARS = 50

# ---------------------------------------------------------------------------
# OCR text normalization
# ---------------------------------------------------------------------------

# Regex: fix l/I misread before a decimal digit  (e.g.  l.50  I.75  l.0)
_OCR_LEADING_L = re.compile(r"\b[lI](\.[0-9])")
# Regex: fix O misread before a decimal digit    (e.g.  O.50  O.75)
_OCR_LEADING_O = re.compile(r"\bO(\.[0-9])")
# Regex: fix l/I misread AFTER a digit-dot       (e.g.  1.l5  2.I0)
_OCR_TRAILING_L = re.compile(r"([0-9]\.)([lI])([0-9])")
# Collapse multiple spaces / stray newlines within a line
_WHITESPACE_NORM = re.compile(r"[ \t]{2,}")


def _normalize_ocr_text(text: str) -> str:
    """
    Applies deterministic substitutions to fix the most common OCR misreads
    that break GWA regex patterns and keyword matching.

    Examples corrected:
      l.50  → 1.50      I.75  → 1.75      O.5  → 0.5
      1.l5  → 1.15      2.I0  → 2.10
    """
    if not text:
        return text

    text = _OCR_LEADING_L.sub(r"1\1", text)
    text = _OCR_LEADING_O.sub(r"0\1", text)
    text = _OCR_TRAILING_L.sub(lambda m: m.group(1) + "1" + m.group(3), text)
    text = _WHITESPACE_NORM.sub(" ", text)
    return text.strip()


# ---------------------------------------------------------------------------
# PDF extraction (two-pass)
# ---------------------------------------------------------------------------

def _extract_pdf_digital(path: str) -> str:
    """Extracts text from a digital (selectable-text) PDF using pdfplumber."""
    pages_text: list[str] = []
    with pdfplumber.open(path) as pdf:
        for page in pdf.pages:
            page_text = page.extract_text() or ""
            pages_text.append(page_text)
    return "\n".join(pages_text)


def _extract_pdf_scanned(path: str) -> str:
    """
    Converts each PDF page to an image and runs EasyOCR on it.
    Used as a fallback when pdfplumber finds no selectable text.
    """
    pages_text: list[str] = []
    images = convert_from_path(path, dpi=200)
    for img in images:
        result = ocr_reader.readtext(
            _pil_to_numpy(img),
            detail=0,               # returns plain string list
            paragraph=True,         # merge nearby text into paragraphs
        )
        pages_text.append(" ".join(result))
    return "\n".join(pages_text)


def extract_text_from_pdf(path: str) -> str:
    """
    Two-pass PDF extraction:
      1. pdfplumber for digital PDFs (fast, lossless)
      2. EasyOCR fallback for scanned / image-only PDFs
    """
    digital_text = _extract_pdf_digital(path)
    if len(digital_text.strip()) >= _PDF_TEXT_MIN_CHARS:
        logger.debug("[Ingestion] PDF: digital text extracted (%d chars)", len(digital_text))
        return digital_text

    logger.info("[Ingestion] PDF: digital extraction insufficient (%d chars) — switching to OCR", len(digital_text))
    return _extract_pdf_scanned(path)


# ---------------------------------------------------------------------------
# Image extraction
# ---------------------------------------------------------------------------

def _pil_to_numpy(img: Image.Image):
    """Convert PIL image to numpy array for EasyOCR."""
    import numpy as np
    return np.array(img.convert("RGB"))


def extract_text_from_image(path: str) -> str:
    """Runs EasyOCR on an image file. Loads via Pillow→numpy to avoid
    imageio v3 backend compatibility issues on Windows."""
    import numpy as np
    img = Image.open(path).convert("RGB")
    img_array = np.array(img)
    result = ocr_reader.readtext(img_array, detail=0, paragraph=True)
    return " ".join(result)


# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------

def extract_text_from_file(file_bytes: bytes, filename: str) -> dict:
    """
    Routes uploaded file bytes to the correct extraction method by extension.

    Returns:
        {
            "success": bool,
            "text": str,              # normalized extracted text (empty string on failure)
            "source": str,            # "digital_pdf" | "scanned_pdf" | "ocr_image" | "plaintext"
            "char_count": int,
            "ocr_failed": bool,       # True only if extraction produced zero usable text
            "reason": str | None,     # human-readable failure message, or None on success
        }
    """
    ext = os.path.splitext(filename.lower())[1]

    if ext not in PDF_EXTENSIONS | IMAGE_EXTENSIONS | TEXT_EXTENSIONS:
        return _failed_result(
            f"Unsupported file type '{ext}'. Accepted: pdf, jpg, jpeg, png, txt."
        )

    # Write bytes to a temporary file (required by pdfplumber / pdf2image / easyocr)
    suffix = ext if ext else ".bin"
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            tmp.write(file_bytes)
            tmp_path = tmp.name

        raw_text = ""
        source   = "unknown"

        if ext in PDF_EXTENSIONS:
            digital_text = _extract_pdf_digital(tmp_path)
            if len(digital_text.strip()) >= _PDF_TEXT_MIN_CHARS:
                raw_text = digital_text
                source   = "digital_pdf"
            else:
                raw_text = _extract_pdf_scanned(tmp_path)
                source   = "scanned_pdf"

        elif ext in IMAGE_EXTENSIONS:
            raw_text = extract_text_from_image(tmp_path)
            source   = "ocr_image"

        elif ext in TEXT_EXTENSIONS:
            raw_text = file_bytes.decode("utf-8", errors="replace")
            source   = "plaintext"

    except Exception as exc:
        logger.exception("[Ingestion] Extraction failed for '%s': %s", filename, exc)
        return _failed_result(f"Extraction error: {exc}")

    finally:
        # Always clean up the temp file
        try:
            os.unlink(tmp_path)
        except Exception:
            pass

    normalized = _normalize_ocr_text(raw_text)

    if not normalized:
        return _failed_result(
            f"No text could be extracted from '{filename}'. "
            "The document may be blank, corrupted, or an unreadable scan."
        )

    return {
        "success":   True,
        "text":      normalized,
        "source":    source,
        "char_count": len(normalized),
        "ocr_failed": False,
        "reason":    None,
    }


def _failed_result(reason: str) -> dict:
    """Uniform failure response — keeps scoring.py's neutral-50 fallback intact."""
    logger.warning("[Ingestion] %s", reason)
    return {
        "success":    False,
        "text":       "",
        "source":     "none",
        "char_count": 0,
        "ocr_failed": True,
        "reason":     reason,
    }

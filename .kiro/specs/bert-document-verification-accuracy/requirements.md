# Requirements Document

## Introduction

The SCHOLAR AI Backend currently performs document authenticity verification using a keyword-matching approach in `bert_analyzer.py`. While BERT embeddings are already implemented (`get_text_embeddings`, `compute_document_similarity`), they are never called during verification. The confidence score is computed as `matched_keywords / total_keywords`, meaning any document that copies the right words passes, and a legitimate document with unusual phrasing may fail.

This feature replaces the keyword-only verification with a BERT embedding-based approach: each submitted document is encoded into a 768-dimensional vector and compared via cosine similarity against a reference template embedding for its document type. The resulting similarity score becomes the authenticity confidence, which feeds into the existing 15% `document_authenticity` weight in `scoring.py`. Keyword matching is retained as a secondary signal to improve robustness.

The system handles seven Philippine scholarship document types: Transcript of Records (TOR), Enrollment Certificate, QCitizen ID, Indigency Certificate, Birth Certificate, Good Moral Certificate, and Income Tax Return.

---

## Glossary

- **BERT_Analyzer**: The `BERTDocumentAnalyzer` class in `bert_analyzer.py` responsible for document embedding and verification.
- **Reference_Template**: A canonical text string representing the expected content and structure of a given document type, used to generate a reference embedding.
- **Reference_Embedding**: The 768-dimensional BERT [CLS] token vector produced from a Reference_Template for a specific document type.
- **Document_Embedding**: The 768-dimensional BERT [CLS] token vector produced from the text of a submitted document.
- **Cosine_Similarity**: The dot product of two unit-normalised vectors, yielding a value in [0, 1] where 1 means identical semantic direction.
- **Hybrid_Confidence**: The final authenticity confidence score combining Cosine_Similarity and keyword match ratio.
- **Keyword_Match_Ratio**: The fraction of expected keywords found in the document text (`matched_keywords / total_expected_keywords`), retained as a secondary signal.
- **Authenticity_Threshold**: The minimum Hybrid_Confidence value (0.40) above which a document is considered authentic.
- **Embedding_Cache**: An in-memory dict mapping Document_Type names to their pre-computed Reference_Embeddings, populated at initialisation before any request is served.
- **Scoring_System**: The `ScholarshipScoringSystem` class in `scoring.py` that consumes the authenticity confidence score.
- **Document_Type**: One of the seven supported Philippine scholarship document categories: `TOR`, `enrollment`, `QCitizen_ID`, `indigency`, `birth_certificate`, `good_moral`, `income_tax`.

---

## Requirements

### Requirement 1: Reference Template Definition

**User Story:** As a system administrator, I want each supported document type to have a canonical reference template, so that BERT has a meaningful semantic target to compare submitted documents against.

#### Acceptance Criteria

1. THE BERT_Analyzer SHALL define a Reference_Template string for each of the seven Document_Types: `TOR`, `enrollment`, `QCitizen_ID`, `indigency`, `birth_certificate`, `good_moral`, and `income_tax`.
2. WHEN a Reference_Template is defined, THE BERT_Analyzer SHALL ensure it contains at least 10 distinct domain-specific terms drawn from the vocabulary of authentic Philippine scholarship documents for that Document_Type.
3. THE BERT_Analyzer SHALL store all Reference_Templates in a single constant named `REFERENCE_TEMPLATES` (a `dict[str, str]`) within `bert_analyzer.py` so that templates can be reviewed and updated without modifying logic code.
4. IF a `doc_type` value is not a key in `REFERENCE_TEMPLATES`, THEN THE BERT_Analyzer SHALL treat it as an unrecognised Document_Type and apply the keyword-only fallback path defined in Requirement 3, Criterion 6.

---

### Requirement 2: Reference Embedding Pre-computation

**User Story:** As a developer, I want reference embeddings to be computed once at startup and cached, so that verification requests do not incur repeated BERT inference overhead for the same document type.

#### Acceptance Criteria

1. WHEN the BERT_Analyzer is initialised (i.e., during `__init__`), THE BERT_Analyzer SHALL compute a Reference_Embedding for every Document_Type that has a non-empty entry in `REFERENCE_TEMPLATES` and store it in the Embedding_Cache before `__init__` returns.
2. THE BERT_Analyzer SHALL store all computed Reference_Embeddings in the Embedding_Cache keyed by Document_Type name, such that `embedding_cache[doc_type]` returns the corresponding `numpy.ndarray` of shape `(1, 768)`.
3. WHILE the BERT_Analyzer is running, THE BERT_Analyzer SHALL serve all subsequent verification requests using the pre-computed Reference_Embeddings from the Embedding_Cache without recomputing them.
4. IF a Reference_Template for a Document_Type is absent or its value is an empty string at initialisation time, THEN THE BERT_Analyzer SHALL log a warning message of the form `"[BERT] Warning: no template for doc_type '{doc_type}' — skipping cache entry"` and SHALL skip that entry in the Embedding_Cache; IF both conditions are true (key missing AND value would be empty), THE BERT_Analyzer SHALL log the warning exactly once using whichever condition is detected first.
5. IF BERT inference raises an exception while computing a Reference_Embedding during initialisation, THEN THE BERT_Analyzer SHALL log the exception, skip that Document_Type's cache entry, and continue initialising remaining entries without aborting the entire startup sequence.

---

### Requirement 3: BERT Embedding-Based Authenticity Verification

**User Story:** As a scholarship officer, I want document authenticity to be assessed using semantic similarity rather than keyword presence alone, so that documents with legitimate but varied phrasing are not incorrectly rejected.

#### Acceptance Criteria

1. WHEN `verify_document_authenticity` is called with a non-empty text and a Document_Type that is one of `TOR`, `enrollment`, `QCitizen_ID`, `indigency`, `birth_certificate`, `good_moral`, or `income_tax`, THE BERT_Analyzer SHALL compute a Document_Embedding for the submitted text using `get_text_embeddings`.
2. WHEN a Document_Embedding has been computed, THE BERT_Analyzer SHALL retrieve the corresponding Reference_Embedding from the Embedding_Cache and compute Cosine_Similarity as `dot(doc_emb, ref_emb) / (norm(doc_emb) * norm(ref_emb))`, where both embeddings are flattened to 1-D vectors before the operation.
3. THE BERT_Analyzer SHALL compute the Keyword_Match_Ratio as `len(matched_keywords) / len(EXPECTED_TERMS[doc_type])` and then compute Hybrid_Confidence as `(cosine_similarity × 0.7) + (keyword_match_ratio × 0.3)`.
4. THE BERT_Analyzer SHALL set `is_authentic = True` when Hybrid_Confidence is greater than or equal to 0.40 (the Authenticity_Threshold).
5. THE BERT_Analyzer SHALL return the Hybrid_Confidence value scaled to a 0–100 range (i.e., `round(hybrid_confidence * 100, 2)`) in the `confidence` field, and SHALL also return `doc_type`, `is_authentic`, `matched_terms`, `matched_keywords`, and `total_expected_terms` to preserve the existing response schema consumed by `scoring.py`.
6. IF the submitted Document_Type is not present in the Embedding_Cache, THEN THE BERT_Analyzer SHALL fall back to the existing keyword-only verification and SHALL include a `fallback_reason` field in the result with the value `"No reference embedding available for doc_type '{doc_type}'"`.
7. IF the submitted text is empty or contains only whitespace, THEN THE BERT_Analyzer SHALL return `is_authentic = False` with `confidence = 0.0` without invoking BERT inference.
8. IF either the Document_Embedding or the Reference_Embedding has a zero L2-norm, THEN THE BERT_Analyzer SHALL set Cosine_Similarity to 0.0 and proceed with the Hybrid_Confidence calculation using that value; WHEN both embeddings are valid (non-zero norms), THE BERT_Analyzer SHALL use the raw cosine similarity value without capping in the Hybrid_Confidence calculation.
9. IF the submitted text is empty or contains only whitespace, THEN THE BERT_Analyzer SHALL check for this condition at the initial input stage before any preprocessing or normalisation steps are applied.

---

### Requirement 4: Backward Compatibility with Scoring System

**User Story:** As a developer, I want the updated verification output to remain compatible with the existing scoring pipeline, so that no changes are required in `scoring.py` or `main.py`.

#### Acceptance Criteria

1. THE BERT_Analyzer SHALL return a verification result dict that includes the fields `doc_type`, `is_authentic`, `confidence`, `matched_terms`, `matched_keywords`, and `total_expected_terms` on every code path, including the empty-text path (where `matched_keywords` SHALL be an empty list `[]`), the unknown-doc-type path, and the nominal hybrid path.
2. THE Scoring_System SHALL continue to consume the `confidence` field from verification results without modification to `scoring.py`.
3. THE BERT_Analyzer SHALL ensure the `confidence` field value is in the range [0.0, 100.0] on all three code paths: `confidence = 0.0` for empty text, `confidence = 50.0` for unknown doc type, and `confidence = round(hybrid_confidence * 100, 2)` for the nominal hybrid path.

---

### Requirement 5: Verification Result Transparency

**User Story:** As a scholarship officer, I want the verification result to explain how the confidence score was derived, so that I can understand why a document was flagged as inauthentic.

#### Acceptance Criteria

1. WHEN embedding-based verification is performed, THE BERT_Analyzer SHALL include a `similarity_score` field in the result containing the raw Cosine_Similarity value rounded to 4 decimal places (range 0.0000–1.0000, unscaled).
2. WHEN embedding-based verification is performed, THE BERT_Analyzer SHALL include a `keyword_match_ratio` field in the result containing the raw Keyword_Match_Ratio rounded to 4 decimal places (range 0.0000–1.0000, unscaled).
3. IF embedding-based verification was performed, THEN THE BERT_Analyzer SHALL set `verification_method = "bert_hybrid"` in the result; IF the keyword-only fallback path was taken, THEN THE BERT_Analyzer SHALL set `verification_method = "keyword_only"`; IF neither the embedding path nor the keyword fallback path executes, THEN THE BERT_Analyzer SHALL default to `verification_method = "bert_hybrid"`.
4. THE BERT_Analyzer SHALL include the `matched_keywords` list in all result paths; on the unknown-doc-type fallback path where no keyword list exists, `matched_keywords` SHALL be an empty list `[]`.

---

### Requirement 6: Performance Constraint

**User Story:** As a system operator, I want document verification to complete within an acceptable time, so that the ranking endpoint remains responsive under normal load.

#### Acceptance Criteria

1. WHEN a single document verification request is processed on CPU hardware with input text of up to 2,000 characters, THE BERT_Analyzer SHALL complete the full embedding computation and similarity calculation within 3 seconds wall-clock time per document.
2. THE BERT_Analyzer SHALL not load or re-initialise the BERT model during a verification call; the model SHALL be loaded once during `__init__` (application initialisation) and reused for all subsequent calls.
3. IF a verification call exceeds 3 seconds on CPU hardware, THE BERT_Analyzer SHALL wait indefinitely until processing completes and return the full verification result; the 3-second budget is a design target to be validated during testing, not a hard runtime cutoff, and no partial or error result SHALL be returned due to the time budget being exceeded.

---

### Requirement 7: Robustness to Noisy OCR Text

**User Story:** As a scholarship applicant, I want my documents to be fairly evaluated even if the OCR extraction produced minor errors, so that I am not penalised for imperfect text extraction.

#### Acceptance Criteria

1. THE BERT_Analyzer SHALL normalise submitted document text before tokenisation by applying the following pipeline in order: (a) convert to lowercase, (b) collapse all whitespace sequences (spaces, tabs, newlines) to a single space, (c) strip leading and trailing whitespace, (d) remove all characters that are neither alphanumeric nor a space.
2. THE BERT_Analyzer SHALL apply the same 4-step normalisation pipeline defined in Criterion 1 to each Reference_Template before computing its Reference_Embedding, ensuring both inputs are processed identically.
3. IF the document text after applying the full normalisation pipeline defined in Criterion 1 is shorter than 10 characters, THEN THE BERT_Analyzer SHALL treat it as effectively empty and return `is_authentic = False` with `confidence = 0.0`.

---

### Requirement 8: Round-Trip Embedding Consistency

**User Story:** As a developer, I want the embedding pipeline to be deterministic, so that the same document text always produces the same verification result.

#### Acceptance Criteria

1. WHEN `get_text_embeddings` is called twice with the same non-empty text string, THE BERT_Analyzer SHALL produce two embeddings whose Cosine_Similarity equals 1.0 (round-trip identity property).
2. WHEN `verify_document_authenticity` is called twice with identical `text` and `doc_type` arguments, THE BERT_Analyzer SHALL return identical values for `confidence`, `is_authentic`, `matched_terms`, and `total_expected_terms` in both calls; IF the system exhibits non-deterministic behaviour (e.g., different random seeds or model states), THE BERT_Analyzer SHALL allow different results to be returned and rely on external consistency mechanisms rather than failing with an error.
3. THE BERT_Analyzer SHALL wrap all calls to `self.model(...)` inside `torch.no_grad()` context in both `get_text_embeddings` and `analyze_document_text` to ensure deterministic output and prevent gradient accumulation.
4. WHEN `get_text_embeddings` is called with an empty string or a string containing only whitespace, THE BERT_Analyzer SHALL raise a `ValueError` with the message `"Cannot embed empty or whitespace-only text"` rather than passing the input to the BERT model.

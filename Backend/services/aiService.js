/**
 * AI Service — Node.js bridge to the Python FastAPI backend.
 * Communicates with the SCHOLAR AI Backend running on port 8000.
 *
 * All functions return null on failure so callers can gracefully
 * degrade when the Python service is unavailable.
 */

import FormData from "form-data";

const AI_BASE_URL = process.env.AI_SERVICE_URL || "http://localhost:8000";
const TIMEOUT_MS = 60000; // 60s — BERT can be slow on CPU

/**
 * Generic fetch wrapper with timeout and error handling.
 */
async function aiRequest(path, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(`${AI_BASE_URL}${path}`, {
      ...options,
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
    });

    clearTimeout(timer);

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.detail || `AI service error: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    clearTimeout(timer);
    if (error.name === "AbortError") {
      console.error("[AI Service] Request timed out:", path);
    } else {
      console.error("[AI Service] Request failed:", path, error.message);
    }
    return null;
  }
}

/**
 * Check if the Python AI service is reachable.
 * @returns {Promise<boolean>}
 */
export async function checkAIHealth() {
  const result = await aiRequest("/health");
  return result?.status === "running";
}

/**
 * Analyze a document using BERT.
 * @param {string} text - Raw text extracted from the document
 * @param {string} docType - Document type (TOR, enrollment, indigency, etc.)
 * @returns {Promise<object|null>}
 */
export async function analyzeDocument(text, docType) {
  return aiRequest("/analyze-document", {
    method: "POST",
    body: JSON.stringify({ text, doc_type: docType }),
  });
}

/**
 * Score and rank all students for a scholarship.
 * @param {Array} students - Array of student data objects
 * @param {string} scholarshipId - MongoDB scholarship _id
 * @param {object} scholarship - Full scholarship document
 * @param {Array} applications - Array of application documents
 * @returns {Promise<object|null>} - { rankings: [...], total_applicants: n }
 */
export async function rankStudents(students, scholarshipId, scholarship, applications) {
  return aiRequest("/rank-students", {
    method: "POST",
    body: JSON.stringify({
      students,
      scholarship_id: scholarshipId,
      scholarship,
      applications,
    }),
  });
}

/**
 * Get a SHAP explanation for a single score breakdown.
 * @param {object} scoreBreakdown
 * @returns {Promise<object|null>}
 */
export async function explainScore(scoreBreakdown) {
  return aiRequest("/explain-score", {
    method: "POST",
    body: JSON.stringify({ score_breakdown: scoreBreakdown }),
  });
}

/**
 * Analyze a document file using BERT (sends file to AI-Backend).
 * @param {Buffer} fileBuffer - File buffer
 * @param {string} filename - Original filename
 * @param {string} docType - Document type (TOR, enrollment, QCitizen_ID, etc.)
 * @returns {Promise<object|null>}
 */
export async function analyzeDocumentFile(fileBuffer, filename, docType) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const form = new FormData();
    form.append("file", fileBuffer, filename);
    form.append("doc_type", docType);

    const response = await fetch(`${AI_BASE_URL}/analyze-document-file`, {
      method: "POST",
      body: form,
      signal: controller.signal,
      headers: form.getHeaders(),
    });

    clearTimeout(timer);

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.detail || `AI service error: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    clearTimeout(timer);
    if (error.name === "AbortError") {
      console.error("[AI Service] File analysis timed out");
    } else {
      console.error("[AI Service] File analysis failed:", error.message);
    }
    return null;
  }
}

/**
 * Client-side API utilities for DocSense
 *
 * Handles communication with backend endpoints:
 * - uploadPDF: Uploads and processes PDF documents
 * - sendMessage: Sends chat messages with RAG
 */

// API client utilities for DocSense

/**
 * Upload a PDF file for processing
 *
 * @param file - PDF file to upload
 * @param onProgress - Callback for upload progress (0-100)
 * @returns Upload result with chunk count and status
 */
export async function uploadPDF(
  file: File,
  onProgress?: (stage: UploadStage, progress?: number) => void
): Promise<UploadResult> {
  const formData = new FormData();
  formData.append("file", file);

  // Notify starting
  onProgress?.("uploading", 0);

  const response = await fetch("/api/ingest", {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to upload PDF");
  }

  const result = await response.json();

  return {
    success: result.success,
    chunksProcessed: result.chunksProcessed,
    chunksInserted: result.chunksInserted,
    chunksFailed: result.chunksFailed,
    documentIds: result.documentIds,
    failedChunks: result.failedChunks,
  };
}

/**
 * Send a chat message and get RAG response
 *
 * @param message - User's question
 * @param onStageChange - Callback for RAG stage changes (searching → generating)
 * @returns Answer and sources from documents
 */
export async function sendMessage(
  message: string,
  onStageChange?: (stage: "searching" | "generating" | null) => void
): Promise<ChatResponse> {
  onStageChange?.("searching");

  const response = await fetch("/api/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ message }),
  });

  onStageChange?.("generating");

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to send message");
  }

  onStageChange?.(null);

  const result = await response.json();

  return {
    answer: result.answer,
    sources: result.sources,
  };
}

/**
 * Types
 */
export type UploadStage =
  | "idle"
  | "uploading"
  | "extracting"
  | "chunking"
  | "embedding"
  | "storing"
  | "done";

export interface UploadResult {
  success: boolean;
  chunksProcessed: number;
  chunksInserted: number;
  chunksFailed: number;
  documentIds: number[];
  failedChunks?: { index: number; error: string }[];
}

export interface ChatResponse {
  answer: string;
  sources: Array<{ filename: string; page: number }>;
}

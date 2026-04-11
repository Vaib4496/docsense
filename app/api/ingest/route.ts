/**
 * Document Ingestion API Route
 *
 * This endpoint handles PDF uploads for RAG (Retrieval-Augmented Generation) pipelines.
 * It extracts text from PDFs, splits them into chunks, generates embeddings using Google's
 * Gemini API, and stores them in Supabase for semantic search.
 *
 * POST /api/ingest - Accepts a PDF file via multipart/form-data
 */

import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { createClient } from "@supabase/supabase-js";
import pdfParse from "pdf-parse";

// Initialize Google GenAI client with API key from environment variables
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY!,
});

// Initialize Supabase client with service role key for database operations
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

/**
 * Splits text into overlapping chunks for processing.
 *
 * Why chunking? Large documents exceed LLM context limits. Chunking allows:
 * - Processing documents of any size
 * - More precise retrieval (smaller relevant sections)
 * - Better embedding quality (focused semantic meaning)
 *
 * @param text - The full text to chunk
 * @param size - Number of words per chunk (default: 500)
 * @param overlap - Number of words to overlap between chunks (default: 50)
 *                  Overlap preserves context at chunk boundaries
 * @returns Array of text chunks
 */
function chunkText(text: string, size = 500, overlap = 50): string[] {
  // Split text into non-empty words (handles multiple spaces/newlines)
  const words = text.split(/\s+/).filter((w) => w.length > 0);
  const chunks: string[] = [];
  let i = 0;

  // Slide a window across the text, moving by (size - overlap) each time
  while (i < words.length) {
    chunks.push(words.slice(i, i + size).join(" "));
    i += size - overlap; // Move forward by chunk size minus overlap
  }

  return chunks;
}

/**
 * Estimates which page a chunk belongs to based on its position in the document.
 *
 * This is approximate since chunk boundaries don't align with page boundaries.
 * Useful for displaying "Source: Page X" in search results.
 *
 * @param chunkIndex - Index of the current chunk (0-based)
 * @param totalChunks - Total number of chunks in the document
 * @param numPages - Total number of pages in the PDF
 * @returns The estimated page number (1-based)
 */
function getPageForChunk(
  chunkIndex: number,
  totalChunks: number,
  numPages: number
): number {
  if (totalChunks <= 1) return 1;

  // Calculate approximate pages per chunk ratio
  const pagesPerChunk = numPages / totalChunks;

  // Map chunk index to page number, capping at total pages
  return Math.min(Math.floor(chunkIndex * pagesPerChunk) + 1, numPages);
}

/**
 * Generates embeddings for text chunks in batches.
 *
 * Batch processing is required because:
 * - API rate limits
 * - Network efficiency (fewer round trips)
 * - Memory management
 *
 * @param chunks - Array of text chunks to embed
 * @param batchSize - Number of chunks per API call (default: 100)
 * @returns Array of embedding vectors (each is an array of numbers)
 */
async function batchEmbedChunks(
  chunks: string[],
  batchSize = 100
): Promise<number[][]> {
  const embeddings: number[][] = [];

  // Process chunks in batches to respect API limits
  for (let i = 0; i < chunks.length; i += batchSize) {
    const batch = chunks.slice(i, i + batchSize);

    // Call Gemini API to generate embeddings for each chunk
    for (const text of batch) {
      try {
        console.log(`Embedding chunk (${embeddings.length + 1}/${chunks.length})...`);
        const result = await ai.models.embedContent({
          model: 'gemini-embedding-001',
          contents: text,
          config: { outputDimensionality: 768 }
        });
        if (!result.embeddings?.[0]?.values) {
          throw new Error('Failed to generate embedding: no values returned');
        }
        embeddings.push(result.embeddings[0].values);
        // Add delay to avoid rate limits (100ms between calls = ~10 requests/sec)
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (e) {
        console.error(`Failed to embed chunk:`, e instanceof Error ? e.message : String(e));
        throw e;
      }
    }
  }

  return embeddings;
}

/**
 * POST handler for PDF ingestion.
 *
 * Request: multipart/form-data with a "file" field containing a PDF
 * Response: JSON with processing results and any errors
 */
export async function POST(request: NextRequest) {
  try {
    // Parse the multipart form data from the request
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    // Validate that a PDF file was uploaded
    if (!file || file.type !== "application/pdf") {
      return NextResponse.json(
        { error: "Please upload a valid PDF file" },
        { status: 400 }
      );
    }

    // Convert the File to a Buffer for pdf-parse
    const buffer = Buffer.from(await file.arrayBuffer());

    // Extract text and metadata from the PDF using pdf-parse v1
    console.log("Parsing PDF...");
    const pdfData = await pdfParse(buffer);
    console.log("PDF parsed successfully");
    const text = pdfData.text;
    const numPages = pdfData.numpages;

    // Reject PDFs with no extractable text (scanned images without OCR)
    if (!text.trim()) {
      return NextResponse.json(
        { error: "No text found in PDF" },
        { status: 400 }
      );
    }

    // Step 1: Split text into manageable chunks
    const chunks = chunkText(text);
    const totalChunks = chunks.length;

    // Step 2: Generate embeddings for all chunks
    console.log(`Generating embeddings for ${totalChunks} chunks...`);
    const embeddings = await batchEmbedChunks(chunks);
    console.log(`Successfully generated ${embeddings.length} embeddings`);

    // Step 3: Prepare database rows with content, embedding, and metadata
    const rows = chunks.map((chunk, i) => ({
      content: chunk,
      embedding: embeddings[i],
      metadata: {
        filename: file.name,
        chunk_index: i,
        page: getPageForChunk(i, totalChunks, numPages),
      },
    }));

    // Step 4: Insert into Supabase in batches
    const insertedIds: number[] = [];
    const failedChunks: { index: number; error: string }[] = [];
    const BATCH_SIZE = 100;

    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE);
      const { data, error } = await supabase
        .from("documents")
        .insert(batch)
        .select("id");

      if (error) {
        // Track which chunks failed in this batch
        batch.forEach((_, idx) => {
          failedChunks.push({ index: i + idx, error: error.message });
        });
      } else if (data) {
        // Collect IDs of successfully inserted records
        insertedIds.push(...data.map((d) => d.id));
      }
    }

    // Determine overall success (all chunks inserted)
    const success = failedChunks.length === 0;

    // Return summary of the ingestion process
    return NextResponse.json({
      success,
      chunksProcessed: totalChunks,
      chunksInserted: insertedIds.length,
      chunksFailed: failedChunks.length,
      documentIds: insertedIds,
      // Only include failed chunks details if there were failures
      ...(failedChunks.length > 0 && { failedChunks }),
    });
  } catch (error) {
    // Log full error for debugging, return generic message to client
    console.error("Ingest error:", error);
    // Check for rate limit errors
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (errorMessage.includes('429') || errorMessage.includes('RESOURCE_EXHAUSTED') || errorMessage.includes('quota')) {
      return NextResponse.json(
        { error: "AI embedding service temporarily unavailable due to rate limits. Please wait a moment and try again." },
        { status: 429 }
      );
    }
    return NextResponse.json(
      { error: "Failed to process PDF" },
      { status: 500 }
    );
  }
}

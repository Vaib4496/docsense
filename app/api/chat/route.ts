/**
 * RAG Chat API Route
 *
 * Full Retrieval-Augmented Generation pipeline:
 * 1. Search for relevant document chunks using semantic similarity
 * 2. Build context from retrieved chunks
 * 3. Generate answer using Gemini with context
 * 4. Return answer with source attributions
 *
 * POST /api/chat - Chat with your documents
 */

import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { createClient } from "@supabase/supabase-js";

// Initialize Google GenAI client
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY!,
});

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

/**
 * Source type for attribution
 */
interface Source {
  filename: string;
  page: number;
}

/**
 * Search result from match_documents
 */
interface SearchResult {
  id: string;
  content: string;
  metadata: {
    filename: string;
    chunk_index: number;
    page: number;
  };
  similarity: number;
}

/**
 * POST handler for RAG chat.
 *
 * Request body: { message: string }
 * Response: { answer: string, sources: Source[] }
 */
export async function POST(request: NextRequest) {
  try {
    const { message } = await request.json();

    if (!message || typeof message !== "string" || message.trim().length === 0) {
      return NextResponse.json(
        { error: "Message is required" },
        { status: 400 }
      );
    }

    // Step 1: Generate embedding and search for relevant chunks
    const embedResult = await ai.models.embedContent({
      model: 'gemini-embedding-001',
      contents: message,
      config: { outputDimensionality: 768 }
    });

    if (!embedResult.embeddings?.[0]?.values) {
      throw new Error('Failed to generate query embedding');
    }

    const queryEmbedding = embedResult.embeddings[0].values;

    // Search for similar documents
    const { data: results, error } = await supabase.rpc("match_documents", {
      query_embedding: queryEmbedding,
      match_threshold: 0.5,
      match_count: 5,
    });

    if (error) {
      console.error("Search error:", error);
      return NextResponse.json(
        { error: "Failed to search documents" },
        { status: 500 }
      );
    }

    const searchResults = (results as SearchResult[]) || [];

    // If no relevant documents found
    if (searchResults.length === 0) {
      return NextResponse.json({
        answer:
          "I couldn't find any relevant information in the uploaded documents. Try uploading a document that might contain information about this topic, or rephrase your question.",
        sources: [],
      });
    }

    // Step 2: Build context from retrieved chunks
    const context = searchResults
      .map((result, index) => {
        return `[${index + 1}] From ${result.metadata.filename} (Page ~${result.metadata.page}):\n${result.content}`;
      })
      .join("\n\n");

    // Step 3: Build prompt with context
    const prompt = `You are a helpful assistant that answers questions based on the provided document context.

Context from documents:
${context}

Question: ${message}

Please answer the question based only on the provided context. If the context doesn't contain enough information to answer the question, say so. Include references to which document and page the information comes from when possible.

Answer:`;

    // Step 4: Generate answer using Gemini
    const generationResult = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });
    const answer = generationResult.text!;

    // Step 5: Extract unique sources from search results
    const sources: Source[] = searchResults.map((result) => ({
      filename: result.metadata.filename,
      page: result.metadata.page,
    }));

    // Remove duplicates based on filename + page
    const uniqueSources = sources.filter(
      (source, index, self) =>
        index ===
        self.findIndex(
          (s) => s.filename === source.filename && s.page === source.page
        )
    );

    // Return answer with sources
    return NextResponse.json({
      answer,
      sources: uniqueSources,
    });
  } catch (error) {
    console.error("Chat error:", error);
    // Check for rate limit errors
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (errorMessage.includes('429') || errorMessage.includes('RESOURCE_EXHAUSTED') || errorMessage.includes('quota')) {
      return NextResponse.json(
        { error: "AI service temporarily unavailable due to rate limits. Please wait a moment and try again." },
        { status: 429 }
      );
    }
    return NextResponse.json(
      { error: "Failed to process chat message" },
      { status: 500 }
    );
  }
}

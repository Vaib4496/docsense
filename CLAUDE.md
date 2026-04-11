# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

DocSense is a Next.js 16 application with App Router that provides document ingestion and RAG (Retrieval-Augmented Generation) capabilities. It processes PDFs, generates embeddings using Google's Generative AI, and stores them in Supabase for semantic search.

## Common Commands

```bash
# Development server (runs on http://localhost:3000)
npm run dev

# Production build
npm run build

# Start production server
npm run start

# Linting
npm run lint
```

## Architecture

### Framework & Routing
- **Next.js 16.2.2** with App Router (`app/` directory)
- **React 19.2.4** with Server Components by default
- Route handlers in `app/api/*/route.ts` for API endpoints

### Key Dependencies
- `@google/generative-ai` - For generating embeddings from document chunks
- `@supabase/supabase-js` - Vector database for storing embeddings
- `pdf-parse` - PDF text extraction

### API Routes
- `POST /api/ingest` - Accepts PDF files via multipart/form-data, chunks them, generates embeddings via Gemini API, and stores in Supabase `documents` table

### Environment Variables
Required variables (defined in `.env.local`):
- `GEMINI_API_KEY` - Google Generative AI API key
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY` - Supabase publishable key
- `SUPABASE_SERVICE_KEY` - Required for the ingest API (server-side only)

### Styling
- **Tailwind CSS 4** with the new `@import "tailwindcss"` syntax (not `@tailwind` directives)
- PostCSS config uses `@tailwindcss/postcss` plugin
- Uses Geist font family via `next/font/google`

### TypeScript Configuration
- Path alias `@/*` maps to root directory
- Strict mode enabled
- Module resolution: "bundler"

## Important Notes

### Next.js Version Warning
**This is NOT standard Next.js.** Version 16 has breaking changes from typical Next.js patterns. Always check `node_modules/next/dist/docs/` for API reference before writing code.

### Tailwind CSS 4 Syntax
Uses the new v4 syntax in `globals.css`:
```css
@import "tailwindcss";
@theme inline { /* ... */ }
```

Not the traditional:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

### ESLint
Uses ESLint 9 flat config format (`eslint.config.mjs`), not `.eslintrc`.

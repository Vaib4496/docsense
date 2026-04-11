"use client";

import React, { useState, useCallback } from "react";
import {
  Upload,
  FileText,
  Check,
  AlertCircle,
  X,
  Loader2,
  Layers,
  Database,
  Sparkles,
} from "lucide-react";
import { uploadPDF, UploadStage, UploadResult } from "@/lib/api";

export interface UploadPanelProps {
  onUploadComplete?: (result: { filename: string; chunks: number }) => void;
}

const stages: { id: UploadStage; label: string; icon: React.ReactNode }[] = [
  { id: "uploading", label: "Uploading", icon: <Upload className="w-4 h-4" /> },
  {
    id: "extracting",
    label: "Extracting text",
    icon: <FileText className="w-4 h-4" />,
  },
  {
    id: "chunking",
    label: "Splitting into chunks",
    icon: <Layers className="w-4 h-4" />,
  },
  {
    id: "embedding",
    label: "Generating embeddings",
    icon: <Sparkles className="w-4 h-4" />,
  },
  {
    id: "storing",
    label: "Storing in database",
    icon: <Database className="w-4 h-4" />,
  },
];

export default function UploadPanel({ onUploadComplete }: UploadPanelProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [currentStage, setCurrentStage] = useState<UploadStage>("idle");
  const [fileName, setFileName] = useState<string | null>(null);
  const [chunksProcessed, setChunksProcessed] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setCurrentStage("idle");
    setFileName(null);
    setChunksProcessed(0);
    setError(null);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const processFile = useCallback(
    async (file: File) => {
      if (file.type !== "application/pdf") {
        setError("Please upload a PDF file");
        return;
      }

      setFileName(file.name);
      setError(null);
      setCurrentStage("uploading");

      try {
        // Simulate progress through stages since the actual API
        // processes everything but we want to show the pipeline visually
        const progressStages: UploadStage[] = [
          "uploading",
          "extracting",
          "chunking",
          "embedding",
          "storing",
        ];

        // Call the actual upload
        const uploadPromise = uploadPDF(file);

        // Animate through stages
        for (let i = 0; i < progressStages.length; i++) {
          setCurrentStage(progressStages[i]);
          await new Promise((resolve) => setTimeout(resolve, 400));
        }

        // Wait for actual upload to complete
        const result: UploadResult = await uploadPromise;

        if (result.success) {
          setChunksProcessed(result.chunksInserted);
          setCurrentStage("done");
          onUploadComplete?.({
            filename: file.name,
            chunks: result.chunksInserted,
          });
        } else {
          throw new Error(
            `Failed to process ${result.chunksFailed} chunks. Please try again.`
          );
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to process PDF");
        setCurrentStage("idle");
      }
    },
    [onUploadComplete]
  );

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);

      const file = e.dataTransfer.files[0];
      if (file) await processFile(file);
    },
    [processFile]
  );

  const handleFileInput = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) await processFile(file);
    },
    [processFile]
  );

  const getStageIndex = (stage: UploadStage) => {
    return stages.findIndex((s) => s.id === stage);
  };

  const currentStageIndex = getStageIndex(currentStage);

  return (
    <div className="w-80 h-full bg-white dark:bg-zinc-950 border-r border-zinc-200 dark:border-zinc-800 flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-zinc-200 dark:border-zinc-800">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          Upload Document
        </h2>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
          Add PDFs to your knowledge base
        </p>
      </div>

      {/* Content */}
      <div className="flex-1 p-4 overflow-y-auto">
        {/* Upload Area */}
        {(currentStage === "idle" || currentStage === "done") && !error && (
          <>
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`
                relative border-2 border-dashed rounded-xl p-6 text-center
                transition-all duration-200 ease-out cursor-pointer
                ${
                  isDragging
                    ? "border-indigo-500 bg-indigo-50/50 dark:bg-indigo-900/20"
                    : "border-zinc-300 dark:border-zinc-700 hover:border-zinc-400 dark:hover:border-zinc-600"
                }
              `}
            >
              <input
                type="file"
                accept=".pdf"
                onChange={handleFileInput}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <div
                className={`mx-auto w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${
                  isDragging
                    ? "bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400"
                    : "bg-zinc-100 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500"
                }`}
              >
                <Upload className="w-5 h-5" />
              </div>
              <p className="mt-3 text-sm font-medium text-zinc-700 dark:text-zinc-300">
                {isDragging ? "Drop PDF here" : "Drop PDF or click to browse"}
              </p>
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-500">
                Supports PDF files up to 50MB
              </p>
            </div>

            {currentStage === "done" && fileName && (
              <div className="mt-4 p-3 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg">
                <div className="flex items-start gap-2">
                  <div className="w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-800 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-emerald-900 dark:text-emerald-100 truncate">
                      {fileName}
                    </p>
                    <p className="text-xs text-emerald-700 dark:text-emerald-300 mt-0.5">
                      {chunksProcessed} chunks stored
                    </p>
                  </div>
                  <button
                    onClick={reset}
                    className="p-1 hover:bg-emerald-100 dark:hover:bg-emerald-800 rounded transition-colors"
                  >
                    <X className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {/* Progress */}
        {currentStage !== "idle" && currentStage !== "done" && (
            <div className="space-y-3">
              {fileName && (
                <div className="flex items-center gap-2 p-2 bg-zinc-50 dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800">
                  <FileText className="w-4 h-4 text-zinc-400" />
                  <span className="text-sm text-zinc-600 dark:text-zinc-400 truncate">
                    {fileName}
                  </span>
                </div>
              )}

              <div className="space-y-1">
                {stages.map((stage, index) => {
                  const isCompleted = index < currentStageIndex;
                  const isCurrent = index === currentStageIndex;

                  return (
                    <div
                      key={stage.id}
                      className={`
                        flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-300
                        ${
                          isCurrent
                            ? "bg-indigo-50/50 dark:bg-indigo-900/10"
                            : ""
                        }
                      `}
                    >
                      <div
                        className={`
                          w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0
                          transition-all duration-300
                          ${
                            isCompleted
                              ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400"
                              : isCurrent
                              ? "bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400"
                              : "bg-zinc-100 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-600"
                          }
                        `}
                      >
                        {isCompleted ? (
                          <Check className="w-3 h-3" />
                        ) : isCurrent ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          stage.icon
                        )}
                      </div>
                      <span
                        className={`
                          text-sm transition-colors duration-300
                          ${
                            isCurrent
                              ? "text-indigo-700 dark:text-indigo-300 font-medium"
                              : isCompleted
                              ? "text-emerald-700 dark:text-emerald-300"
                              : "text-zinc-400 dark:text-zinc-600"
                          }
                        `}
                      >
                        {stage.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

        {/* Error */}
        {error && (
          <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm text-red-800 dark:text-red-200">
                  {error}
                </p>
              </div>
              <button
                onClick={reset}
                className="p-1 hover:bg-red-100 dark:hover:bg-red-800 rounded transition-colors"
              >
                <X className="w-4 h-4 text-red-600 dark:text-red-400" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

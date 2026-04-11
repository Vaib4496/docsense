"use client";

import React, { useState, useRef, useEffect } from "react";
import { Send, Loader2, Search, Sparkles, FileText } from "lucide-react";
import { sendMessage } from "@/lib/api";

export interface Source {
  filename: string;
  page: number;
}

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: Source[];
  timestamp: Date;
}

interface ChatPanelProps {
  className?: string;
}

export default function ChatPanel({ className }: ChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStage, setLoadingStage] = useState<
    "searching" | "generating" | null
  >(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  // Auto-resize textarea
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = "auto";
      inputRef.current.style.height = `${inputRef.current.scrollHeight}px`;
    }
  }, [inputValue]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || isLoading) return;

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: inputValue.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue("");
    setIsLoading(true);
    setLoadingStage("searching");

    try {
      const response = await sendMessage(userMessage.content, (stage) => {
        setLoadingStage(stage);
      });

      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: response.answer,
        sources: response.sources,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      const errorMessage: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content:
          error instanceof Error
            ? error.message
            : "Failed to get response. Please try again.",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
      setLoadingStage(null);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div className={`flex flex-col h-full bg-zinc-50/50 dark:bg-zinc-900/50 ${className}`}>
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center px-8">
            <div className="w-12 h-12 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mb-4">
              <Sparkles className="w-6 h-6 text-zinc-400 dark:text-zinc-600" />
            </div>
            <h3 className="text-lg font-medium text-zinc-900 dark:text-zinc-100 mb-2">
              Ask your documents
            </h3>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 max-w-sm">
              Upload a PDF and ask questions about its content. The AI will search
              through your documents and provide grounded answers with sources.
            </p>
          </div>
        ) : (
          <>
            {messages.map((message) => (
              <MessageBubble key={message.id} message={message} />
            ))}

            {/* Loading indicator */}
            {isLoading && (
              <div className="flex items-start gap-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center flex-shrink-0">
                  {loadingStage === "searching" ? (
                    <Search className="w-4 h-4 text-indigo-600 dark:text-indigo-400 animate-pulse" />
                  ) : (
                    <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  )}
                </div>
                <div className="flex-1 bg-white dark:bg-zinc-900 rounded-2xl rounded-tl-sm px-4 py-3 border border-zinc-200 dark:border-zinc-800 shadow-sm">
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 text-zinc-400 animate-spin" />
                    <span className="text-sm text-zinc-600 dark:text-zinc-400">
                      {loadingStage === "searching"
                        ? "Searching documents..."
                        : "Generating answer..."}
                    </span>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Input */}
      <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950">
        <form onSubmit={handleSubmit} className="relative">
          <div className="relative flex items-end gap-2 bg-zinc-100 dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 focus-within:border-indigo-500 dark:focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-500/20 dark:focus-within:ring-indigo-400/20 transition-all">
            <textarea
              ref={inputRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask a question about your documents..."
              rows={1}
              className="flex-1 bg-transparent px-4 py-3 resize-none outline-none text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 min-h-[48px] max-h-[120px]"
              disabled={isLoading}
            />
            <button
              type="submit"
              disabled={!inputValue.trim() || isLoading}
              className="m-2 p-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-zinc-300 dark:disabled:bg-zinc-700 text-white rounded-xl transition-colors disabled:cursor-not-allowed"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
          <p className="mt-2 text-xs text-zinc-400 dark:text-zinc-600 text-center">
            Press Enter to send, Shift+Enter for new line
          </p>
        </form>
      </div>
    </div>
  );
}

// Message Bubble Component
function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === "user";

  return (
    <div
      className={`flex items-start gap-3 animate-in fade-in slide-in-from-bottom-2 duration-300 ${
        isUser ? "flex-row-reverse" : ""
      }`}
    >
      {/* Avatar */}
      <div
        className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
          isUser
            ? "bg-zinc-900 dark:bg-zinc-100"
            : "bg-indigo-100 dark:bg-indigo-900/30"
        }`}
      >
        {isUser ? (
          <span className="text-xs font-medium text-white dark:text-zinc-900">You</span>
        ) : (
          <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
        )}
      </div>

      {/* Message Content */}
      <div
        className={`flex-1 max-w-[85%] ${
          isUser ? "flex justify-end" : ""
        }`}
      >
        <div
          className={`inline-block px-4 py-3 rounded-2xl ${
            isUser
              ? "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-tr-sm"
              : "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-800 rounded-tl-sm shadow-sm"
          }`}
        >
          <div className="text-sm whitespace-pre-wrap">{message.content}</div>
        </div>

        {/* Sources */}
        {!isUser && message.sources && message.sources.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {message.sources.map((source, index) => (
              <SourceBadge key={index} source={source} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Source Badge Component
function SourceBadge({ source }: { source: Source }) {
  return (
    <div className="inline-flex items-center gap-1.5 px-2 py-1 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-md text-xs text-zinc-600 dark:text-zinc-400 transition-colors cursor-help">
      <FileText className="w-3 h-3" />
      <span className="truncate max-w-[150px]">{source.filename}</span>
      <span className="text-zinc-400">·</span>
      <span>Page ~{source.page}</span>
    </div>
  );
}

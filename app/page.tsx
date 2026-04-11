"use client";

import UploadPanel from "./components/UploadPanel";
import ChatPanel from "./components/ChatPanel";

export default function Home() {
  return (
    <div className="h-screen flex overflow-hidden bg-zinc-50 dark:bg-zinc-950">
      {/* Left Panel - Upload */}
      <UploadPanel />

      {/* Right Panel - Chat */}
      <ChatPanel className="flex-1" />
    </div>
  );
}

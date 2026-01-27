"use client";
import Sidebar from "./Sidebar";
import SongsSection from "./SongsSection";
import Header from "./header";
// import Header from "@/components/Header";

export default function MusicPage() {
  return (
    <div className="w-full h-screen bg-black text-white flex flex-col overflow-hidden">
      
      {/* Header */}
      <Header />

      {/* Main Layout */}
      <div className="flex flex-1 overflow-hidden">
        
        {/* Sidebar (30%) */}
        <Sidebar />

        {/* Songs Section (70%) */}
        <SongsSection />

      </div>

    </div>
  );
}

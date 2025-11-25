"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { AudioWaveform, Search, Settings } from "lucide-react";
import SettingsPanel from "./SettingsPanel";
import { supabase } from "@/app/lib/supabaseClient";

export default function Header() {
  const [showSettings, setShowSettings] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [results, setResults] = useState([]);
  const [showPopup, setShowPopup] = useState(false);

  // ⬇ Real-time search
  useEffect(() => {
    const fetchData = async () => {
      if (!searchQuery.trim()) {
        setResults([]);
        setShowPopup(false);
        return;
      }

      const { data, error } = await supabase
        .from("songs")
        .select("*")
        .or(
          `title.ilike.${searchQuery}%,title.ilike.% ${searchQuery}%`
        );

      if (!error) {
        setResults(data);
        setShowPopup(true);
      }
    };

    fetchData();
  }, [searchQuery]);

  return (
    <>
      <header className="w-full bg-black text-white sticky top-0 z-50 shadow-lg shadow-black/25">
        <div className="max-w-[1400px] w-full mx-auto flex items-center justify-between px-8 py-4 gap-4">

          {/* Logo */}
          <Link href="/" className="flex items-center">
            <AudioWaveform
              size={42}
              className="text-[#fa4565] cursor-pointer hover:scale-110 transition-transform duration-300"
            />
          </Link>

          {/* Search bar */}
          <div className="relative flex-1 max-w-[500px] hidden md:block">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search songs, artists..."
              className="w-full bg-[#161616] px-5 py-2.5 rounded-full 
              text-sm text-gray-200 placeholder-gray-500 
              focus:outline-none focus:ring-2 focus:ring-[#fa4565]"
            />
            <Search className="absolute right-5 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />

            {/* Popup Results */}
            {showPopup && results.length > 0 && (
              <div className="absolute mt-3 w-full bg-[#1c1c1c] border border-[#333] rounded-xl p-3 shadow-xl">
                {results.map((song) => (
                  <div
                    key={song.id}
                    className="p-2 px-4 hover:bg-[#333] rounded-lg cursor-pointer flex justify-between"
                  >
                    <span>{song.title}</span>
                    <span className="text-gray-400">{song.artist}</span>
                  </div>
                ))}
              </div>
            )}

            {/* No results */}
            {showPopup && results.length === 0 && (
              <div className="absolute mt-3 w-full bg-[#1c1c1c] border border-[#333] rounded-xl p-3 text-gray-400">
                No songs found
              </div>
            )}
          </div>

          {/* Premium + Settings */}
          <div className="flex items-center gap-3">
            <Link
              href="/premium"
              className="bg-[#fa4565] px-5 py-2 rounded-full font-semibold 
              hover:bg-[#ff6078] transition-all duration-300 text-center"
            >
              Premium
            </Link>

            <button
              onClick={() => setShowSettings(true)}
              className="p-2 hover:bg-[#222] cursor-pointer rounded-full transition-all duration-300"
            >
              <Settings size={24} className="text-gray-300" />
            </button>
          </div>
        </div>
      </header>

      {/* Slide Panel */}
      <SettingsPanel
        open={showSettings}
        onClose={() => setShowSettings(false)}
      />
    </>
  );
}

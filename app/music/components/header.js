"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  AudioWaveform,
  Search,
  X,
  User2,
  Palette,
  Globe,
  ShieldCheck,
  LogOut,
} from "lucide-react";
import { supabase } from "@/app/lib/supabaseClient";

// ---------------- SETTINGS PANEL ----------------
function SettingsPanel({ open, onClose, user }) {
  const displayUser = user || {
    full_name: "Echo User",
    email: "guest@example.com",
    avatar_url: null,
  };

  const initial = displayUser.full_name?.[0] || "U";
  const [isRotating, setIsRotating] = React.useState(false);

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[90]"
          onClick={onClose}
        />
      )}

      <aside
        className={`fixed top-0 right-0 h-full w-[330px] bg-[#0f0f0f] text-white 
        shadow-xl z-[100] transform transition-transform duration-300 
        ${open ? "translate-x-0" : "translate-x-full"} p-6 flex flex-col`}
      >
        <div className="flex justify-between items-center pb-4 border-b border-[#1c1c1c]">
          <h2 className="text-xl font-bold">Settings</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-[#1c1c1c] rounded-lg text-gray-400 hover:text-white"
          >
            <X size={22} />
          </button>
        </div>

        <div className="flex-1 space-y-6 pt-4 overflow-y-auto">
          <div className="flex items-center gap-3 p-3 bg-[#161616] rounded-xl border border-[#fa4565]/20">
            {displayUser.img ? (
              <img
                src={displayUser.img}
                className="w-12 h-12 rounded-full object-cover"
              />
            ) : (
              <div className="w-12 h-12 bg-[#fa4565] rounded-full flex items-center justify-center font-bold text-lg">
                {initial}
              </div>
            )}

            <div>
              <h4 className="font-semibold">{displayUser.full_name}</h4>
              <p className="text-[12px] text-gray-400 truncate">
                {displayUser.email}
              </p>
            </div>
          </div>

          <ul className="space-y-2 border-t border-[#2a2a2a] pt-4">
            {[
              { icon: User2, label: "My Account" },
              { icon: Palette, label: "Theme" },
              { icon: Globe, label: "Language" },
              { icon: ShieldCheck, label: "Security" },
            ].map(({ icon: Icon, label }) => (
              <div
                key={label}
                className="flex items-center gap-3 p-3 rounded-lg text-sm text-gray-300 hover:bg-[#1c1c1c] cursor-pointer"
              >
                <Icon size={20} /> {label}
              </div>
            ))}
          </ul>
        </div>

        <button
          onClick={async () => {
            setIsRotating(true);

            try {
              const res = await fetch("/api/logout", { method: "POST" });

              let data;
              try {
                data = await res.json();
              } catch {
                data = { success: true };
              }

              console.log("Logout response:", data);

              setTimeout(() => {
                onClose();
                window.location.href = "/login";
              }, 600);

            } catch (err) {
              console.error("Logout failed:", err);
              setIsRotating(false);
            }
          }}
          className="w-full py-3 bg-[#fa4565] hover:bg-[#ff5c79] rounded-lg font-semibold mt-6 flex items-center justify-center gap-2"
        >
          {/* If loading → show spinner */}
          {isRotating ? (
            <span className="loader"></span>
          ) : (
            <div className="flex items-center gap-2">
              <LogOut size={18} />
              Logout
            </div>
          )}
        </button>



      </aside>
    </>
  );
}

// ---------------- MAIN HEADER ----------------
export default function Header() {
  const [showSettings, setShowSettings] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [results, setResults] = useState([]);
  const [showPopup, setShowPopup] = useState(false);
  const [user, setUser] = useState(null);

  // ⭐ Fetch Authenticated User Using API
  useEffect(() => {
    async function loadUser() {
      console.log("🔄 Fetching user from /api/getToken ...");

      const res = await fetch("/api/getToken");
      const data = await res.json();

      if (data.user) {
        console.log("✅ USER FETCHED:", data.user);
        setUser(data.user);
      } else {
        console.log("⚠ No user found");
      }
    }

    loadUser();
  }, []);

  // ⭐ LIVE SEARCH FROM SUPABASE
  useEffect(() => {
    const fetchData = async () => {
      if (!searchQuery.trim()) {
        setResults([]);
        setShowPopup(false);
        return;
      }

      console.log("🎵 Searching:", searchQuery);

      const { data, error } = await supabase
        .from("songs")
        .select("*")
        .ilike("title", `%${searchQuery}%`);

      if (error) {
        console.log("❌ Search Error:", error);
        return;
      }

      console.log("✅ Search Results:", data);
      setResults(data);
      setShowPopup(true);
    };

    fetchData();
  }, [searchQuery]);

  return (
    <>
      <header className="w-full bg-black text-white sticky top-0 z-50 shadow-lg">
        <div className="max-w-[1400px] mx-auto flex items-center justify-between px-8 py-4">

          {/* Logo */}
          <Link href="/" className="flex items-center">
            <AudioWaveform
              size={42}
              className="text-[#fa4565] hover:scale-110 transition"
            />
          </Link>

          {/* Search Bar */}
          <div className="relative flex-1 max-w-[500px] hidden md:block">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search songs, artists..."
              className="w-full bg-[#161616] px-5 py-2.5 rounded-full text-sm text-gray-200 placeholder-gray-500 
              focus:outline-none focus:ring-2 focus:ring-[#fa4565]"
              onBlur={() => setTimeout(() => setShowPopup(false), 200)}
            />
            <Search className="absolute right-5 top-1/2 -translate-y-1/2 text-gray-400" />

            {showPopup && (
              <div className="absolute mt-3 w-full bg-[#1c1c1c] border border-[#333] rounded-xl p-3 shadow-xl max-h-60 overflow-y-auto">
                {results.length > 0 ? (
                  results.map((song) => (
                    <div
                      key={song.id}
                      className="p-2 px-4 hover:bg-[#333] rounded-lg cursor-pointer flex justify-between"
                      onClick={() => {
                        console.log("🎧 Selected:", song.title);
                        setSearchQuery(song.title);
                        setShowPopup(false);
                      }}
                    >
                      <span>{song.title}</span>
                      <span className="text-gray-400 text-sm">{song.artist}</span>
                    </div>
                  ))
                ) : (
                  <div className="text-gray-400 p-2">No songs found</div>
                )}
              </div>
            )}
          </div>

          {/* Premium + Profile */}
          <div className="flex items-center gap-3">
            <Link
              href="/premium"
              className="bg-[#fa4565] px-5 py-2 rounded-full font-semibold hover:bg-[#ff6078]"
            >
              Premium
            </Link>

            <button onClick={() => setShowSettings(true)}>
              {user?.img ? (
                <img
                  src={user.img}
                  className="w-10 h-10 rounded-full border object-cover hover:scale-110 transition"
                />
              ) : (
                <div className="w-10 h-10 bg-[#333] rounded-full flex items-center justify-center text-lg font-bold">
                  {user?.full_name?.[0]}
                </div>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Settings Panel */}
      <SettingsPanel open={showSettings} onClose={() => setShowSettings(false)} user={user} />
    </>
  );
}

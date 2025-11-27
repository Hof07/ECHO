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
  Upload,
} from "lucide-react";
import { supabase } from "@/app/lib/supabaseClient";

// ---------------- SETTINGS PANEL ----------------
function SettingsPanel({ open, onClose, user }) {
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState(null);

  const displayUser = user || {
    full_name: "Echo User",
    email: "guest@example.com",
    img: null,
    id: null,
  };

  const initial = displayUser.full_name?.[0] || "U";

  // ----------- NEW UPLOAD USING /api/getImg ONLY -----------
  const handleUpload = async (e) => {
    console.log("🔔 handleUpload triggered");
    const file = e.target.files?.[0];
    console.log("📁 Selected file:", file);

    if (!file) {
      console.log("⚠️ No file selected, aborting upload.");
      return;
    }

    if (!displayUser.email) {
      console.log("⚠️ displayUser.email missing:", displayUser);
      alert("User email missing!");
      return;
    }

    try {
      const tempPreview = URL.createObjectURL(file);
      setPreview(tempPreview);
      console.log("🖼 Preview URL created:", tempPreview);

      setUploading(true);
      console.log("⏳ Uploading started for:", displayUser.email);

      const formData = new FormData();
      formData.append("file", file);
      formData.append("email", displayUser.email);

      console.log("📦 FormData prepared:", {
        fileName: file.name,
        fileType: file.type,
        email: displayUser.email,
      });

      const res = await fetch("/api/getImg", {
        method: "POST",
        body: formData,
      });

      console.log("📥 /api/getImg responded status:", res.status);

      let data;
      try {
        data = await res.json();
        console.log("📨 /api/getImg JSON:", data);
      } catch (jsonErr) {
        console.log("❌ Failed to parse JSON from /api/getImg:", jsonErr);
        alert("Upload failed: invalid server response");
        setUploading(false);
        return;
      }

      if (!data.url) {
        console.log("❌ Upload error from API:", data.error || data);
        alert("Upload error: " + (data.error || "Unknown error"));
        setUploading(false);
        return;
      }

      console.log("✔️ Upload successful. New URL:", data.url);

      // Log reload intention and reload
      console.log("🔁 Reloading page to refresh user data (window.location.reload).");
      window.location.reload();
    } catch (err) {
      console.log("🔥 Unexpected error during upload:", err);
      alert("Unexpected error: " + (err?.message || err));
    } finally {
      setUploading(false);
      console.log("✅ handleUpload finished (uploading state false).");
    }
  };

  // Log open/close for SettingsPanel
  useEffect(() => {
    console.log(`📂 SettingsPanel ${open ? "opened" : "closed"}`, {
      open,
      userEmail: displayUser.email,
    });
  }, [open, displayUser.email]);

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
            onClick={() => {
              console.log("✖️ Settings close button clicked");
              onClose();
            }}
            className="p-2 hover:bg-[#1c1c1c] rounded-lg text-gray-400 hover:text-white"
          >
            <X size={22} />
          </button>
        </div>

        {/* USER CARD */}
        <div className="flex-1 space-y-6 pt-4 overflow-y-auto">
          <div className="flex items-center gap-3 p-3 bg-[#161616] rounded-xl border border-[#fa4565]/20">
            {preview ? (
              <>
                <img src={preview} className="w-12 h-12 rounded-full object-cover" />
                <div className="text-xs text-gray-400 ml-2">Preview shown (not saved)</div>
              </>
            ) : displayUser.img ? (
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

          {/* Upload Image */}
          <label className="cursor-pointer flex items-center gap-2 bg-[#1c1c1c] hover:bg-[#222] p-3 rounded-lg border border-[#333]">
            <Upload size={18} />
            {uploading ? "Uploading..." : "Upload Profile Image"}

            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleUpload}
            />
          </label>

          {/* OPTIONS */}
          <ul className="space-y-2 border-t border-[#2a2a2a] pt-4">
            {[{ icon: User2, label: "My Account" },
              { icon: Palette, label: "Theme" },
              { icon: Globe, label: "Language" },
              { icon: ShieldCheck, label: "Security" }].map(
              ({ icon: Icon, label }) => (
                <div
                  key={label}
                  className="flex items-center gap-3 p-3 rounded-lg text-sm text-gray-300 hover:bg-[#1c1c1c] cursor-pointer"
                >
                  <Icon size={20} /> {label}
                </div>
              )
            )}
          </ul>
        </div>

        {/* LOGOUT */}
        <button
          onClick={async () => {
            console.log("🔒 Logout button clicked");
            try {
              const res = await fetch("/api/logout", { method: "POST" });
              const json = await res.json().catch(() => ({}));
              console.log("🔐 Logout API response:", res.status, json);
              window.location.href = "/login";
            } catch (err) {
              console.error("❌ Logout failed:", err);
            }
          }}
          className="w-full py-3 bg-[#fa4565] hover:bg-[#ff5c79] rounded-lg font-semibold mt-6 flex items-center justify-center gap-2"
        >
          <LogOut size={18} /> Logout
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

  // Fetch user
  useEffect(() => {
    async function loadUser() {
      console.log("🔄 loadUser() starting - calling /api/getToken");
      try {
        const res = await fetch("/api/getToken");
        console.log("📥 /api/getToken status:", res.status);
        const data = await res.json().catch(() => null);
        console.log("👤 /api/getToken response:", data);
        if (data?.user) {
          setUser(data.user);
          console.log("✅ User set:", data.user);
        } else {
          console.log("⚠️ No user returned from /api/getToken");
        }
      } catch (err) {
        console.error("❌ Error loading user:", err);
      }
    }

    loadUser();
  }, []);

  // SEARCH SONGS
  useEffect(() => {
    const fetchData = async () => {
      console.log("🔍 Searching songs for query:", searchQuery);
      if (!searchQuery.trim()) {
        setResults([]);
        setShowPopup(false);
        console.log("🔎 Empty searchQuery - cleared results");
        return;
      }

      try {
        const { data, error } = await supabase
          .from("songs")
          .select("*")
          .ilike("title", `%${searchQuery}%`);

        console.log("🎵 Supabase search returned:", { dataLength: data?.length, error });
        if (error) {
          console.log("⚠️ Supabase search error:", error);
          setResults([]);
          setShowPopup(false);
          return;
        }

        setResults(data || []);
        setShowPopup(true);
      } catch (err) {
        console.error("❌ Unexpected error during song search:", err);
        setResults([]);
        setShowPopup(false);
      }
    };

    // debounce-like behavior (simple)
    const t = setTimeout(fetchData, 250);
    return () => clearTimeout(t);
  }, [searchQuery]);

  // log when settings panel toggles
  useEffect(() => {
    console.log("⚙️ Settings panel toggled:", showSettings);
  }, [showSettings]);

  return (
    <>
      <header className="w-full bg-black text-white sticky top-0 z-50 shadow-lg">
        <div className="max-w-[1400px] mx-auto flex items-center justify-between px-8 py-4">
          <Link href="/" className="flex items-center">
            <AudioWaveform
              size={42}
              className="text-[#fa4565] hover:scale-110 transition"
            />
          </Link>

          {/* SEARCH */}
          <div className="relative flex-1 max-w-[500px] hidden md:block">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                console.log("✏️ Search input changed:", e.target.value);
                setSearchQuery(e.target.value);
              }}
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
                        console.log("🎯 Song selected from search:", song);
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

          {/* PREMIUM + PROFILE */}
          <div className="flex items-center justify-between gap-3">
            <Link
              href="/premium"
              className="bg-[#fa4565] px-5 py-2 rounded-full font-semibold hover:bg-[#ff6078]"
            >
              Premium
            </Link>

            <button
              onClick={() => {
                console.log("👤 Profile button clicked - opening Settings");
                setShowSettings(true);
                className="relative left-5"
              }}
            >
              {user?.img ? (
                <img
                  src={user.img}
                  className="w-10 h-10 rounded-full border object-cover hover:scale-110 transition"
                  alt="profile"
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
      <SettingsPanel
        open={showSettings}
        onClose={() => {
          console.log("🔒 Closing settings from parent");
          setShowSettings(false);
        }}
        user={user}
      />
    </>
  );
}

"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
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
  Music,
  Plus,
  MoreVertical,
  Trash2,
  ListPlus,
  Library,
  Hourglass,
} from "lucide-react";

// Ensure these paths and the client are correctly configured for your environment
import { supabase } from "@/app/lib/supabaseClient";
import CreatePlaylistModal from "../components/CreatePlaylistModal";
import AddSongToPlaylistModal from "../components/AddSongToPlaylistModal";


// ---------------- UTILITY FUNCTION ----------------
/**

 * @returns {Promise<string | null>} The user's email or null.
 */
const getMailId = async () => {
  try {
    const response = await fetch('/api/getToken');
    if (!response.ok) {
      return null;
    }
    const data = await response.json();
    const mailId = data.user?.email || data.user?.mailid;
    return mailId || null;

  } catch (error) {
    console.error("Error fetching user mail ID:", error);
    return null;
  }
};

function PlaylistManager({ userMailId }) {
  const [playlists, setPlaylists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [activeMenuId, setActiveMenuId] = useState(null);
  const [playlistIdToAdd, setPlaylistIdToAdd] = useState(null);

  // Function to fetch playlists, filtered by userMailId
  const getPlaylists = useCallback(async (mailId) => {
    setLoading(true);
    let query = supabase.from("playlists").select("id, name, image_url");

    if (mailId) {
      query = query.eq("created_by", mailId);
    }

    const { data, error } = await query.order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching playlists:", error);
    }

    setPlaylists(data || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (userMailId) {
      getPlaylists(userMailId);
    } else {
      setLoading(false);
    }

    const handleClickOutside = () => setActiveMenuId(null);
    window.addEventListener("click", handleClickOutside);
    return () => window.removeEventListener("click", handleClickOutside);
  }, [userMailId, getPlaylists]);

  const deletePlaylist = async (id) => {
    setActiveMenuId(null);
    if (!confirm("Are you sure you want to delete this playlist?")) return;

    const previousPlaylists = [...playlists];
    setPlaylists(playlists.filter((p) => p.id !== id));

    // Also need to delete associated songs from the playlist_songs table if applicable
    // Not explicitly shown here, but crucial for database integrity.

    const { error } = await supabase.from("playlists").delete().eq("id", id);

    if (error) {
      console.error("Delete failed:", error);
      alert(`Error: ${error.message}`);
      setPlaylists(previousPlaylists);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between border-t border-[#2a2a2a] pt-4">
        <h3 className="text-lg font-bold text-white flex items-center gap-2">
          <Library size={20} className="text-[#fa4565]" /> Your Playlists
        </h3>
        <button
          className="p-2 cursor-pointer text-gray-400 hover:bg-[#fa4565] rounded-full hover:text-black transition"
          onClick={() => userMailId ? setShowCreateModal(true) : alert("Please log in to create a playlist")}
          disabled={!userMailId}
          title="Create New Playlist"
        >
          <Plus size={20} />
        </button>
      </div>

      {!userMailId && !loading && (
        <p className="text-red-400 text-sm">Please log in to manage your playlists.</p>
      )}

      {loading && <p className="text-gray-500 text-sm">Loading...</p>}

      {userMailId && playlists.length === 0 && !loading && (
        <p className="text-gray-500 text-sm">No playlists found. Create your first one!</p>
      )}

      {userMailId && playlists.length > 0 && (
        <div className="flex flex-col gap-2">
          {playlists.map((p) => (
            <div
              key={p.id}
              className={`relative group ${activeMenuId === p.id ? "z-50" : "z-0"}`}
            >
              <Link
                href={`/playlist/${p.id}`}
                onClick={() => setActiveMenuId(null)} // Close menu on click
                className="bg-[#1a1a1a] p-3 rounded-xl flex items-center gap-3 hover:bg-[#2a2a2a] transition pr-10"
              >
                <div className="relative h-10 w-10 min-w-[2.5rem] rounded-md overflow-hidden bg-gray-800">
                  {p.image_url ? (
                    <img
                      loading="lazy"
                      src={p.image_url}
                      alt={p.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <Music size={16} className="text-gray-400 m-auto h-full" />
                  )}
                </div>
                <div className="flex flex-col overflow-hidden">
                  <span className="font-medium text-white truncate text-sm">{p.name}</span>
                  <span className="text-xs text-gray-500 truncate">Playlist</span>
                </div>
              </Link>

              <div className="absolute right-2 top-1/2 -translate-y-1/2">
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setActiveMenuId(activeMenuId === p.id ? null : p.id);
                  }}
                  className={`
                    p-2 rounded-full transition cursor-pointer
                    ${activeMenuId === p.id
                      ? "text-white opacity-100"
                      : "text-gray-400 opacity-0 group-hover:opacity-100 hover:bg-black/50"
                    }
                  `}
                >
                  <MoreVertical size={18} />
                </button>

                {activeMenuId === p.id && (
                  <div
                    className="absolute right-0 top-10 w-48 bg-[#222] border border-gray-700 rounded-lg shadow-2xl overflow-hidden flex flex-col py-1 z-[100]"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      onClick={() => {
                        setPlaylistIdToAdd(p.id);
                        setActiveMenuId(null);
                      }}
                      className="flex items-center gap-3 px-4 py-3 text-sm text-gray-300 hover:bg-white/10 text-left w-full cursor-pointer"
                    >
                      <ListPlus size={16} /> Add Song
                    </button>

                    <button
                      onClick={() => deletePlaylist(p.id)}
                      className="flex items-center gap-3 px-4 py-3 text-sm text-red-400 hover:bg-red-900/20 text-left w-full cursor-pointer"
                    >
                      <Trash2 size={16} /> Delete Playlist
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 🟢 MODALS ARE NOW UNCOMMENTED AND READY TO RENDER */}
      {showCreateModal && (
        <CreatePlaylistModal
          close={() => setShowCreateModal(false)}
          refresh={() => getPlaylists(userMailId)}
          createdBy={userMailId}
        />
      )}

      {playlistIdToAdd && (
        <AddSongToPlaylistModal
          playlistId={playlistIdToAdd}
          close={() => setPlaylistIdToAdd(null)}
        />
      )}
    </div>
  );
}


// ---------------- SETTINGS PANEL ----------------
/**
 * Sliding side panel for user settings and profile management.
 */
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

  // ----------- UPLOAD PROFILE IMAGE -----------
  const handleUpload = async (e) => {
    const file = e.target.files?.[0];

    if (!file || !displayUser.email) {
      alert("User email missing or no file selected.");
      return;
    }

    try {
      const tempPreview = URL.createObjectURL(file);
      setPreview(tempPreview);
      setUploading(true);

      const formData = new FormData();
      formData.append("file", file);
      formData.append("email", displayUser.email);

      const res = await fetch("/api/getImg", {
        method: "POST",
        body: formData,
      });

      let data;
      try {
        data = await res.json();
      } catch (jsonErr) {
        alert("Upload failed: invalid server response");
        return;
      }

      if (!data.url) {
        alert("Upload error: " + (data.error || "Unknown error"));
        return;
      }

      // Reload page to refresh user data and profile image
      window.location.reload();
    } catch (err) {
      alert("Unexpected error: " + (err?.message || err));
    } finally {
      setUploading(false);
    }
  };

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[90]"
          onClick={onClose}
        />
      )}

      <aside
        className={`fixed top-0 right-0 h-full 
    w-[330px] md:w-[500px]
    bg-[#0f0f0f] text-white 
    shadow-xl z-[100] 
    transform transition-transform duration-300 
    ${open ? "translate-x-0" : "translate-x-full"} 
    p-6 flex flex-col`}
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

        {/* USER CARD & UPLOAD */}
        <div className="space-y-4 pt-4">
          <div className="flex items-center gap-3 p-3 bg-[#161616] rounded-xl border border-[#fa4565]/20">
            {preview ? (
              <>
                <img loading="lazy" src={preview} className="w-12 h-12 rounded-full object-cover" />
                <div className="text-xs text-gray-400 ml-2">Preview shown (not saved)</div>
              </>
            ) : displayUser.img ? (
              <img
                loading="lazy"
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
          <label className="cursor-pointer flex items-center gap-2 bg-[#1c1c1c] hover:bg-[#222] p-3 rounded-lg border border-[#333] text-sm">
            <Upload size={18} />
            {uploading ? "Uploading..." : "Upload Profile Image"}

            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleUpload}
            />
          </label>
        </div>


        {/* MAIN SETTINGS CONTENT AREA (Playlists & Options) */}
        <div className="flex-1 space-y-6 pt-4 overflow-y-auto custom-scroll">

          {/* PLAYLIST MANAGER SECTION */}
          <PlaylistManager userMailId={displayUser.email} />

          {/* GENERAL OPTIONS */}
          <ul className="space-y-2 border-t border-[#2a2a2a] pt-4">
            {[
              { icon: User2, label: "My Account" },
              { icon: Palette, label: "Theme" },
              { icon: Hourglass, label: "Time Spended", href: "/duration" },
              { icon: ShieldCheck, label: "Security" },
            ].map(({ icon: Icon, label, href }) =>
              href ? (
                <Link
                  key={label}
                  href={href}
                  className="flex items-center gap-3 p-3 rounded-lg text-sm text-gray-300 hover:bg-[#1c1c1c] cursor-pointer"
                >
                  <Icon size={20} /> {label}
                </Link>
              ) : (
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
            try {
              await fetch("/api/logout", { method: "POST" });
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

// ---------------- MAIN EXPORT COMPONENT ----------------
/**
 * Main application header with logo, search, and user profile/settings.
 */
export default function Header() {
  const [showSettings, setShowSettings] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [results, setResults] = useState([]);
  const [showPopup, setShowPopup] = useState(false);
  const [user, setUser] = useState(null);

  // Fetch user details
  useEffect(() => {
    async function loadUser() {
      try {
        // Use the getToken API to fetch the user session data
        const res = await fetch("/api/getToken");
        const tokenData = await res.json().catch(() => null);
        if (tokenData?.user) {
          setUser(tokenData.user);
        }
      } catch (e) {
        console.error("Error fetching full user data:", e);
      }
    }
    loadUser();
  }, []);

  // SEARCH SONGS
  useEffect(() => {
    const fetchData = async () => {
      if (!searchQuery.trim()) {
        setResults([]);
        setShowPopup(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from("songs")
          .select("id, title, artist_name as artist")
          .ilike("title", `%${searchQuery}%`);

        if (error) {
          setResults([]);
          setShowPopup(false);
          return;
        }

        setResults(data || []);
        setShowPopup(true);
      } catch (err) {
        setResults([]);
        setShowPopup(false);
      }
    };

    // Simple debounce: wait 250ms after the user stops typing
    const t = setTimeout(fetchData, 250);
    return () => clearTimeout(t);
  }, [searchQuery]);


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

          {/* SEARCH INPUT AND POPUP */}
          <div className="relative flex-1 max-w-[500px] hidden md:block">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search songs, artists..."
              className="w-full bg-[#161616] px-5 py-2.5 rounded-full text-sm text-gray-200 placeholder-gray-500 
              focus:outline-none focus:ring-2 focus:ring-[#fa4565]"
              // Hide popup when focus is lost (with a slight delay)
              onBlur={() => setTimeout(() => setShowPopup(false), 200)}
            />

            <Search className="absolute right-5 top-1/2 -translate-y-1/2 text-gray-400" />

            {showPopup && (
              <div className="absolute mt-3 w-full bg-[#1c1c1c] border border-[#333] rounded-xl p-3 shadow-xl max-h-60 overflow-y-auto z-50">
                {results.length > 0 ? (
                  results.map((song) => (
                    <div
                      key={song.id}
                      className="p-2 px-4 hover:bg-[#333] rounded-lg cursor-pointer flex justify-between"
                      onClick={() => {
                        setSearchQuery(song.title);
                        setShowPopup(false);
                        // TODO: Implement song playback action here
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
              onClick={() => setShowSettings(true)}
            >
              {user?.img ? (
                <img
                  loading="lazy"
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
        onClose={() => setShowSettings(false)}
        user={user}
      />
    </>
  );
}
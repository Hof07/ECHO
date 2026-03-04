"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import {
  AudioWaveform,
  Search,
  X,
  User2,
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
  ListMusic,
  Mic2,
  Clock,
  TrendingUp,
  ChevronRight,
} from "lucide-react";

import { supabase } from "@/app/lib/supabaseClient";
import CreatePlaylistModal from "../components/CreatePlaylistModal";
import AddSongToPlaylistModal from "../components/AddSongToPlaylistModal";
import { usePlayer } from "../context/PlayerContext";

// ---------------- UTILITY ----------------
const getMailId = async () => {
  try {
    const response = await fetch("/api/getToken");
    if (!response.ok) return null;
    const data = await response.json();
    return data.user?.email || data.user?.mailid || null;
  } catch {
    return null;
  }
};

// ---------------- PLAYLIST MANAGER ----------------
function PlaylistManager({ userMailId }) {
  const [playlists, setPlaylists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [activeMenuId, setActiveMenuId] = useState(null);
  const [playlistIdToAdd, setPlaylistIdToAdd] = useState(null);

  const getPlaylists = useCallback(async (mailId) => {
    setLoading(true);
    let query = supabase.from("playlists").select("id, name, image_url");
    if (mailId) query = query.eq("created_by", mailId);
    const { data, error } = await query.order("created_at", { ascending: false });
    if (error) console.error("Error fetching playlists:", error);
    setPlaylists(data || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (userMailId) getPlaylists(userMailId);
    else setLoading(false);
    const handleClickOutside = () => setActiveMenuId(null);
    window.addEventListener("click", handleClickOutside);
    return () => window.removeEventListener("click", handleClickOutside);
  }, [userMailId, getPlaylists]);

  const deletePlaylist = async (id) => {
    setActiveMenuId(null);
    if (!confirm("Are you sure you want to delete this playlist?")) return;
    const previousPlaylists = [...playlists];
    setPlaylists(playlists.filter((p) => p.id !== id));
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
            <div key={p.id} className={`relative group ${activeMenuId === p.id ? "z-50" : "z-0"}`}>
              <Link
                href={`/playlist/${p.id}`}
                onClick={() => setActiveMenuId(null)}
                className="bg-[#1a1a1a] p-3 rounded-xl flex items-center gap-3 hover:bg-[#2a2a2a] transition pr-10"
              >
                <div className="relative h-10 w-10 min-w-[2.5rem] rounded-md overflow-hidden bg-gray-800">
                  {p.image_url ? (
                    <img loading="lazy" src={p.image_url} alt={p.name} className="h-full w-full object-cover" />
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
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); setActiveMenuId(activeMenuId === p.id ? null : p.id); }}
                  className={`p-2 rounded-full transition cursor-pointer ${activeMenuId === p.id ? "text-white opacity-100" : "text-gray-400 opacity-0 group-hover:opacity-100 hover:bg-black/50"}`}
                >
                  <MoreVertical size={18} />
                </button>
                {activeMenuId === p.id && (
                  <div className="absolute right-0 top-10 w-48 bg-[#222] border border-gray-700 rounded-lg shadow-2xl overflow-hidden flex flex-col py-1 z-[100]" onClick={(e) => e.stopPropagation()}>
                    <button onClick={() => { setPlaylistIdToAdd(p.id); setActiveMenuId(null); }} className="flex items-center gap-3 px-4 py-3 text-sm text-gray-300 hover:bg-white/10 text-left w-full cursor-pointer">
                      <ListPlus size={16} /> Add Song
                    </button>
                    <button onClick={() => deletePlaylist(p.id)} className="flex items-center gap-3 px-4 py-3 text-sm text-red-400 hover:bg-red-900/20 text-left w-full cursor-pointer">
                      <Trash2 size={16} /> Delete Playlist
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreateModal && (
        <CreatePlaylistModal close={() => setShowCreateModal(false)} refresh={() => getPlaylists(userMailId)} createdBy={userMailId} />
      )}
      {playlistIdToAdd && (
        <AddSongToPlaylistModal playlistId={playlistIdToAdd} close={() => setPlaylistIdToAdd(null)} />
      )}
    </div>
  );
}

// ---------------- SETTINGS PANEL ----------------
function SettingsPanel({ open, onClose, user }) {
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState(null);

  const displayUser = user || { full_name: "Echo User", email: "guest@example.com", img: null, id: null };
  const initial = displayUser.full_name?.[0] || "U";

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !displayUser.email) { alert("User email missing or no file selected."); return; }
    try {
      const tempPreview = URL.createObjectURL(file);
      setPreview(tempPreview);
      setUploading(true);
      const formData = new FormData();
      formData.append("file", file);
      formData.append("email", displayUser.email);
      const res = await fetch("/api/getImg", { method: "POST", body: formData });
      let data;
      try { data = await res.json(); } catch { alert("Upload failed: invalid server response"); return; }
      if (!data.url) { alert("Upload error: " + (data.error || "Unknown error")); return; }
      window.location.reload();
    } catch (err) {
      alert("Unexpected error: " + (err?.message || err));
    } finally {
      setUploading(false);
    }
  };

  return (
    <>
      {open && <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[90]" onClick={onClose} />}
      <aside className={`fixed top-0 right-0 h-full w-[330px] md:w-[500px] bg-[#0f0f0f] text-white shadow-xl z-[100] transform transition-transform duration-300 ${open ? "translate-x-0" : "translate-x-full"} p-6 flex flex-col`}>
        <div className="flex justify-between items-center pb-4 border-b border-[#1c1c1c]">
          <h2 className="text-xl font-bold">Settings</h2>
          <button onClick={onClose} className="p-2 hover:bg-[#1c1c1c] rounded-lg text-gray-400 hover:text-white">
            <X size={22} />
          </button>
        </div>
        <div className="space-y-4 pt-4">
          <div className="flex items-center gap-3 p-3 bg-[#161616] rounded-xl border border-[#fa4565]/20">
            {preview ? (
              <><img loading="lazy" src={preview} className="w-12 h-12 rounded-full object-cover" /><div className="text-xs text-gray-400 ml-2">Preview shown (not saved)</div></>
            ) : displayUser.img ? (
              <img loading="lazy" src={displayUser.img} className="w-12 h-12 rounded-full object-cover" />
            ) : (
              <div className="w-12 h-12 bg-[#fa4565] rounded-full flex items-center justify-center font-bold text-lg">{initial}</div>
            )}
            <div>
              <h4 className="font-semibold">{displayUser.full_name}</h4>
              <p className="text-[12px] text-gray-400 truncate">{displayUser.email}</p>
            </div>
          </div>
          <label className="cursor-pointer flex items-center gap-2 bg-[#1c1c1c] hover:bg-[#222] p-3 rounded-lg border border-[#333] text-sm">
            <Upload size={18} />
            {uploading ? "Uploading..." : "Upload Profile Image"}
            <input type="file" accept="image/*" className="hidden" onChange={handleUpload} />
          </label>
        </div>
        <div className="flex-1 space-y-6 pt-4 overflow-y-auto custom-scroll">
          <PlaylistManager userMailId={displayUser.email} />
          <ul className="space-y-2 border-t border-[#2a2a2a] pt-4">
            {[
              { icon: User2, label: "My Account" },
              { icon: ListMusic, label: "Public Playlist", href: "/playlists" },
              { icon: Hourglass, label: "Time Spended", href: "/duration" },
              { icon: ShieldCheck, label: "Security" },
            ].map(({ icon: Icon, label, href }) =>
              href ? (
                <Link key={label} href={href} className="flex items-center gap-3 p-3 rounded-lg text-sm text-gray-300 hover:bg-[#1c1c1c] cursor-pointer">
                  <Icon size={20} /> {label}
                </Link>
              ) : (
                <div key={label} className="flex items-center gap-3 p-3 rounded-lg text-sm text-gray-300 hover:bg-[#1c1c1c] cursor-pointer">
                  <Icon size={20} /> {label}
                </div>
              )
            )}
          </ul>
        </div>
        <button
          onClick={async () => {
            try { await fetch("/api/logout", { method: "POST" }); window.location.href = "/login"; }
            catch (err) { console.error("Logout failed:", err); }
          }}
          className="w-full py-3 bg-[#fa4565] hover:bg-[#ff5c79] rounded-lg font-semibold mt-6 flex items-center justify-center gap-2"
        >
          <LogOut size={18} /> Logout
        </button>
      </aside>
    </>
  );
}

// ---------------- SEARCH BAR ----------------
const RECENT_KEY = "echo_recent_searches";

function SpotifySearchBar({ isMobileOpen, onMobileClose }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [results, setResults] = useState([]);
  const [recentSearches, setRecentSearches] = useState([]);
  const [trendingSongs, setTrendingSongs] = useState([]);
  const [isFocused, setIsFocused] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const inputRef = useRef(null);
  const containerRef = useRef(null);

  const { playSong } = usePlayer();

  // Auto focus when mobile search opens
  useEffect(() => {
    if (isMobileOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isMobileOpen]);

  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(RECENT_KEY) || "[]");
      setRecentSearches(stored);
    } catch { setRecentSearches([]); }
  }, []);

  useEffect(() => {
    const fetchTrending = async () => {
      try {
        const { data } = await supabase
          .from("songs")
          .select("id, title, artist_name, cover_url, audio_url, duration")
          .limit(5)
          .order("play_count", { ascending: false });
        setTrendingSongs(data || []);
      } catch { setTrendingSongs([]); }
    };
    fetchTrending();
  }, []);

  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsFocused(false);
        setActiveIndex(-1);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      const q = searchQuery.trim();
      if (!q) { setResults([]); setIsLoading(false); return; }
      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from("songs")
          .select("id, title, artist_name, cover_url, audio_url, duration")
          .or(`title.ilike.%${q}%,artist_name.ilike.%${q}%`)
          .limit(8);
        if (!error) setResults(data || []);
      } catch { setResults([]); }
      finally { setIsLoading(false); }
    };
    const t = setTimeout(fetchData, 250);
    return () => clearTimeout(t);
  }, [searchQuery]);

  const saveRecent = (title) => {
    try {
      const prev = JSON.parse(localStorage.getItem(RECENT_KEY) || "[]");
      const updated = [title, ...prev.filter((s) => s !== title)].slice(0, 5);
      localStorage.setItem(RECENT_KEY, JSON.stringify(updated));
      setRecentSearches(updated);
    } catch { }
  };

  const removeRecent = (term, e) => {
    e.stopPropagation();
    try {
      const updated = recentSearches.filter((s) => s !== term);
      localStorage.setItem(RECENT_KEY, JSON.stringify(updated));
      setRecentSearches(updated);
    } catch { }
  };

  const handleSelect = (song, index, list) => {
    saveRecent(song.title);
    setSearchQuery(song.title);
    setIsFocused(false);
    setActiveIndex(-1);
    playSong(song, index, list);
    if (onMobileClose) onMobileClose();
  };

  const handleRecentClick = (term) => {
    setSearchQuery(term);
    inputRef.current?.focus();
  };

  const clearInput = () => {
    setSearchQuery("");
    setResults([]);
    inputRef.current?.focus();
  };

  const allItems = searchQuery.trim() ? results : trendingSongs;

  const handleKeyDown = (e) => {
    if (!isFocused) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setActiveIndex((i) => Math.min(i + 1, allItems.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActiveIndex((i) => Math.max(i - 1, -1)); }
    else if (e.key === "Enter" && activeIndex >= 0) { e.preventDefault(); handleSelect(allItems[activeIndex], activeIndex, allItems); }
    else if (e.key === "Escape") { setIsFocused(false); setActiveIndex(-1); inputRef.current?.blur(); if (onMobileClose) onMobileClose(); }
  };

  const showDropdown = isFocused;
  const showResults = searchQuery.trim() && results.length > 0;
  const showEmpty = searchQuery.trim() && !isLoading && results.length === 0;
  const showDefault = !searchQuery.trim();

  return (
    <div
      ref={containerRef}
      className={`relative ${isMobileOpen ? "flex flex-1 w-full" : "hidden md:flex flex-1 max-w-[500px]"}`}
    >
      <div className={`relative flex items-center w-full transition-all duration-300 ${isFocused ? "ring-2 ring-[#fa4565]" : "ring-1 ring-transparent"} rounded-full bg-[#161616]`}>
        <span className="absolute left-4 text-gray-400 pointer-events-none"><Search size={16} /></span>
        <input
          ref={inputRef}
          type="text"
          value={searchQuery}
          onChange={(e) => { setSearchQuery(e.target.value); setActiveIndex(-1); }}
          onFocus={() => setIsFocused(true)}
          onKeyDown={handleKeyDown}
          placeholder="What do you want to play?"
          className="w-full bg-transparent pl-10 pr-10 py-2.5 text-sm text-gray-200 placeholder-gray-500 focus:outline-none rounded-full"
          autoComplete="off"
          spellCheck="false"
        />
        <span className="absolute right-4">
          {searchQuery ? (
            <button onClick={clearInput} className="text-gray-400 hover:text-white transition p-0.5 rounded-full hover:bg-white/10"><X size={15} /></button>
          ) : (
            <span className="text-gray-600"><Mic2 size={15} /></span>
          )}
        </span>
      </div>

      {/* DROPDOWN */}
      {showDropdown && (
        <div className="absolute top-full mt-2 left-0 right-0 bg-[#121212] border border-[#2a2a2a] rounded-2xl shadow-2xl overflow-hidden z-50 animate-in">
          {isLoading && (
            <div className="p-4 space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-3 animate-pulse">
                  <div className="w-10 h-10 rounded bg-[#2a2a2a] shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3 bg-[#2a2a2a] rounded w-3/4" />
                    <div className="h-2.5 bg-[#222] rounded w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {!isLoading && showResults && (
            <div className="py-2">
              <div className="px-4 py-2 text-[11px] font-semibold tracking-widest text-gray-500 uppercase">Songs</div>
              {results.map((song, idx) => (
                <button
                  key={song.id}
                  onMouseDown={() => handleSelect(song, idx, results)}
                  onMouseEnter={() => setActiveIndex(idx)}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${activeIndex === idx ? "bg-white/10" : "hover:bg-white/5"}`}
                >
                  <div className="w-10 h-10 rounded bg-[#2a2a2a] shrink-0 overflow-hidden">
                    {song.cover_url ? <img src={song.cover_url} alt={song.title} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-gray-600"><Music size={16} /></div>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white font-medium truncate">{song.title}</p>
                    <p className="text-xs text-gray-400 truncate">{song.artist_name || "Unknown Artist"}</p>
                  </div>
                  {song.duration && <span className="text-xs text-gray-500 shrink-0">{song.duration}</span>}
                  <ChevronRight size={14} className="text-gray-600 shrink-0" />
                </button>
              ))}
            </div>
          )}

          {!isLoading && showEmpty && (
            <div className="py-8 text-center">
              <Music size={32} className="mx-auto text-gray-600 mb-3" />
              <p className="text-sm text-gray-400">No results for <span className="text-white font-medium">"{searchQuery}"</span></p>
              <p className="text-xs text-gray-600 mt-1">Try different keywords</p>
            </div>
          )}

          {!isLoading && showDefault && (
            <div className="py-2">
              {recentSearches.length > 0 && (
                <div className="mb-1">
                  <div className="px-4 py-2 flex items-center gap-2 text-[11px] font-semibold tracking-widest text-gray-500 uppercase">
                    <Clock size={12} /> Recent searches
                  </div>
                  {recentSearches.map((term) => (
                    <div key={term} onMouseDown={() => handleRecentClick(term)} className="flex items-center gap-3 px-4 py-2.5 hover:bg-white/5 cursor-pointer group">
                      <Clock size={14} className="text-gray-500 shrink-0" />
                      <span className="text-sm text-gray-300 flex-1 truncate">{term}</span>
                      <button onMouseDown={(e) => removeRecent(term, e)} className="opacity-0 group-hover:opacity-100 p-1 rounded-full hover:bg-white/10 text-gray-500 hover:text-white transition"><X size={12} /></button>
                    </div>
                  ))}
                  <div className="mx-4 border-t border-[#2a2a2a] my-2" />
                </div>
              )}
              {trendingSongs.length > 0 && (
                <div>
                  <div className="px-4 py-2 flex items-center gap-2 text-[11px] font-semibold tracking-widest text-gray-500 uppercase">
                    <TrendingUp size={12} /> Trending
                  </div>
                  {trendingSongs.map((song, idx) => (
                    <button
                      key={song.id}
                      onMouseDown={() => handleSelect(song, idx, trendingSongs)}
                      onMouseEnter={() => setActiveIndex(idx)}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${activeIndex === idx ? "bg-white/10" : "hover:bg-white/5"}`}
                    >
                      <span className="w-5 text-center text-xs font-bold text-gray-600">{idx + 1}</span>
                      <div className="w-9 h-9 rounded bg-[#2a2a2a] shrink-0 overflow-hidden">
                        {song.cover_url ? <img src={song.cover_url} alt={song.title} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-gray-600"><Music size={14} /></div>}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white font-medium truncate">{song.title}</p>
                        <p className="text-xs text-gray-400 truncate">{song.artist_name || "Unknown Artist"}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
              {recentSearches.length === 0 && trendingSongs.length === 0 && (
                <div className="py-6 text-center text-sm text-gray-500">Start typing to search songs</div>
              )}
            </div>
          )}
        </div>
      )}

      <style>{`
        .animate-in { animation: dropIn 0.18s ease-out; }
        @keyframes dropIn {
          from { opacity: 0; transform: translateY(-6px) scale(0.98); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>
  );
}

// ---------------- MAIN HEADER ----------------
export default function Header() {
  const [showSettings, setShowSettings] = useState(false);
  const [user, setUser] = useState(null);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);

  useEffect(() => {
    async function loadUser() {
      try {
        const res = await fetch("/api/getToken");
        const tokenData = await res.json().catch(() => null);
        if (tokenData?.user) setUser(tokenData.user);
      } catch (e) {
        console.error("Error fetching full user data:", e);
      }
    }
    loadUser();
  }, []);

  return (
    <>
      <header className="w-full bg-black text-white sticky top-0 z-50 shadow-lg">
        <div className="max-w-[1400px] mx-auto px-4 md:px-8 py-4">

          {/* ── MOBILE HEADER ── */}
          <div className="flex md:hidden items-center gap-2">
            {mobileSearchOpen ? (
              // Search mode: full width search bar + X to close
              <>
                <SpotifySearchBar isMobileOpen={true} onMobileClose={() => setMobileSearchOpen(false)} />
                <button
                  onClick={() => setMobileSearchOpen(false)}
                  className="shrink-0 p-2 rounded-full bg-[#1c1c1c] text-gray-400 hover:text-white transition"
                >
                  <X size={20} />
                </button>
              </>
            ) : (
              // Normal mode: logo | search icon + profile
              <>
                <Link href="/" className="flex items-center shrink-0">
                  <AudioWaveform size={36} className="text-[#fa4565] hover:scale-110 transition" />
                </Link>
                <div className="flex items-center gap-3 ml-auto">
                  <button
                    onClick={() => setMobileSearchOpen(true)}
                    className="p-2 rounded-full bg-[#161616] text-gray-400 hover:text-white transition"
                  >
                    <Search size={20} />
                  </button>
                  <button onClick={() => setShowSettings(true)}>
                    {user?.img ? (
                      <img loading="lazy" src={user.img} className="w-9 h-9 rounded-full border object-cover" alt="profile" />
                    ) : (
                      <div className="w-9 h-9 bg-[#333] rounded-full flex items-center justify-center text-base font-bold">
                        {user?.full_name?.[0] || "?"}
                      </div>
                    )}
                  </button>
                </div>
              </>
            )}
          </div>

          {/* ── DESKTOP HEADER ── */}
          <div className="hidden md:flex items-center justify-between gap-4">
            <Link href="/" className="flex items-center shrink-0">
              <AudioWaveform size={42} className="text-[#fa4565] hover:scale-110 transition" />
            </Link>
            <SpotifySearchBar isMobileOpen={false} onMobileClose={() => {}} />
            <div className="flex items-center gap-3 shrink-0">
              {/* Premium only on desktop */}
              <Link href="/premium" className="bg-[#fa4565] px-5 py-2 rounded-full font-semibold hover:bg-[#ff6078] transition whitespace-nowrap">
                Premium
              </Link>
              <button onClick={() => setShowSettings(true)}>
                {user?.img ? (
                  <img loading="lazy" src={user.img} className="w-10 h-10 rounded-full border object-cover hover:scale-110 transition" alt="profile" />
                ) : (
                  <div className="w-10 h-10 bg-[#333] rounded-full flex items-center justify-center text-lg font-bold hover:scale-110 transition">
                    {user?.full_name?.[0] || "?"}
                  </div>
                )}
              </button>
            </div>
          </div>

        </div>
      </header>

      <SettingsPanel open={showSettings} onClose={() => setShowSettings(false)} user={user} />
    </>
  );
}

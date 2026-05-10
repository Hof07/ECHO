"use client";

import { useParams } from "next/navigation";
import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { supabase } from "@/app/lib/supabaseClient";
import { useRouter } from "next/navigation";
import {
  Clock, Play, Pause, Hash, RefreshCw, Upload,
  X, MoreHorizontal, Shuffle, Plus, Trash2,
  GripVertical, Search, Image,
} from "lucide-react";
import { usePlayer } from "@/app/music/context/PlayerContext";
import { useColor } from "color-thief-react";

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const HEADER_HEIGHT_PX = 380;
const FIXED_TOP_BAR_HEIGHT = 64;
const ACTION_ROW_HEIGHT = 88;

// ─── SPOTIFY-STYLE SHUFFLE QUEUE ──────────────────────────────────────────────
// Current song stays at index 0, rest is Fisher-Yates shuffled
const buildShuffleQueue = (songs, currentSongId) => {
  if (!songs.length) return [];
  const currentIdx = songs.findIndex((s) => s.id === currentSongId);
  const current = currentIdx >= 0 ? songs[currentIdx] : songs[0];
  const rest = songs.filter((s) => s.id !== current.id);
  for (let i = rest.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [rest[i], rest[j]] = [rest[j], rest[i]];
  }
  return [current, ...rest];
};

export default function PlaylistPage() {
  const { id } = useParams();
  const router = useRouter();

  // ── Core state ──
  const [playlist, setPlaylist] = useState(null);
  const [songs, setSongs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [scrollY, setScrollY] = useState(0);

  // ── Shuffle — queue stored as STATE so React re-renders on change ──
  const [isShuffling, setIsShuffling] = useState(false);
  const [shuffleQueue, setShuffleQueue] = useState([]);

  // ── Cover modal ──
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [generatingCover, setGeneratingCover] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const fileInputRef = useRef(null);

  // ── Add song panel ──
  const [isAddSongOpen, setIsAddSongOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchDebounceRef = useRef(null);

  // ── Drag reorder ──
  const [dragIndex, setDragIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);

  // ── Per-song context menu ──
  const [contextMenu, setContextMenu] = useState(null);

  const activeSongRef = useRef(null);

  // ── Player context ──
  // togglePlayPause is optional — some implementations may not expose it
  const {
    playSong,
    currentSongId,
    isPlaying,
    currentPlaylistId,
    togglePlayPause,
    updatePlaybackList,
  } = usePlayer();

  const isGloballyPlaying = !!isPlaying;
  const isThisPlaylistActive = useMemo(
    () => currentPlaylistId === playlist?.id,
    [currentPlaylistId, playlist?.id]
  );

  // ── Color theming from cover ──
  const coverUrl = playlist?.image_url || "/placeholder.png";
  const { data: dominantColor, loading: loadingColor } = useColor(coverUrl, "hex", {
    crossOrigin: "anonymous",
  });
  const bgColor = dominantColor || "#1a1a2e";
  const listBg = "#111111";

  // ─── SCROLL ───────────────────────────────────────────────────────────────
  useEffect(() => {
    let raf = null;
    const onScroll = () => {
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => setScrollY(window.scrollY));
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => { window.removeEventListener("scroll", onScroll); if (raf) cancelAnimationFrame(raf); };
  }, []);

  const parallax        = useMemo(() => Math.max(-HEADER_HEIGHT_PX, -scrollY * 0.5), [scrollY]);
  const showStickyTitle = useMemo(() => scrollY > HEADER_HEIGHT_PX - FIXED_TOP_BAR_HEIGHT - 30, [scrollY]);
  const largeTitleOp    = useMemo(() => Math.max(0, Math.min(1, 1 - scrollY / (HEADER_HEIGHT_PX * 0.7))), [scrollY]);
  const smallTitleOp    = useMemo(() => {
    const start = HEADER_HEIGHT_PX * 0.4;
    return Math.max(0, Math.min(1, (scrollY - start) / (HEADER_HEIGHT_PX * 0.2)));
  }, [scrollY]);
  const coverScale      = useMemo(() => Math.max(0.82, 1 - scrollY * 0.0004), [scrollY]);
  const coverBlur       = useMemo(() => Math.min(6, scrollY * 0.025), [scrollY]);

  // ─── FETCH ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!id) { setErr("Invalid Playlist ID"); setLoading(false); return; }
    const fetchData = async () => {
      try {
        const { data: pl, error: plErr } = await supabase
          .from("playlists")
          .select("id, name, description, image_url, created_by, created_at")
          .eq("id", id).single();
        if (plErr) throw plErr;
        setPlaylist(pl);

        const { data: rows, error: songsErr } = await supabase
          .from("playlist_songs")
          .select(`id, created_at, song:song_id (id, title, cover_url, audio_url, duration, artist_name)`)
          .eq("playlist_id", id)
          .order("created_at", { ascending: true });
        if (songsErr) throw songsErr;

        const extracted = (rows || []).map((row, idx) => ({
          ...row.song,
          playlistSongId: row.id,
          position: idx,
          artist_name: row?.song?.artist_name || "Unknown Artist",
        }));
        setSongs(extracted);
      } catch (e) {
        setErr("Failed loading playlist: " + (e.message || e));
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id]);

  // ─── HELPERS ──────────────────────────────────────────────────────────────
  const totalDuration = useMemo(() => songs.reduce((t, s) => t + (s.duration || 0), 0), [songs]);
  const fmtPlaylistDur = (sec) => {
    if (!sec) return "0 min";
    const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60);
    return h > 0 ? `${h} hr ${m} min` : `${m} min`;
  };
  const fmtDur = (sec) => {
    if (!sec) return "--:--";
    return `${Math.floor(sec / 60)}:${(sec % 60).toString().padStart(2, "0")}`;
  };

  // ─── PLAYABLE SONGS ───────────────────────────────────────────────────────
  // shuffleQueue is STATE → this memo correctly re-evaluates when queue changes
  const playableSongs = useMemo(() => {
    if (isShuffling && shuffleQueue.length > 0) return shuffleQueue;
    return songs;
  }, [isShuffling, shuffleQueue, songs]);

  // ─── SHUFFLE TOGGLE ───────────────────────────────────────────────────────
  const handleToggleShuffle = useCallback(() => {
    if (!isShuffling) {
      const activeId = isThisPlaylistActive ? currentSongId : null;
      const queue = buildShuffleQueue(songs, activeId);
      setShuffleQueue(queue);
      setIsShuffling(true);
      if (isThisPlaylistActive && updatePlaybackList) updatePlaybackList(queue, currentSongId);
    } else {
      setShuffleQueue([]);
      setIsShuffling(false);
      if (isThisPlaylistActive && updatePlaybackList) updatePlaybackList(songs, currentSongId);
    }
  }, [isShuffling, songs, currentSongId, isThisPlaylistActive, updatePlaybackList]);

  // ─── PLAY SONG (row click) ────────────────────────────────────────────────
  const handlePlaySong = useCallback((song) => {
    if (!playlist?.id) return;
    if (isShuffling) {
      const queue = buildShuffleQueue(songs, song.id);
      setShuffleQueue(queue);
      playSong(song, 0, queue, playlist.id);
      if (updatePlaybackList) updatePlaybackList(queue, song.id);
    } else {
      const idx = songs.findIndex((s) => s.id === song.id);
      playSong(song, idx >= 0 ? idx : 0, songs, playlist.id);
    }
  }, [songs, isShuffling, playlist?.id, playSong, updatePlaybackList]);

  // ─── PLAY ALL ─────────────────────────────────────────────────────────────
  // FIX: togglePlayPause is checked before calling — was crashing as "not a function"
  const handlePlayAll = useCallback(() => {
    if (isGloballyPlaying) {
      if (typeof togglePlayPause === "function") togglePlayPause(false);
      return;
    }
    const list = isShuffling && shuffleQueue.length > 0 ? shuffleQueue : songs;
    if (list.length > 0 && playlist?.id) playSong(list[0], 0, list, playlist.id);
  }, [isGloballyPlaying, isShuffling, shuffleQueue, songs, playlist?.id, playSong, togglePlayPause]);

  // ─── DELETE SONG ──────────────────────────────────────────────────────────
  const handleDeleteSong = useCallback(async (song) => {
    setContextMenu(null);
    setSongs((prev) => prev.filter((s) => s.id !== song.id));
    if (isShuffling) setShuffleQueue((prev) => prev.filter((s) => s.id !== song.id));
    try {
      await supabase.from("playlist_songs").delete().eq("id", song.playlistSongId);
    } catch (e) { console.error("Delete failed", e); }
  }, [isShuffling]);

  // ─── ADD SONG ─────────────────────────────────────────────────────────────
  const handleSearchSongs = useCallback((query) => {
    setSearchQuery(query);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    if (!query.trim()) { setSearchResults([]); return; }
    searchDebounceRef.current = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const { data } = await supabase
          .from("songs")
          .select("id, title, cover_url, audio_url, duration, artist_name")
          .ilike("title", `%${query}%`)
          .limit(20);
        const existing = new Set(songs.map((s) => s.id));
        setSearchResults((data || []).filter((s) => !existing.has(s.id)));
      } finally { setSearchLoading(false); }
    }, 300);
  }, [songs]);

  const handleAddSong = useCallback(async (song) => {
    const optimistic = { ...song, playlistSongId: `temp-${song.id}`, position: songs.length, artist_name: song.artist_name || "Unknown Artist" };
    setSongs((prev) => [...prev, optimistic]);
    setSearchResults((prev) => prev.filter((s) => s.id !== song.id));
    try {
      const { data, error } = await supabase
        .from("playlist_songs")
        .insert({ playlist_id: id, song_id: song.id })
        .select("id").single();
      if (error) throw error;
      setSongs((prev) => prev.map((s) => s.playlistSongId === `temp-${song.id}` ? { ...s, playlistSongId: data.id } : s));
    } catch (e) {
      console.error("Add failed", e);
      setSongs((prev) => prev.filter((s) => s.playlistSongId !== `temp-${song.id}`));
    }
  }, [id, songs]);

  // ─── DRAG REORDER ────────────────────────────────────────────────────────
  const handleDragStart = (e, index) => {
    setDragIndex(index);
    e.dataTransfer.effectAllowed = "move";
  };
  const handleDragOver = (e, index) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOverIndex !== index) setDragOverIndex(index);
  };
  const handleDrop = useCallback((e, dropIndex) => {
    e.preventDefault();
    if (dragIndex === null || dragIndex === dropIndex) { setDragIndex(null); setDragOverIndex(null); return; }
    const reordered = [...songs];
    const [removed] = reordered.splice(dragIndex, 1);
    reordered.splice(dropIndex, 0, removed);
    const withPos = reordered.map((s, i) => ({ ...s, position: i }));
    setSongs(withPos);
    setDragIndex(null);
    setDragOverIndex(null);
    if (isShuffling) {
      const newQueue = buildShuffleQueue(withPos, currentSongId);
      setShuffleQueue(newQueue);
      if (updatePlaybackList) updatePlaybackList(newQueue, currentSongId);
    } else if (isThisPlaylistActive && updatePlaybackList) {
      updatePlaybackList(withPos, currentSongId);
    }
  }, [dragIndex, songs, isShuffling, currentSongId, isThisPlaylistActive, updatePlaybackList]);

  const generatePlaylistCover = async () => {};
  const handleImageUpload = async () => {};
  const triggerFileInput = () => fileInputRef.current?.click();

  useEffect(() => {
    const close = () => setContextMenu(null);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, []);

  // ─── LOADING / ERROR ──────────────────────────────────────────────────────
  if (loading || loadingColor)
    return <div className="flex justify-center items-center h-screen bg-[#111]"><div className="circle-loader" /></div>;
  if (err)
    return <div className="p-10 text-red-500 bg-[#111] min-h-screen">{err}</div>;

  // ─── RENDER ───────────────────────────────────────────────────────────────
  return (
    <main className="flex-1 text-white bg-[#111111] relative min-h-screen overflow-x-hidden">

      {/* ══ FIXED TOP BAR ══════════════════════════════════════════════════ */}
      <div
        className="fixed top-0 left-0 right-0 z-[100] flex items-center h-16 px-4 sm:px-6 transition-all duration-400"
        style={{
          background: showStickyTitle ? `${bgColor}e8` : "transparent",
          backdropFilter: showStickyTitle ? "blur(16px) saturate(140%)" : "none",
          WebkitBackdropFilter: showStickyTitle ? "blur(16px) saturate(140%)" : "none",
          borderBottom: showStickyTitle ? "1px solid rgba(255,255,255,0.06)" : "none",
        }}
      >
        <button
          onClick={() => router.back()}
          className="w-8 h-8 rounded-full bg-black/50 hover:bg-black/70 flex items-center justify-center transition-colors flex-shrink-0 border border-white/10"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-3.5 h-3.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </button>
        <h2
          className="absolute left-1/2 -translate-x-1/2 text-sm font-bold truncate max-w-[55vw] text-center transition-opacity duration-200 pointer-events-none"
          style={{ opacity: smallTitleOp }}
        >
          {playlist?.name}
        </h2>
      </div>

      {/* ══ HERO HEADER ════════════════════════════════════════════════════ */}
      <div className="relative overflow-hidden" style={{ height: HEADER_HEIGHT_PX }}>

        {/* Blurred background — full bleed cover art */}
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage: `url(${coverUrl})`,
            transform: `translateY(${parallax * 0.25}px) scale(1.2)`,
            filter: `blur(${16 + coverBlur}px) brightness(0.38) saturate(1.2)`,
          }}
        />

        {/* Gradient fade to list background */}
        <div
          className="absolute inset-0"
          style={{
            background: `linear-gradient(180deg,
              ${bgColor}55 0%,
              ${bgColor}88 35%,
              ${bgColor}bb 65%,
              ${listBg} 100%)`,
          }}
        />

        {/* ── MOBILE layout: cover centered, text below ── */}
        <div
          className="absolute inset-0 flex sm:hidden flex-col items-center justify-end pb-7 pt-20 px-5 gap-4"
          style={{ transform: `translateY(${parallax * 0.12}px)`, opacity: largeTitleOp }}
        >
          {/* Centered cover art */}
          <div
            onClick={() => setIsModalOpen(true)}
            style={{ transform: `scale(${coverScale})`, transformOrigin: "center bottom" }}
            className="cursor-pointer"
          >
            <img
              loading="lazy"
              src={coverUrl}
              alt={playlist?.name}
              crossOrigin="anonymous"
              className="w-44 h-44 rounded-xl object-cover shadow-[0_24px_64px_rgba(0,0,0,0.75)] hover:brightness-110 transition-all duration-300"
            />
          </div>
          {/* Text below cover */}
          <div className="text-center w-full">
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/40 block mb-1">Playlist</span>
            <h1 className="text-3xl font-black leading-tight tracking-tight drop-shadow-2xl">{playlist?.name}</h1>
            {playlist?.description && (
              <p className="text-xs text-white/40 mt-1 line-clamp-1">{playlist.description}</p>
            )}
            <p className="text-xs text-white/35 mt-1.5 font-medium">
              {songs.length} {songs.length === 1 ? "song" : "songs"}
              {totalDuration > 0 && <> • {fmtPlaylistDur(totalDuration)}</>}
            </p>
          </div>
        </div>

        {/* ── DESKTOP layout: side by side ── */}
        <div
          className="absolute inset-0 hidden sm:flex items-end gap-6 px-8 pb-8 pt-20"
          style={{ transform: `translateY(${parallax * 0.12}px)`, opacity: largeTitleOp }}
        >
          <div
            onClick={() => setIsModalOpen(true)}
            style={{ transform: `scale(${coverScale})`, transformOrigin: "bottom left" }}
            className="cursor-pointer flex-shrink-0"
          >
            <img
              loading="lazy"
              src={coverUrl}
              alt={playlist?.name}
              crossOrigin="anonymous"
              className="w-52 h-52 rounded-xl object-cover shadow-[0_24px_64px_rgba(0,0,0,0.75)] hover:brightness-110 transition-all duration-300"
            />
          </div>
          <div className="flex flex-col gap-1.5 min-w-0">
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/40">Playlist</span>
            <h1 className="text-5xl md:text-7xl font-black leading-none tracking-tight drop-shadow-2xl truncate">
              {playlist?.name}
            </h1>
            {playlist?.description && (
              <p className="text-sm text-white/40 mt-1 max-w-md line-clamp-2">{playlist.description}</p>
            )}
            <p className="text-sm text-white/40 mt-1 font-medium">
              {songs.length} {songs.length === 1 ? "song" : "songs"}
              {totalDuration > 0 && <> • {fmtPlaylistDur(totalDuration)}</>}
            </p>
          </div>
        </div>
      </div>

      {/* ══ STICKY ACTION ROW ══════════════════════════════════════════════ */}
      <div
        className="sticky z-40 transition-all duration-300"
        style={{
          top: FIXED_TOP_BAR_HEIGHT,
          background: listBg,
          boxShadow: showStickyTitle ? "0 4px 24px rgba(0,0,0,0.6)" : "none",
        }}
      >
        <div className="px-5 sm:px-8 flex items-center justify-between h-[88px]">
          {/* Play / Pause */}
          <button
            onClick={handlePlayAll}
            className="w-14 h-14 rounded-full flex items-center justify-center shadow-[0_8px_24px_rgba(250,69,101,0.4)] transition-all duration-200 hover:scale-105 active:scale-95"
            style={{ background: "linear-gradient(135deg, #fa4565 0%, #d63354 100%)" }}
          >
            {isGloballyPlaying
              ? <Pause className="w-6 h-6 fill-white text-white" />
              : <Play className="w-6 h-6 fill-white text-white ml-0.5" />
            }
          </button>

          <div className="flex gap-0.5 items-center">
            {/* Shuffle — Spotify dot indicator when on */}
            <button
              onClick={handleToggleShuffle}
              className={`relative p-2.5 rounded-full transition-all duration-200 ${
                isShuffling
                  ? "text-[#fa4565] bg-[#fa4565]/12 scale-110"
                  : "text-white/35 hover:text-white hover:bg-white/8"
              }`}
              title={isShuffling ? "Shuffle On" : "Shuffle Off"}
            >
              <Shuffle className="w-5 h-5" />
              {isShuffling && (
                <span className="absolute bottom-1.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[#fa4565]" />
              )}
            </button>

            {/* Add song */}
            <button
              onClick={() => { setIsAddSongOpen(true); setSearchQuery(""); setSearchResults([]); }}
              className="p-2.5 rounded-full text-white/35 hover:text-white hover:bg-white/8 transition-all duration-200"
              title="Add songs"
            >
              <Plus className="w-5 h-5" />
            </button>

            {/* Heart */}
            <button className="p-2.5 rounded-full text-white/35 hover:text-white hover:bg-white/8 transition-all duration-200">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.05-4.312 2.52-1.928-1.47-3.593-2.52-5.32-2.52C4.1 3.75 2 5.765 2 8.25c0 7.22 8.8 12 10 12s10-4.78 10-12z" />
              </svg>
            </button>

            {/* More */}
            <button className="p-2.5 rounded-full text-white/35 hover:text-white hover:bg-white/8 transition-all duration-200">
              <MoreHorizontal className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* ══ SONG LIST ══════════════════════════════════════════════════════ */}
      <div style={{ background: listBg }}>
        {/* Table header */}
        <div
          className="grid grid-cols-[20px_36px_1fr_52px] md:grid-cols-[20px_36px_5fr_3fr_88px] items-center text-white/25 text-[9px] sm:text-[10px] uppercase tracking-widest font-semibold border-b border-white/5 py-2.5 px-5 sm:px-8 sticky z-30"
          style={{ top: FIXED_TOP_BAR_HEIGHT + ACTION_ROW_HEIGHT, background: listBg }}
        >
          <div />
          <Hash className="w-3 h-3" />
          <div>Title</div>
          <div className="hidden md:block">Artist</div>
          <Clock className="w-3 h-3 justify-self-end" />
        </div>

        {/* Song rows */}
        <div className="pb-44">
          {playableSongs.map((song, i) => {
            const isActive = isThisPlaylistActive && currentSongId === song.id;
            const isDragging = dragIndex === i;
            const isOver = dragOverIndex === i && dragIndex !== i;

            return (
              <div
                key={song.id}
                ref={isActive ? activeSongRef : null}
                draggable
                onDragStart={(e) => handleDragStart(e, i)}
                onDragOver={(e) => handleDragOver(e, i)}
                onDrop={(e) => handleDrop(e, i)}
                onDragEnd={() => { setDragIndex(null); setDragOverIndex(null); }}
                className={`
                  relative grid grid-cols-[20px_36px_1fr_52px] md:grid-cols-[20px_36px_5fr_3fr_88px]
                  items-center py-1.5 sm:py-2 px-5 sm:px-8 group select-none
                  transition-all duration-150
                  ${isOver ? "border-t-2 border-[#fa4565] mt-[-1px]" : "border-t border-white/[0.03]"}
                  ${isDragging ? "opacity-25 scale-[0.97]" : "opacity-100"}
                  ${isActive ? "bg-white/[0.06]" : "cursor-pointer hover:bg-white/[0.04]"}
                `}
                onClick={() => !isDragging && handlePlaySong(song)}
              >
                {/* Drag handle */}
                <div className="opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing flex items-center justify-center">
                  <GripVertical className="w-3.5 h-3.5 text-white/25" />
                </div>

                {/* Index / Equalizer */}
                <div className="flex items-center justify-center w-5 h-5 relative">
                  {isActive ? (
                    <div className="flex gap-[2px] items-end h-3.5 rotate-180">
                      {[0.8, 1.2, 1].map((delay, b) => (
                        <div
                          key={b}
                          className="w-[3px] bg-[#fa4565] rounded-full animate-equalizer"
                          style={{ animationDelay: `${delay * 0.15}s` }}
                        />
                      ))}
                    </div>
                  ) : (
                    <>
                      <span className={`text-xs transition-all duration-150 group-hover:opacity-0 group-hover:scale-75 ${isActive ? "text-[#fa4565]" : "text-white/30"}`}>
                        {i + 1}
                      </span>
                      <Play className="w-3.5 h-3.5 absolute fill-white text-white opacity-0 scale-50 group-hover:opacity-100 group-hover:scale-100 transition-all duration-150" />
                    </>
                  )}
                </div>

                {/* Song info */}
                <div className="flex items-center gap-3 min-w-0">
                  <img
                    loading="lazy"
                    src={song.cover_url}
                    alt={song.title}
                    className={`w-10 h-10 sm:w-11 sm:h-11 rounded-md object-cover flex-shrink-0 shadow-md transition-all ${isActive ? "ring-2 ring-[#fa4565] ring-offset-1 ring-offset-[#111]" : ""}`}
                  />
                  <div className="min-w-0">
                    <p className={`text-sm font-medium truncate transition-colors leading-snug ${isActive ? "text-[#fa4565]" : "text-white/90 group-hover:text-[#fa4565]"}`}>
                      {song.title}
                    </p>
                    <p className="text-xs text-white/35 truncate mt-0.5">{song.artist_name}</p>
                  </div>
                </div>

                {/* Artist — desktop only */}
                <div className="hidden md:block text-sm text-white/35 truncate">{song.artist_name}</div>

                {/* Duration + menu */}
                <div className="flex items-center justify-end gap-1 relative">
                  <div className="hidden md:block relative">
                    <button
                      onClick={(e) => { e.stopPropagation(); setContextMenu(contextMenu === song.id ? null : song.id); }}
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-white/25 hover:text-white rounded-full hover:bg-white/10"
                    >
                      <MoreHorizontal className="w-4 h-4" />
                    </button>
                    {contextMenu === song.id && (
                      <div
                        className="absolute right-7 top-1/2 -translate-y-1/2 z-50 bg-[#242424] border border-white/10 rounded-xl shadow-2xl py-1.5 min-w-[190px]"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          onClick={() => handleDeleteSong(song)}
                          className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-red-400 hover:bg-white/5 hover:text-red-300 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Remove from playlist
                        </button>
                      </div>
                    )}
                  </div>
                  <span className={`text-xs tabular-nums min-w-[38px] text-right ${isActive ? "text-[#fa4565]" : "text-white/30"}`}>
                    {fmtDur(song.duration)}
                  </span>
                </div>
              </div>
            );
          })}

          {/* Empty state */}
          {songs.length === 0 && (
            <div className="flex flex-col items-center justify-center py-24 gap-4 text-white/20">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={0.8} stroke="currentColor" className="w-16 h-16 opacity-30">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 9l10.5-3m0 6.553v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 11-.99-3.467l2.31-.66a2.25 2.25 0 001.632-2.163zm0 0V2.25L9 5.25v10.303m0 0v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 01-.99-3.467l2.31-.66A2.25 2.25 0 009 15.553z" />
              </svg>
              <div className="text-center">
                <p className="text-sm font-semibold text-white/35 mb-1">No songs yet</p>
                <p className="text-xs text-white/20">Add some music to get started</p>
              </div>
              <button
                onClick={() => setIsAddSongOpen(true)}
                className="mt-1 flex items-center gap-2 px-5 py-2.5 bg-[#fa4565] hover:bg-[#e03a58] text-white rounded-full text-sm font-semibold transition-colors shadow-lg"
              >
                <Plus className="w-4 h-4" /> Add songs
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ══ ADD SONG PANEL ════════════════════════════════════════════════ */}
      {isAddSongOpen && (
        <div
          className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center"
          style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(8px)" }}
          onClick={() => setIsAddSongOpen(false)}
        >
          <div
            className="bg-[#181818] w-full sm:max-w-lg rounded-t-3xl sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-white/[0.07]"
            style={{ maxHeight: "82vh" }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Mobile handle */}
            <div className="flex justify-center pt-3 sm:hidden">
              <div className="w-10 h-1 rounded-full bg-white/15" />
            </div>

            <div className="flex justify-between items-center px-5 pt-4 pb-3 border-b border-white/[0.07]">
              <h2 className="text-sm font-bold">Add to Playlist</h2>
              <button onClick={() => setIsAddSongOpen(false)} className="p-1.5 text-white/35 hover:text-white rounded-full hover:bg-white/8 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="px-4 py-3">
              <div className="flex items-center gap-2 bg-white/6 border border-white/10 rounded-xl px-3 py-2.5 focus-within:border-[#fa4565]/60 transition-colors">
                <Search className="w-4 h-4 text-white/25 flex-shrink-0" />
                <input
                  autoFocus
                  type="text"
                  value={searchQuery}
                  onChange={(e) => handleSearchSongs(e.target.value)}
                  placeholder="Search for songs…"
                  className="bg-transparent text-sm text-white placeholder-white/20 flex-1 outline-none"
                />
                {searchQuery && (
                  <button onClick={() => { setSearchQuery(""); setSearchResults([]); }}>
                    <X className="w-3.5 h-3.5 text-white/25 hover:text-white" />
                  </button>
                )}
              </div>
            </div>

            <div className="overflow-y-auto flex-1 px-3 pb-6">
              {searchLoading && <div className="flex justify-center py-10"><div className="circle-loader" /></div>}
              {!searchLoading && searchQuery && searchResults.length === 0 && (
                <p className="text-center text-white/20 text-sm py-10">No results for "{searchQuery}"</p>
              )}
              {!searchLoading && !searchQuery && (
                <p className="text-center text-white/15 text-xs py-10">Start typing to search</p>
              )}
              {searchResults.map((song) => (
                <div
                  key={song.id}
                  className="flex items-center gap-3 px-2 py-2.5 rounded-xl hover:bg-white/6 group cursor-pointer transition-colors"
                  onClick={() => handleAddSong(song)}
                >
                  <img loading="lazy" src={song.cover_url} alt={song.title} className="w-11 h-11 rounded-lg object-cover flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{song.title}</p>
                    <p className="text-xs text-white/30 truncate mt-0.5">{song.artist_name || "Unknown Artist"}</p>
                  </div>
                  <div className="w-7 h-7 rounded-full border border-white/15 flex items-center justify-center flex-shrink-0 group-hover:border-[#fa4565] group-hover:bg-[#fa4565] transition-all duration-200">
                    <Plus className="w-3.5 h-3.5 text-white/35 group-hover:text-white transition-colors" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ══ COVER CHANGE MODAL ════════════════════════════════════════════ */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.8)", backdropFilter: "blur(10px)" }}
          onClick={() => setIsModalOpen(false)}
        >
          <div
            className="bg-[#181818] rounded-2xl shadow-2xl w-full max-w-md border border-white/[0.07] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center px-5 py-4 border-b border-white/[0.07]">
              <h2 className="text-sm font-bold">Change Cover</h2>
              <button onClick={() => setIsModalOpen(false)} className="p-1.5 text-white/35 hover:text-white rounded-full hover:bg-white/8 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-3">
              <div className="bg-white/[0.04] rounded-xl p-4 border border-white/[0.07]">
                <h3 className="text-sm font-semibold mb-1 flex items-center gap-2">
                  <Upload className="w-4 h-4 text-[#fa4565]" /> Upload Image
                </h3>
                <p className="text-xs text-white/30 mb-3">Select a file from your device</p>
                <button
                  onClick={triggerFileInput}
                  disabled={uploadingCover}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-white/8 hover:bg-white/12 rounded-lg text-sm transition-colors disabled:opacity-50"
                >
                  {uploadingCover ? <><RefreshCw className="w-4 h-4 animate-spin" />Uploading…</> : <><Image className="w-4 h-4" />Choose File</>}
                </button>
                <input type="file" accept="image/*" ref={fileInputRef} onChange={handleImageUpload} style={{ display: "none" }} />
              </div>
              {songs.length > 0 && (
                <div className="bg-white/[0.04] rounded-xl p-4 border border-white/[0.07]">
                  <h3 className="text-sm font-semibold mb-1 flex items-center gap-2">
                    <RefreshCw className="w-4 h-4 text-[#fa4565]" /> AI Generate
                  </h3>
                  <p className="text-xs text-white/30 mb-3">Generate art from your {songs.length} songs</p>
                  <button
                    onClick={generatePlaylistCover}
                    disabled={generatingCover}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-[#fa4565] hover:bg-[#e03a58] rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                  >
                    {generatingCover ? <><RefreshCw className="w-4 h-4 animate-spin" />Generating…</> : "Generate Cover"}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
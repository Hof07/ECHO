"use client";

import { useParams } from "next/navigation";
import { useEffect, useState, useMemo, useRef, useCallback } from "react";
// Ensure this path is correct for your Supabase client setup
import { supabase } from "@/app/lib/supabaseClient";
import {
  Clock,
  Play,
  Pause,
  Hash,
  Image,
  RefreshCw,
  Upload,
  X,
  MoreHorizontal,
  Shuffle,
} from "lucide-react";
import { usePlayer } from "@/app/music/context/PlayerContext";
import { useColor } from "color-thief-react";

// --- CONSTANTS ---
const COVER_BUCKET = "covers";
const HEADER_HEIGHT_PX = 320;
const FIXED_TOP_BAR_HEIGHT = 80;
const ACTION_ROW_HEIGHT = 96;
// -----------------

// ⭐️ UTILITY: Fisher-Yates shuffle algorithm
const shuffleArray = (array) => {
  // We need a shallow copy to prevent modifying the original array state directly
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
};

export default function PlaylistPage() {
  const { id } = useParams();

  // 1. STATE INITIALIZATION
  const [playlist, setPlaylist] = useState(null);
  const [songs, setSongs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [generatingCover, setGeneratingCover] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [scrollOffset, setScrollOffset] = useState(0);

  // 2. SHUFFLE STATES
  const [isShuffling, setIsShuffling] = useState(false);
  const [shuffledSongs, setShuffledSongs] = useState([]); // Holds the current shuffled order

  const activeSongRef = useRef(null);
  const fileInputRef = useRef(null);
  const mainScrollRef = useRef(null);

  // 3. DESTRUCTURE NECESSARY PLAYER CONTEXT VALUES
  const {
    playSong,
    currentSongId,
    isPlaying, // ⭐️ Global state, used for the main button sync
    currentPlaylistId,
    togglePlayPause,
    isPlaybackFinished,
    updatePlaybackList,
  } = usePlayer();

  // ⭐️ NEW: Global flag for the main play button sync
  const isGloballyPlaying = isPlaying;

  // Existing flag for list item status (only active if it's THIS playlist)
  const isThisPlaylistActive = useMemo(() => {
    return currentPlaylistId === playlist?.id;
  }, [currentPlaylistId, playlist?.id]);

  const coverUrl = playlist?.image_url || "/placeholder.png";
  const { data: dominantColor, loading: loadingColor } = useColor(
    coverUrl,
    "hex",
    { crossOrigin: "anonymous" }
  );
  const bgColor = dominantColor || "#2c2c2c";
  const listAreaBg = "#1a1a1a";

  // Scroll Handler (omitted for brevity)
  useEffect(() => {
    let raf = null;
    const onScroll = () => {
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        setScrollOffset(window.scrollY);
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  // Animation values (omitted for brevity)
  const parallaxTranslate = useMemo(
    () => Math.max(-HEADER_HEIGHT_PX, -scrollOffset * 0.6),
    [scrollOffset]
  );
  const showFixedHeader = useMemo(
    () => scrollOffset > HEADER_HEIGHT_PX - FIXED_TOP_BAR_HEIGHT - 20,
    [scrollOffset]
  );
  const largeTitleOpacity = useMemo(() => {
    const t = (HEADER_HEIGHT_PX - scrollOffset) / HEADER_HEIGHT_PX;
    return Math.max(0, Math.min(1, t));
  }, [scrollOffset]);
  const smallTitleOpacity = useMemo(() => {
    const start = HEADER_HEIGHT_PX * 0.35;
    const duration = HEADER_HEIGHT_PX * 0.25;
    const v = (scrollOffset - start) / duration;
    return Math.max(0, Math.min(1, v));
  }, [scrollOffset]);
  const headerOpacity = useMemo(() => {
    const o = 1 - scrollOffset / (HEADER_HEIGHT_PX * 1.1);
    return Math.max(0.08, Math.min(1, o));
  }, [scrollOffset]);

  // 4. SHUFFLE EFFECT: Create the shuffled list and sync with the Player Context
  useEffect(() => {
    // Determine the list that should be sent to the player
    let listToSend = songs;
    let newShuffledSongs = [];

    if (isShuffling && songs.length > 0) {
      newShuffledSongs = shuffleArray(songs);
      setShuffledSongs(newShuffledSongs);
      listToSend = newShuffledSongs;
    } else {
      setShuffledSongs([]);
    }

    // IMPORTANT: If this playlist is currently responsible for playback, update the PlayerContext's list
    if (isThisPlaylistActive && updatePlaybackList) {
      updatePlaybackList(listToSend, currentSongId);
    }
  }, [
    isShuffling,
    songs,
    isThisPlaylistActive,
    updatePlaybackList,
    currentSongId,
  ]);

  // 5. Dynamic Playback List: Uses the shuffled list if active
  const playableSongs = useMemo(() => {
    return isShuffling && shuffledSongs.length > 0 ? shuffledSongs : songs;
  }, [isShuffling, shuffledSongs, songs]);

  // 6. SHUFFLE TOGGLE HANDLER
  const handleToggleShuffle = () => {
    // Toggling shuffle resets the song list and will trigger the useEffect above to re-shuffle/re-sync
    setIsShuffling((prev) => !prev);
  };

  // 7. MODIFIED Playback Handlers: Uses playableSongs list
  const handlePlaySong = useCallback(
    (song) => {
      // Find the index of the clicked song in the currently playable list
      const startIndex = playableSongs.findIndex((s) => s.id === song.id);

      // Start playback from the correct index using the correct list
      if (startIndex !== -1 && playlist?.id) {
        // Pass the current playlist ID to the player context
        playSong(song, startIndex, playableSongs, playlist.id);
      }
    },
    [playableSongs, playSong, playlist?.id]
  );

  // ⭐️ 8. MODIFIED Play All: Now acts as a global toggle
  const handlePlayAll = useCallback(() => {
    if (isGloballyPlaying) {
      // If ANYTHING is playing globally, pause it
      togglePlayPause(false);
      return;
    }

    // If nothing is playing, start THIS playlist from the beginning
    const listToPlay = playableSongs;
    if (listToPlay.length > 0 && playlist?.id) {
      playSong(listToPlay[0], 0, listToPlay, playlist.id);
    }
  }, [
    isGloballyPlaying,
    playableSongs,
    playlist?.id,
    playSong,
    togglePlayPause,
  ]);

  // 9. AUTOMATIC RE-SHUFFLE LOGIC
  useEffect(() => {
    if (
      isShuffling &&
      isPlaybackFinished && // Context tells us the list has ended
      isThisPlaylistActive // Ensure it's THIS playlist that finished
    ) {
      console.log(
        "Playlist finished in shuffle mode. Re-shuffling and restarting."
      );

      // 1. Generate a new shuffled list
      const newShuffled = shuffleArray(songs);

      // 2. Update the local state for rendering
      setShuffledSongs(newShuffled);

      // 3. Update the PlayerContext with the new list and start the first song (index 0)
      if (newShuffled.length > 0) {
        // Calling playSong will reset isPlaybackFinished to false inside the context
        playSong(newShuffled[0], 0, newShuffled, playlist.id);
      }
    }
  }, [
    isPlaybackFinished,
    isShuffling,
    songs,
    isThisPlaylistActive,
    playlist?.id,
    playSong,
  ]);

  // Fetch Playlist/Songs (omitted for brevity)
  useEffect(() => {
    if (!id) {
      setErr("Invalid Playlist ID");
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      try {
        const { data: playlistData, error: playlistError } = await supabase
          .from("playlists")
          .select("id, name, description, image_url, created_by, created_at")
          .eq("id", id)
          .single();

        if (playlistError) throw playlistError;
        setPlaylist(playlistData);

        const { data: playlistSongs, error: songsErr } = await supabase
          .from("playlist_songs")
          .select(
            `
                id,
                song:song_id (
                    id,
                    title,
                    cover_url,
                    audio_url,
                    duration,
                    artist_name
                )
                `
          )
          .eq("playlist_id", id);

        if (songsErr) throw songsErr;

        const extracted = (playlistSongs || []).map((row) => ({
          ...row.song,
          artist_name: row?.song?.artist_name || "Unknown Artist",
        }));

        setSongs(extracted);
      } catch (e) {
        console.error("Fetch error:", e);
        setErr("Failed loading playlist: " + (e.message || e));
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id]);

  const totalDurationSeconds = useMemo(() => {
    return songs.reduce((total, song) => total + (song.duration || 0), 0);
  }, [songs]);
  const formatPlaylistDuration = (totalSeconds) => {
    if (!totalSeconds) return "0 min";

    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);

    if (hours > 0) {
      return `${hours} hr ${minutes} min`;
    }
    return `${minutes} min`;
  };

  // Cover upload/generation helpers (omitted for brevity)
  const generatePlaylistCover = async () => {
    /* ... */
  };
  const handleImageUpload = async (e) => {
    /* ... */
  };
  const triggerFileInput = () => fileInputRef.current?.click();

  const formatDuration = (sec) => {
    if (!sec) return "--:--";
    const m = Math.floor(sec / 60);
    const s = (sec % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  // Header Content (omitted for brevity)
  const HeaderContent = useMemo(() => {
    return (
      <>
        {/* FIXED TOP BAR (Small Header) */}
        <div
          className={`fixed top-0 left-0 right-0 z-[100] p-4 transition-all duration-300 flex items-center h-20`}
          style={{
            backgroundColor: bgColor,
            boxShadow: showFixedHeader ? "0 6px 18px rgba(0,0,0,0.45)" : "none",
            backdropFilter: showFixedHeader
              ? "saturate(120%) blur(6px)"
              : "none",
          }}
        >
          <div className="flex justify-between w-full items-center">
            <div className="flex items-center gap-3">
              <a href="/music" className="text-white hover:text-[#fa4565]">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                  className="w-6 h-6"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M15.75 19.5L8.25 12l7.5-7.5"
                  />
                </svg>
              </a>
            </div>

            <div className="flex items-center gap-4">
              <button className="text-gray-400 hover:text-[#fa4565] hidden md:inline-flex">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                  className="w-5 h-5"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"
                  />
                </svg>
              </button>
              <div className="w-6" />
            </div>
          </div>

          {/* Collapsed Playlist Title - Centered */}
          <h2
            className="text-xl font-bold truncate absolute left-1/2 -translate-x-1/2 transition-opacity duration-200 w-1/2 text-center px-2"
            style={{ opacity: smallTitleOpacity }}
            aria-hidden={smallTitleOpacity < 0.05}
          >
            {playlist?.name || "Playlist"}
          </h2>
        </div>

        {/* COLLAPSING MAIN HEADER */}
        <header
          className="absolute inset-0 z-20 pt-20 pb-8 px-6 sm:px-8 flex items-end transition-colors"
          style={{
            height: HEADER_HEIGHT_PX,
            backgroundImage: `linear-gradient(to bottom, ${bgColor} ${Math.round(
              headerOpacity * 80
            )}%, ${listAreaBg} 100%)`,
            transform: `translateY(${parallaxTranslate}px)`,
          }}
        >
          {/* Cover Image */}
          <div className="relative group">
            <div
              onClick={() => setIsModalOpen(true)}
              className="w-44 h-44 sm:w-52 sm:h-52 rounded-md object-cover shadow-2xl cursor-pointer hover:scale-[1.03] transition-transform duration-300"
              title="Click to change playlist cover"
            >
              <img
                loading="lazy"
                src={coverUrl}
                alt={`${playlist?.name} Cover`}
                className="w-full h-full rounded-md object-cover"
                crossOrigin="anonymous"
              />
            </div>
          </div>

          <div className="flex flex-col gap-2 flex-1 ml-5 sm:ml-6">
            <p className="text-sm font-light text-white">Playlist</p>
            <h1
              className="text-4xl sm:text-6xl md:text-8xl font-extrabold break-words leading-none"
              style={{
                opacity: largeTitleOpacity,
                transition: "opacity 120ms linear",
              }}
            >
              {playlist?.name}
            </h1>
            <p className="text-sm text-gray-300 mt-2">
              {songs.length} {songs.length === 1 ? "song" : "songs"} • { " "}
              {formatPlaylistDuration(totalDurationSeconds)}
            </p>
          </div>
        </header>
      </>
    );
  }, [
    playlist,
    songs.length,
    bgColor,
    coverUrl,
    smallTitleOpacity,
    largeTitleOpacity,
    headerOpacity,
    showFixedHeader,
    parallaxTranslate,
  ]);

  // ---------------- LIST VIEW UI ----------------
  const ListView = useMemo(
    () => (
      <div className="rounded-xl shadow-2xl overflow-visible">
        {/* STICKY TABLE HEADER */}
        <div
          className="grid grid-cols-[32px_1fr_32px] md:grid-cols-[32px_5fr_3fr_1fr] text-gray-400 text-[10px] md:text-xs uppercase font-light border-b border-[#222] py-2 md:py-3 px-4 md:px-8 sticky z-30 bg-[#1a1a1a]"
          style={{ top: FIXED_TOP_BAR_HEIGHT + ACTION_ROW_HEIGHT }}
        >
          <Hash className="w-4 h-4" />
          <div>Title</div>
          <div className="hidden md:block">Artist</div>
          <Clock className="w-4 h-4 justify-self-end mr-2" />
        </div>

        {/* Song Rows - Iterates over playableSongs */}
        <div className="pb-40 bg-[#1a1a1a]">
          {playableSongs.map((song, i) => {
            // Only show active/equalizer if this song is playing AND it belongs to this playlist
            const isActive = isThisPlaylistActive && currentSongId === song.id;

            return (
              <div
                key={song.id}
                ref={isActive ? activeSongRef : null}
                onClick={() => handlePlaySong(song)}
                className={`grid grid-cols-[32px_1fr_32px] md:grid-cols-[32px_5fr_3fr_1fr] items-center py-2 md:py-3 px-4 md:px-8 group cursor-pointer border-b border-[#1b1b1b] transition-all duration-200 select-none ${
                  isActive
                    ? "text-[#fa4565] font-semibold"
                    : "text-gray-300 hover:text-[#fa4565]"
                }`}
              >
                {/* Play Button / Number */}
                <div className="relative flex items-center justify-center w-4 h-4 group">
                  {!isActive ? (
                    <>
                      <span className="transition-all duration-200 group-hover:opacity-0 group-hover:scale-0">
                        {i + 1}
                      </span>
                      <Play className="w-4 h-4 absolute opacity-0 fill-[#fa4565] scale-0 transition-all duration-200 group-hover:opacity-100 group-hover:scale-100" />
                    </>
                  ) : (
                    // Equalizer/playing indicator (Active)
                    <div className="flex gap-[2px] transform rotate-180">
                      {[1, 2, 3].map((bar) => (
                        <div
                          key={bar}
                          className="w-[3px] bg-[#fa4565] animate-equalizer rounded-full"
                          style={{ animationDelay: `${bar * 0.1}s` }}
                        />
                      ))}
                    </div>
                  )}
                </div>

                {/* Song Info */}
                <div className="flex items-center gap-3">
                  <img
                    loading="lazy"
                    src={song.cover_url}
                    alt={song.title}
                    className="w-12 h-12 object-cover rounded-md shadow-lg"
                  />
                  <div className="truncate">
                    <p className="truncate">{song.title}</p>
                    <p className="text-sm text-gray-400 truncate">
                      {song.artist_name}
                    </p>
                  </div>
                </div>

                {/* Artist */}
                <div className="hidden md:block text-sm text-gray-400 truncate">
                  {song.artist_name}
                </div>

                {/* Duration */}
                <div className="text-sm text-gray-400 justify-self-end">
                  {formatDuration(song.duration)}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    ),
    [playableSongs, currentSongId, handlePlaySong, isThisPlaylistActive]
  );

  // Error and Loading States
  if (loading || loadingColor)
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="circle-loader"></div>
      </div>
    );

  if (err) return <div className="p-10 text-red-600">{err}</div>;

  // 10. MAIN RENDER
  return (
    <main
      ref={mainScrollRef}
      className="flex-1 overflow-y-auto custom-scroll text-white bg-[#1a1a1a] relative min-h-screen"
    >
      {/* 1. FIXED/COLLAPSIBLE HEADER */}
      {HeaderContent}
      {/* 2. HEADER SPACER */}
      <div style={{ height: HEADER_HEIGHT_PX }} />
      {/* STICKY ACTION ROW */}
      <div
        className="sticky z-40 transition-all duration-300"
        style={{
          top: `${FIXED_TOP_BAR_HEIGHT}px`,
          backgroundColor: listAreaBg,
          boxShadow: showFixedHeader ? "0 8px 24px rgba(0,0,0,0.45)" : "none",
        }}
      >
        <div className="p-4 md:p-8 flex items-center justify-between h-[96px]">
          {/* Main Play/Pause Button - ⭐️ SYNCS GLOBALLY */}
          <button
            onClick={handlePlayAll}
            className="bg-[#fa4565] rounded-full w-14 h-14 flex items-center justify-center shadow-2xl hover:scale-105 transition-transform"
            title={isGloballyPlaying ? "Pause Playback" : "Play Playlist"}
          >
            {isGloballyPlaying ? (
              <Pause className="w-8 h-8 fill-white" />
            ) : (
              <Play className="w-8 h-8 fill-white ml-0.5" />
            )}
          </button>

          <div className="flex gap-4 items-center">
            {/* SHUFFLE TOGGLE BUTTON */}
            <button
              onClick={handleToggleShuffle}
              className={`p-2 transition-colors ${
                isShuffling
                  ? "text-[#fa4565] hover:text-[#f8657f] scale-110" // Active style
                  : "text-gray-400 hover:text-white" // Inactive style
              }`}
              title={isShuffling ? "Turn Shuffle Off" : "Turn Shuffle On"}
            >
              <Shuffle className="w-6 h-6" />
            </button>

            {/* Save Button (unchanged) */}
            <button
              className="text-gray-400 hover:text-white transition-colors p-2"
              title="Save to your library"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                className="w-6 h-6"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.05-4.312 2.52-1.928-1.47-3.593-2.52-5.32-2.52C4.1 3.75 2 5.765 2 8.25c0 7.22 8.8 12 10 12s10-4.78 10-12z"
                />
              </svg>
            </button>

            {/* More Options Button (unchanged) */}
            <button
              className="text-gray-400 hover:text-white transition-colors p-2"
              title="More options"
            >
              <MoreHorizontal className="w-6 h-6" />
            </button>
          </div>
        </div>
      </div>
      -{/* SONG LIST */}
      <div className="py-6">{ListView}</div>
      {/* MODAL (omitted for brevity) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="bg-[#1e1e1e] p-6 rounded-xl shadow-2xl max-w-lg w-full m-4">
            <div className="flex justify-between items-center mb-4 border-b border-[#333] pb-3">
              <h2 className="text-xl font-bold">Change Playlist Cover</h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-gray-400 hover:text-white p-1"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-6">
              {/* Manual Upload */}
              <div className="p-4 bg-[#282828] rounded-lg border border-[#333]">
                <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
                  <Upload className="w-5 h-5 text-[#fa4565]" />
                  Upload Custom Image
                </h3>
                <p className="text-sm text-gray-400 mb-3">
                  Select a file from your device to set as the playlist cover.
                </p>
                <button
                  onClick={triggerFileInput}
                  disabled={uploadingCover || generatingCover}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-gray-600 hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {uploadingCover ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Image className="w-4 h-4" />
                      Choose File
                    </>
                  )}
                </button>
                <input
                  type="file"
                  accept="image/*"
                  ref={fileInputRef}
                  onChange={handleImageUpload}
                  style={{ display: "none" }}
                  disabled={uploadingCover}
                />
              </div>

              {/* AI Generation */}
              {songs.length > 0 && (
                <div className="p-4 bg-[#282828] rounded-lg border border-[#333]">
                  <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
                    <RefreshCw className="w-5 h-5 text-[#fa4565]" />
                    Generate from Songs
                  </h3>
                  <p className="text-sm text-gray-400 mb-3">
                    Use the titles and artists from your{" "}
                    <strong>{songs.length}</strong> songs to generate a unique
                    cover art (requires server-side AI).
                  </p>
                  <button
                    onClick={generatePlaylistCover}
                    disabled={generatingCover || uploadingCover}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-[#fa4565] hover:bg-[#e03a58] rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {generatingCover ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Image className="w-4 h-4" />
                        Generate Cover
                      </>
                    )}
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

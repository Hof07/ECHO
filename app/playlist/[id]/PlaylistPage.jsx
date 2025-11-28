"use client";

import { useParams } from "next/navigation";
import { useEffect, useState, useMemo, useRef, useCallback } from "react";
// Ensure this path is correct for your Supabase client setup
import { supabase } from "@/app/lib/supabaseClient";
import { Clock, Play, Hash, Image, RefreshCw, Upload, X, MoreHorizontal } from "lucide-react"; 
import { usePlayer } from "@/app/music/context/PlayerContext";
// 1. Import color-thief-react
import { useColor } from "color-thief-react";

// --- CONSTANTS ---
const COVER_BUCKET = "covers";
const HEADER_HEIGHT_PX = 320; // Max height of the cover area (height of the large header)
const FIXED_TOP_BAR_HEIGHT = 80; // Height of the small collapsed header (h-20)
const ACTION_ROW_HEIGHT = 96; // Height of the p-8 action row
// -----------------

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
  const [scrollOffset, setScrollOffset] = useState(0); // Tracks scroll position

  const activeSongRef = useRef(null);
  const fileInputRef = useRef(null);
  const mainScrollRef = useRef(null); // Ref for the main scrollable area
  const { playSong, currentSongId } = usePlayer();

  // 2. Get dominant color from the playlist image
  const coverUrl = playlist?.image_url || "/placeholder.png";
  const { data: dominantColor, loading: loadingColor } = useColor(coverUrl, "hex", { crossOrigin: "anonymous" });
  
  const bgColor = dominantColor || '#2c2c2c'; 
  const listAreaBg = '#1a1a1a'; // A darker color for the list area

  // 3. Scroll handler setup
  const handleScroll = useCallback(() => {
    if (mainScrollRef.current) {
      setScrollOffset(mainScrollRef.current.scrollTop);
    }
  }, []);

  useEffect(() => {
    const element = mainScrollRef.current;
    if (element) {
      element.addEventListener('scroll', handleScroll);
      return () => element.removeEventListener('scroll', handleScroll);
    }
  }, [handleScroll]);

  
  // 🟢 CALCULATE VISIBILITY VARIABLES 
  // Parallax: Moves the header content up at a slower rate than the scroll
  const parallaxTranslate = useMemo(() => Math.min(0, -scrollOffset * 0.8), [scrollOffset]);
  
  // showFixedHeader: True when the main header has scrolled mostly past the view
  const showFixedHeader = useMemo(() => scrollOffset > (HEADER_HEIGHT_PX - FIXED_TOP_BAR_HEIGHT), [scrollOffset]);
  
  // largeTitleOpacity: Fades OUT the large header title as we scroll down (0% to 100% scroll)
  const largeTitleOpacity = useMemo(() => 
    Math.min(1, Math.max(0, (HEADER_HEIGHT_PX - scrollOffset) / HEADER_HEIGHT_PX))
  , [scrollOffset]);

  // smallTitleOpacity: Fades IN the small fixed title starting earlier (40% to 60%)
  const smallTitleOpacity = useMemo(() => 
    // START FADE-IN EARLIER: Starts at 40% and finishes at 60% of the header scroll
    Math.min(1, Math.max(0, (scrollOffset - (HEADER_HEIGHT_PX * 0.4)) / (HEADER_HEIGHT_PX * 0.2)))
  , [scrollOffset]);
  
  // headerOpacity: Fades out the main header background
  const headerOpacity = useMemo(() => 
    Math.max(0.1, 1 - (scrollOffset / HEADER_HEIGHT_PX) * 1.5), // Fade out faster
  [scrollOffset]);
  // -------------------------------------------------------------------------

  // 🟢 Fetch playlist + songs 
  useEffect(() => {
    if (!id) {
      setErr("Invalid Playlist ID");
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      try {
        // Playlist info
        const { data: playlistData, error: playlistError } = await supabase
          .from("playlists")
          .select("*, name, description") 
          .eq("id", id)
          .single();

        if (playlistError) throw playlistError;

        setPlaylist(playlistData);

        // Songs inside playlist 
        const { data: playlistSongs, error: songsErr } = await supabase
          .from("playlist_songs")
          .select(
            `
              song:songs (
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

        const extracted = playlistSongs.map((row) => ({
          ...row.song,
          artist_name: row.song.artist_name || "Unknown Artist",
        }));

        setSongs(extracted);
      } catch (e) {
        console.error("Fetch error:", e);
        setErr("Failed loading playlist: " + e.message);
      }

      setLoading(false);
    };

    fetchData();
  }, [id]);

  // 🟢 Generate playlist cover from songs
  const generatePlaylistCover = async () => {
    if (!playlist?.id) return;
    setGeneratingCover(true);
    try {
      const response = await fetch("/api/generate-playlist-cover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playlistId: playlist.id }),
      });
      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        const text = await response.text();
        console.error("Non-JSON response:", text.substring(0, 200));
        throw new Error("Server returned an error page. Check AI API route.");
      }
      const result = await response.json();
      if (!response.ok) {
        throw new Error(
          result.error || `HTTP error! status: ${response.status}`
        );
      }
      setPlaylist((prev) => ({
        ...prev,
        image_url: result.url + "?t=" + Date.now(), // Cache bust
      }));
      alert("Playlist cover generated successfully!");
      setIsModalOpen(false);
    } catch (error) {
      console.error("Error generating cover:", error);
      alert(`Error generating cover: ${error.message}`);
    } finally {
      setGeneratingCover(false);
    }
  };

  // 🟢 Handle manual cover upload
  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !playlist?.id) return;
    if (!file.type.startsWith("image/")) {
      alert("Please select a valid image file.");
      return;
    }
    setUploadingCover(true);
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${playlist.id}/${playlist.id}-${Date.now()}.${fileExt}`;
      const filePath = `${playlist.id}/${fileName}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from(COVER_BUCKET)
        .upload(filePath, file, {
          cacheControl: "3600",
          upsert: true,
        });
      if (uploadError) {
        throw new Error(
          `Upload Failed: ${uploadError.message}. Check Storage RLS Policy on '${COVER_BUCKET}' bucket.`
        );
      }
      const { data: publicUrlData } = supabase.storage
        .from(COVER_BUCKET)
        .getPublicUrl(filePath);
      const newImageUrl = publicUrlData.publicUrl;
      const { error: updateError } = await supabase
        .from("playlists")
        .update({ image_url: newImageUrl })
        .eq("id", playlist.id);
      if (updateError) {
        throw new Error(
          `Database Update Failed: ${updateError.message}. Check 'playlists' Table RLS Policy.`
        );
      }
      setPlaylist((prev) => ({
        ...prev,
        image_url: newImageUrl,
      }));
      alert("Cover uploaded successfully!");
      setIsModalOpen(false);
    } catch (error) {
      console.error("Error during cover upload:", error);
      alert("Failed to upload cover image. Error: " + error.message);
    } finally {
      setUploadingCover(false);
      e.target.value = null;
    }
  };

  // 🟢 Utility Functions
  const triggerFileInput = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handlePlay = useCallback(
    (song, i) => {
      playSong(song, i, songs);
    },
    [songs, playSong]
  );

  const formatDuration = (sec) => {
    if (!sec) return "--:--";
    const m = Math.floor(sec / 60);
    const s = (sec % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };


  // 4. 🎨 Collapsible Header Component 
  const HeaderContent = useMemo(() => {
    
    return (
      <>
        {/* -------------------- 🆕 FIXED TOP BAR (Small Header) -------------------- */}
        {/* This bar is always sticky and uses the dominant color */}
        <div 
          className="fixed top-0 left-0 right-0 z-[100] p-4 transition-all duration-300 flex items-center h-20"
          style={{ 
            backgroundColor: bgColor,
            // Show shadow only after the main header is scrolled past
            boxShadow: showFixedHeader ? '0 4px 6px rgba(0,0,0,0.5)' : 'none',
          }}
        >
          {/* Back/Sort Icons */}
          <div className="flex justify-between w-full">
            <button className="text-white hover:text-[#fa4565]">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                </svg>
            </button>
            <div className="flex items-center gap-4">
                <button className="text-white hover:text-[#fa4565]">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                    </svg>
                </button>
                <div className="w-6"></div> 
            </div>
          </div>
          
          {/* Collapsed Playlist Title - Centered over the content */}
          <h2 
            className="text-xl font-bold truncate absolute left-1/2 -translate-x-1/2 transition-opacity duration-300 w-1/3 text-center"
            // Uses smallTitleOpacity for the smooth fade-in animation
            style={{ opacity: smallTitleOpacity }}
          >
            {playlist?.name || 'Playlist'}
          </h2>
        </div>


        {/* -------------------- 🆕 COLLAPSING MAIN HEADER -------------------- */}
        <header
          className="absolute inset-0 z-20 pt-20 pb-8 px-8 flex items-end transition-colors"
          style={{ 
            height: HEADER_HEIGHT_PX,
            // Use the dominant color and apply the opacity/gradient based on scroll
            backgroundImage: `linear-gradient(to bottom, ${bgColor} ${headerOpacity * 100}%, ${listAreaBg} 100%)`,
            // Apply parallax scroll effect
            transform: `translateY(${parallaxTranslate}px)`,
          }}
        >
          {/* Cover Image */}
          <div className="relative group">
            <div
              onClick={() => setIsModalOpen(true)}
              className="w-52 h-52 rounded-md object-cover shadow-2xl cursor-pointer hover:scale-[1.03] transition-all duration-300"
              title="Click to change playlist cover"
            >
              <img
                src={coverUrl}
                alt={`${playlist?.name} Cover`}
                className="w-full h-full rounded-md object-cover"
                crossOrigin="anonymous"
              />
            </div>
          </div>

          <div className="flex flex-col gap-2 flex-1 ml-6">
            <p className="text-sm font-light text-white">Playlist</p>
            {/* Large title fades out */}
            <h1 
              className="text-5xl md:text-8xl font-extrabold break-words leading-none"
              // The large title fades OUT smoothly as the small one fades IN
              style={{ opacity: largeTitleOpacity }}
            >
              {playlist?.name}
            </h1>
            <p className="text-sm text-gray-300 mt-2">
              {songs.length} {songs.length === 1 ? "song" : "songs"}
            </p>
          </div>
        </header>
      </>
    );
  }, [playlist, songs.length, scrollOffset, bgColor, coverUrl, showFixedHeader, parallaxTranslate, largeTitleOpacity, smallTitleOpacity, headerOpacity, listAreaBg]);
  

  // 5. 🎨 LIST VIEW TABLE UI 
  const ListView = useMemo(
    () => (
      <div className="rounded-xl shadow-2xl overflow-visible">
        
        {/* 🆕 STICKY TABLE HEADER */}
        {/* This sticks right below the Fixed Top Bar (80px) + Action Row (96px) = 176px */}
        <div 
          className="grid grid-cols-[32px_1fr_32px]
              md:grid-cols-[32px_5fr_3fr_1fr]
              text-gray-400 text-[10px] md:text-xs uppercase font-light
              border-b border-[#222] py-2 md:py-3 px-8 sticky z-30 bg-[#1a1a1a] transition-all duration-300"
          style={{ top: FIXED_TOP_BAR_HEIGHT + ACTION_ROW_HEIGHT }} 
        >
          <Hash className="w-4 h-4" />
          <div>Title</div>
          <div className="hidden md:block">Artist</div>
          <Clock className="w-4 h-4 justify-self-end mr-2" />
        </div>
        
        {/* Song Rows */}
        <div className="pb-40 bg-[#1a1a1a]">
          {songs.map((song, i) => {
            const isActive = currentSongId === song.id;
            return (
              <div
                key={song.id}
                ref={isActive ? activeSongRef : null}
                onClick={() => handlePlay(song, i)}
                className={`grid grid-cols-[32px_1fr_32px]
                  md:grid-cols-[32px_5fr_3fr_1fr]
                  items-center py-2 md:py-3 px-8 group cursor-pointer border-b border-[#1b1b1b]
                  transition-all duration-200 select-none ${
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
                      <Play
                        className="w-4 h-4 absolute opacity-0 fill-[#fa4565] scale-0 transition-all duration-200
                          group-hover:opacity-100 group-hover:scale-100"
                      />
                    </>
                  ) : (
                    <div className="flex gap-[2px] transform rotate-180">
                      {[1, 2, 3].map((bar) => (
                        <div
                          key={bar}
                          className="w-[3px] bg-[#fa4565] animate-equalizer rounded-full"
                          style={{ animationDelay: `${bar * 0.1}s` }}
                        ></div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Song Info */}
                <div className="flex items-center gap-3">
                  <img
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
    [songs, currentSongId, handlePlay] 
  );

  // 2. ERROR AND LOADING STATES 
  if (loading || loadingColor) return <div className="p-10 text-white">Loading...</div>;
  if (err) return <div className="p-10 text-red-600">{err}</div>;


  // 6. MAIN COMPONENT RENDER
  return (
    <main 
      ref={mainScrollRef}
      className="flex-1 overflow-y-auto custom-scroll text-white bg-[#1a1a1a] relative"
    >
      
      {/* 1. FIXED/COLLAPSIBLE HEADER */}
      {HeaderContent}

      {/* 2. HEADER SPACER/PLACEHOLDER: This MUST match the full height of the CollapsibleHeaderContent to enable scroll */}
      <div style={{ height: HEADER_HEIGHT_PX }}></div>

      {/* 🆕 STICKY ACTION ROW (Play Button, etc.) */}
      <div 
        className="sticky z-40 transition-all duration-300"
        style={{ 
          // CRITICAL: This sticks right below the Fixed Top Bar (80px)
          top: `${FIXED_TOP_BAR_HEIGHT}px`, 
          backgroundColor: listAreaBg, 
          // Shadow appears only after main header is scrolled past (Spotify-like behavior)
          boxShadow: showFixedHeader ? '0 4px 6px rgba(0,0,0,0.5)' : 'none',
        }}
      >
        <div className="p-4 md:p-8 flex items-center justify-between h-[96px]"> {/* Explicit height for action row */}
          <button
            onClick={() => handlePlay(songs[0], 0)} // Play first song
            className="bg-[#fa4565] rounded-full w-14 h-14 flex items-center justify-center shadow-2xl hover:scale-105 transition-transform"
            title="Play Playlist"
          >
            <Play className="w-8 h-8 fill-white ml-0.5" />
          </button>
          
          <div className="flex gap-4 items-center">
            {/* Add a Like/Save button */}
            <button className="text-gray-400 hover:text-white transition-colors p-2" title="Save to your library">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.05-4.312 2.52-1.928-1.47-3.593-2.52-5.32-2.52C4.1 3.75 2 5.765 2 8.25c0 7.22 8.8 12 10 12s10-4.78 10-12z" />
                </svg>
            </button>
            {/* Add a menu button */}
            <button className="text-gray-400 hover:text-white transition-colors p-2" title="More options">
                <MoreHorizontal className="w-6 h-6" />
            </button>
          </div>
        </div>
      </div>
      
      {/* 3. SONG LIST */}
      {ListView}
      
      {/* 4. MODAL */}
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
              {/* 1. Manual Upload Section */}
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
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-gray-600 
                              hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
                {/* Hidden File Input */}
                <input
                  type="file"
                  accept="image/*"
                  ref={fileInputRef}
                  onChange={handleImageUpload}
                  style={{ display: "none" }}
                  disabled={uploadingCover}
                />
              </div>

              {/* 2. AI Generation Section */}
              {songs.length > 0 && (
                <div className="p-4 bg-[#282828] rounded-lg border border-[#333]">
                  <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
                    <RefreshCw className="w-5 h-5 text-[#fa4565]" />
                    Generate from Songs
                  </h3>
                  <p className="text-sm text-gray-400 mb-3">
                    Use the titles and artists from your **{songs.length}**
                    songs to generate a unique cover art (requires server-side
                    AI).
                  </p>
                  <button
                    onClick={generatePlaylistCover}
                    disabled={generatingCover || uploadingCover}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-[#fa4565] 
                              hover:bg-[#e03a58] rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
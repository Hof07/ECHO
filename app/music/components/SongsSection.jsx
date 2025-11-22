"use client";

import { useEffect, useState, useRef } from "react";
import { usePlayer } from "../context/PlayerContext";
import { Play, Music2, Clock, Hash, List, Grid, Shuffle } from "lucide-react";
import { supabase } from "@/app/lib/supabaseClient";

export default function SongsSection() {
  const [songs, setSongs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isListView, setIsListView] = useState(true);
  const [isMounted, setIsMounted] = useState(false);
  const { playSong, currentSong } = usePlayer();
  
  const activeSongRef = useRef(null);

  // --- CRITICAL FIX: Ensure full client mount before rendering complex UI ---
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // --- Data Fetching ---
  useEffect(() => {
    const fetchSongs = async () => {
      setIsLoading(true);

      const { data, error } = await supabase
        .from("songs")
        .select(
          `
            id,
            title,
            cover_url,
            duration,
            audio_url,
            artist_name
          `
        )
        .order("id", { ascending: true });

      if (!error && data) setSongs(data);
      else console.error("Supabase Error:", error);

      setIsLoading(false);
    };

    fetchSongs();
  }, []);

  // --- FIX: Auto-Scroll to Active Song ---
  useEffect(() => {
    // This ensures the active song is visible and prevents scroll jump on play
    if (currentSong && activeSongRef.current) {
      activeSongRef.current.scrollIntoView({
        behavior: "smooth",
        block: "nearest", 
      });
    }
  }, [currentSong, isMounted]);

  // --- Handler & Formatters ---
  const handlePlay = (song, index) => {
    playSong(song, index, songs);
  };

  const formatDuration = (seconds) => {
    if (!seconds || isNaN(seconds)) return "0:00";
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60)
      .toString()
      .padStart(2, "0");
    return `${m}:${s}`;
  };

  const stuffle = () => {
    console.log("Shuffling playlist...");
  };

  // --- Components for List and Card Views ---

  const ListView = () => (
    <div className="bg-[#121212] rounded-xl shadow-2xl overflow-hidden">
      {/* List Header Row (Sticky) */}
      <div className="grid grid-cols-[16px_4fr_3fr_1fr] md:grid-cols-[16px_5fr_3fr_1fr_1fr] text-gray-400 text-xs uppercase font-light border-b border-[#222] py-3 px-4 sticky top-0 bg-[#121212] z-10">
        <Hash className="w-4 h-4" />
        <div className="col-span-1">Title</div>
        <div className="hidden md:block col-span-1">Artist</div>
        <div className="hidden md:block col-span-1"></div>
        <Clock className="w-4 h-4 justify-self-end mr-2" />
      </div>

      {/* Scrollable Song Items - FIX: pb-40 ensures list clears the fixed player bar */}
      <div className={`max-h-[75vh] overflow-y-scroll scrollbar-thin scrollbar-thumb-[#fa4565]/50 scrollbar-track-transparent ${currentSong ? 'pb-40' : 'pb-8'}`}>
        {songs.map((song, i) => {
          const isActive = currentSong?.id === song.id;
          return (
            <div
              key={song.id}
              ref={isActive ? activeSongRef : null} 
              className={`
                grid grid-cols-[16px_4fr_3fr_1fr] md:grid-cols-[16px_5fr_3fr_1fr_1fr] 
                items-center py-2 px-4 group transition-all duration-200 border-b border-[#1b1b1b]
                cursor-pointer 
                ${isActive 
                  ? "bg-[#fa4565]/20 text-[#fa4565] font-semibold hover:bg-[#fa4565]/30" 
                  : "text-gray-200 hover:bg-[#1b1b1b]"
                }
              `}
              onClick={() => handlePlay(song, i)}
            >
              {/* 1. Index/Play Icon */}
              <div className="text-sm transition duration-150 relative">
                <span
                  className={`transition-opacity duration-150 flex items-center
                    /* FIX: pointer-events-none prevents the hover blink on active song */
                    ${isActive ? "opacity-100 pointer-events-none" : "group-hover:opacity-0"}`}
                >
                  {isActive ? (
                    <Play className="w-4 h-4 fill-[#fa4565] relative right-[8px]" />
                  ) : (
                    i + 1
                  )}
                </span>

                {/* Hover Play Icon - Only visible on hover AND if NOT active */}
                <Play 
                  className={`w-4 h-4 fill-white absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 transition-opacity duration-150
                    ${!isActive && 'group-hover:opacity-100'} 
                    ${isActive || 'opacity-0'}
                    `}
                />
              </div>

              {/* 2. Title & Cover */}
              <div className="flex items-center gap-3">
                <img
                  src={song.cover_url}
                  className="w-12 h-12 object-cover rounded-md shadow-lg"
                  alt={song.title}
                />
                <div className="truncate">
                  <p
                    className={`text-base truncate ${
                      isActive ? "text-white" : "text-white"
                    }`}
                  >
                    {song.title}
                  </p>
                  <p className="text-sm text-gray-400 group-hover:text-gray-300 transition duration-150">
                    {song.artist_name || "Unknown Artist"}
                  </p>
                </div>
              </div>

              {/* 3. Artist */}
              <div className="hidden md:block text-sm text-gray-400 truncate">
                {song.artist_name || "Various"}
              </div>

              {/* 4. Explicit Tag */}
              <div className="hidden md:block text-xs text-gray-500">
                {song.explicit && (
                  <span className="bg-gray-700/50 text-gray-300 px-1 py-0.5 rounded-sm font-bold">
                    E
                  </span>
                )}
              </div>

              {/* 5. Duration */}
              <div className="text-sm text-gray-400 justify-self-end">
                <span>{formatDuration(song.duration)}</span>
              </div>
            </div>
          );
        })}
        {/* Visual Fix: Empty spacer div for clean visual break at the bottom */}
        <div className="h-4 sm:h-8"></div> 
      </div>
    </div>
  );

  const CardView = () => (
    /* FIX: pb-40 ensures list clears the fixed player bar in Grid View */
    <div className={`grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6 max-h-[75vh] overflow-y-auto scrollbar-thin scrollbar-thumb-[#fa4565]/50 scrollbar-track-transparent ${currentSong ? 'pb-40' : 'pb-8'}`}>
      {songs.map((song, i) => {
        const isActive = currentSong?.id === song.id;
        return (
          <div
            key={song.id}
            className={`group p-4 rounded-xl cursor-pointer shadow-2xl relative overflow-hidden transition-all duration-300
              /* FIX for Blink: Conditional Hover/Active Styling */
              ${isActive
                ? "bg-[#fa4565]/20 ring-2 ring-[#fa4565] hover:bg-[#fa4565]/30 hover:-translate-y-1"
                : "bg-[#121212] hover:bg-[#1b1b1b] hover:-translate-y-1"
              }`}
            onClick={() => handlePlay(song, i)}
          >
            <div className="relative">
              <img
                src={song.cover_url}
                className="w-full aspect-square object-cover rounded-lg shadow-xl"
                alt={song.title}
              />

              {/* Play Button Overlay */}
              <div
                /* FIX for Blink: Conditional visibility */
                className={`absolute bottom-2 right-2 w-12 h-12 rounded-full
                  bg-[#fa4565] flex items-center
                  justify-center transition-all duration-300 shadow-md group-hover:bottom-4 group-hover:right-4
                  ${isActive 
                    ? "opacity-100 bottom-4 right-4" 
                    : "opacity-0 group-hover:opacity-100"
                  }`}
              >
                <Play className="w-6 h-6 text-white fill-white" />
              </div>
            </div>
            <div className="mt-4">
              <p className={`font-bold text-base truncate ${isActive ? "text-[#fa4565]" : "text-white"}`}>{song.title}</p>
              <p className="text-sm text-gray-400 mt-0.5">
                {song.artist_name || "Unknown Artist"}
              </p>
              <div className="flex items-center gap-2 mt-1 text-gray-500 text-xs">
                {song.explicit && (
                  <span className="bg-gray-700/50 text-gray-300 px-1 py-0.5 rounded-sm font-bold">
                    E
                  </span>
                )}
                <Clock className="w-3 h-3" />
                <span>{formatDuration(song.duration)}</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );


  // --- Render ---

  return (
    <div className="w-[75%] mx-auto pt-8 pb-10 text-white">
      {/* Header and Toggle Button */}
      <div className="flex items-center justify-between mb-6 p-2">
        <div className="flex items-center gap-2">
          <Music2 className="w-7 h-7 text-[#fa4565]" />
          <h2 className="text-3xl font-extrabold tracking-tight">
            Top Hits & Trending
          </h2>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setIsListView(true)}
            className={`p-2 rounded-full transition-colors ${
              isListView
                ? "bg-[#fa4565] text-white shadow-lg"
                : "text-gray-400 hover:bg-[#1b1b1b]"
            }`}
            title="Switch to List View"
            disabled={!isMounted}
          >
            <List className="w-5 h-5" />
          </button>
          <button
            onClick={() => setIsListView(false)}
            className={`p-2 rounded-full transition-colors ${
              !isListView
                ? "bg-[#fa4565] text-white shadow-lg"
                : "text-gray-400 hover:bg-[#1b1b1b]"
            }`}
            title="Switch to Grid View"
            disabled={!isMounted}
          >
            <Grid className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Conditional Rendering */}
      {!isMounted || isLoading ? (
        <div className="text-center py-20 text-gray-500 bg-[#121212] rounded-xl shadow-2xl">
          <p className="flex items-center justify-center gap-2">
            <svg
              className={`h-5 w-5 text-[#fa4565] ${
                isMounted ? "animate-spin" : ""
              }`}
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              ></circle>
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
            {isLoading
              ? "Loading music from the server..."
              : "Initializing UI..."}
          </p>
        </div>
      ) : songs.length > 0 ? (
        // Actual Content
        isListView ? (
          <div>
            <ListView />
            <button
              onClick={stuffle}
              className={`fixed right-6 bg-[#fa4565] text-white p-4 rounded-full shadow-xl 
                hover:scale-105 active:scale-95 transition z-50
                ${currentSong ? "bottom-[100px]" : "bottom-6"} 
              `}
              title="Shuffle Play"
            >
              <Shuffle className="w-6 h-6" />
            </button>
          </div>
        ) : (
          <div>
            <CardView />
            <button
              onClick={stuffle}
              className={`fixed right-6 bg-[#fa4565] text-white p-4 rounded-full shadow-xl 
                hover:scale-105 active:scale-95 transition z-50
                ${currentSong ? "bottom-[100px]" : "bottom-6"} 
              `}
              title="Shuffle Play"
            >
              <Shuffle className="w-6 h-6" />
            </button>
          </div>
        )
      ) : (
        // No Songs Fallback
        <div className="text-center py-20 text-gray-500 bg-[#121212] rounded-xl shadow-2xl">
          <p>
            No songs found. Please check your Supabase connection and database
            rows.
          </p>
        </div>
      )}
    </div>
  );
}
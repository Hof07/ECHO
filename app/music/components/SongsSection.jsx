"use client";

import React, { useEffect, useState, useRef, useMemo } from "react";
import { usePlayer } from "../context/PlayerContext";
import { Play, Music2, Clock, Hash, List, Grid } from "lucide-react";
import { supabase } from "@/app/lib/supabaseClient";
import ShuffleButton from "./ShuffleButton";

function SongsSection() {
  const [songs, setSongs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isListView, setIsListView] = useState(true);

  const { playSong, currentSongId } = usePlayer();

  const activeSongRef = useRef(null);
  const previousSongId = useRef(null);

  useEffect(() => {
    const fetchSongs = async () => {
      setIsLoading(true);
      const { data, error } = await supabase
        .from("songs")
        .select("id,title,cover_url,duration,audio_url,artist_name")
        .eq("isOther", false);

      if (!error && data) {
        // --- LOCAL STORAGE SORTING LOGIC ---
        const stats = JSON.parse(localStorage.getItem("song_stats") || "{}");
        
        const sortedSongs = [...data].sort((a, b) => {
          const countA = stats[a.id] || 0;
          const countB = stats[b.id] || 0;
          // Sort by listen count (descending), then alphabetically by title
          if (countB !== countA) return countB - countA;
          return a.title.localeCompare(b.title);
        });

        setSongs(sortedSongs);
      }
      setIsLoading(false);
    };

    fetchSongs();
  }, []);

  // auto scroll when playing song changes
  useEffect(() => {
    if (currentSongId && previousSongId.current !== currentSongId) {
      previousSongId.current = currentSongId;
      activeSongRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }
  }, [currentSongId]);

  const handlePlay = (song, index) => {
    // --- UPDATE LISTEN COUNT ---
    const stats = JSON.parse(localStorage.getItem("song_stats") || "{}");
    stats[song.id] = (stats[song.id] || 0) + 1;
    localStorage.setItem("song_stats", JSON.stringify(stats));
    
    playSong(song, index, songs);
  };

  const formatDuration = (seconds) =>
    !seconds || isNaN(seconds)
      ? "0:00"
      : `${Math.floor(seconds / 60)}:${String(
          Math.floor(seconds % 60)
        ).padStart(2, "0")}`;

  /* ====== LIST VIEW ====== */
  const ListView = useMemo(
    () => () =>
      (
        <div className="bg-[#121212] rounded-xl shadow-2xl overflow-hidden">
          <div
            className="grid grid-cols-[32px_1fr_32px]
md:grid-cols-[32px_5fr_3fr_1fr_1fr]
text-gray-400 text-[10px] md:text-xs uppercase font-light
border-b border-[#222] py-2 md:py-3 px-3 md:px-4 sticky top-0 bg-[#121212] z-10"
          >
            <Hash className="w-4 h-4" />
            <div>Title</div>
            <div className="hidden md:block">Artist</div>
            <Clock className="w-4 h-4 justify-self-end mr-2" />
          </div>

          <div className="max-h-[75vh] overflow-y-scroll pb-40">
            {songs.map((song, i) => {
              const isActive = song.id === currentSongId;
              return (
                <div
                  key={song.id}
                  ref={isActive ? activeSongRef : null}
                  onClick={() => handlePlay(song, i)}
                  className={`grid grid-cols-[32px_1fr_32px]
md:grid-cols-[32px_5fr_3fr_1fr_1fr]
items-center py-2 md:py-3 px-3 md:px-4 group cursor-pointer border-b border-[#1b1b1b]
transition-all duration-200 select-none ${
                    isActive
                      ? "text-[#fa4565] font-semibold"
                      : "text-gray-300 hover:text-[#fa4565]"
                  }`}
                >
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
                      <div className="flex gap-[2px] transform rotate-180 transition-all duration-200 ease-in-out">
                        {[1, 2, 3].map((bar) => (
                          <div
                            key={bar}
                            className="w-[3px] bg-[#fa4565] animate-equalizer rounded-full transition-all duration-200"
                            style={{ animationDelay: `${bar * 0.1}s` }}
                          ></div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-3">
                    <img
                      src={song.cover_url}
                      alt={song.title}
                      loading="lazy"
                      className="w-12 h-12 object-cover rounded-md shadow-lg"
                    />
                    <div className="truncate">
                      <p className="truncate">{song.title}</p>
                      <p className="text-sm text-gray-400 truncate">
                        {song.artist_name}
                      </p>
                    </div>
                  </div>

                  <div className="hidden md:block text-sm text-gray-400 truncate">
                    {song.artist_name}
                  </div>

                  <div className="text-sm text-gray-400 justify-self-end">
                    {formatDuration(song.duration)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ),
    [songs, currentSongId]
  );

  /* ====== CARD VIEW ====== */
  const CardView = useMemo(
    () => () =>
      (
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-6 max-h-[75vh] overflow-y-auto pb-40">
          {songs.map((song, i) => {
            const isActive = song.id === currentSongId;

            return (
              <div
                key={song.id}
                onClick={() => handlePlay(song, i)}
                className={`group relative p-4 rounded-xl cursor-pointer transition-all duration-300
              ${
                isActive
                  ? "!bg-[#fa4565]/25 ring-2 ring-[#fa4565] text-white"
                  : "bg-[#121212] hover:bg-[#1b1b1b]"
              }`}
              >
                <div className="relative rounded-lg overflow-hidden">
                  <img
                    loading="lazy"
                    src={song.cover_url}
                    className="w-full aspect-square object-cover"
                  />

                  {!isActive && (
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-all duration-300 flex justify-center items-center">
                      <button className="bg-[#fa4565] cursor-pointer w-12 h-12 rounded-full flex items-center justify-center scale-75 opacity-0 group-hover:scale-100 group-hover:opacity-100 transition-all duration-300 shadow-lg">
                        <Play className="w-5 h-5 fill-white" />
                      </button>
                    </div>
                  )}

                  {isActive && (
                    <div className="absolute inset-0 bg-black/40 flex justify-center items-center rotate-180">
                      <div className="flex gap-[3px]">
                        {[1, 2, 3].map((bar) => (
                          <div
                            key={bar}
                            className="w-[4px] bg-[#fa4565] animate-equalizer rounded-md"
                            style={{ animationDelay: `${bar * 0.1}s` }}
                          ></div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <p className="font-bold mt-4 truncate">{song.title}</p>
                <p className="text-sm text-gray-400 truncate">
                  {song.artist_name}
                </p>
              </div>
            );
          })}
        </div>
      ),
    [songs, currentSongId]
  );

  return (
    <div className="w-full md:w-[75%] mx-auto pt-8 pb-10 text-white">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Music2 className="w-7 h-7 text-[#fa4565]" />
          <h2 className="text-3xl font-extrabold">Top Hits & Trending</h2>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setIsListView(true)}
            className={`p-2 rounded-full cursor-pointer ${
              isListView ? "bg-[#fa4565]" : "text-gray-400"
            }`}
          >
            <List className="w-5 h-5" />
          </button>

          <button
            onClick={() => setIsListView(false)}
            className={`p-2 rounded-full cursor-pointer ${
              !isListView ? "bg-[#fa4565]" : "text-gray-400"
            }`}
          >
            <Grid className="w-5 h-5" />
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-20 text-gray-500">Loading...</div>
      ) : songs.length > 0 ? (
        <>
          {isListView ? <ListView /> : <CardView />}
          <ShuffleButton />
        </>
      ) : (
        <div className="text-center py-20">No songs found.</div>
      )}
    </div>
  );
}

export default React.memo(SongsSection);

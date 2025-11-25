"use client";

import { useParams } from "next/navigation";
import { useEffect, useState, useMemo, useRef } from "react";
import { supabase } from "@/app/lib/supabaseClient";
import { Clock, Play, Hash } from "lucide-react";
import { usePlayer } from "@/app/music/context/PlayerContext";

export default function PlaylistPage() {
  const { id } = useParams();

  const [playlist, setPlaylist] = useState(null);
  const [songs, setSongs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);

  const activeSongRef = useRef(null);
  const { playSong, currentSongId } = usePlayer();

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
        const { data: playlistData } = await supabase
          .from("playlists")
          .select("*")
          .eq("id", id)
          .single();

        setPlaylist(playlistData);

        // Songs inside playlist (artist stored IN songs table)
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

        if (songsErr) {
          console.log(songsErr);
          setErr("Failed loading songs");
          return;
        }

        const extracted = playlistSongs.map((row) => ({
          ...row.song,
          artist_name: row.song.artist_name || "Unknown Artist",
        }));

        setSongs(extracted);
      } catch (e) {
        console.log(e);
        setErr("Failed loading playlist");
      }

      setLoading(false);
    };

    fetchData();
  }, [id]);

  const handlePlay = (song, i) => {
    playSong(song, i, songs);
  };

  const formatDuration = (sec) => {
    if (!sec) return "--:--";
    const m = Math.floor(sec / 60);
    const s = (sec % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  // 🎨 LIST VIEW TABLE UI
  const ListView = useMemo(
    () => (
      <div className="bg-[#121212] rounded-xl shadow-2xl overflow-hidden mt-6">

        {/* Header Row */}
        <div
          className="grid grid-cols-[32px_1fr_32px]
          md:grid-cols-[32px_5fr_3fr_1fr]
          text-gray-400 text-[10px] md:text-xs uppercase font-light
          border-b border-[#222] py-2 md:py-3 px-3 md:px-4 sticky top-0 bg-[#121212] z-10"
        >
          <Hash className="w-4 h-4" />
          <div>Title</div>
          <div className="hidden md:block">Artist</div>
          <Clock className="w-4 h-4 justify-self-end mr-2" />
        </div>

        {/* Song Rows */}
        <div className="max-h-[75vh] overflow-y-scroll pb-40">
          {songs.map((song, i) => {
            const isActive = currentSongId === song.id;

            return (
              <div
                key={song.id}
                ref={isActive ? activeSongRef : null}
                onClick={() => handlePlay(song, i)}
                className={`grid grid-cols-[32px_1fr_32px]
                md:grid-cols-[32px_5fr_3fr_1fr]
                items-center py-2 md:py-3 px-3 md:px-4 group cursor-pointer border-b border-[#1b1b1b]
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
    [songs, currentSongId]
  );

  if (loading) return <div className="p-10 text-white">Loading…</div>;
  if (err) return <div className="p-10 text-red-600">{err}</div>;

  return (
    <main className="flex-1 p-8 overflow-y-auto custom-scroll text-white bg-[#1a1a1a]">

      {/* Playlist Header */}
      <header className="flex items-end gap-6 p-4 rounded-lg bg-gradient-to-b from-[#333] to-[#1a1a1a]">
        <img
          src={playlist?.image_url || "/placeholder.png"}
          className="w-48 h-48 rounded-md object-cover"
        />
        <div className="flex flex-col gap-2">
          <p className="text-sm text-gray-300">Playlist</p>
          <h1 className="text-6xl font-extrabold">{playlist?.title}</h1>
          <p className="text-sm">{songs.length} songs</p>
        </div>
      </header>

      {/* Songs Table */}
      {ListView}
    </main>
  );
}

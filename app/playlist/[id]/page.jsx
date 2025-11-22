"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/app/lib/supabaseClient";
import { Clock, Play } from "lucide-react";

export default function PlaylistPage() {
  const { id } = useParams(); // playlist_id from URL e.g. /playlist/4
  const numericId = Number(id);

  const [playlist, setPlaylist] = useState(null);
  const [songs, setSongs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);

  console.log("📌 Playlist ID from URL:", id);

  useEffect(() => {
    if (!id || isNaN(numericId)) {
      setErr(`Invalid Playlist ID: Must be numeric (Received: ${id})`);
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      try {
        // Fetch playlist info
        const { data: playlistData, error: playlistErr } = await supabase
          .from("playlists")
          .select("*")
          .eq("id", numericId)
          .single();

        if (playlistErr || !playlistData) {
          setErr("Playlist not found!");
          setLoading(false);
          return;
        }

        setPlaylist(playlistData);

        // Fetch songs via relationship table
        const { data: playlistSongs, error: songsErr } = await supabase
          .from("playlist_songs")
          .select(`
            songs (
              id,
              title,
              author,
              duration,
              image_url
            )
          `)
          .eq("playlist_id", numericId);

        console.log("🎶 Raw playlist_songs:", playlistSongs);

        if (!songsErr && playlistSongs) {
          const extractedSongs = playlistSongs.map(row => row.songs);
          setSongs(extractedSongs);
        }
      } catch (error) {
        console.error("Error fetching playlist:", error);
        setErr("Something went wrong loading playlist!");
      }
      setLoading(false);
    };

    fetchData();
  }, [id, numericId]);

  if (loading) return <div className="p-10 text-white">Loading playlist…</div>;
  if (err) return <div className="p-10 text-red-500">{err}</div>;
  if (!playlist) return <div className="p-10 text-gray-400">Not Found</div>;

  return (
    <main className="flex-1 p-8 overflow-y-auto custom-scroll text-white bg-[#1a1a1a]">
      
      {/* 🎧 Playlist Header */}
      <header className="flex items-end gap-6 p-4 rounded-lg bg-gradient-to-b from-[#333] to-[#1a1a1a] shadow-lg">
        <img 
          src={playlist.image_url} 
          alt={playlist.name} 
          className="w-48 h-48 rounded-md shadow-2xl object-cover"
        />
        <div className="flex flex-col gap-2">
          <p className="text-sm font-semibold text-gray-300">Playlist</p>
          <h1 className="text-6xl font-extrabold text-white">{playlist.name}</h1>
          <p className="text-sm text-gray-400">
            Created on: {new Date(playlist.created_at).toLocaleDateString()}
          </p>
          <p className="text-sm font-medium">
            <span className="text-[#fa4565]">{songs.length}</span> songs
          </p>
        </div>
      </header>

      {/* Play Controls */}
      <div className="flex items-center gap-6 py-6 border-b border-[#333]">
        <button className="p-3 rounded-full bg-[#fa4565] text-black hover:scale-105 transition">
          <Play size={24} fill="black" />
        </button>
      </div>

      {/* 🎶 Song List */}
      <div className="mt-4">
        {songs.length === 0 ? (
          <p className="text-gray-500 text-center py-10">No songs in this playlist.</p>
        ) : (
          songs.map((song, index) => (
            <div 
              key={song.id}
              className="grid grid-cols-[30px_3fr_2fr_80px] items-center py-3 px-4 rounded-lg hover:bg-white/10 transition group cursor-pointer"
            >
              <div className="text-center text-gray-400">{index + 1}</div>
              <div className="flex items-center gap-3">
                <img src={song.image_url} className="w-10 h-10 rounded" />
                <span className="text-white">{songs.title}</span>
              </div>
              <div className="text-gray-400">{songs.author}</div>
              <div className="text-right text-gray-400">{songs.duration}</div>
            </div>
          ))
        )}
      </div>
    </main>
  );
}

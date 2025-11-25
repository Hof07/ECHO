"use client";

import { useParams } from "next/navigation";
import { useEffect, useState, useMemo, useRef } from "react";
import { supabase } from "@/app/lib/supabaseClient";
import { Clock, Play, Hash, Image, RefreshCw } from "lucide-react";
import { usePlayer } from "@/app/music/context/PlayerContext";

export default function PlaylistPage() {
  const { id } = useParams();

  const [playlist, setPlaylist] = useState(null);
  const [songs, setSongs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [generatingCover, setGeneratingCover] = useState(false);

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
        const { data: playlistData, error: playlistError } = await supabase
          .from("playlists")
          .select("*")
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
      console.log("Generating cover for playlist:", playlist.id);
      
      const response = await fetch('/api/generate-playlist-cover', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ playlistId: playlist.id }),
      });

      // Check if response is HTML (error page)
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        console.error('Non-JSON response:', text.substring(0, 200));
        throw new Error('Server returned an error page. Check API route.');
      }

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || `HTTP error! status: ${response.status}`);
      }

      // Update the playlist with new image URL
      setPlaylist(prev => ({
        ...prev,
        image_url: result.url + '?t=' + Date.now() // Cache bust
      }));

      console.log('Playlist cover generated successfully!');
    } catch (error) {
      console.error('Error generating cover:', error);
      
      // More specific error messages
      let errorMessage = error.message;
      if (error.message.includes('Failed to fetch')) {
        errorMessage = 'Network error: Could not reach the server. Check if the API route exists.';
      } else if (error.message.includes('error page')) {
        errorMessage = 'Server error: API route might be missing or has an error. Check console for details.';
      }
      
      alert(`Error generating cover: ${errorMessage}`);
    } finally {
      setGeneratingCover(false);
    }
  };

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
      <header className="flex items-end gap-6 p-4 rounded-lg bg-gradient-to-b from-[#333] to-[#1a1a1a] relative">
        {/* Cover Image with Generate Button */}
        <div className="relative group">
          <img
            src={playlist?.image_url || "/placeholder.png"}
            className="w-48 h-48 rounded-md object-cover shadow-2xl"
          />
          
          {/* Generate Cover Button - Only show if there are songs */}
          {songs.length > 0 && (
            <button
              onClick={generatePlaylistCover}
              disabled={generatingCover}
              className="absolute bottom-2 right-2 p-2 bg-black/70 hover:bg-black/90 
                rounded-full transition-all duration-200 opacity-0 group-hover:opacity-100
                disabled:opacity-50 disabled:cursor-not-allowed"
              title="Generate cover from songs"
            >
              {generatingCover ? (
                <RefreshCw className="w-4 h-4 text-white animate-spin" />
              ) : (
                <Image className="w-4 h-4 text-white" />
              )}
            </button>
          )}
        </div>

        <div className="flex flex-col gap-2 flex-1">
          <p className="text-sm text-gray-300">Playlist</p>
          <h1 className="text-4xl md:text-6xl font-extrabold break-words">
            {playlist?.title}
          </h1>
          
          <div className="flex items-center gap-4 flex-wrap">
            <p className="text-sm text-gray-300">
              {songs.length} {songs.length === 1 ? 'song' : 'songs'}
            </p>
            
            {/* Generate Cover Button for Mobile */}
            {songs.length > 0 && (
              <button
                onClick={generatePlaylistCover}
                disabled={generatingCover}
                className="md:hidden flex items-center gap-2 px-3 py-1 bg-[#fa4565] 
                  hover:bg-[#e03a58] rounded-full text-xs transition-all duration-200
                  disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {generatingCover ? (
                  <>
                    <RefreshCw className="w-3 h-3 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Image className="w-3 h-3" />
                    Generate Cover
                  </>
                )}
              </button>
            )}
          </div>

          {/* Info about cover generation */}
          {songs.length > 0 && (
            <p className="text-xs text-gray-400 mt-2 max-w-md">
              {playlist?.image_url ? 
                "Cover generated from song artworks" : 
                "Click the image button to create a cover from your songs"
              }
            </p>
          )}
        </div>
      </header>

      {/* Songs Table */}
      {ListView}
    </main>
  );
}
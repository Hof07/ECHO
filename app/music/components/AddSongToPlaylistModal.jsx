"use client";
import { useState, useEffect, useRef } from "react";
import { supabase } from "@/app/lib/supabaseClient";
import { X, Search, Plus, Check, Loader2 } from "lucide-react";

export default function AddSongToPlaylistModal({ close, playlistId }) {
  const [songs, setSongs] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [addedSongs, setAddedSongs] = useState(new Set()); 

  const inputRef = useRef(null);

  // Fetch all songs on mount
  useEffect(() => {
    const fetchSongs = async () => {
      const { data, error } = await supabase
        .from("songs")
        .select("id, title, artist_name, cover_url") // Fetch necessary song details
        .order("title", { ascending: true });

      if (error) console.error("Error fetching songs:", error);
      else setSongs(data || []);
      
      setLoading(false);
    };

    fetchSongs();
    if (inputRef.current) inputRef.current.focus();
  }, []);

  // Add Song Logic
  const addSongToPlaylist = async (songId) => {
    setAddedSongs((prev) => new Set(prev).add(songId)); // Optimistic UI

    const { error } = await supabase
      .from("playlist_songs")
      .insert([{ playlist_id: playlistId, song_id: songId }]);

    if (error) {
      console.error("Error adding song:", error.message);
      
      // Revert UI if error (e.g., if it's already a duplicate)
      setAddedSongs((prev) => {
        const newSet = new Set(prev);
        newSet.delete(songId);
        return newSet;
      });
      if (error.code === '23505') alert("Song is already in this playlist!");
    }
  };

  // Filter songs based on search query
  const filteredSongs = songs.filter(
    (song) =>
      song.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      song.author?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[200]">
      <div className="bg-[#1a1a1a] w-[90%] max-w-lg rounded-2xl shadow-2xl h-[80vh] flex flex-col">
        
        {/* Header */}
        <div className="p-6 border-b border-gray-700 flex justify-between items-center">
          <h2 className="text-xl font-bold text-white">Add Songs</h2>
          <button onClick={close} className="p-1 rounded-full text-gray-400 hover:bg-white/10 hover:text-white">
            <X size={24} />
          </button>
        </div>

        {/* Search Bar */}
        <div className="p-4 border-b border-gray-700/50 bg-[#222]">
          <div className="relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-[#fa4565]" size={18} />
            <input
              ref={inputRef}
              type="text"
              placeholder="Search songs or artists..."
              className="w-full bg-[#333] text-white pl-10 pr-4 py-3 rounded-full outline-none focus:ring-2 focus:ring-[#fa4565] transition"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* Song List */}
        <div className="flex-1 overflow-y-auto custom-scroll p-2">
          {loading ? (
            <div className="flex items-center justify-center h-40">
              <Loader2 className="animate-spin text-[#fa4565]" size={32} />
            </div>
          ) : filteredSongs.length === 0 ? (
            <p className="text-center text-gray-500 mt-10">No songs found.</p>
          ) : (
            <div className="flex flex-col gap-1">
              {filteredSongs.map((song) => {
                const isAdded = addedSongs.has(song.id);
                return (
                  <div key={song.id} className="flex items-center justify-between p-3 hover:bg-white/5 rounded-lg group transition">
                    <div className="flex items-center gap-3 overflow-hidden">
                      {/* Song Image */}
                      <div className="h-10 w-10 bg-gray-800 rounded overflow-hidden flex-shrink-0">
                        <img src={song.cover_url} loading="lazy" alt={song.title} className="h-full w-full object-cover" />
                      </div>
                      {/* Song Details */}
                      <div className="flex flex-col overflow-hidden">
                        <span className="text-white font-medium truncate">{song.title}</span>
                        <span className="text-xs text-gray-400 truncate">{song.author}</span>
                      </div>
                    </div>

                    {/* Add Button */}
                    <button
                      onClick={() => !isAdded && addSongToPlaylist(song.id)}
                      className={`p-2 rounded-full border transition flex-shrink-0
                        ${isAdded 
                          ? "bg-[#fa4565] border-[#fa4565] text-white" 
                          : "border-gray-600 text-gray-400 hover:border-white hover:text-white"
                        }`}
                    >
                      {isAdded ? <Check size={18} /> : <Plus size={18} />}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
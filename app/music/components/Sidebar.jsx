"use client";
import { useEffect, useState } from "react";
import { Plus, Music, MoreVertical, Trash2, ListPlus } from "lucide-react";
import Link from "next/link";
import { supabase } from "@/app/lib/supabaseClient";
import CreatePlaylistModal from "../components/CreatePlaylistModal";
import AddSongToPlaylistModal from "../components/AddSongToPlaylistModal"; // <-- Imported new modal

export default function Sidebar() {
  const [playlists, setPlaylists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [activeMenuId, setActiveMenuId] = useState(null);
  
  // State to manage opening the AddSong modal for a specific playlist
  const [playlistIdToAdd, setPlaylistIdToAdd] = useState(null); 

  const getPlaylists = async () => {
    const { data } = await supabase
      .from("playlists")
      .select("*")
      .order("created_at", { ascending: false });
    setPlaylists(data || []);
    setLoading(false);
  };

  useEffect(() => {
    getPlaylists();
    // Close menu when clicking anywhere else
    const handleClickOutside = () => setActiveMenuId(null);
    window.addEventListener("click", handleClickOutside);
    return () => window.removeEventListener("click", handleClickOutside);
  }, []);

  const deletePlaylist = async (id) => {
    setActiveMenuId(null); 

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
    <aside className="w-[20%] bg-[#111] h-full p-6 flex flex-col gap-6 overflow-y-auto custom-scroll pb-20">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">Your Library</h3>
        <button
          className="p-2 rounded-lg text-gray-400 hover:bg-[#fa4565] hover:text-black transition"
          onClick={() => setShowModal(true)}
        >
          <Plus size={20} />
        </button>
      </div>

      {loading && <p className="text-gray-500 text-sm">Loading...</p>}

      {playlists.length > 0 && (
        <div className="flex flex-col gap-3">
          {playlists.map((p) => (
            <div 
              key={p.id} 
              // FIX: Dynamic Z-index to prevent clipping
              className={`relative group ${activeMenuId === p.id ? "z-50" : "z-0"}`}
            >
              <Link
                href={`/playlist/${p.id}`}
                className="bg-[#1a1a1a] p-3 rounded-xl flex items-center gap-4 hover:bg-[#2a2a2a] transition pr-10"
              >
                <div className="relative h-12 w-12 min-w-[3rem] rounded-md overflow-hidden bg-gray-800">
                  {p.image_url ? (
                    <img src={p.image_url} alt={p.name} className="h-full w-full object-cover" />
                  ) : (
                    <Music size={20} className="text-gray-400 m-auto h-full" />
                  )}
                </div>
                <div className="flex flex-col overflow-hidden">
                  <span className="font-medium text-white truncate text-sm">{p.name}</span>
                  <span className="text-xs text-gray-500 truncate">Playlist</span>
                </div>
              </Link>

              {/* Three Dots Button */}
              <div className="absolute right-2 top-1/2 -translate-y-1/2">
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setActiveMenuId(activeMenuId === p.id ? null : p.id);
                  }}
                  className={`
                    p-2 rounded-full transition cursor-pointer
                    ${activeMenuId === p.id 
                      ? "text-white opacity-100" 
                      : "text-gray-400 opacity-0 group-hover:opacity-100 hover:bg-black/50"
                    }
                  `}
                >
                  <MoreVertical size={18} />
                </button>

                {/* Dropdown Menu */}
                {activeMenuId === p.id && (
                  <div 
                    className="absolute right-0 top-10 w-48 bg-[#222] border border-gray-700 rounded-lg shadow-2xl overflow-hidden flex flex-col py-1 z-[100]"
                    onClick={(e) => e.stopPropagation()} 
                  >
                    {/* --- ADD SONG BUTTON --- */}
                    <button 
                      onClick={() => {
                          setPlaylistIdToAdd(p.id); // Set the ID to open the modal
                          setActiveMenuId(null); // Close the dropdown menu
                      }}
                      className="flex items-center gap-3 px-4 py-3 text-sm text-gray-300 hover:bg-white/10 text-left w-full cursor-pointer"
                    >
                      <ListPlus size={16} /> Add Song
                    </button>
                    
                    <button 
                      onClick={() => deletePlaylist(p.id)}
                      className="flex items-center gap-3 px-4 py-3 text-sm text-red-400 hover:bg-red-900/20 text-left w-full cursor-pointer"
                    >
                      <Trash2 size={16} /> Delete Playlist
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      
      {showModal && <CreatePlaylistModal close={() => setShowModal(false)} refresh={getPlaylists} />}
      
      {/* RENDER THE ADD SONG MODAL */}
      {playlistIdToAdd && (
        <AddSongToPlaylistModal 
          playlistId={playlistIdToAdd} 
          close={() => setPlaylistIdToAdd(null)} 
        />
      )}
    </aside>
  );
}
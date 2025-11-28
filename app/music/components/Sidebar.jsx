"use client";
import { useEffect, useState } from "react";
import { Plus, Music, MoreVertical, Trash2, ListPlus } from "lucide-react";
import Link from "next/link";
import { supabase } from "@/app/lib/supabaseClient";
import CreatePlaylistModal from "../components/CreatePlaylistModal";
import AddSongToPlaylistModal from "../components/AddSongToPlaylistModal";

export default function Sidebar() {
  const [playlists, setPlaylists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [activeMenuId, setActiveMenuId] = useState(null);
  const [playlistIdToAdd, setPlaylistIdToAdd] = useState(null);
  const [userMailId, setUserMailId] = useState(null);

  // Function to fetch the user's mail ID from the server API
  const getMailId = async () => {
    try {
      const response = await fetch('/api/getToken');
      
      if (!response.ok) {
        if (response.status === 401) {
            // console.log("User not logged in or JWT is invalid (Status 401).");
        } 
        return null;
      }

      const data = await response.json();
      
      // FIX: Extracts mail ID from the nested 'user' object returned by your API
      const mailId = data.user?.email || data.user?.mailid;
      
      if (mailId) {
        setUserMailId(mailId);
        return mailId;
      }
      
      return null;

    } catch (error) {
      console.error("Error fetching user mail ID:", error);
      return null;
    }
  };

  // Function to fetch playlists, filtered by userMailId
  const getPlaylists = async (mailId) => {
    setLoading(true);
    let query = supabase.from("playlists").select("*");

    // Apply filter only if mailId is available
    if (mailId) {
        query = query.eq("created_by", mailId);
    }
    
    const { data, error } = await query.order("created_at", { ascending: false });

    if (error) {
        console.error("Error fetching playlists:", error);
    }

    setPlaylists(data || []);
    setLoading(false);
  };

  useEffect(() => {
    const initSidebar = async () => {
        const mailId = await getMailId(); 
        
        if (mailId) {
            getPlaylists(mailId);
        } else {
            setLoading(false); 
        }
    }

    initSidebar();

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
    <aside className="hidden lg:flex w-[20%] bg-[#111] h-full p-6 flex-col gap-6 overflow-y-auto custom-scroll pb-20">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">Your Library</h3>
        <button
          className="p-2 cursor-pointer text-gray-400 hover:bg-[#fa4565] rounded-full hover:text-black transition"
          onClick={() => userMailId ? setShowModal(true) : alert("Please log in to create a playlist")}
          disabled={!userMailId} 
        >
          <Plus size={20} />
        </button>
      </div>

      {!userMailId && !loading && (
        <p className="text-red-400 text-sm">Please log in to view and create your playlists.</p>
      )}
      
      {loading && <p className="text-gray-500 text-sm">Loading...</p>}

      {userMailId && playlists.length === 0 && !loading && (
        <p className="text-gray-500 text-sm">Please Create Your playlist</p>
      )}

      {userMailId && playlists.length > 0 && (
        <div className="flex flex-col gap-3">
          {playlists.map((p) => (
            <div 
              key={p.id} 
              className={`relative group ${activeMenuId === p.id ? "z-50" : "z-0"}`}
            >
              <Link
                href={`/playlist/${p.id}`}
                className="bg-[#1a1a1a] p-3 rounded-xl flex items-center gap-4 hover:bg-[#2a2a2a] transition pr-10"
              >
                <div className="relative h-12 w-12 min-w-[3rem] rounded-md overflow-hidden bg-gray-800">
                  {p.image_url ? (
                    <img 
                      src={p.image_url} 
                      alt={p.name} 
                      className="h-full w-full object-cover" 
                    />
                  ) : (
                    // This is the music icon fallback if the URL is null or fails
                    <Music size={20} className="text-gray-400 m-auto h-full" /> 
                  )}
                </div>
                <div className="flex flex-col overflow-hidden">
                  <span className="font-medium text-white truncate text-sm">{p.name}</span>
                  <span className="text-xs text-gray-500 truncate">Playlist</span>
                </div>
              </Link>

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

                {activeMenuId === p.id && (
                  <div 
                    className="absolute right-0 top-10 w-48 bg-[#222] border border-gray-700 rounded-lg shadow-2xl overflow-hidden flex flex-col py-1 z-[100]"
                    onClick={(e) => e.stopPropagation()} 
                  >
                    <button 
                      onClick={() => {
                        setPlaylistIdToAdd(p.id);
                        setActiveMenuId(null);
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
      
      {showModal && (
        <CreatePlaylistModal 
          close={() => setShowModal(false)} 
          refresh={() => getPlaylists(userMailId)} 
          createdBy={userMailId}
        />
      )}
      
      {playlistIdToAdd && (
        <AddSongToPlaylistModal 
          playlistId={playlistIdToAdd} 
          close={() => setPlaylistIdToAdd(null)} 
        />
      )}
    </aside>
  );
}
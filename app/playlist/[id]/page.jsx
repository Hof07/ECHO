"use client";

import { useParams } from "next/navigation";

import { useEffect, useState, useMemo, useRef, useCallback } from "react";

// Ensure this path is correct for your Supabase client setup

import { supabase } from "@/app/lib/supabaseClient";

import { Clock, Play, Hash, Image, RefreshCw, Upload, X } from "lucide-react";

import { usePlayer } from "@/app/music/context/PlayerContext";

const COVER_BUCKET = "covers";

export default function PlaylistPage() {
  const { id } = useParams();

  const [playlist, setPlaylist] = useState(null);

  const [songs, setSongs] = useState([]);

  const [loading, setLoading] = useState(true);

  const [err, setErr] = useState(null);

  const [generatingCover, setGeneratingCover] = useState(false);

  const [uploadingCover, setUploadingCover] = useState(false);

  // State to manage the modal visibility

  const [isModalOpen, setIsModalOpen] = useState(false);

  const activeSongRef = useRef(null);

  const fileInputRef = useRef(null);

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

      // NOTE: This assumes your serverless API route is correctly deployed and configured

      const response = await fetch("/api/generate-playlist-cover", {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
        },

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

      // Update the playlist with new image URL

      setPlaylist((prev) => ({
        ...prev,

        image_url: result.url + "?t=" + Date.now(), // Cache bust
      }));

      alert("Playlist cover generated successfully!");

      setIsModalOpen(false); // Close modal on success
    } catch (error) {
      console.error("Error generating cover:", error);

      alert(`Error generating cover: ${error.message}`);
    } finally {
      setGeneratingCover(false);
    }
  };

  // 🟢 Handle manual cover upload - WITH ENHANCED ERROR LOGGING

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];

    if (!file || !playlist?.id) return;

    if (!file.type.startsWith("image/")) {
      alert("Please select a valid image file.");

      return;
    }

    setUploadingCover(true);

    try {
      // 1. Upload to Supabase Storage (INSERT operation)

      const fileExt = file.name.split(".").pop();

      const fileName = `${playlist.id}/${playlist.id}-${Date.now()}.${fileExt}`;

      const filePath = `${playlist.id}/${fileName}`;

      // The RLS policy for 'anon' INSERT must be set on the 'covers' bucket for this to work

      const { data: uploadData, error: uploadError } = await supabase.storage

        .from(COVER_BUCKET)

        .upload(filePath, file, {
          cacheControl: "3600",

          upsert: true,
        });

      if (uploadError) {
        console.error("Supabase Storage Upload Error:", uploadError);

        // Throw an informative error about the RLS failure

        throw new Error(
          `Upload Failed: ${uploadError.message}. Check Storage RLS Policy on '${COVER_BUCKET}' bucket.`
        );
      }

      // 2. Get public URL

      const { data: publicUrlData } = supabase.storage

        .from(COVER_BUCKET)

        .getPublicUrl(filePath);

      const newImageUrl = publicUrlData.publicUrl;

      // 3. Update the playlist database record (UPDATE operation)

      // The RLS policy for 'anon' UPDATE must be set on the 'playlists' table for this to work

      const { error: updateError } = await supabase

        .from("playlists")

        .update({ image_url: newImageUrl })

        .eq("id", playlist.id);

      if (updateError) {
        console.error("Database Update Error:", updateError);

        // Throw an informative error about the RLS failure

        throw new Error(
          `Database Update Failed: ${updateError.message}. Check 'playlists' Table RLS Policy.`
        );
      }

      // 4. Update local state

      setPlaylist((prev) => ({
        ...prev,

        image_url: newImageUrl,
      }));

      alert("Cover uploaded successfully!");

      setIsModalOpen(false); // Close modal on success
    } catch (error) {
      console.error("Error during cover upload:", error);

      // Display the detailed error message caught from the try block

      alert("Failed to upload cover image. Error: " + error.message);
    } finally {
      setUploadingCover(false);

      // Reset file input to allow uploading the same file again

      e.target.value = null;
    }
  };

  // 🟢 Function to open the file dialog

  const triggerFileInput = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  // 🟢 Simplified Play Handler

  const handlePlay = useCallback(
    (song, i) => {
      playSong(song, i, songs);
    },
    [songs, playSong]
  );

  // 🟢 Duration Formatter

  const formatDuration = (sec) => {
    if (!sec) return "--:--";

    const m = Math.floor(sec / 60);

    const s = (sec % 60).toString().padStart(2, "0");

    return `${m}:${s}`;
  };

  // 🎨 LIST VIEW TABLE UI (useMemo unchanged)

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

    [songs, currentSongId, handlePlay]
  );

  if (loading) return <div className="p-10 text-white">Loading…</div>;

  if (err) return <div className="p-10 text-red-600">{err}</div>;

  return (
    <main className="flex-1 p-8 overflow-y-auto custom-scroll text-white bg-[#1a1a1a]">
      {/* Playlist Header */}

      <header className="flex items-end gap-6 p-4 rounded-lg bg-gradient-to-b from-[#333] to-[#1a1a1a] relative">
        {/* Cover Image */}

        <div className="relative group">
          <div
            onClick={() => setIsModalOpen(true)} // 🟢 Open modal on click
            className={`w-48 h-48 rounded-md object-cover shadow-2xl cursor-pointer 

                        transition-all duration-300 ${
                          isModalOpen ? "opacity-70" : "hover:scale-[1.03]"
                        }`}
            title="Click to change playlist cover"
          >
            <img
              src={playlist?.image_url || "/placeholder.png"}
              alt={`${playlist?.title} Cover`}
              className="w-full h-full rounded-md object-cover"
            />
          </div>
        </div>

        <div className="flex flex-col gap-2 flex-1">
          <p className="text-sm text-gray-300">Playlist</p>

          <h1 className="text-4xl md:text-6xl font-extrabold break-words">
            {playlist?.title}
          </h1>

          <div className="flex items-center gap-4 flex-wrap">
            <p className="text-sm text-gray-300">
              {songs.length} {songs.length === 1 ? "song" : "songs"}
            </p>

            {/* Open Modal Button for Mobile */}

            <button
              onClick={() => setIsModalOpen(true)}
              className="md:hidden flex items-center gap-2 px-3 py-1 bg-[#fa4565] 

                                hover:bg-[#e03a58] rounded-full text-xs transition-all duration-200"
            >
              <Image className="w-3 h-3" />
              Change Cover
            </button>
          </div>

          {/* Info about cover */}

          <p className="text-xs text-gray-400 mt-2 max-w-md">
            Click the playlist cover image to upload a custom image or generate
            one based on the songs.
          </p>
        </div>
      </header>

      {/* Songs Table */}

      {ListView}

      {/* 🆕 Cover Upload Modal */}

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
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

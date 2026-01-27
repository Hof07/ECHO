"use client";

import { useState, useRef, useEffect } from "react";
import { supabase } from "@/app/lib/supabaseClient";
import { X, Loader2, Upload } from "lucide-react";

export default function CreatePlaylistModal({ close, refresh }) {
  const [playlistName, setPlaylistName] = useState("");
  const [uploading, setUploading] = useState(false);
  const [imageFile, setImageFile] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");

  const modalRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (inputRef.current) inputRef.current.focus();
  }, []);

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (modalRef.current && !modalRef.current.contains(event.target)) close();
    };

    const handleEscape = (event) => {
      if (event.key === "Escape") close();
    };

    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [close]);

  const isInputValid = playlistName.trim().length > 0 && imageFile;

  const uploadImageToSupabase = async () => {
    if (!imageFile) return null;

    const fileExt = imageFile.name.split(".").pop();
    const fileName = `${Date.now()}.${fileExt}`;
    const filePath = `${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from("covers")
      .upload(filePath, imageFile);

    if (uploadError) {
      console.error(uploadError);
      setErrorMessage("Failed to upload image.");
      return null;
    }

    // fetch public URL
    const {
      data: { publicUrl },
    } = supabase.storage.from("covers").getPublicUrl(filePath);

    return publicUrl;
  };

  const createPlaylist = async () => {
    setErrorMessage("");

    if (!isInputValid) {
      setErrorMessage("Please enter playlist name and upload image.");
      return;
    }

    setUploading(true);

    try {
      const imageUrl = await uploadImageToSupabase();
      if (!imageUrl) return;

      const { error } = await supabase.from("playlists").insert([
        {
          name: playlistName.trim(),
          image_url: imageUrl,
        },
      ]);

      if (error) {
        console.error(error);
        setErrorMessage("Failed to create playlist.");
        return;
      }

      refresh();
      close();
    } catch (e) {
      console.error(e);
      setErrorMessage("Unexpected error occurred.");
    } finally {
      setUploading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !uploading && isInputValid) {
      createPlaylist();
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50"
      role="dialog"
      aria-modal="true"
    >
      <div
        ref={modalRef}
        className="bg-[#1a1a1a] p-8 rounded-2xl shadow-2xl w-[90%] max-w-md flex flex-col gap-6"
      >
        <div className="flex justify-between items-center pb-2 border-b border-gray-700">
          <h2 className="text-xl font-bold text-white">New Playlist</h2>
          <button
            onClick={close}
            className="p-1 rounded-full text-gray-400 hover:bg-[#fa4565] hover:text-white transition"
          >
            <X size={20} />
          </button>
        </div>

        {errorMessage && (
          <p className="text-sm text-red-400 bg-red-900/20 p-3 rounded">
            {errorMessage}
          </p>
        )}

        {/* Playlist Name */}
        <div className="flex flex-col gap-1">
          <label
            htmlFor="playlist-name"
            className="text-sm font-medium text-gray-300"
          >
            Name your playlist
          </label>
          <input
            ref={inputRef}
            id="playlist-name"
            type="text"
            placeholder="e.g., My Mix"
            value={playlistName}
            onChange={(e) => {
              setPlaylistName(e.target.value);
              if (errorMessage) setErrorMessage("");
            }}
            onKeyPress={handleKeyPress}
            className="p-3 rounded-lg bg-[#222] text-white placeholder-gray-500 outline-none border border-transparent focus:border-[#fa4565] focus:ring-2 focus:ring-[#fa4565] transition"
            disabled={uploading}
          />
        </div>

        {/* Upload Cover */}
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-gray-300">
            Upload Playlist Cover
          </label>

          <label
            className="flex flex-col items-center justify-center p-4 border border-gray-700 border-dashed rounded-lg cursor-pointer hover:bg-[#ffffff10] transition"
          >
            <Upload className="text-gray-400 mb-2" size={28} />
            <span className="text-gray-400">
              {imageFile ? imageFile.name : "Click to upload image"}
            </span>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                setImageFile(e.target.files[0]);
                if (errorMessage) setErrorMessage("");
              }}
            />
          </label>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button
            className="px-4 py-2 text-gray-300 rounded-full hover:bg-white/10 transition font-medium"
            onClick={close}
            disabled={uploading}
          >
            Cancel
          </button>

          <button
            disabled={uploading || !isInputValid}
            onClick={createPlaylist}
            className={`px-6 py-2 rounded-full font-semibold transition flex items-center justify-center gap-2 ${
              uploading || !isInputValid
                ? "bg-[#fa4565]/50 text-black cursor-not-allowed"
                : "bg-[#fa4565] text-black hover:scale-[1.02]"
            }`}
          >
            {uploading && <Loader2 size={18} className="animate-spin" />}
            {uploading ? "Creating..." : "Create Playlist"}
          </button>
        </div>
      </div>
    </div>
  );
}

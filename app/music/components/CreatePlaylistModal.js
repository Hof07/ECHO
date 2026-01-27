"use client";
import { useState } from "react";
import { X, Upload } from "lucide-react";
import { supabase } from "@/app/lib/supabaseClient";

export default function CreatePlaylistModal({ close, refresh, createdBy }) {
  const [playlistName, setPlaylistName] = useState("");
  const [loading, setLoading] = useState(false);
  const [imageFile, setImageFile] = useState(null); // NEW FOR UPLOAD
  const [errorMessage, setErrorMessage] = useState("");

  // Upload Image to Supabase Storage
  const uploadImage = async () => {
    if (!imageFile) return null;

    const ext = imageFile.name.split(".").pop();
    const fileName = `${Date.now()}.${ext}`;

    // Upload
    const { error: uploadError } = await supabase.storage
      .from("covers")
      .upload(fileName, imageFile);

    if (uploadError) {
      console.error(uploadError);
      setErrorMessage("Image upload failed!");
      return null;
    }

    // Get public URL
    const { data } = supabase.storage
      .from("covers")
      .getPublicUrl(fileName);

    return data.publicUrl;
  };

  const createPlaylist = async (e) => {
    e.preventDefault();

    if (!playlistName.trim()) {
      alert("Please enter a playlist name.");
      return;
    }

    if (!imageFile) {
      alert("Please upload a cover image.");
      return;
    }

    if (!createdBy) {
      alert("Error: User authentication data is missing. Please log in again.");
      console.error("Attempted to create playlist without a 'created_by'.");
      return;
    }

    setLoading(true);

    // 1️⃣ Upload Image
    const uploadedUrl = await uploadImage();
    if (!uploadedUrl) {
      setLoading(false);
      return;
    }

    // 2️⃣ Insert playlist with created_by + uploaded image URL
    const { data, error } = await supabase
      .from("playlists")
      .insert([
        {
          name: playlistName.trim(),
          created_by: createdBy,
          image_url: uploadedUrl, // ← final image URL here
        },
      ])
      .select()
      .single();

    setLoading(false);

    if (error) {
      console.error("Error creating playlist:", error);
      alert(`Error creating playlist: ${error.message}`);
    } else {
      // console.log("Playlist created:", data);
      refresh();
      close();
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/80 flex items-center justify-center z-[1000]"
      onClick={close}
    >
      <div
        className="bg-[#222] p-6 rounded-xl w-full max-w-sm shadow-2xl relative"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={close}
          className="absolute top-4 right-4 text-gray-400 hover:text-white transition"
        >
          <X size={20} />
        </button>

        <h2 className="text-xl font-bold text-white mb-4">
          Create New Playlist
        </h2>

        {errorMessage && (
          <p className="text-red-400 text-sm mb-2">{errorMessage}</p>
        )}

        <form onSubmit={createPlaylist} className="flex flex-col gap-4">
          {/* Playlist Name */}
          <input
            type="text"
            value={playlistName}
            onChange={(e) => setPlaylistName(e.target.value)}
            placeholder="Enter playlist name"
            className="w-full bg-[#333] text-white p-3 rounded-lg border border-gray-600 focus:border-[#fa4565] focus:ring-1 focus:ring-[#fa4565] outline-none"
            required
            disabled={loading}
          />

          {/* Upload Image */}
          <label className="flex flex-col items-center justify-center p-4 border border-gray-600 border-dashed rounded-lg cursor-pointer hover:bg-[#ffffff15] transition">
            <Upload size={26} className="text-gray-300 mb-1" />
            <span className="text-gray-400 text-sm">
              {imageFile ? imageFile.name : "Click to upload cover image"}
            </span>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => setImageFile(e.target.files[0])}
              disabled={loading}
            />
          </label>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="bg-[#fa4565] text-black font-semibold p-3 rounded-lg hover:bg-[#ff6780] transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Creating..." : "Create"}
          </button>
        </form>
      </div>
    </div>
  );
}

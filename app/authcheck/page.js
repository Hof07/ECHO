"use client";
import React, { useState } from "react";

export default function Page() {
    const [playlistName, setPlaylistName] = useState("");
    const [imageUrl, setImageUrl] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const generateImage = async () => {
        if (!playlistName) {
            setError("Please enter a playlist name.");
            return;
        }

        setLoading(true);
        setImageUrl("");
        setError(null);

        try {
            const res = await fetch("/api/genImg", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ playlistName }),
            });

            // --- 🛠️ FIX: Robust Response Handling ---
            let data;
            let errorText = null;

            if (res.ok) { // Status 200-299
                data = await res.json();
            } else { // Status 400 or 500
                try {
                    // Try to read the error payload as JSON first (if the server returned a structured error)
                    data = await res.json();
                    errorText = data.error || `Server responded with status ${res.status}`;
                } catch (e) {
                    // If JSON fails, read the plain text error message from the body
                    errorText = await res.text();
                    if (errorText.includes('<html')) {
                        // If it looks like an HTML error page (common for fatal crashes)
                        errorText = "Server returned an unhandled fatal error (check terminal logs for full stack trace).";
                    }
                }
            }

            if (res.ok && data?.url) {
                setImageUrl(data.url);
            } else {
                // Display the most informative error message
                setError(`❌ Generation Failed: ${errorText || data?.error || 'Unknown server error.'}`);
            }
        } catch (err) {
            // This only catches true network failure (e.g., server not running)
            console.log("🔥 [CLIENT CRASH] FETCH CRASH:", err);
            setError("A network error occurred while connecting to the server. Is the Next.js server running?");
        }

        setLoading(false);
    };

    return (
        <div className="p-6 flex flex-col items-center gap-4 bg-black min-h-screen">
            <h1 className="text-3xl font-extrabold text-gray-800 mt-10">
                Generate AI Playlist Cover
            </h1>
            
            <input
                type="text"
                value={playlistName}
                onChange={(e) => setPlaylistName(e.target.value)}
                placeholder="Enter playlist name..."
                className="border border-gray-300 px-4 py-2 rounded-lg w-96 shadow-sm focus:ring-blue-500 focus:border-blue-500 transition"
            />

            <button
                onClick={generateImage}
                disabled={loading}
                className={`px-6 py-2 rounded-lg font-semibold shadow-md transition duration-200
                  ${loading 
                    ? "bg-gray-400 cursor-not-allowed" 
                    : "bg-blue-600 text-white hover:bg-blue-700"
                  }`
                }
            >
                {loading ? "Generating Image... Please Wait" : "Generate Cover Image"}
            </button>

            {/* Error Message */}
            {error && (
                <div className="text-red-600 bg-red-100 p-3 rounded-lg border border-red-300 w-96 text-center mt-4">
                    {error}
                </div>
            )}

            {/* Image Preview */}
            {imageUrl && (
                <div className="mt-8 text-center">
                    <h2 className="text-xl font-bold mb-3 text-gray-700">✅ Generated Image</h2>
                    <img
                        src={imageUrl}
                        alt={`Generated Cover for ${playlistName}`}
                        className="w-72 h-72 object-cover rounded-xl shadow-2xl border-4 border-white"
                    />
                </div>
            )}
        </div>
    );
}
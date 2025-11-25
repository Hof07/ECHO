import React from 'react';
import { Play } from "lucide-react";

// Helper function (assuming it's available globally or imported)
const formatDuration = (seconds) => {
    if (!seconds || isNaN(seconds)) return "0:00";
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
};

const SongListItem = React.memo(({ song, index, isActive, handlePlay, activeSongRef }) => {
    
    // NOTE: We rely on the parent (SongsSection) passing a stable formatDuration function 
    // and a stable handlePlay function (which it is currently doing).

    return (
        <div
            key={song.id}
            ref={isActive ? activeSongRef : null} 
            className={`
                grid grid-cols-[16px_4fr_3fr_1fr] md:grid-cols-[16px_5fr_3fr_1fr_1fr] 
                items-center py-2 px-4 group transition-all duration-200 border-b border-[#1b1b1b]
                cursor-pointer 
                ${isActive 
                    ? "bg-[#fa4565]/20 text-[#fa4565] font-semibold hover:bg-[#fa4565]/30" 
                    : "text-gray-200 hover:bg-[#1b1b1b]"
                }
            `}
            onClick={() => handlePlay(song, index)}
        >
            {/* 1. Index/Play Icon */}
            <div className="text-sm transition duration-150 relative">
                <span
                    className={`transition-opacity duration-150 flex items-center
                        /* FIX: pointer-events-none prevents the hover blink on active song */
                        ${isActive ? "opacity-100 pointer-events-none" : "group-hover:opacity-0"}`}
                >
                    {isActive ? (
                        <Play className="w-4 h-4 fill-[#fa4565] relative right-[8px]" />
                    ) : (
                        index + 1
                    )}
                </span>

                {/* Hover Play Icon - Only visible on hover AND if NOT active */}
                <Play 
                    className={`w-4 h-4 fill-white absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 transition-opacity duration-150
                        ${!isActive && 'group-hover:opacity-100'} 
                        ${isActive || 'opacity-0'}
                        `}
                />
            </div>

            {/* 2. Title & Cover */}
            <div className="flex items-center gap-3">
                <img
                    src={song.cover_url}
                    className="w-12 h-12 object-cover rounded-md shadow-lg"
                    alt={song.title}
                />
                <div className="truncate">
                    <p
                        className={`text-base truncate ${
                            isActive ? "text-white" : "text-white"
                        }`}
                    >
                        {song.title}
                    </p>
                    <p className="text-sm text-gray-400 group-hover:text-gray-300 transition duration-150">
                        {song.artist_name || "Unknown Artist"}
                    </p>
                </div>
            </div>

            {/* 3. Artist */}
            <div className="hidden md:block text-sm text-gray-400 truncate">
                {song.artist_name || "Various"}
            </div>

            {/* 4. Explicit Tag */}
            <div className="hidden md:block text-xs text-gray-500">
                {song.explicit && (
                    <span className="bg-gray-700/50 text-gray-300 px-1 py-0.5 rounded-sm font-bold">
                        E
                    </span>
                )}
            </div>

            {/* 5. Duration */}
            <div className="text-sm text-gray-400 justify-self-end">
                <span>{formatDuration(song.duration)}</span>
            </div>
        </div>
    );
});

SongListItem.displayName = 'SongListItem';

export default SongListItem;
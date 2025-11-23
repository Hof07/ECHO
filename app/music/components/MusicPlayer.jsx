// MusicPlayer.jsx
"use client";

import { useRef, useState, useEffect } from "react";
import { usePlayer } from "../context/PlayerContext";
import {
    Play,
    Pause,
    SkipBack,
    SkipForward,
    Repeat,
    Volume2,
    VolumeX, 
    MoonStar, 
    Gauge, 
    Clock, 
} from "lucide-react";
// Import the new modal component
import SleepTimerModal from "./SleepTimerModal"; 

export default function MusicPlayer() {
    const {
        currentSong,
        isPlaying,
        togglePlay,
        playNext,
        playPrev,
        progress,
        duration,
        seekTo,
        isLoop,
        toggleLoop,
        volume, 
        changeVolume,
        // sleepTimerTimeRemaining, // Placeholder context prop
        // setSleepTimer, // Placeholder context function
        // cancelSleepTimer, // Placeholder context function
    } = usePlayer();

    const [seeking, setSeeking] = useState(false);
    const [isSleeperMode, setIsSleeperMode] = useState(false);
    const [isTimerModalOpen, setIsTimerModalOpen] = useState(false); 
    
    const [prevVolume, setPrevVolume] = useState(volume > 0 ? volume : 1.0); 
    const [isSlowPlayback, setIsSlowPlayback] = useState(false); 
    const [prevRate, setPrevRate] = useState(1.0); 

    const seekBarRef = useRef(null);
    
    // 💾 Update prevVolume state when volume is changed outside of Mute/Sleeper toggles.
    useEffect(() => {
        if (volume > 0 && volume !== 0.3) {
            setPrevVolume(volume);
        }
    }, [volume]);


    if (!currentSong) return null;

    // -------------------------------------------------------------------
    // --- UTILITY & HANDLER FUNCTIONS (MUST BE DEFINED BEFORE JSX) ---
    // -------------------------------------------------------------------
    
    const formatTime = (sec) => {
        if (!sec || isNaN(sec)) return "0:00";
        const m = Math.floor(sec / 60);
        const s = Math.floor(sec % 60)
            .toString()
            .padStart(2, "0");
        return `${m}:${s}`;
    };

    const updateSeek = (clientX) => {
        const rect = seekBarRef.current.getBoundingClientRect();
        const x = clientX - rect.left;
        const pct = Math.min(Math.max(x / rect.width, 0), 1);
        seekTo(pct * duration);
    };

    // Mouse Handlers
    const handleMouseDown = () => setSeeking(true);
    const handleMouseMove = (e) => seeking && updateSeek(e.clientX);
    const handleMouseUp = (e) => {
        // Prevent accidental seek on mouse up if seeking flag wasn't active
        if (seeking) {
            updateSeek(e.clientX);
            setSeeking(false);
        }
    };
    
    // Touch Handlers
    const handleTouchStart = () => setSeeking(true);
    const handleTouchMove = (e) => seeking && updateSeek(e.touches[0].clientX);
    const handleTouchEnd = (e) => {
        if (seeking) {
            updateSeek(e.changedTouches[0].clientX);
            setSeeking(false);
        }
    };

    const handlePrevClick = () => {
        if (progress > 3) {
            seekTo(0);
        } else {
            playPrev();
        }
    };

    const toggleSleeperMode = () => {
        const newSleeperState = !isSleeperMode;
        setIsSleeperMode(newSleeperState);

        if (newSleeperState) {
            if (volume !== 0.3) {
                setPrevVolume(volume > 0 ? volume : 1.0); 
            }
            changeVolume(0.3);
        } else {
            changeVolume(prevVolume > 0 ? prevVolume : 1.0); 
        }
        
        setIsSlowPlayback(false);
    };
    
    const toggleMute = () => {
        if (volume > 0) {
            if (volume !== 0.3) {
                setPrevVolume(volume);
            }
            changeVolume(0);
        } else {
            changeVolume(prevVolume > 0 ? prevVolume : 1.0);
        }

        setIsSleeperMode(false); 
        setIsSlowPlayback(false);
    };

    const toggleSlowPlayback = () => {
        const newSlowState = !isSlowPlayback;
        setIsSlowPlayback(newSlowState);

        if (newSlowState) {
            setPrevRate(1.0); 
            // setPlaybackRate(0.75); // <--- UNCOMMENT WHEN IMPLEMENTED IN CONTEXT
        } else {
            // setPlaybackRate(prevRate); // <--- UNCOMMENT WHEN IMPLEMENTED IN CONTEXT
        }
        
        setIsSleeperMode(false);
    };

    // --- NEW: Timer Integration Functions (Placeholder) ---
    const handleSetTimer = (timeInSeconds) => {
        // ASSUMED: setSleepTimer(timeInSeconds);
        setIsTimerModalOpen(false); 
    };

    const handleCancelTimer = () => {
        // ASSUMED: cancelSleepTimer();
        setIsTimerModalOpen(false); 
    };


    const progressPercent = duration ? (progress / duration) * 100 : 0;
    const isMuted = volume === 0;
    // const isTimerActive = sleepTimerTimeRemaining > 0; // ASSUMED CONTEXT PROP

    return (
        <>
            {/* 1. RENDER THE MODAL */}
            <SleepTimerModal
                isActive={isTimerModalOpen}
                // timeRemaining={sleepTimerTimeRemaining || 0} // ASSUMED CONTEXT PROP
                timeRemaining={0} // Replace with real prop when available
                onSetTimer={handleSetTimer}
                onCancelTimer={handleCancelTimer}
                onClose={() => setIsTimerModalOpen(false)}
            />

            {/* 2. PLAYER BAR JSX */}
            <div className="fixed bottom-0 w-full bg-black text-white pt-4 pb-3 px-5 z-50 shadow-xl border-t border-[#222]">
                
                {/* --- Seek Bar --- */}
                <div
                    ref={seekBarRef}
                    className="relative w-full cursor-pointer group select-none"
                    // HANDLERS ARE NOW DEFINED AND ACCESSIBLE
                    onMouseDown={handleMouseDown} 
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={() => setSeeking(false)}
                    onTouchStart={handleTouchStart}
                    onTouchMove={handleTouchMove}
                    onTouchEnd={handleTouchEnd}
                >
                    {/* ... (Seek bar elements) ... */}
                    <div className="w-full h-[6px] bg-[#252525] rounded-full" />
                    <div
                        className="absolute top-0 left-0 h-[6px] bg-white rounded-full transition-colors group-hover:bg-[#fa4565]"
                        style={{ width: `${progressPercent}%` }}
                    />
                    <div
                        className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-white border-2 border-[#fa4565] transition-transform ${
                            seeking ? "scale-125" : "scale-0 group-hover:scale-100"
                        }`}
                        style={{ left: `calc(${progressPercent}% - 8px)` }}
                    />
                </div>

                {/* Time */}
                <div className="flex justify-between text-[10px] mt-1 opacity-75">
                    <span>{formatTime(progress)}</span>
                    <span>{formatTime(duration)}</span>
                </div>
                
                {/* --- Controls and Info --- */}
                <div className="flex items-center justify-between mt-3">
                    
                    {/* 1. Song Info (Left) */}
                    <div className="flex items-center gap-3 w-1/4">
                        <img
                            src={currentSong.cover_url}
                            alt="cover"
                            className="w-12 h-12 rounded object-cover"
                        />
                        <div className="leading-tight truncate">
                            <h4 className="font-semibold text-sm truncate">{currentSong.title}</h4>
                            <p className="text-[11px] opacity-60 truncate">
                                {currentSong.artists?.name || currentSong.artist_name || "Unknown Artist"}
                            </p>
                        </div>
                    </div>

                    {/* 2. Main Buttons (Center) */}
                    <div className="flex items-center gap-4 w-1/2 justify-center">
                        
                        <button onClick={handlePrevClick} title="Previous/Restart">
                            <SkipBack className="cursor-pointer w-5 h-5 opacity-75 hover:opacity-100 transition" />
                        </button>

                        <button
                            onClick={togglePlay}
                            className="cursor-pointer text-black p-3 rounded-full hover:scale-110 transition bg-[#fa4565]"
                            title={isPlaying ? "Pause" : "Play"}
                        >
                            {isPlaying ? (
                                <Pause className="w-5 h-5 " />
                            ) : (
                                <Play className="w-5 h-5" />
                            )}
                        </button>

                        <button onClick={playNext} title="Skip Next">
                            <SkipForward className="cursor-pointer w-5 h-5 opacity-75 hover:opacity-100 transition" />
                        </button>

                        <button onClick={toggleLoop} title="Toggle Loop">
                            <Repeat
                                className={`w-5 h-5 transition ${
                                    isLoop
                                        ? "text-[#fa4565]"
                                        : "opacity-75 hover:opacity-100 cursor-pointer"
                                }`}
                            />
                        </button>
                    </div>

                    {/* 3. Special Controls (Right) */}
                    <div className="flex items-center gap-2 w-1/4 justify-end relative">

                        {/* --- NEW: Sleep Timer Button --- */}
                        <button 
                            onClick={() => setIsTimerModalOpen(true)} // Opens the modal
                            title="Set Sleep Timer"
                            className="p-1 transition-colors cursor-pointer"
                        >
                            <Clock 
                                className={`w-5 h-5 ${
                                    // isTimerActive ? 'text-[#fa4565]' : 
                                    'text-gray-400 hover:text-white'}`} 
                            />
                        </button>

                        {/* 🐌 Slow Playback Button */}
                        <button 
                            onClick={toggleSlowPlayback} 
                            title="Toggle Slow Playback Rate"
                            className="p-1 transition-colors cursor-pointer"
                        >
                            <Gauge 
                                className={`w-5 h-5 ${isSlowPlayback ? 'text-[#fa4565]' : 'text-gray-400 hover:text-white'}`} 
                            />
                        </button>

                        {/* 🌙 Sleeper Button */}
                        <button 
                            onClick={toggleSleeperMode} 
                            title="Sleep Mode (30% Volume)"
                            className="p-1 transition-colors cursor-pointer"
                        >
                            <MoonStar 
                                className={`w-5 h-5 ${isSleeperMode ? 'text-[#fa4565]' : 'text-gray-400 hover:text-white'}`} 
                            />
                        </button>
                        
                        {/* 🔊 Mute Button */}
                        <button onClick={toggleMute} title={isMuted ? "Unmute" : "Mute"}>
                            {isMuted ? (
                                <VolumeX className="cursor-pointer w-5 h-5 text-[#fa4565]" /> 
                            ) : (
                                <Volume2 className="cursor-pointer w-5 h-5 text-gray-400 hover:text-white" />
                            )}
                        </button>
                    </div>
                </div >
            </div>
        </>
    );
}
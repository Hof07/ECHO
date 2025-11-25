// MusicPlayer.jsx
"use client";

import { useRef, useState, useEffect } from "react";
import { usePlayer } from "../context/PlayerContext";
import ColorThief from "color-thief-browser";
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
  Maximize,
  Minimize,
  Shuffle,
} from "lucide-react";
import SleepTimerModal from "./SleepTimerModal";

// --- UTILITY FUNCTION RE-DEFINITION ---
const formatTime = (sec) => {
  if (!sec || isNaN(sec)) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60)
    .toString()
    .padStart(2, "0");
  return `${m}:${s}`;
};
// -----------------------------------------------------------------------------

// 🎶 FULLSCREEN PLAYER COMPONENT - STYLED TO MATCH IMAGE
const FullScreenPlayer = ({
  currentSong,
  isPlaying,
  togglePlay,
  playNext,
  playPrev,
  toggleFullscreen,

  progress,
  duration,
  seekTo,
  isLoop,
  toggleLoop,
  volume,
  changeVolume,
  toggleMute,
  handlePrevClick,
  // --- NEW PROPS FOR SYNCING ---
  isSleeperMode,
  toggleSleeperMode,
  // --- SYNCED: Removed local isSleeperMode and toggleSleeperMode
}) => {
  const seekBarRef = useRef(null);
  const [seeking, setSeeking] = useState(false);

  const progressPercent = duration ? (progress / duration) * 100 : 0;
  const isMuted = volume === 0;

  // --- SEEK HANDLERS (UNCHANGED) ---
  const updateSeek = (clientX) => {
    const rect = seekBarRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const pct = Math.min(Math.max(x / rect.width, 0), 1);
    seekTo(pct * duration);
  };

  const handleMouseDown = () => setSeeking(true);
  const handleMouseMove = (e) => seeking && updateSeek(e.clientX);
  const handleMouseUp = (e) => {
    if (seeking) {
      updateSeek(e.clientX);
      setSeeking(false);
    }
  };
  const handleTouchStart = () => setSeeking(true);
  const handleTouchMove = (e) => seeking && updateSeek(e.touches[0].clientX);
  const handleTouchEnd = (e) => {
    if (seeking) {
      updateSeek(e.changedTouches[0].clientX);
      setSeeking(false);
    }
  };
  // ----------------------
  const [dominantColor, setDominantColor] = useState("#000");

  useEffect(() => {
    if (!currentSong?.cover_url) return;

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = currentSong.cover_url;

    img.onload = () => {
      const colorThief = new ColorThief();
      const [r, g, b] = colorThief.getColor(img);
      setDominantColor(`rgb(${r}, ${g}, ${b})`);
    };
  }, [currentSong]);

  // SYNCED: Removed local state and redefinition of toggleSleeperMode

  return (
    <div
      className="fixed inset-0 flex items-center justify-center p-4 z-[100] transition-all duration-700"
      style={{
        background: `linear-gradient(160deg, ${dominantColor}, #000)`,
      }}
    >
      {/* 🔘 Exit Fullscreen Button (Top-Right) */}
      <button
        onClick={toggleFullscreen}
        className="absolute top-4 cursor-pointer right-4 p-3 rounded-full hover:bg-white/20 
    backdrop-blur-md transition border border-white/30 shadow-lg"
        title="Exit Fullscreen"
      >
        <Minimize className="w-6 h-6 opacity-90 hover:opacity-100" />
      </button>

      {/* 🎵 Glass Card */}
      <div
        className="
        w-full max-w-sm text-white rounded-3xl p-6 flex flex-col justify-between 
        shadow-2xl bg-white/10 backdrop-blur-2xl border border-white/15
      "
      >
        {/* Album Artwork */}
        <img
          src={currentSong.cover_url}
          alt="cover"
          className="w-full aspect-square object-cover rounded-2xl mb-6 shadow-xl"
        />

        {/* Song Info */}
        <div className="text-center mb-4">
          <h1 className="text-xl font-semibold truncate">
            " {currentSong.title} "
          </h1>
          <p className="text-sm opacity-80 truncate">
            {currentSong.artists?.name ||
              currentSong.artist_name ||
              "Unknown Artist"}
          </p>
        </div>

        {/* Seek Bar */}
        <div className="mb-6">
          <div
            ref={seekBarRef}
            className="relative w-full h-3 cursor-pointer bg-white/20 rounded-full cursor-pointer select-none"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            <div
              className="absolute top-0 left-0 h-3 bg-white rounded-full transition-all"
              style={{ width: `${progressPercent}%` }}
            />
            <div
              className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full"
              style={{ left: `calc(${progressPercent}% - 8px)` }}
            />
          </div>

          <div className="flex justify-between text-xs opacity-75 mt-2">
            <span>{formatTime(progress)}</span>
            <span>{formatTime(duration - progress)}</span>
          </div>
        </div>
              
        {/* Controls */}
        <div className="flex items-center justify-between mb-6">
          {/* SYNCED: Using prop toggleSleeperMode and isSleeperMode */}
          <button
            onClick={toggleSleeperMode}
            title="Sleep Mode (30% Volume)"
            className="p-1 transition-colors cursor-pointer hover:text-white"
          >
            <MoonStar
              className={`w-6 h-6 ${
                isSleeperMode
                  ? "text-white"
                  : "opacity-50 hover:opacity-100"
              }`}
            />
          </button>
          <button
            onClick={handlePrevClick}
            className="opacity-70 cursor-pointer hover:opacity-100"
          >
            <SkipBack className="w-7 h-7" />
          </button>

          <button
            className="bg-white text-black cursor-pointer p-4 rounded-full hover:scale-110 transition shadow-lg"
            onClick={togglePlay}
          >
            {isPlaying ? (
              <Pause className="w-6 h-6" />
            ) : (
              <Play className="w-6 h-6 " />
            )}
          </button>

          <button
            onClick={playNext}
            className="opacity-70 cursor-pointer hover:opacity-100"
          >
            <SkipForward className="w-7 h-7" />
          </button>

          <button
            onClick={toggleLoop}
            className={`${
              isLoop ? "text-white" : "opacity-50 hover:opacity-100 "
            }`}
          >
            <Repeat className="w-6 h-6 cursor-pointer" />
          </button>
        </div>

        {/* Volume */}
        <div className="flex items-center gap-3 ">
          <button onClick={toggleMute}>
            {isMuted ? (
              <VolumeX className="w-5 h-5 opacity-80" />
            ) : (
              <Volume2 className="w-5 h-5 opacity-80" />
            )}
          </button>

          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={volume}
            onChange={(e) => changeVolume(parseFloat(e.target.value))}
            className="w-full h-[5px] rounded-full bg-white/20 cursor-pointer accent-white"
          />

          <Volume2 className="w-5 h-5 opacity-80" />
        </div>
      </div>
    </div>
  );
};

// -----------------------------------------------------------------------------
// --- MAIN MusicPlayer COMPONENT (REMAINS MOSTLY UNCHANGED) ---
// -----------------------------------------------------------------------------

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
  // LIFTED STATE: isSleeperMode and prevVolume
  const [isSleeperMode, setIsSleeperMode] = useState(false);
  const [prevVolume, setPrevVolume] = useState(volume > 0 ? volume : 1.0);
  const [isTimerModalOpen, setIsTimerModalOpen] = useState(false);

  const [isFullScreen, setIsFullScreen] = useState(false); // <--- New State

  
  const [isSlowPlayback, setIsSlowPlayback] = useState(false);
  const [prevRate, setPrevRate] = useState(1.0);

  const seekBarRef = useRef(null);

  useEffect(() => {
    // Keep prevVolume updated for when volume is changed manually
    if (volume > 0 && volume !== 0.3) {
      setPrevVolume(volume);
      // If volume is changed from 0.3 to something else, exit sleeper mode
      if (isSleeperMode) {
        setIsSleeperMode(false);
      }
    }
    // If volume is manually set to 0, ensure prevVolume is set before mute/unmute
    if (volume === 0 && prevVolume === 0) {
      setPrevVolume(1.0);
    }
  }, [volume]);
  
  // Re-sync isSleeperMode if volume is programmatically set to 0.3 outside of this component
  useEffect(() => {
    if (volume === 0.3 && !isSleeperMode) {
      setIsSleeperMode(true);
    }
    if (volume !== 0.3 && isSleeperMode) {
      setIsSleeperMode(false);
    }
  }, [volume, isSleeperMode]);


  if (!currentSong) return null;

  // --- UTILITY & HANDLER FUNCTIONS ---

  // Re-definition of formatTime removed as it's defined at the top

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

  // LIFTED HANDLER: toggleSleeperMode
  const toggleSleeperMode = () => {
    const newSleeperState = !isSleeperMode;
    setIsSleeperMode(newSleeperState);

    if (newSleeperState) {
      // Save current volume if it's not already 0.3, then set to 0.3
      if (volume !== 0.3) {
        setPrevVolume(volume > 0 ? volume : 1.0);
      }
      changeVolume(0.3);
    } else {
      // Restore volume, defaulting to 1.0 if prevVolume somehow ended up 0
      changeVolume(prevVolume > 0 ? prevVolume : 1.0);
    }

    setIsSlowPlayback(false); // Often a side effect to ensure proper mode
  };

  const toggleMute = () => {
    if (volume > 0) {
      // If volume is not 0.3 (sleeper volume), save it before muting
      if (volume !== 0.3) {
        setPrevVolume(volume);
      }
      changeVolume(0);
    } else {
      // Restore volume, defaulting to 1.0 if prevVolume somehow ended up 0
      changeVolume(prevVolume > 0 ? prevVolume : 1.0);
    }

    setIsSleeperMode(false); // Muting explicitly disables sleeper mode
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

  // --- NEW: Fullscreen Toggle ---
  const toggleFullscreen = () => {
    setIsFullScreen((prev) => !prev);
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

  // --- CONDITIONAL RENDER FOR FULLSCREEN ---
  if (isFullScreen) {
    return (
      <FullScreenPlayer
        currentSong={currentSong}
        isPlaying={isPlaying}
        togglePlay={togglePlay}
        playNext={playNext}
        playPrev={playPrev}
        toggleFullscreen={toggleFullscreen}
        // Pass props/handlers needed for fullscreen controls
        progress={progress}
        duration={duration}
        seekTo={seekTo}
        isLoop={isLoop}
        toggleLoop={toggleLoop}
        volume={volume}
        changeVolume={changeVolume}
        toggleMute={toggleMute}
        handlePrevClick={handlePrevClick}
        // --- NEW PROPS PASSED FOR SYNCING ---
        isSleeperMode={isSleeperMode}
        toggleSleeperMode={toggleSleeperMode}
      />
    );
  }
  // ------------------------------------------

  return (
    <>
      {/* 1. RENDER THE MODAL */}
      <SleepTimerModal
        isActive={isTimerModalOpen}
        timeRemaining={0}
        onSetTimer={handleSetTimer}
        onCancelTimer={handleCancelTimer}
        onClose={() => setIsTimerModalOpen(false)}
      />

      {/* 2. PLAYER BAR JSX (Unchanged) */}
      <div className="fixed bottom-0 w-full bg-black text-white pt-4 pb-3 px-5 z-50 shadow-xl border-t border-[#222]">
        {/* --- Seek Bar --- */}
        <div
          ref={seekBarRef}
          className="relative w-full cursor-pointer group select-none"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={() => setSeeking(false)}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
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
              <h4 className="font-semibold text-sm truncate">
                {currentSong.title}
              </h4>
              <p className="text-[11px] opacity-60 truncate">
                {currentSong.artists?.name ||
                  currentSong.artist_name ||
                  "Unknown Artist"}
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
            {/* ... other special buttons ... */}
            <button
              onClick={() => setIsTimerModalOpen(true)}
              title="Set Sleep Timer"
              className="p-1 transition-colors cursor-pointer"
            >
              <Clock
                className={`w-5 h-5 ${"text-gray-400 hover:text-white"}`}
              />
            </button>

            <button
              onClick={toggleSlowPlayback}
              title="Toggle Slow Playback Rate"
              className="p-1 transition-colors cursor-pointer"
            >
              <Gauge
                className={`w-5 h-5 ${
                  isSlowPlayback
                    ? "text-[#fa4565]"
                    : "text-gray-400 hover:text-white"
                }`}
              />
            </button>

            {/* SYNCED: Using lifted toggleSleeperMode and isSleeperMode */}
            <button
              onClick={toggleSleeperMode}
              title="Sleep Mode (30% Volume)"
              className="p-1 transition-colors cursor-pointer"
            >
              <MoonStar
                className={`w-5 h-5 ${
                  isSleeperMode
                    ? "text-[#fa4565]"
                    : "text-gray-400 hover:text-white"
                }`}
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
            <button
              onClick={toggleFullscreen}
              title="Toggle Fullscreen"
              className="p-1 transition-colors cursor-pointer"
            >
              <Maximize className="w-5 h-5 text-gray-400 hover:text-white" />
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
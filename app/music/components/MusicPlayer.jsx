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
  MicVocal,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import SleepTimerModal from "./SleepTimerModal";

// --- UTILITY FUNCTION ---
const formatTime = (sec) => {
  if (!sec || isNaN(sec)) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60)
    .toString()
    .padStart(2, "0");
  return `${m}:${s}`;
};

// -----------------------------------------------------------------------------
// --- FULLSCREEN PLAYER ---
// -----------------------------------------------------------------------------
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
  isSleeperMode,
  toggleSleeperMode,
}) => {
  const seekBarRef = useRef(null);
  const [seeking, setSeeking] = useState(false);
  const progressPercent = duration ? (progress / duration) * 100 : 0;
  const isMuted = volume === 0;

  const updateSeek = (clientX) => {
    const rect = seekBarRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const pct = Math.min(Math.max(x / rect.width, 0), 1);
    seekTo(pct * duration);
  };

  const handleMouseDown = () => setSeeking(true);
  const handleMouseMove = (e) => seeking && updateSeek(e.clientX);
  const handleMouseUp = (e) => {
    if (seeking) { updateSeek(e.clientX); setSeeking(false); }
  };
  const handleTouchStart = () => setSeeking(true);
  const handleTouchMove = (e) => seeking && updateSeek(e.touches[0].clientX);
  const handleTouchEnd = (e) => {
    if (seeking) { updateSeek(e.changedTouches[0].clientX); setSeeking(false); }
  };

  const [dominantColor, setDominantColor] = useState("#000");

  useEffect(() => {
    if (!currentSong?.cover_url) return;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = currentSong.cover_url;
    img.onload = () => {
      const colorThief = new ColorThief();
      if (img.complete) {
        const [r, g, b] = colorThief.getColor(img);
        setDominantColor(`rgb(${r}, ${g}, ${b})`);
      }
    };
  }, [currentSong]);

  return (
    <div
      className="fixed inset-0 flex items-center justify-center p-4 z-[100] transition-all duration-700"
      style={{ background: `linear-gradient(160deg, ${dominantColor}, #000)` }}
    >
      <button
        onClick={toggleFullscreen}
        className="absolute top-2 sm:top-4 cursor-pointer right-2 sm:right-4 p-2 sm:p-3 rounded-full hover:bg-white/20 
        backdrop-blur-md transition border border-white/30 shadow-lg text-white scale-90 sm:scale-100"
        title="Exit Fullscreen"
      >
        <Minimize className="w-4 h-4 sm:w-6 sm:h-6 opacity-90 hover:opacity-100" />
      </button>

      <div className="w-full max-w-sm text-white rounded-3xl p-6 flex flex-col justify-between shadow-2xl bg-white/10 backdrop-blur-2xl border border-white/15">
        <img
          loading="lazy"
          src={currentSong.cover_url}
          alt="cover"
          className="w-full aspect-square object-cover rounded-2xl mb-6 shadow-xl"
        />

        <div className="text-center mb-4">
          <h1 className="text-xl font-semibold truncate">
            " {currentSong.title} "
          </h1>
          <p className="text-sm opacity-80 truncate">
            {currentSong.artists?.name || currentSong.artist_name || "Unknown Artist"}
          </p>
        </div>

        <div className="mb-6">
          <div
            ref={seekBarRef}
            className="relative w-full h-2 cursor-pointer bg-white/20 rounded-full select-none"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            <div
              className="absolute top-0 left-0 h-2 bg-white rounded-full transition-all"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <div className="flex justify-between text-xs opacity-75 mt-2">
            <span>{formatTime(progress)}</span>
            <span>- {formatTime(duration - progress)}</span>
          </div>
        </div>

        <div className="flex items-center justify-between mb-6">
          <button
            onClick={toggleSleeperMode}
            title="Sleep Mode (30% Volume)"
            className="p-1 transition-colors cursor-pointer hover:text-white"
          >
            <MoonStar className={`w-6 h-6 ${isSleeperMode ? "text-white" : "opacity-50 hover:opacity-100"}`} />
          </button>

          <button onClick={handlePrevClick} className="opacity-70 cursor-pointer hover:opacity-100">
            <svg className="w-10 h-10" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M11.5 5.51515C11.5 4.39414 10.2523 3.72758 9.32432 4.3546L1.87121 9.38945C1.04543 9.94741 1.04543 11.1643 1.87121 11.7223L9.32432 16.7571C10.2523 17.3842 11.5 16.7176 11.5 15.5966V5.51515Z" fill="#fff" />
              <path d="M22.5 5.51515C22.5 4.39414 21.2523 3.72758 20.3243 4.3546L12.8712 9.38945C12.0454 9.94741 12.0454 11.1643 12.8712 11.7223L20.3243 16.7571C21.2523 17.3842 22.5 16.7176 22.5 15.5966V5.51515Z" fill="#fff" />
            </svg>
          </button>

          <button
            className="bg-white text-black cursor-pointer p-4 rounded-full hover:scale-110 transition shadow-lg"
            onClick={togglePlay}
          >
            {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6" />}
          </button>

          <button onClick={playNext} className="opacity-70 cursor-pointer hover:opacity-100">
            <svg className="w-10 h-10" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12.5 5.51515C12.5 4.39414 13.7477 3.72758 14.6757 4.3546L22.1288 9.38945C22.9546 9.94741 22.9546 11.1643 22.1288 11.7223L14.6757 16.7571C13.7477 17.3842 12.5 16.7176 12.5 15.5966V5.51515Z" fill="#fff" />
              <path d="M1.5 5.51515C1.5 4.39414 2.74768 3.72758 3.67568 4.3546L11.1288 9.38945C11.9546 9.94741 11.9546 11.1643 11.1288 11.7223L3.67568 16.7571C2.74768 17.3842 1.5 16.7176 1.5 15.5966V5.51515Z" fill="#fff" />
            </svg>
          </button>

          <button onClick={toggleLoop} className={`${isLoop ? "text-white" : "opacity-50 hover:opacity-100"}`}>
            <Repeat className="w-6 h-6 cursor-pointer" />
          </button>
        </div>

        <div className="flex items-center gap-3">
          <button onClick={toggleMute}>
            {isMuted
              ? <VolumeX className="w-5 h-5 opacity-80" />
              : <Volume2 className="w-5 h-5 opacity-80" />
            }
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
// --- MAIN MusicPlayer COMPONENT ---
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
    playbackRate,
    setPlaybackRate,
    toggleEnhancedAudio,
    isEnhanced,
    // sleepTimerTimeRemaining,
    // setSleepTimer,
    // cancelSleepTimer,
  } = usePlayer();

  const [seeking, setSeeking] = useState(false);
  const [isSleeperMode, setIsSleeperMode] = useState(false);
  const [prevVolume, setPrevVolume] = useState(volume > 0 ? volume : 1.0);
  const [isTimerModalOpen, setIsTimerModalOpen] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [isSlowPlayback, setIsSlowPlayback] = useState(false);
  const [prevRate, setPrevRate] = useState(1.0);
  const [showSpeedPopup, setShowSpeedPopup] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isDolbyOn, setIsDolbyOn] = useState(false);

  // --- TIMER STATE ---
  const [isSongTimer, setIsSongTimer] = useState(false);
  const [sleepTimerRemaining, setSleepTimerRemaining] = useState(0);

  const seekBarRef = useRef(null);
  const sleepTimerRef = useRef(null);

  // --- SYNC SLEEPER MODE WITH VOLUME ---
  useEffect(() => {
    if (volume > 0 && volume !== 0.3) {
      setPrevVolume(volume);
      if (isSleeperMode) setIsSleeperMode(false);
    }
    if (volume === 0 && prevVolume === 0) setPrevVolume(1.0);
  }, [volume, isSleeperMode, prevVolume]);

  useEffect(() => {
    if (volume === 0.3 && !isSleeperMode) setIsSleeperMode(true);
    if (volume !== 0.3 && isSleeperMode) setIsSleeperMode(false);
  }, [volume, isSleeperMode]);

  // --- SLEEP TIMER COUNTDOWN ---
  useEffect(() => {
    if (sleepTimerRemaining > 0) {
      sleepTimerRef.current = setInterval(() => {
        setSleepTimerRemaining((prev) => {
          if (prev <= 1) {
            clearInterval(sleepTimerRef.current);
            // Pause playback when timer hits 0
            if (isPlaying) togglePlay();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(sleepTimerRef.current);
  }, [sleepTimerRemaining > 0]); // only re-run when timer starts/stops

  // --- SONG TIMER: stop after current song ends ---
  useEffect(() => {
    if (isSongTimer && duration > 0 && progress >= duration - 0.5) {
      if (isPlaying) togglePlay();
      setIsSongTimer(false);
    }
  }, [progress, duration, isSongTimer]);

  if (!currentSong) return null;

  // --- SEEK HANDLERS ---
  const updateSeek = (clientX) => {
    const rect = seekBarRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const pct = Math.min(Math.max(x / rect.width, 0), 1);
    seekTo(pct * duration);
  };

  const handleMouseDown = () => setSeeking(true);
  const handleMouseMove = (e) => seeking && updateSeek(e.clientX);
  const handleMouseUp = (e) => {
    if (seeking) { updateSeek(e.clientX); setSeeking(false); }
  };
  const handleTouchStart = () => setSeeking(true);
  const handleTouchMove = (e) => seeking && updateSeek(e.touches[0].clientX);
  const handleTouchEnd = (e) => {
    if (seeking) { updateSeek(e.changedTouches[0].clientX); setSeeking(false); }
  };

  const handlePrevClick = () => {
    if (progress > 3) seekTo(0);
    else playPrev();
  };

  const toggleSleeperMode = () => {
    const newSleeperState = !isSleeperMode;
    setIsSleeperMode(newSleeperState);
    if (newSleeperState) {
      if (volume !== 0.3) setPrevVolume(volume > 0 ? volume : 1.0);
      changeVolume(0.3);
    } else {
      changeVolume(prevVolume > 0 ? prevVolume : 1.0);
    }
    setIsSlowPlayback(false);
  };

  const toggleMute = () => {
    if (volume > 0) {
      if (volume !== 0.3) setPrevVolume(volume);
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
      // setPlaybackRate(0.75);
    } else {
      // setPlaybackRate(prevRate);
    }
    setIsSleeperMode(false);
  };

  const toggleFullscreen = () => setIsFullScreen((prev) => !prev);

  // --- TIMER HANDLERS ---
  const handleSetTimer = (timeInSeconds) => {
    clearInterval(sleepTimerRef.current);
    setSleepTimerRemaining(timeInSeconds);
    setIsSongTimer(false);
    setIsTimerModalOpen(false);
    // setSleepTimer(timeInSeconds); // uncomment when context is ready
  };

  const handleSetSongTimer = () => {
    setIsSongTimer(true);
    setSleepTimerRemaining(0);
    clearInterval(sleepTimerRef.current);
    setIsTimerModalOpen(false);
  };

  const handleCancelTimer = () => {
    setIsSongTimer(false);
    setSleepTimerRemaining(0);
    clearInterval(sleepTimerRef.current);
    // cancelSleepTimer(); // uncomment when context is ready
    setIsTimerModalOpen(false);
  };

  const progressPercent = duration ? (progress / duration) * 100 : 0;
  const isMuted = volume === 0;
  const hasActiveTimer = isSongTimer || sleepTimerRemaining > 0;

  // --- FULLSCREEN ---
  if (isFullScreen) {
    return (
      <FullScreenPlayer
        currentSong={currentSong}
        isPlaying={isPlaying}
        togglePlay={togglePlay}
        playNext={playNext}
        playPrev={playPrev}
        toggleFullscreen={toggleFullscreen}
        progress={progress}
        duration={duration}
        seekTo={seekTo}
        isLoop={isLoop}
        toggleLoop={toggleLoop}
        volume={volume}
        changeVolume={changeVolume}
        toggleMute={toggleMute}
        handlePrevClick={handlePrevClick}
        isSleeperMode={isSleeperMode}
        toggleSleeperMode={toggleSleeperMode}
      />
    );
  }

  return (
    <>
      {/* SLEEP TIMER MODAL */}
      <SleepTimerModal
        isActive={isTimerModalOpen}
        timeRemaining={sleepTimerRemaining}
        isSongTimer={isSongTimer}
        onSetTimer={handleSetTimer}
        onSetSongTimer={handleSetSongTimer}
        onCancelTimer={handleCancelTimer}
        onClose={() => setIsTimerModalOpen(false)}
      />

      {/* COLLAPSE TOGGLE BUTTON */}
      <div
        className={`fixed right-6 z-[60] transition-all duration-500 ease-in-out ${
          isCollapsed ? "bottom-0" : "bottom-[130px] sm:bottom-[95px]"
        }`}
      >
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="bg-black/80 backdrop-blur-md relative bottom-[42px] text-white border border-[#222] px-3 py-1.5 rounded-t-xl shadow-2xl hover:border-[#fa4565]/50 transition-all flex items-center justify-center group"
          title={isCollapsed ? "Show Player" : "Hide Player"}
        >
          {isCollapsed ? (
            <ChevronUp size={18} className="text-[#fa4565] animate-bounce" />
          ) : (
            <ChevronDown size={20} className="text-gray-400 group-hover:text-[#fa4565] transition-colors" />
          )}
        </button>
      </div>

      {/* MAIN PLAYER BAR */}
      <div
        className={`fixed bottom-0 w-full bg-black text-white pt-4 pb-3 px-3 sm:px-5 z-50 shadow-xl border-t border-[#222] transition-transform duration-500 ease-in-out ${
          isCollapsed ? "translate-y-full" : "translate-y-0"
        }`}
      >
        {/* Seek Bar */}
        <div
          ref={seekBarRef}
          className="relative w-full cursor-pointer group select-none"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={() => {}}
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

        {/* Time Labels */}
        <div className="flex justify-between text-[10px] mt-1 opacity-75">
          <span>{formatTime(progress)}</span>
          <span>-{formatTime(duration)}</span>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-between mt-3 flex-wrap sm:flex-nowrap">

          {/* Song Info (Left) */}
          <div className="flex items-center gap-3 w-full sm:w-1/4 mb-3 sm:mb-0 order-1">
            <img
              loading="lazy"
              src={currentSong?.cover_url || "/default-cover.png"}
              alt="cover"
              className="w-12 h-12 rounded object-cover flex-shrink-0 border border-white/10"
            />
            <div className="leading-tight truncate min-w-0">
              <h4 className="font-semibold text-sm truncate">
                {currentSong?.title || "No Track Selected"}
              </h4>
              <p className="text-[11px] opacity-60 truncate">
                {currentSong?.artists?.name || currentSong?.artist_name || "Unknown Artist"}
              </p>
            </div>
          </div>

          {/* Main Buttons (Center) */}
          <div className="flex items-center gap-4 w-full sm:w-1/2 justify-center order-3 sm:order-2">
            <button onClick={handlePrevClick} title="Previous/Restart">
              <SkipBack className="cursor-pointer w-5 h-5 opacity-75 hover:opacity-100 transition" />
            </button>

            <button
              onClick={togglePlay}
              className="cursor-pointer text-black p-3 rounded-full hover:scale-110 transition bg-[#fa4565] flex-shrink-0 shadow-lg shadow-[#fa4565]/20"
              title={isPlaying ? "Pause" : "Play"}
            >
              {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
            </button>

            <button onClick={playNext} title="Skip Next">
              <SkipForward className="cursor-pointer w-5 h-5 opacity-75 hover:opacity-100 transition" />
            </button>

            <button onClick={toggleLoop} title="Toggle Loop">
              <Repeat
                className={`w-5 h-5 transition ${
                  isLoop ? "text-[#fa4565]" : "opacity-75 hover:opacity-100 cursor-pointer"
                }`}
              />
            </button>
          </div>

          {/* Special Controls (Right) */}
          <div className="flex items-center gap-2 w-full sm:w-1/4 justify-end relative mb-3 sm:mb-0 order-2 sm:order-3">

            {/* Enhanced Audio */}
            <button
              onClick={toggleEnhancedAudio}
              title="Enhanced Audio (Dolby + Bass)"
              className={`p-2 rounded-full flex flex-col cursor-pointer items-center gap-1 transition-all duration-500 ${
                isEnhanced
                  ? "bg-[#fa4565]/20 text-[#fa4565] scale-110"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" role="img" xmlns="http://www.w3.org/2000/svg" fill="currentColor">
                <path d="M24,20.352V3.648H0v16.704H24z M18.433,5.806h2.736v12.387h-2.736c-2.839,0-5.214-2.767-5.214-6.194S15.594,5.806,18.433,5.806z M2.831,5.806h2.736c2.839,0,5.214,2.767,5.214,6.194s-2.374,6.194-5.214,6.194H2.831V5.806z" />
              </svg>
            </button>

            {/* Clock / Timer — glows red when active */}
            <button
              onClick={() => setIsTimerModalOpen(true)}
              className="p-1 cursor-pointer relative"
              title={hasActiveTimer ? (isSongTimer ? "Song Timer Active" : `Sleep Timer: ${formatTime(sleepTimerRemaining)}`) : "Sleep Timer"}
            >
              <Clock
                className={`w-5 h-5 transition ${
                  hasActiveTimer ? "text-[#fa4565]" : "text-gray-400 hover:text-white"
                }`}
              />
              {/* Active dot indicator */}
              {hasActiveTimer && (
                <span className="absolute top-0 right-0 w-2 h-2 bg-[#fa4565] rounded-full animate-pulse" />
              )}
            </button>

            {/* Speed */}
            <button onClick={() => setShowSpeedPopup(true)} className="p-1 cursor-pointer">
              <Gauge
                className={`w-5 h-5 transition ${
                  showSpeedPopup ? "text-[#fa4565]" : "text-gray-400 hover:text-white"
                }`}
              />
            </button>

            {/* Sleeper Mode */}
            <button onClick={toggleSleeperMode} className="p-1 cursor-pointer">
              <MoonStar
                className={`w-5 h-5 transition ${
                  isSleeperMode ? "text-[#fa4565]" : "text-gray-400 hover:text-white"
                }`}
              />
            </button>

            {/* Mute */}
            <button onClick={toggleMute}>
              {isMuted
                ? <VolumeX className="w-5 h-5 text-[#fa4565]" />
                : <Volume2 className="w-5 h-5 text-gray-400 hover:text-white" />
              }
            </button>

            {/* Fullscreen */}
            <button onClick={toggleFullscreen} className="p-1 cursor-pointer">
              <Maximize className="w-5 h-5 text-gray-400 hover:text-white transition" />
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

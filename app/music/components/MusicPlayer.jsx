"use client";

import { useRef, useState } from "react";
import { usePlayer } from "../context/PlayerContext";
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Repeat,
  Volume2,
} from "lucide-react";

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
  } = usePlayer();

  const [seeking, setSeeking] = useState(false);
  const seekBarRef = useRef(null);

  if (!currentSong) return null;

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

  const handleMouseDown = () => setSeeking(true);
  const handleMouseMove = (e) => seeking && updateSeek(e.clientX);
  const handleMouseUp = (e) => {
    updateSeek(e.clientX);
    setSeeking(false);
  };

  const handleTouchStart = () => setSeeking(true);
  const handleTouchMove = (e) => seeking && updateSeek(e.touches[0].clientX);
  const handleTouchEnd = (e) => {
    updateSeek(e.changedTouches[0].clientX);
    setSeeking(false);
  };

  // YouTube-like prev button: restart if >3s, else go prev
  const handlePrevClick = () => {
    if (progress > 3) {
      seekTo(0);
    } else {
      playPrev();
    }
  };

  const progressPercent = duration ? (progress / duration) * 100 : 0;

  return (
    <div className="fixed bottom-0 w-full bg-black text-white pt-4 pb-3 px-5 z-50 shadow-xl border-t border-[#222]">
      {/* Seek Bar with Dragging */}
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
        {/* Track */}
        <div className="w-full h-[6px] bg-[#252525] rounded-full" />
        {/* Progress */}
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

      {/* Bottom Controls */}
      <div className="flex items-center justify-between mt-3">
        {/* Song Info */}
        <div className="flex items-center gap-3">
          <img
            src={currentSong.cover_url}
            alt="cover"
            className="w-12 h-12 rounded object-cover"
          />
          <div className="leading-tight">
            <h4 className="font-semibold text-sm">{currentSong.title}</h4>
            <p className="text-[11px] opacity-60">{currentSong.artists?.name}</p>
          </div>
        </div>

        {/* Buttons */}
        <div className="flex items-center gap-4 ">
          <button onClick={handlePrevClick}>
            <SkipBack className="cursor-pointer w-5 h-5 opacity-75 hover:opacity-100 transition" />
          </button>

          <button
            onClick={togglePlay}
            className="cursor-pointer text-black p-3 rounded-full hover:scale-110 transition bg-[#fa4565]"
          >
            {isPlaying ? <Pause className="w-5 h-5 " /> : <Play className="w-5 h-5" />}
          </button>

          <button onClick={playNext}>
            <SkipForward className="cursor-pointer w-5 h-5 opacity-75 hover:opacity-100 transition" />
          </button>

          <button onClick={toggleLoop}>
            <Repeat
              className={`w-5 h-5 transition ${isLoop ? "text-[#fa4565]" : "opacity-75 hover:opacity-100 cursor-pointer"}`}
            />
          </button>
        </div>

        {/* Volume */}
        <div className="flex items-center gap-2 w-28">
          <Volume2 className="w-4 h-4 opacity-80" />
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={volume}
            onChange={(e) => changeVolume(Number(e.target.value))}
            className="w-full h-[3px] "
          />
        </div>
      </div>
    </div>
  );
}

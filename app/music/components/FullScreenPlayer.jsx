// FullScreenPlayer.jsx
"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import ColorThief from "color-thief-browser";
import {
  Play, Pause, Repeat, Volume2, VolumeX,
  MoonStar, Minimize, SkipBack, SkipForward,
} from "lucide-react";

/* ─────────────────────────────────────────────
   UTILITY
───────────────────────────────────────────── */
const formatTime = (sec) => {
  if (!sec || isNaN(sec)) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
};

/* ─────────────────────────────────────────────
   APPLE MUSIC AMBIENT CANVAS
   Replicates the slow-morphing colour-blob
   animation from iOS 17 Apple Music.
───────────────────────────────────────────── */
const AmbientCanvas = ({ colors }) => {
  const canvasRef = useRef(null);
  const rafRef = useRef(null);
  const timeRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !colors?.length) return;
    const ctx = canvas.getContext("2d");

    // Parse "rgb(r,g,b)" strings into [r,g,b] arrays
    const parsed = colors.map((c) => {
      const m = c.match(/\d+/g);
      return m ? m.map(Number) : [30, 30, 30];
    });

    // Each blob gets a random starting position + drift velocity
    const blobs = parsed.map((col, i) => ({
      col,
      x: 0.2 + Math.random() * 0.6,
      y: 0.2 + Math.random() * 0.6,
      vx: (Math.random() - 0.5) * 0.0003,
      vy: (Math.random() - 0.5) * 0.0003,
      r: 0.45 + Math.random() * 0.25,   // radius as fraction of canvas size
      phase: (Math.PI * 2 * i) / parsed.length,
    }));

    const resize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    const draw = () => {
      const W = canvas.width;
      const H = canvas.height;
      timeRef.current += 0.004;
      const t = timeRef.current;

      // Dark base
      ctx.fillStyle = "rgba(0,0,0,1)";
      ctx.fillRect(0, 0, W, H);

      blobs.forEach((b) => {
        // Gentle Lissajous drift
        b.x += b.vx + Math.sin(t * 0.7 + b.phase) * 0.0008;
        b.y += b.vy + Math.cos(t * 0.5 + b.phase) * 0.0008;

        // Soft boundary bounce
        if (b.x < 0.05 || b.x > 0.95) b.vx *= -1;
        if (b.y < 0.05 || b.y > 0.95) b.vy *= -1;
        b.x = Math.min(0.95, Math.max(0.05, b.x));
        b.y = Math.min(0.95, Math.max(0.05, b.y));

        const cx = b.x * W;
        const cy = b.y * H;
        const radius = b.r * Math.max(W, H);

        // Pulsing opacity (0.28 – 0.48 range)
        const alpha = 0.28 + 0.10 * Math.sin(t * 1.2 + b.phase);

        const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
        const [r, g, bl] = b.col;
        grad.addColorStop(0, `rgba(${r},${g},${bl},${alpha})`);
        grad.addColorStop(0.5, `rgba(${r},${g},${bl},${alpha * 0.4})`);
        grad.addColorStop(1, `rgba(${r},${g},${bl},0)`);

        ctx.globalCompositeOperation = "lighter";
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalCompositeOperation = "source-over";
      });

      // Vignette overlay — darkens edges like Apple Music
      const vignette = ctx.createRadialGradient(
        W / 2, H / 2, W * 0.1,
        W / 2, H / 2, W * 0.85
      );
      vignette.addColorStop(0, "rgba(0,0,0,0)");
      vignette.addColorStop(1, "rgba(0,0,0,0.65)");
      ctx.fillStyle = vignette;
      ctx.fillRect(0, 0, W, H);

      rafRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", resize);
    };
  }, [colors]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full"
      style={{ filter: "blur(0px)" }}
    />
  );
};

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
  const [paletteColors, setPaletteColors] = useState([]);

  const progressPercent = duration ? (progress / duration) * 100 : 0;
  const isMuted = volume === 0;

  /* ── Extract full palette from cover ── */
  useEffect(() => {
    if (!currentSong?.cover_url) return;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = currentSong.cover_url;
    img.onload = () => {
      if (!img.complete) return;
      try {
        const ct = new ColorThief();
        // Get 6 colours for richer blobs
        const palette = ct.getPalette(img, 6);
        setPaletteColors(palette.map(([r, g, b]) => `rgb(${r},${g},${b})`));
      } catch (e) {
        console.warn("ColorThief failed", e);
      }
    };
  }, [currentSong?.cover_url]);

  /* ── Seek handlers ── */
  const updateSeek = useCallback((clientX) => {
    if (!seekBarRef.current) return;
    const rect = seekBarRef.current.getBoundingClientRect();
    const pct = Math.min(Math.max((clientX - rect.left) / rect.width, 0), 1);
    seekTo(pct * duration);
  }, [seekTo, duration]);

  const handleMouseDown = () => setSeeking(true);
  const handleMouseMove = (e) => seeking && updateSeek(e.clientX);
  const handleMouseUp = (e) => { if (seeking) { updateSeek(e.clientX); setSeeking(false); } };
  const handleTouchStart = () => setSeeking(true);
  const handleTouchMove = (e) => seeking && updateSeek(e.touches[0].clientX);
  const handleTouchEnd = (e) => { if (seeking) { updateSeek(e.changedTouches[0].clientX); setSeeking(false); } };

  return (
    <div className="fixed inset-0 z-[100] overflow-hidden flex items-center justify-center">

      {/* ── LAYER 1: Animated ambient background ── */}
      <AmbientCanvas colors={paletteColors} />

      {/* ── LAYER 2: Frosted glass noise grain ── */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E")`,
          opacity: 0.04,
          mixBlendMode: "overlay",
        }}
      />

      {/* ── Exit button ── */}
      <button
        onClick={toggleFullscreen}
        className="absolute top-4 right-4 z-10 p-2.5 rounded-full border border-white/20 bg-white/10 backdrop-blur-md hover:bg-white/20 transition text-white"
        title="Exit Fullscreen"
      >
        <Minimize className="w-5 h-5" />
      </button>

      {/* ── MAIN CARD ── */}
      <div
        className="relative z-10 w-full max-w-[360px] mx-4 rounded-3xl overflow-hidden"
        style={{
          background: "rgba(10,10,12,0.55)",
          backdropFilter: "blur(40px) saturate(180%)",
          WebkitBackdropFilter: "blur(40px) saturate(180%)",
          border: "1px solid rgba(255,255,255,0.10)",
          boxShadow: "0 40px 80px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.08)",
        }}
      >
        {/* ── Album Art ── */}
        <div className="relative p-5 pb-0">
          <div className="relative rounded-2xl overflow-hidden shadow-2xl">
            <img
              loading="lazy"
              src={currentSong.cover_url}
              alt="cover"
              className="w-full aspect-square object-cover"
              style={{
                transform: isPlaying ? "scale(1.03)" : "scale(1)",
                transition: "transform 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)",
              }}
            />
            {/* Subtle inner shadow on art */}
            <div
              className="absolute inset-0 rounded-2xl pointer-events-none"
              style={{ boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.08)" }}
            />
          </div>
        </div>

        {/* ── Song info ── */}
        <div className="px-5 pt-5 pb-2 text-white">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h1
                className="text-xl font-bold truncate leading-tight"
                style={{ fontFamily: "'SF Pro Display', 'Helvetica Neue', sans-serif", letterSpacing: "-0.3px" }}
              >
                {currentSong.title}
              </h1>
              <p className="text-sm mt-0.5 truncate" style={{ color: "rgba(255,255,255,0.55)" }}>
                {currentSong.artists?.name || currentSong.artist_name || "Unknown Artist"}
              </p>
            </div>
            {/* Sleep mode pill */}
            <button
              onClick={toggleSleeperMode}
              title="Sleep Mode"
              className={`flex-shrink-0 mt-0.5 p-1.5 rounded-full transition-all ${isSleeperMode
                ? "bg-white/20 text-white"
                : "text-white/40 hover:text-white/70"
                }`}
            >
              <MoonStar className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ── Seek bar ── */}
        <div className="px-5 pb-1">
          <div
            ref={seekBarRef}
            className="relative w-full cursor-pointer select-none group"
            style={{ height: "20px", display: "flex", alignItems: "center" }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={() => seeking && setSeeking(false)}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            {/* Track */}
            <div className="w-full h-1 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.15)" }}>
              <div
                className="h-full rounded-full"
                style={{
                  width: `${progressPercent}%`,
                  background: "rgba(255,255,255,0.9)",
                  transition: seeking ? "none" : "width 0.1s linear",
                }}
              />
            </div>
            {/* Thumb */}
            <div
              className="absolute w-3 h-3 rounded-full bg-white pointer-events-none transition-transform duration-150"
              style={{
                left: `calc(${progressPercent}% - 6px)`,
                transform: seeking ? "scale(1.4)" : "scale(0)",
                opacity: seeking ? 1 : 0,
              }}
            />
          </div>

          <div className="flex justify-between mt-1" style={{ color: "rgba(255,255,255,0.40)", fontSize: "11px", fontVariantNumeric: "tabular-nums" }}>
            <span>{formatTime(progress)}</span>
            <span>−{formatTime(duration - progress)}</span>
          </div>
        </div>

        {/* ── Transport controls ── */}
        <div className="px-5 pb-4 pt-2 flex items-center justify-between">
          {/* Prev */}
          <button
            onClick={handlePrevClick}
            className="text-white opacity-75 hover:opacity-100 transition active:scale-90"
          >
            <svg className="w-9 h-9" viewBox="0 0 24 24" fill="none">
              <path d="M11.5 5.515C11.5 4.394 10.252 3.728 9.324 4.355L1.871 9.389C1.045 9.947 1.045 11.164 1.871 11.722L9.324 16.757C10.252 17.384 11.5 16.718 11.5 15.597V5.515Z" fill="currentColor" />
              <path d="M22.5 5.515C22.5 4.394 21.252 3.728 20.324 4.355L12.871 9.389C12.045 9.947 12.045 11.164 12.871 11.722L20.324 16.757C21.252 17.384 22.5 16.718 22.5 15.597V5.515Z" fill="currentColor" />
            </svg>
          </button>

          {/* Play / Pause */}
          <button
            onClick={togglePlay}
            className="flex items-center justify-center rounded-full bg-white text-black transition-all active:scale-95 hover:scale-105"
            style={{ width: "64px", height: "64px", boxShadow: "0 8px 32px rgba(0,0,0,0.5)" }}
          >
            {isPlaying
              ? <Pause className="w-7 h-7" strokeWidth={2.5} />
              : <Play className="w-7 h-7 ml-0.5" strokeWidth={2.5} />
            }
          </button>

          {/* Next */}
          <button
            onClick={playNext}
            className="text-white opacity-75 hover:opacity-100 transition active:scale-90"
          >
            <svg className="w-9 h-9" viewBox="0 0 24 24" fill="none">
              <path d="M12.5 5.515C12.5 4.394 13.748 3.728 14.676 4.355L22.129 9.389C22.955 9.947 22.955 11.164 22.129 11.722L14.676 16.757C13.748 17.384 12.5 16.718 12.5 15.597V5.515Z" fill="currentColor" />
              <path d="M1.5 5.515C1.5 4.394 2.748 3.728 3.676 4.355L11.129 9.389C11.955 9.947 11.955 11.164 11.129 11.722L3.676 16.757C2.748 17.384 1.5 16.718 1.5 15.597V5.515Z" fill="currentColor" />
            </svg>
          </button>

          {/* Loop */}
          <button
            onClick={toggleLoop}
            className={`transition ${isLoop ? "text-white" : "text-white/40 hover:text-white/70"}`}
          >
            <Repeat className="w-5 h-5" />
          </button>
        </div>

        {/* ── Volume ── */}
        <div
          className="mx-5 mb-5 px-4 py-3 rounded-2xl flex items-center gap-3"
          style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.06)" }}
        >
          <button onClick={toggleMute} className="flex-shrink-0 text-white/60 hover:text-white transition">
            {isMuted
              ? <VolumeX className="w-4 h-4" />
              : <Volume2 className="w-4 h-4" />
            }
          </button>

          <div className="flex-1 relative" style={{ height: "20px", display: "flex", alignItems: "center" }}>
            <div className="w-full h-1 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.12)" }}>
              <div
                className="h-full rounded-full bg-white transition-all"
                style={{ width: `${volume * 100}%` }}
              />
            </div>
            <input
              type="range" min="0" max="1" step="0.01" value={volume}
              onChange={(e) => changeVolume(parseFloat(e.target.value))}
              className="absolute inset-0 w-full opacity-0 cursor-pointer"
              style={{ height: "100%" }}
            />
          </div>

          <Volume2 className="w-4 h-4 text-white/60 flex-shrink-0" />
        </div>
      </div>

      <style>{`
        @keyframes ambientPulse {
          0%, 100% { opacity: 0.85; }
          50%       { opacity: 1; }
        }
      `}</style>
    </div>
  );
};

export default FullScreenPlayer;

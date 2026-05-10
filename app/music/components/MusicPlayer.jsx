
"use client";

import { useRef, useState, useEffect, useCallback, useMemo } from "react";
import { usePlayer } from "../context/PlayerContext";
import ColorThief from "color-thief-browser";
import {
  Play, Pause, SkipBack, SkipForward, Repeat,
  Volume2, VolumeX, MoonStar, Gauge, Clock,
  Maximize, Minimize, ChevronDown, ChevronUp, Music2,
} from "lucide-react";
import SleepTimerModal from "./SleepTimerModal";

// -----------------------------------------------------------------------------
// HELPERS
// -----------------------------------------------------------------------------
const formatTime = (sec) => {
  if (!sec || isNaN(sec)) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
};

const INSTRUMENTAL_GAP_THRESHOLD = 6;

// -----------------------------------------------------------------------------
// LYRICS CACHE
// -----------------------------------------------------------------------------
const LYRICS_CACHE_PREFIX = "lyrics_cache__";
const LYRICS_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function lyricsCacheKey(title, artist) {
  return `${LYRICS_CACHE_PREFIX}${title}__${artist}`.toLowerCase().replace(/\s+/g, "_");
}
function getLyricsFromCache(title, artist) {
  try {
    const raw = localStorage.getItem(lyricsCacheKey(title, artist));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Date.now() - parsed.ts > LYRICS_CACHE_TTL_MS) {
      localStorage.removeItem(lyricsCacheKey(title, artist));
      return null;
    }
    return { lrc: parsed.lrc, synced: parsed.synced };
  } catch { return null; }
}
function saveLyricsToCache(title, artist, lrc, synced) {
  try {
    localStorage.setItem(lyricsCacheKey(title, artist), JSON.stringify({ lrc, synced, ts: Date.now() }));
  } catch { }
}

// -----------------------------------------------------------------------------
// SMART TEXT COLOR
// -----------------------------------------------------------------------------
function getLuminance(r, g, b) {
  const toLinear = (c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}
function getContrastRatio(l1, l2) {
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}
function deriveTextColors(palette, bgRgb) {
  const fallback = {
    active: "rgba(255,255,255,1)",
    past: "rgba(255,255,255,0.55)",
    dim: "rgba(255,255,255,0.18)",
    raw: [255, 255, 255],
  };
  if (!palette || !palette.length || !bgRgb) return fallback;
  const bgLum = getLuminance(...bgRgb);
  let bestColor = null;
  let bestScore = 0;
  for (const [r, g, b] of palette) {
    const lum = getLuminance(r, g, b);
    const contrast = getContrastRatio(lum, bgLum);
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const saturation = max === 0 ? 0 : (max - min) / max;
    const score = contrast * (1 + saturation * 0.5);
    if (score > bestScore) { bestScore = score; bestColor = [r, g, b]; }
  }
  const finalContrast = bestColor ? getContrastRatio(getLuminance(...bestColor), bgLum) : 0;
  if (!bestColor || finalContrast < 2.5) {
    bestColor = bgLum < 0.5 ? [255, 255, 255] : [20, 20, 30];
  }
  const [r, g, b] = bestColor;
  return {
    active: `rgba(${r},${g},${b},1)`,
    past: `rgba(${r},${g},${b},0.5)`,
    dim: `rgba(${r},${g},${b},0.18)`,
    raw: [r, g, b],
  };
}

// -----------------------------------------------------------------------------
// LYRICS UTILS
// -----------------------------------------------------------------------------
async function fetchLyricsFromSources(title, artist) {
  try {
    const r = await fetch(
      `https://lrclib.net/api/get?track_name=${encodeURIComponent(title)}&artist_name=${encodeURIComponent(artist)}`
    );
    if (r.ok) {
      const d = await r.json();
      if (d.syncedLyrics) return { lrc: d.syncedLyrics, synced: true };
      if (d.plainLyrics) return { lrc: d.plainLyrics, synced: false };
    }
  } catch { }
  try {
    const r = await fetch(
      `https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(title)}`
    );
    if (r.ok) {
      const d = await r.json();
      if (d.lyrics?.trim()) return { lrc: d.lyrics.trim(), synced: false };
    }
  } catch { }
  return { lrc: "", synced: false };
}

function parseLRC(lrc) {
  if (!lrc) return [];
  return lrc.split("\n").map((line) => {
    const m = line.match(/\[(\d+):(\d+\.\d+)\](.*)/);
    if (!m) return null;
    return { time: parseInt(m[1]) * 60 + parseFloat(m[2]), text: m[3].trim() };
  }).filter((l) => l && l.text);
}

function parsePlain(text) {
  if (!text) return [];
  return text.split("\n").map((l) => l.trim()).filter(Boolean).map((t) => ({ time: null, text: t }));
}

function injectInstrumentalMarkers(lines, totalDuration) {
  if (!lines.length) return lines;
  const result = [];
  for (let i = 0; i < lines.length; i++) {
    result.push(lines[i]);
    const current = lines[i];
    const next = lines[i + 1];
    if (current.time === null) continue;
    const gapStart = current.time;
    const gapEnd = next ? next.time : (totalDuration || gapStart + INSTRUMENTAL_GAP_THRESHOLD + 1);
    if (gapEnd - gapStart >= INSTRUMENTAL_GAP_THRESHOLD) {
      result.push({ time: gapStart + 0.5, text: "♪", isInstrumental: true, gapEnd });
    }
  }
  return result;
}

// -----------------------------------------------------------------------------
// APPLE MUSIC ANIMATED BACKGROUND
// -----------------------------------------------------------------------------
const AppleMusicBg = ({ baseColor, blobColors }) => (
  <div className="absolute inset-0 overflow-hidden" style={{ backgroundColor: baseColor, transition: "background-color 1.5s ease" }}>
    {blobColors.map((color, i) => (
      <div key={i} className="absolute rounded-full" style={{
        width: "65%", height: "65%",
        backgroundColor: color,
        filter: "blur(72px)", opacity: 0.75,
        animation: `blobMove${i + 1} ${9 + i * 2}s ease-in-out infinite`,
        ...[
          { top: "-10%", left: "-10%" },
          { top: "35%", right: "-15%" },
          { bottom: "-15%", left: "20%" },
          { top: "-5%", right: "10%" },
        ][i],
      }} />
    ))}
    <style>{`
      @keyframes blobMove1{0%,100%{transform:translate(0,0) scale(1)}25%{transform:translate(18%,-12%) scale(1.12)}50%{transform:translate(-8%,22%) scale(0.92)}75%{transform:translate(-18%,-6%) scale(1.06)}}
      @keyframes blobMove2{0%,100%{transform:translate(0,0) scale(1)}25%{transform:translate(-20%,10%) scale(0.9)}50%{transform:translate(12%,-18%) scale(1.1)}75%{transform:translate(15%,12%) scale(0.95)}}
      @keyframes blobMove3{0%,100%{transform:translate(0,0) scale(1)}25%{transform:translate(10%,15%) scale(1.08)}50%{transform:translate(-15%,-10%) scale(0.93)}75%{transform:translate(20%,-5%) scale(1.04)}}
      @keyframes blobMove4{0%,100%{transform:translate(0,0) scale(1)}25%{transform:translate(-12%,-18%) scale(0.95)}50%{transform:translate(18%,8%) scale(1.1)}75%{transform:translate(-5%,20%) scale(0.9)}}
    `}</style>
  </div>
);

// -----------------------------------------------------------------------------
// INSTRUMENTAL INDICATOR
// -----------------------------------------------------------------------------
const InstrumentalLine = ({ isActive, isPast, textColors }) => {
  const [r, g, b] = textColors?.raw || [255, 255, 255];
  return (
    <div className="flex items-center gap-3 mb-7 select-none"
      style={{ opacity: isActive ? 1 : isPast ? 0.5 : 0.18, transition: "opacity 0.4s ease" }}>
      {[0, 1, 2, 3].map((i) => (
        <div key={i} style={{
          width: 3, borderRadius: 2,
          backgroundColor: `rgba(${r},${g},${b},1)`,
          animation: isActive ? `musicBar${i} ${0.6 + i * 0.15}s ease-in-out infinite alternate` : "none",
          height: isActive ? undefined : 8,
        }} />
      ))}
      <span style={{
        fontSize: 16, fontWeight: 500,
        color: `rgba(${r},${g},${b},${isActive ? 0.9 : 0.5})`,
        letterSpacing: "0.12em", fontStyle: "italic",
      }}>
        instrumental
      </span>
      <style>{`
        @keyframes musicBar0{from{height:4px}to{height:22px}}
        @keyframes musicBar1{from{height:12px}to{height:5px}}
        @keyframes musicBar2{from{height:6px}to{height:20px}}
        @keyframes musicBar3{from{height:16px}to{height:4px}}
      `}</style>
    </div>
  );
};

// -----------------------------------------------------------------------------
// WORD-BY-WORD LYRIC LINE
// -----------------------------------------------------------------------------
const LyricLine = ({
  line, nextLineTime, totalDuration, progress,
  isActive, isPast, isSynced, onClick, textColors,
}) => {
  const words = line.text.split(" ");
  const { active: litClr, past: pastClr, dim: dimClr } = textColors || {
    active: "rgba(255,255,255,1)",
    past: "rgba(255,255,255,0.5)",
    dim: "rgba(255,255,255,0.18)",
  };

  let litWords = 0;
  if (isSynced && isActive) {
    const lineStart = line.time;
    const lineEnd = nextLineTime ?? (totalDuration || lineStart + 4);
    const lineDur = Math.max(lineEnd - lineStart, 0.5);
    const elapsed = Math.max(progress - lineStart, 0);
    const wordDur = lineDur / words.length;
    litWords = Math.min(Math.floor(elapsed / wordDur) + 1, words.length);
  }

  return (
    <p onClick={onClick} className="text-left leading-snug mb-7 select-none"
      style={{
        fontSize: "32px", fontWeight: 700,
        cursor: isSynced && line.time !== null ? "pointer" : "default",
        transform: isActive ? "scale(1.04) translateZ(0)" : "scale(1) translateZ(0)",
        transformOrigin: "left center",
        willChange: "transform",
        transition: "transform 0.4s cubic-bezier(0.34, 1.2, 0.64, 1)",
      }}>
      {isSynced
        ? words.map((word, wi) => {
          const lit = isActive ? wi < litWords : isPast;
          const dim = !isActive && !isPast;
          return (
            <span key={wi} style={{
              color: lit ? litClr : dim ? dimClr : pastClr,
              transition: "color 0.18s ease",
              marginRight: wi < words.length - 1 ? "0.3em" : 0,
              display: "inline-block",
              animation: lit && isActive && wi === litWords - 1 ? "wordPop 0.15s ease" : "none",
            }}>
              {word}
            </span>
          );
        })
        : <span style={{ color: isActive ? litClr : isPast ? pastClr : dimClr }}>{line.text}</span>
      }
    </p>
  );
};

// -----------------------------------------------------------------------------
// LYRICS VIEW
// — active line at 40% from top (Apple Music style)
// — bottom padding prevents overlap with the "scroll up" button
// -----------------------------------------------------------------------------
const BOTTOM_BAR_HEIGHT = 80; // px — height of the floating bottom button area

const LyricsView = ({
  lyrics, synced, progress, duration,
  isLoading, songTitle, seekTo, isVisible, textColors,
}) => {
  const containerRef = useRef(null);
  const lineRefs = useRef([]);
  const userScrollingRef = useRef(false);
  const resumeTimerRef = useRef(null);
  const didJumpRef = useRef(false);
  const prevActiveIdx = useRef(-1);

  const activeIdx = synced
    ? lyrics.reduce((acc, line, i) => line.time !== null && progress >= line.time ? i : acc, -1)
    : -1;

  const scrollToActive = useCallback((idx, behavior = "smooth") => {
    const container = containerRef.current;
    const el = lineRefs.current[idx];
    if (!container || !el) return;
    // Use available height minus bottom bar so active line never hides behind it
    const usableHeight = container.offsetHeight - BOTTOM_BAR_HEIGHT;
    const targetScrollTop = el.offsetTop - usableHeight * 0.4;
    container.scrollTo({ top: Math.max(0, targetScrollTop), behavior });
  }, []);

  // First visit: instant jump
  useEffect(() => {
    if (!isVisible) { didJumpRef.current = false; return; }
    if (!synced || activeIdx < 0) return;
    if (!didJumpRef.current) {
      didJumpRef.current = true;
      requestAnimationFrame(() => scrollToActive(activeIdx, "instant"));
    }
  }, [isVisible, synced, activeIdx, scrollToActive]);

  // Auto-scroll on line change
  useEffect(() => {
    if (!synced || activeIdx < 0) return;
    if (activeIdx === prevActiveIdx.current) return;
    prevActiveIdx.current = activeIdx;
    if (!userScrollingRef.current) scrollToActive(activeIdx, "smooth");
  }, [activeIdx, synced, scrollToActive]);

  // Manual scroll: pause 3s then resume
  const handleScroll = useCallback(() => {
    userScrollingRef.current = true;
    clearTimeout(resumeTimerRef.current);
    resumeTimerRef.current = setTimeout(() => {
      userScrollingRef.current = false;
      if (synced && activeIdx >= 0) scrollToActive(activeIdx, "smooth");
    }, 3000);
  }, [synced, activeIdx, scrollToActive]);

  useEffect(() => () => clearTimeout(resumeTimerRef.current), []);

  const [tr, tg, tb] = textColors?.raw || [255, 255, 255];

  if (isLoading) {
    return (
      <div style={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12 }}>
        <div style={{
          width: 32, height: 32, borderRadius: "50%",
          border: `2px solid rgba(${tr},${tg},${tb},0.25)`,
          borderTopColor: `rgba(${tr},${tg},${tb},1)`,
          animation: "spin 0.8s linear infinite",
        }} />
        <p style={{ color: `rgba(${tr},${tg},${tb},0.5)`, fontSize: 14 }}>Finding lyrics...</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!lyrics.length) {
    return (
      <div style={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12 }}>
        <Music2 style={{ width: 40, height: 40, color: `rgba(${tr},${tg},${tb},0.2)` }} />
        <p style={{ fontSize: 14, textAlign: "center", padding: "0 24px", color: `rgba(${tr},${tg},${tb},0.4)` }}>
          No lyrics available for<br />
          <span style={{ color: `rgba(${tr},${tg},${tb},0.65)`, fontWeight: 600 }}>"{songTitle}"</span>
        </p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      style={{
        height: "100%",
        overflowY: "auto",
        overflowX: "hidden",
        padding: "0 28px",
        // ↓ KEY FIX: bottom padding = bottom bar height so last lines scroll above it
        paddingBottom: `${BOTTOM_BAR_HEIGHT + 20}px`,
        scrollbarWidth: "none",
        msOverflowStyle: "none",
      }}
    >
      {/* Top spacer so first line can sit at 40% */}
      <div style={{ height: "40vh" }} />

      {lyrics.map((line, i) => {
        let nextLineTime = null;
        for (let j = i + 1; j < lyrics.length; j++) {
          if (!lyrics[j].isInstrumental && lyrics[j].time !== null) {
            nextLineTime = lyrics[j].time;
            break;
          }
        }

        if (line.isInstrumental) {
          const isActive = synced && progress >= line.time && progress < (line.gapEnd ?? Infinity);
          const isPast = synced && progress >= (line.gapEnd ?? Infinity);
          return (
            <div key={`inst-${i}`} ref={(el) => (lineRefs.current[i] = el)}>
              <InstrumentalLine isActive={isActive} isPast={isPast} textColors={textColors} />
            </div>
          );
        }

        return (
          <div key={i} ref={(el) => (lineRefs.current[i] = el)}>
            <LyricLine
              line={line}
              nextLineTime={nextLineTime}
              totalDuration={duration}
              progress={progress}
              isActive={synced && i === activeIdx}
              isPast={synced && i < activeIdx}
              isSynced={synced}
              textColors={textColors}
              onClick={() => { if (synced && line.time !== null && seekTo) seekTo(line.time); }}
            />
          </div>
        );
      })}

      <style>{`
        @keyframes wordPop {
          0%   { transform: scale(1); }
          50%  { transform: scale(1.14); }
          100% { transform: scale(1); }
        }
      `}</style>
    </div>
  );
};

// -----------------------------------------------------------------------------
// FULLSCREEN PLAYER
// -----------------------------------------------------------------------------
const FullScreenPlayer = ({
  currentSong, isPlaying, togglePlay, playNext, playPrev,
  toggleFullscreen, progress, duration, seekTo,
  isLoop, toggleLoop, volume, changeVolume, toggleMute,
  handlePrevClick, isSleeperMode, toggleSleeperMode,
}) => {
  const seekBarRef = useRef(null);
  const scrollRef = useRef(null);
  const [seeking, setSeeking] = useState(false);
  const [showLyrics, setShowLyrics] = useState(false);
  const [baseColor, setBaseColor] = useState("#0a0a0a");
  const [blobColors, setBlobColors] = useState(["#333", "#222", "#444", "#111"]);
  const [palette, setPalette] = useState(null);
  const [bgRgb, setBgRgb] = useState(null);
  const [lyrics, setLyrics] = useState([]);
  const [lyricsSynced, setLyricsSynced] = useState(false);
  const [lyricsLoading, setLyricsLoading] = useState(false);

  const progressPercent = duration ? (progress / duration) * 100 : 0;
  const isMuted = volume === 0;

  const textColors = useMemo(() => deriveTextColors(palette, bgRgb), [palette, bgRgb]);
  const [tr, tg, tb] = textColors?.raw || [255, 255, 255];

  useEffect(() => {
    if (!currentSong?.cover_url) return;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = currentSong.cover_url;
    img.onload = () => {
      try {
        const ct = new ColorThief();
        const p = ct.getPalette(img, 6);
        const [r, g, b] = p[0];
        const darkR = Math.floor(r * 0.25);
        const darkG = Math.floor(g * 0.25);
        const darkB = Math.floor(b * 0.25);
        setBaseColor(`rgb(${darkR},${darkG},${darkB})`);
        setBgRgb([darkR, darkG, darkB]);
        setBlobColors(p.slice(0, 4).map(([r, g, b]) => `rgb(${r},${g},${b})`));
        setPalette(p);
      } catch { }
    };
  }, [currentSong?.cover_url]);

  useEffect(() => {
    if (!currentSong) return;
    setLyrics([]);
    setLyricsSynced(false);

    if (currentSong.lyrics_lrc !== undefined && currentSong.lyrics_lrc !== null) {
      if (currentSong.lyrics_lrc === "") return;
      const parsed = parseLRC(currentSong.lyrics_lrc);
      if (parsed.length) { setLyrics(injectInstrumentalMarkers(parsed, duration)); setLyricsSynced(true); }
      else { setLyrics(parsePlain(currentSong.lyrics_lrc)); setLyricsSynced(false); }
      return;
    }

    const artistName = currentSong.artists?.name || currentSong.artist_name || "";
    const cached = getLyricsFromCache(currentSong.title, artistName);
    if (cached) {
      if (cached.lrc) {
        if (cached.synced) { const parsed = parseLRC(cached.lrc); setLyrics(injectInstrumentalMarkers(parsed, duration)); setLyricsSynced(true); }
        else { setLyrics(parsePlain(cached.lrc)); setLyricsSynced(false); }
      }
      return;
    }

    setLyricsLoading(true);
    fetchLyricsFromSources(currentSong.title, artistName).then(({ lrc, synced }) => {
      setLyricsLoading(false);
      saveLyricsToCache(currentSong.title, artistName, lrc, synced);
      if (!lrc) return;
      if (synced) { const parsed = parseLRC(lrc); setLyrics(injectInstrumentalMarkers(parsed, duration)); setLyricsSynced(true); }
      else { setLyrics(parsePlain(lrc)); setLyricsSynced(false); }
    });
  }, [currentSong?.id]);

  const updateSeek = (clientX) => {
    const rect = seekBarRef.current.getBoundingClientRect();
    const pct = Math.min(Math.max((clientX - rect.left) / rect.width, 0), 1);
    seekTo(pct * duration);
  };
  const onMouseDown = () => setSeeking(true);
  const onMouseMove = (e) => seeking && updateSeek(e.clientX);
  const onMouseUp = (e) => { if (seeking) { updateSeek(e.clientX); setSeeking(false); } };
  const onTouchStart = () => setSeeking(true);
  const onTouchMove = (e) => seeking && updateSeek(e.touches[0].clientX);
  const onTouchEnd = (e) => { if (seeking) { updateSeek(e.changedTouches[0].clientX); setSeeking(false); } };

  const handleScroll = () => {
    if (scrollRef.current) setShowLyrics(scrollRef.current.scrollTop > 100);
  };

  return (
    <div className="fixed inset-0 z-[100]">
      <AppleMusicBg baseColor={baseColor} blobColors={blobColors} />

      {/* Mini floating card */}
      <div className={`absolute top-3 w-[86%] left-3 z-30 flex items-center gap-2.5
        bg-white/10 backdrop-blur-2xl border border-white/15 rounded-2xl p-2.5
        transition-all duration-500 ease-out
        ${showLyrics ? "opacity-100 translate-y-0 scale-100 pointer-events-auto" : "opacity-0 -translate-y-2 scale-95 pointer-events-none"}`}>
        <img src={currentSong.cover_url} alt="cover" className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
        <div className="overflow-hidden max-w-[150px]">
          <p className="text-[11px] font-medium truncate" style={{ color: `rgba(${tr},${tg},${tb},1)` }}>{currentSong.title}</p>
          <p className="text-[10px] truncate" style={{ color: `rgba(${tr},${tg},${tb},0.55)` }}>
            {currentSong.artists?.name || currentSong.artist_name || "Unknown Artist"}
          </p>
        </div>
      </div>

      {/* Minimize */}
      <button onClick={toggleFullscreen}
        className="absolute top-3 right-3 z-30 p-2.5 rounded-full backdrop-blur-md border transition shadow-lg"
        style={{ color: `rgba(${tr},${tg},${tb},0.9)`, borderColor: `rgba(${tr},${tg},${tb},0.25)`, background: `rgba(${tr},${tg},${tb},0.1)` }}>
        <Minimize className="w-5 h-5" />
      </button>

      {/* Snap scroll outer */}
      <div ref={scrollRef} onScroll={handleScroll} className="absolute inset-0 overflow-y-auto"
        style={{ scrollSnapType: "y mandatory", scrollbarWidth: "none" }}>

        {/* ════ SECTION 1 — PLAYER ════ */}
        <div className="flex items-center justify-center p-4" style={{ minHeight: "100dvh", scrollSnapAlign: "start" }}>
          <div className="relative z-10 w-full max-w-sm rounded-3xl p-6 flex flex-col justify-between shadow-2xl bg-white/10 backdrop-blur-2xl border border-white/15"
            style={{ color: `rgba(${tr},${tg},${tb},1)` }}>

            <img loading="lazy" src={currentSong.cover_url} alt="cover"
              className="w-full aspect-square object-cover rounded-2xl mb-6 shadow-xl" />

            <div className="text-center mb-4">
              <h1 className="text-xl font-semibold truncate">"{currentSong.title}"</h1>
              <p className="text-sm truncate" style={{ opacity: 0.8 }}>
                {currentSong.artists?.name || currentSong.artist_name || "Unknown Artist"}
              </p>
            </div>

            {/* Seek bar */}
            <div className="mb-6">
              <div ref={seekBarRef}
                className="relative w-full h-2 cursor-pointer rounded-full select-none"
                style={{ backgroundColor: `rgba(${tr},${tg},${tb},0.2)` }}
                onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={onMouseUp}
                onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
                <div className="absolute top-0 left-0 h-2 rounded-full transition-all"
                  style={{ width: `${progressPercent}%`, backgroundColor: `rgba(${tr},${tg},${tb},1)` }} />
              </div>
              <div className="flex justify-between text-xs mt-2" style={{ opacity: 0.75 }}>
                <span>{formatTime(progress)}</span>
                <span>-{formatTime(duration - progress)}</span>
              </div>
            </div>

            {/* Controls */}
            <div className="flex items-center justify-between mb-6">
              <button onClick={toggleSleeperMode} title="Sleep Mode">
                <MoonStar className="w-6 h-6 cursor-pointer"
                  style={{ color: `rgba(${tr},${tg},${tb},${isSleeperMode ? 1 : 0.45})` }} />
              </button>
              <button onClick={handlePrevClick} className="cursor-pointer" style={{ opacity: 0.7 }}>
                <svg className="w-10 h-10" viewBox="0 0 24 24" fill="none">
                  <path d="M11.5 5.51515C11.5 4.39414 10.2523 3.72758 9.32432 4.3546L1.87121 9.38945C1.04543 9.94741 1.04543 11.1643 1.87121 11.7223L9.32432 16.7571C10.2523 17.3842 11.5 16.7176 11.5 15.5966V5.51515Z" fill={`rgba(${tr},${tg},${tb},1)`} />
                  <path d="M22.5 5.51515C22.5 4.39414 21.2523 3.72758 20.3243 4.3546L12.8712 9.38945C12.0454 9.94741 12.0454 11.1643 12.8712 11.7223L20.3243 16.7571C21.2523 17.3842 22.5 16.7176 22.5 15.5966V5.51515Z" fill={`rgba(${tr},${tg},${tb},1)`} />
                </svg>
              </button>
              <button onClick={togglePlay}
                className="cursor-pointer p-4 rounded-full hover:scale-110 transition shadow-lg"
                style={{ backgroundColor: `rgba(${tr},${tg},${tb},1)`, color: baseColor }}>
                {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6" />}
              </button>
              <button onClick={playNext} className="cursor-pointer" style={{ opacity: 0.7 }}>
                <svg className="w-10 h-10" viewBox="0 0 24 24" fill="none">
                  <path d="M12.5 5.51515C12.5 4.39414 13.7477 3.72758 14.6757 4.3546L22.1288 9.38945C22.9546 9.94741 22.9546 11.1643 22.1288 11.7223L14.6757 16.7571C13.7477 17.3842 12.5 16.7176 12.5 15.5966V5.51515Z" fill={`rgba(${tr},${tg},${tb},1)`} />
                  <path d="M1.5 5.51515C1.5 4.39414 2.74768 3.72758 3.67568 4.3546L11.1288 9.38945C11.9546 9.94741 11.9546 11.1643 11.1288 11.7223L3.67568 16.7571C2.74768 17.3842 1.5 16.7176 1.5 15.5966V5.51515Z" fill={`rgba(${tr},${tg},${tb},1)`} />
                </svg>
              </button>
              <button onClick={toggleLoop}>
                <Repeat className="w-6 h-6 cursor-pointer"
                  style={{ color: `rgba(${tr},${tg},${tb},${isLoop ? 1 : 0.45})` }} />
              </button>
            </div>

            {/* Volume */}
            <div className="flex items-center gap-3">
              <button onClick={toggleMute}>
                {isMuted
                  ? <VolumeX className="w-5 h-5" style={{ color: `rgba(${tr},${tg},${tb},0.8)` }} />
                  : <Volume2 className="w-5 h-5" style={{ color: `rgba(${tr},${tg},${tb},0.8)` }} />}
              </button>
              <input type="range" min="0" max="1" step="0.01" value={volume}
                onChange={(e) => changeVolume(parseFloat(e.target.value))}
                className="w-full h-[5px] rounded-full cursor-pointer"
                style={{ accentColor: `rgba(${tr},${tg},${tb},1)` }} />
              <Volume2 className="w-5 h-5" style={{ color: `rgba(${tr},${tg},${tb},0.8)` }} />
            </div>
          </div>
        </div>

        {/* ════ SECTION 2 — LYRICS ════ */}
        {/* position:relative so the absolute bottom bar is anchored here */}
        <div style={{ minHeight: "100dvh", scrollSnapAlign: "start", position: "relative" }}>

          {/* Lyrics scroll area — takes full height */}
          <div style={{ position: "absolute", inset: 0 }}>
            <LyricsView
              lyrics={lyrics}
              synced={lyricsSynced}
              progress={progress}
              duration={duration}
              isLoading={lyricsLoading}
              songTitle={currentSong.title}
              seekTo={seekTo}
              isVisible={showLyrics}
              textColors={textColors}
            />
          </div>

          {/* Floating bottom button — always on top, never overlaps lyrics text */}
          <div style={{
            position: "absolute",
            bottom: 0, left: 0, right: 0,
            height: `${BOTTOM_BAR_HEIGHT}px`,
            zIndex: 20,
            pointerEvents: "none",
            // Gradient so lyrics fade out cleanly into the button
            background: `linear-gradient(to bottom, transparent 0%, rgba(0,0,0,0.75) 50%, rgba(0,0,0,0.92) 100%)`,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "flex-end",
            paddingBottom: "18px",
            gap: 4,
          }}>
            <button
              style={{
                pointerEvents: "auto",
                color: `rgba(${tr},${tg},${tb},0.45)`,
                fontSize: 12,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 4,
                background: "none",
                border: "none",
                cursor: "pointer",
              }}
              onClick={() => scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" })}>
              <ChevronDown className="w-4 h-4 rotate-180" />
              <span>scroll up for player</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

// -----------------------------------------------------------------------------
// MAIN MusicPlayer COMPONENT (mini bar)
// -----------------------------------------------------------------------------
export default function MusicPlayer() {
  const {
    currentSong, isPlaying, togglePlay, playNext, playPrev,
    progress, duration, seekTo, isLoop, toggleLoop,
    volume, changeVolume, playbackRate, setPlaybackRate,
    toggleEnhancedAudio, isEnhanced,
  } = usePlayer();

  const [seeking, setSeeking] = useState(false);
  const [isSleeperMode, setIsSleeperMode] = useState(false);
  const [prevVolume, setPrevVolume] = useState(volume > 0 ? volume : 1.0);
  const [isTimerModalOpen, setIsTimerModalOpen] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [showSpeedPopup, setShowSpeedPopup] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [barAccentColor, setBarAccentColor] = useState("#fa4565");
  const [isSongTimer, setIsSongTimer] = useState(false);
  const [sleepTimerRemaining, setSleepTimerRemaining] = useState(0);

  const seekBarRef = useRef(null);
  const sleepTimerRef = useRef(null);

  useEffect(() => {
    if (!currentSong?.cover_url) return;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = currentSong.cover_url;
    img.onload = () => {
      try {
        const ct = new ColorThief();
        const [r, g, b] = ct.getColor(img);
        setBarAccentColor(`rgb(${r},${g},${b})`);
      } catch { }
    };
  }, [currentSong?.cover_url]);

  useEffect(() => {
    if (volume > 0 && volume !== 0.3) {
      setPrevVolume(volume);
      if (isSleeperMode) setIsSleeperMode(false);
    }
    if (volume === 0 && prevVolume === 0) setPrevVolume(1.0);
  }, [volume]);

  useEffect(() => {
    if (volume === 0.3 && !isSleeperMode) setIsSleeperMode(true);
    if (volume !== 0.3 && isSleeperMode) setIsSleeperMode(false);
  }, [volume]);

  useEffect(() => {
    if (sleepTimerRemaining > 0) {
      sleepTimerRef.current = setInterval(() => {
        setSleepTimerRemaining((prev) => {
          if (prev <= 1) { clearInterval(sleepTimerRef.current); if (isPlaying) togglePlay(); return 0; }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(sleepTimerRef.current);
  }, [sleepTimerRemaining > 0]);

  useEffect(() => {
    if (isSongTimer && duration > 0 && progress >= duration - 0.5) {
      if (isPlaying) togglePlay();
      setIsSongTimer(false);
    }
  }, [progress, duration, isSongTimer]);

  if (!currentSong) return null;

  const updateSeek = (clientX) => {
    const rect = seekBarRef.current.getBoundingClientRect();
    const pct = Math.min(Math.max((clientX - rect.left) / rect.width, 0), 1);
    seekTo(pct * duration);
  };
  const onMouseDown = () => setSeeking(true);
  const onMouseMove = (e) => seeking && updateSeek(e.clientX);
  const onMouseUp = (e) => { if (seeking) { updateSeek(e.clientX); setSeeking(false); } };
  const onTouchStart = () => setSeeking(true);
  const onTouchMove = (e) => seeking && updateSeek(e.touches[0].clientX);
  const onTouchEnd = (e) => { if (seeking) { updateSeek(e.changedTouches[0].clientX); setSeeking(false); } };

  const handlePrevClick = () => { if (progress > 3) seekTo(0); else playPrev(); };

  const toggleSleeperMode = () => {
    const next = !isSleeperMode;
    setIsSleeperMode(next);
    if (next) { if (volume !== 0.3) setPrevVolume(volume > 0 ? volume : 1.0); changeVolume(0.3); }
    else changeVolume(prevVolume > 0 ? prevVolume : 1.0);
  };

  const toggleMute = () => {
    if (volume > 0) { if (volume !== 0.3) setPrevVolume(volume); changeVolume(0); }
    else changeVolume(prevVolume > 0 ? prevVolume : 1.0);
    setIsSleeperMode(false);
  };

  const handleSetTimer = (s) => { clearInterval(sleepTimerRef.current); setSleepTimerRemaining(s); setIsSongTimer(false); setIsTimerModalOpen(false); };
  const handleSetSongTimer = () => { setIsSongTimer(true); setSleepTimerRemaining(0); clearInterval(sleepTimerRef.current); setIsTimerModalOpen(false); };
  const handleCancelTimer = () => { setIsSongTimer(false); setSleepTimerRemaining(0); clearInterval(sleepTimerRef.current); setIsTimerModalOpen(false); };

  const progressPercent = duration ? (progress / duration) * 100 : 0;
  const isMuted = volume === 0;
  const hasActiveTimer = isSongTimer || sleepTimerRemaining > 0;

  if (isFullScreen) {
    return (
      <FullScreenPlayer
        currentSong={currentSong}
        isPlaying={isPlaying}
        togglePlay={togglePlay}
        playNext={playNext}
        playPrev={playPrev}
        toggleFullscreen={() => setIsFullScreen(false)}
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
      <SleepTimerModal
        isActive={isTimerModalOpen}
        timeRemaining={sleepTimerRemaining}
        isSongTimer={isSongTimer}
        onSetTimer={handleSetTimer}
        onSetSongTimer={handleSetSongTimer}
        onCancelTimer={handleCancelTimer}
        onClose={() => setIsTimerModalOpen(false)}
      />

      {/* Collapse toggle */}
      <div className={`fixed right-6 z-[60] transition-all duration-500 ease-in-out ${isCollapsed ? "bottom-0" : "bottom-[130px] sm:bottom-[95px]"}`}>
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="bg-black/80 backdrop-blur-md relative bottom-[42px] text-white border border-[#222]
            px-3 py-1.5 rounded-t-xl shadow-2xl hover:border-[#fa4565]/50 transition-all flex items-center justify-center group">
          {isCollapsed
            ? <ChevronUp size={18} className="text-[#fa4565] animate-bounce" />
            : <ChevronDown size={20} className="text-gray-400 group-hover:text-[#fa4565] transition-colors" />}
        </button>
      </div>

      {/* Mini player bar */}
      <div
        className={`fixed bottom-0 w-full bg-black text-white pt-4 pb-3 px-3 sm:px-5 z-50 shadow-xl border-t
          transition-all duration-500 ease-in-out ${isCollapsed ? "translate-y-full" : "translate-y-0"}`}
        style={{ borderTopColor: `${barAccentColor}55`, boxShadow: `0 -2px 24px 0 ${barAccentColor}22` }}>

        {/* Seek bar */}
        <div ref={seekBarRef} className="relative w-full cursor-pointer group select-none"
          onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={onMouseUp}
          onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
          <div className="w-full h-[6px] bg-[#252525] rounded-full" />
          <div className="absolute top-0 left-0 h-[6px] rounded-full transition-colors"
            style={{ width: `${progressPercent}%`, backgroundColor: barAccentColor }} />
          <div className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-white border-2 transition-transform
            ${seeking ? "scale-125" : "scale-0 group-hover:scale-100"}`}
            style={{ borderColor: barAccentColor, left: `calc(${progressPercent}% - 8px)` }} />
        </div>

        <div className="flex justify-between text-[10px] mt-1 opacity-75">
          <span>{formatTime(progress)}</span>
          <span>-{formatTime(duration)}</span>
        </div>

        <div className="flex items-center justify-between mt-3 flex-wrap sm:flex-nowrap">
          {/* Song info */}
          <div className="flex items-center gap-3 w-full sm:w-1/4 mb-3 sm:mb-0 order-1">
            <img loading="lazy" src={currentSong?.cover_url || "/default-cover.png"} alt="cover"
              className="w-12 h-12 rounded object-cover flex-shrink-0 border border-white/10" />
            <div className="leading-tight truncate min-w-0">
              <h4 className="font-semibold text-sm truncate">{currentSong?.title || "No Track Selected"}</h4>
              <p className="text-[11px] opacity-60 truncate">
                {currentSong?.artists?.name || currentSong?.artist_name || "Unknown Artist"}
              </p>
            </div>
          </div>

          {/* Main controls */}
          <div className="flex items-center gap-4 w-full sm:w-1/2 justify-center order-3 sm:order-2">
            <button onClick={handlePrevClick}>
              <SkipBack className="cursor-pointer w-5 h-5 opacity-75 hover:opacity-100 transition" />
            </button>
            <button onClick={togglePlay}
              className="cursor-pointer text-black p-3 rounded-full hover:scale-110 transition flex-shrink-0 shadow-lg"
              style={{ backgroundColor: barAccentColor, boxShadow: `0 4px 20px ${barAccentColor}55` }}>
              {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
            </button>
            <button onClick={playNext}>
              <SkipForward className="cursor-pointer w-5 h-5 opacity-75 hover:opacity-100 transition" />
            </button>
            <button onClick={toggleLoop}>
              <Repeat className="w-5 h-5 transition cursor-pointer"
                style={{ color: isLoop ? barAccentColor : undefined, opacity: isLoop ? 1 : 0.75 }} />
            </button>
          </div>

          {/* Special controls */}
          <div className="flex items-center gap-2 w-full sm:w-1/4 justify-end relative mb-3 sm:mb-0 order-2 sm:order-3">
            <button onClick={toggleEnhancedAudio} title="Enhanced Audio"
              className={`p-2 rounded-full cursor-pointer transition-all duration-500 ${isEnhanced ? "scale-110" : "text-gray-400 hover:text-white"}`}
              style={isEnhanced ? { color: barAccentColor, backgroundColor: `${barAccentColor}22` } : {}}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                <path d="M24,20.352V3.648H0v16.704H24z M18.433,5.806h2.736v12.387h-2.736c-2.839,0-5.214-2.767-5.214-6.194S15.594,5.806,18.433,5.806z M2.831,5.806h2.736c2.839,0,5.214,2.767,5.214,6.194s-2.374,6.194-5.214,6.194H2.831V5.806z" />
              </svg>
            </button>

            <button onClick={() => setIsTimerModalOpen(true)} className="p-1 cursor-pointer relative">
              <Clock className="w-5 h-5 transition"
                style={{ color: hasActiveTimer ? barAccentColor : undefined, opacity: hasActiveTimer ? 1 : undefined }} />
              {hasActiveTimer && (
                <span className="absolute top-0 right-0 w-2 h-2 rounded-full animate-pulse"
                  style={{ backgroundColor: barAccentColor }} />
              )}
            </button>

            <button onClick={() => setShowSpeedPopup(true)} className="p-1 cursor-pointer">
              <Gauge className="w-5 h-5 transition" style={{ color: showSpeedPopup ? barAccentColor : undefined }} />
            </button>

            <button onClick={toggleSleeperMode} className="p-1 cursor-pointer">
              <MoonStar className="w-5 h-5 transition"
                style={{ color: isSleeperMode ? barAccentColor : undefined, opacity: isSleeperMode ? 1 : undefined }} />
            </button>

            <button onClick={toggleMute}>
              {isMuted
                ? <VolumeX className="w-5 h-5" style={{ color: barAccentColor }} />
                : <Volume2 className="w-5 h-5 text-gray-400 hover:text-white" />}
            </button>

            <button onClick={() => setIsFullScreen(true)} className="p-1 cursor-pointer">
              <Maximize className="w-5 h-5 text-gray-400 hover:text-white transition" />
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
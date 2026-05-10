// MusicPlayer.jsx
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

// Minimum gap (seconds) between lyric lines to be considered an instrumental break
const INSTRUMENTAL_GAP_THRESHOLD = 6;

// -----------------------------------------------------------------------------
// LYRICS CACHE HELPERS  ← NEW
// Cache key format: "lyrics_cache__{title}__{artist}"
// Stored value: JSON { lrc: string, synced: boolean, ts: number }
// -----------------------------------------------------------------------------
const LYRICS_CACHE_PREFIX = "lyrics_cache__";
const LYRICS_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function lyricsCacheKey(title, artist) {
  return `${LYRICS_CACHE_PREFIX}${title}__${artist}`.toLowerCase().replace(/\s+/g, "_");
}

function getLyricsFromCache(title, artist) {
  try {
    const raw = localStorage.getItem(lyricsCacheKey(title, artist));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // Invalidate if older than TTL
    if (Date.now() - parsed.ts > LYRICS_CACHE_TTL_MS) {
      localStorage.removeItem(lyricsCacheKey(title, artist));
      return null;
    }
    return { lrc: parsed.lrc, synced: parsed.synced };
  } catch {
    return null;
  }
}

function saveLyricsToCache(title, artist, lrc, synced) {
  try {
    localStorage.setItem(
      lyricsCacheKey(title, artist),
      JSON.stringify({ lrc, synced, ts: Date.now() })
    );
  } catch {
    // localStorage quota exceeded or unavailable — silently ignore
  }
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
  return lrc
    .split("\n")
    .map((line) => {
      const m = line.match(/\[(\d+):(\d+\.\d+)\](.*)/);
      if (!m) return null;
      return { time: parseInt(m[1]) * 60 + parseFloat(m[2]), text: m[3].trim() };
    })
    .filter((l) => l && l.text);
}

function parsePlain(text) {
  if (!text) return [];
  return text.split("\n").map((l) => l.trim()).filter(Boolean).map((t) => ({ time: null, text: t }));
}

/**
 * Injects instrumental placeholder entries between lyric lines where there's
 * a big enough gap. The inserted entry has `isInstrumental: true`.
 */
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
      result.push({
        time: gapStart + 0.5, // start showing just after previous line
        text: "♪",
        isInstrumental: true,
        gapEnd,
      });
    }
  }
  return result;
}

// -----------------------------------------------------------------------------
// APPLE MUSIC ANIMATED BACKGROUND
// -----------------------------------------------------------------------------
const AppleMusicBg = ({ baseColor, blobColors }) => (
  <div
    className="absolute inset-0 overflow-hidden"
    style={{ backgroundColor: baseColor, transition: "background-color 1.5s ease" }}
  >
    {blobColors.map((color, i) => (
      <div
        key={i}
        className="absolute rounded-full"
        style={{
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
        }}
      />
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
const InstrumentalLine = ({ isActive, isPast, isDarkBg }) => {
  const fg = isDarkBg ? "255,255,255" : "20,20,30";
  return (
    <div
      className="flex items-center gap-3 mb-5 select-none"
      style={{
        opacity: isActive ? 1 : isPast ? 0.5 : 0.2,
        transition: "opacity 0.4s ease",
      }}
    >
      {/* animated music bars */}
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          style={{
            width: 3,
            borderRadius: 2,
            backgroundColor: `rgba(${fg},1)`,
            animation: isActive
              ? `musicBar${i} ${0.6 + i * 0.15}s ease-in-out infinite alternate`
              : "none",
            height: isActive ? undefined : 8,
          }}
        />
      ))}
      <span
        style={{
          fontSize: 14,
          fontWeight: 500,
          color: `rgba(${fg},${isActive ? 0.9 : 0.5})`,
          letterSpacing: "0.12em",
          fontStyle: "italic",
        }}
      >
        instrumental
      </span>
      <style>{`
        @keyframes musicBar0{from{height:4px}to{height:20px}}
        @keyframes musicBar1{from{height:10px}to{height:5px}}
        @keyframes musicBar2{from{height:6px}to{height:18px}}
        @keyframes musicBar3{from{height:14px}to{height:4px}}
      `}</style>
    </div>
  );
};

// -----------------------------------------------------------------------------
// WORD-BY-WORD LYRIC LINE
// Fix: font-weight constant (700), only scale animates → no glyph reflow blink
// -----------------------------------------------------------------------------
const LyricLine = ({
  line, nextLineTime, totalDuration, progress,
  isActive, isPast, isSynced, onClick, isDarkBg,
}) => {
  const words = line.text.split(" ");
  const fg = isDarkBg ? "255,255,255" : "20,20,30";
  const litClr = `rgba(${fg},1)`;
  const pastClr = `rgba(${fg},0.55)`;
  const dimClr = `rgba(${fg},0.2)`;

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
    <p
      onClick={onClick}
      className="text-left leading-relaxed mb-5 select-none"
      style={{
        fontSize: "20px",
        // Keep font-weight always 700 — changing weight causes glyph reflow → blink
        fontWeight: 700,
        cursor: isSynced && line.time !== null ? "pointer" : "default",
        // Only animate transform (GPU-composited) — no layout-affecting props
        transform: isActive
          ? "scale(1.04) translateZ(0)"
          : "scale(1) translateZ(0)",
        transformOrigin: "left center",
        willChange: "transform",
        transition: "transform 0.4s cubic-bezier(0.34, 1.2, 0.64, 1)",
      }}
    >
      {isSynced
        ? words.map((word, wi) => {
          const lit = isActive ? wi < litWords : isPast;
          const dim = !isActive && !isPast;
          return (
            <span
              key={wi}
              style={{
                color: lit ? litClr : dim ? dimClr : pastClr,
                transition: "color 0.18s ease",
                marginRight: wi < words.length - 1 ? "0.3em" : 0,
                display: "inline-block",
                animation:
                  lit && isActive && wi === litWords - 1
                    ? "wordPop 0.15s ease"
                    : "none",
              }}
            >
              {word}
            </span>
          );
        })
        : (
          <span style={{ color: isActive ? litClr : isPast ? pastClr : dimClr }}>
            {line.text}
          </span>
        )
      }
    </p>
  );
};

// -----------------------------------------------------------------------------
// LYRICS VIEW
//
// Auto-scroll behaviour:
//   1. Active line changes → smooth scroll to vertical center
//   2. First visit → instant jump to current line (no landing at top mid-song)
//   3. Last visible line is active → auto-scroll up so more lines show above
//   4. Manual scroll → pause 3s then resume
// -----------------------------------------------------------------------------
const LyricsView = ({
  lyrics, synced, progress, duration,
  isLoading, songTitle, seekTo, isVisible, isDarkBg,
}) => {
  const containerRef = useRef(null);
  const lineRefs = useRef([]);
  const userScrollingRef = useRef(false);
  const resumeTimerRef = useRef(null);
  const didJumpRef = useRef(false);
  const prevActiveIdx = useRef(-1);

  const activeIdx = synced
    ? lyrics.reduce((acc, line, i) =>
      line.time !== null && progress >= line.time ? i : acc, -1)
    : -1;

  // ── helper: scroll a line to vertical center ──
  const scrollToLine = useCallback((idx, behavior = "smooth") => {
    const container = containerRef.current;
    const el = lineRefs.current[idx];
    if (!container || !el) return;
    const top = el.offsetTop - container.offsetHeight / 2 + el.offsetHeight / 2;
    container.scrollTo({ top: Math.max(0, top), behavior });
  }, []);

  // ── check if active line is near the bottom of the visible area ──
  const isLineNearBottom = useCallback((idx) => {
    const container = containerRef.current;
    const el = lineRefs.current[idx];
    if (!container || !el) return false;
    const containerRect = container.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    // "near bottom" = bottom of the line is within bottom 30% of container
    const relativeBottom = elRect.bottom - containerRect.top;
    return relativeBottom > container.clientHeight * 0.70;
  }, []);

  // ── first-entry instant jump ──
  useEffect(() => {
    if (!isVisible) {
      didJumpRef.current = false;
      return;
    }
    if (!synced || activeIdx < 0) return;
    if (!didJumpRef.current) {
      didJumpRef.current = true;
      requestAnimationFrame(() => scrollToLine(activeIdx, "instant"));
    }
  }, [isVisible, synced, activeIdx, scrollToLine]);

  // ── continuous auto-scroll: fires every time active line changes ──
  useEffect(() => {
    if (!synced || activeIdx < 0) return;
    if (activeIdx === prevActiveIdx.current) return;
    prevActiveIdx.current = activeIdx;

    if (!userScrollingRef.current) {
      // If active line is near/at the bottom, scroll to center it
      // This covers the "last line on screen" case naturally
      if (isLineNearBottom(activeIdx)) {
        scrollToLine(activeIdx, "smooth");
      } else {
        scrollToLine(activeIdx, "smooth");
      }
    }
  }, [activeIdx, synced, scrollToLine, isLineNearBottom]);

  // ── additional: keep checking if current active line drifts to bottom
  //    (handles case where user is already on the right line but it scrolled down) ──
  useEffect(() => {
    if (!synced || activeIdx < 0 || userScrollingRef.current) return;
    const interval = setInterval(() => {
      if (!userScrollingRef.current && isLineNearBottom(activeIdx)) {
        scrollToLine(activeIdx, "smooth");
      }
    }, 800);
    return () => clearInterval(interval);
  }, [activeIdx, synced, isLineNearBottom, scrollToLine]);

  // ── manual scroll detection → pause auto-scroll 3s ──
  const handleScroll = useCallback(() => {
    userScrollingRef.current = true;
    clearTimeout(resumeTimerRef.current);
    resumeTimerRef.current = setTimeout(() => {
      userScrollingRef.current = false;
      if (synced && activeIdx >= 0) scrollToLine(activeIdx, "smooth");
    }, 3000);
  }, [synced, activeIdx, scrollToLine]);

  useEffect(() => () => clearTimeout(resumeTimerRef.current), []);

  // ── loading / empty states ──
  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 py-10">
        <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin" />
        <p className="text-white/50 text-sm">Finding lyrics...</p>
      </div>
    );
  }

  if (!lyrics.length) {
    const fg = isDarkBg ? "255,255,255" : "20,20,30";
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 py-10">
        <Music2 className="w-10 h-10" style={{ color: `rgba(${fg},0.2)` }} />
        <p className="text-sm text-center px-6" style={{ color: `rgba(${fg},0.4)` }}>
          No lyrics available for<br />
          <span style={{ color: `rgba(${fg},0.6)`, fontWeight: 600 }}>"{songTitle}"</span>
        </p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className="flex-1 overflow-y-auto px-6 py-6 w-full"
      style={{
        scrollbarWidth: "none",
        maskImage: "linear-gradient(to bottom, transparent 0%, black 12%, black 88%, transparent 100%)",
        WebkitMaskImage: "linear-gradient(to bottom, transparent 0%, black 12%, black 88%, transparent 100%)",
      }}
    >
      <div className="h-16" />

      {lyrics.map((line, i) => {
        // Find the next non-instrumental line's time for word timing calc
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
            <div key={`instrumental-${i}`} ref={(el) => (lineRefs.current[i] = el)}>
              <InstrumentalLine isActive={isActive} isPast={isPast} isDarkBg={isDarkBg} />
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
              isDarkBg={isDarkBg}
              onClick={() => {
                if (synced && line.time !== null && seekTo) seekTo(line.time);
              }}
            />
          </div>
        );
      })}

      <div className="h-32" />

      <style>{`
        @keyframes wordPop {
          0%   { transform: scale(1); }
          50%  { transform: scale(1.12); }
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
  const [lyrics, setLyrics] = useState([]);
  const [lyricsSynced, setLyricsSynced] = useState(false);
  const [lyricsLoading, setLyricsLoading] = useState(false);

  const progressPercent = duration ? (progress / duration) * 100 : 0;
  const isMuted = volume === 0;

  // ── determine if background is dark (for text color adaptation) ──
  const isDarkBg = useMemo(() => {
    const m = baseColor.match(/\d+/g);
    if (!m) return true;
    const [r, g, b] = m.map(Number);
    return (r * 299 + g * 587 + b * 114) / 1000 < 128;
  }, [baseColor]);

  // ── palette from cover ──
  useEffect(() => {
    if (!currentSong?.cover_url) return;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = currentSong.cover_url;
    img.onload = () => {
      try {
        const ct = new ColorThief();
        const palette = ct.getPalette(img, 5);
        const [r, g, b] = palette[0];
        setBaseColor(`rgb(${Math.floor(r * 0.25)},${Math.floor(g * 0.25)},${Math.floor(b * 0.25)})`);
        setBlobColors(palette.slice(0, 4).map(([r, g, b]) => `rgb(${r},${g},${b})`));
      } catch { }
    };
  }, [currentSong?.cover_url]);

  // ── fetch lyrics + inject instrumental markers ──
  // CHANGED: check localStorage cache first; on API fetch save result to cache
  useEffect(() => {
    if (!currentSong) return;
    setLyrics([]);
    setLyricsSynced(false);

    // ── Case 1: song has embedded lyrics (e.g. from DB) ──
    if (currentSong.lyrics_lrc !== undefined && currentSong.lyrics_lrc !== null) {
      if (currentSong.lyrics_lrc === "") return;
      const parsed = parseLRC(currentSong.lyrics_lrc);
      if (parsed.length) {
        setLyrics(injectInstrumentalMarkers(parsed, duration));
        setLyricsSynced(true);
      } else {
        setLyrics(parsePlain(currentSong.lyrics_lrc));
        setLyricsSynced(false);
      }
      return;
    }

    // ── Case 2: try localStorage cache first ──
    const artistName = currentSong.artists?.name || currentSong.artist_name || "";
    const cached = getLyricsFromCache(currentSong.title, artistName);

    if (cached) {
      // Cache hit — apply immediately, no network call needed
      if (cached.lrc) {
        if (cached.synced) {
          const parsed = parseLRC(cached.lrc);
          setLyrics(injectInstrumentalMarkers(parsed, duration));
          setLyricsSynced(true);
        } else {
          setLyrics(parsePlain(cached.lrc));
          setLyricsSynced(false);
        }
      }
      // cached.lrc === "" means we already know no lyrics exist → stay empty
      return;
    }

    // ── Case 3: cache miss — fetch from API, then cache result ──
    setLyricsLoading(true);
    fetchLyricsFromSources(currentSong.title, artistName).then(({ lrc, synced }) => {
      setLyricsLoading(false);

      // Always cache the result (even empty string) so we skip the API next time
      saveLyricsToCache(currentSong.title, artistName, lrc, synced);

      if (!lrc) return;
      if (synced) {
        const parsed = parseLRC(lrc);
        setLyrics(injectInstrumentalMarkers(parsed, duration));
        setLyricsSynced(true);
      } else {
        setLyrics(parsePlain(lrc));
        setLyricsSynced(false);
      }
    });
  }, [currentSong?.id]);

  // ── seek bar handlers ──
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

  // ── outer scroll → decide which section is visible ──
  const handleScroll = () => {
    if (scrollRef.current) setShowLyrics(scrollRef.current.scrollTop > 100);
  };

  return (
    <div className="fixed inset-0 z-[100]">
      <AppleMusicBg baseColor={baseColor} blobColors={blobColors} />

      {/* mini floating card */}
      <div
        className={`absolute top-3 w-[86%] left-3 z-30 flex items-center gap-2.5
          bg-white/10 backdrop-blur-2xl border border-white/15 rounded-2xl p-2.5
          transition-all duration-500 ease-out
          ${showLyrics
            ? "opacity-100 translate-y-0 scale-100 pointer-events-auto"
            : "opacity-0 -translate-y-2 scale-95 pointer-events-none"
          }`}
      >
        <img src={currentSong.cover_url} alt="cover" className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
        <div className="overflow-hidden max-w-[120px]">
          <p className="text-white text-[11px] font-medium truncate">{currentSong.title}</p>
          <p className="text-white/55 text-[10px] truncate">
            {currentSong.artists?.name || currentSong.artist_name || "Unknown Artist"}
          </p>
        </div>
      </div>

      {/* minimize */}
      <button
        onClick={toggleFullscreen}
        className="absolute top-3 right-3 z-30 p-2.5 rounded-full
          hover:bg-white/20 backdrop-blur-md border border-white/25 text-white transition shadow-lg"
      >
        <Minimize className="w-5 h-5 opacity-90" />
      </button>

      {/* outer scrollable container (snaps between sections) */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="absolute inset-0 overflow-y-auto"
        style={{ scrollSnapType: "y mandatory", scrollbarWidth: "none" }}
      >

        {/* ════ SECTION 1 — PLAYER ════ */}
        <div
          className="flex items-center justify-center p-4"
          style={{ minHeight: "100dvh", scrollSnapAlign: "start" }}
        >
          <div className="relative z-10 w-full max-w-sm text-white rounded-3xl p-6
            flex flex-col justify-between shadow-2xl bg-white/10 backdrop-blur-2xl border border-white/15">

            <img
              loading="lazy"
              src={currentSong.cover_url}
              alt="cover"
              className="w-full aspect-square object-cover rounded-2xl mb-6 shadow-xl"
            />

            <div className="text-center mb-4">
              <h1 className="text-xl font-semibold truncate">"{currentSong.title}"</h1>
              <p className="text-sm opacity-80 truncate">
                {currentSong.artists?.name || currentSong.artist_name || "Unknown Artist"}
              </p>
            </div>

            {/* seek bar */}
            <div className="mb-6">
              <div
                ref={seekBarRef}
                className="relative w-full h-2 cursor-pointer bg-white/20 rounded-full select-none"
                onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={onMouseUp}
                onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}
              >
                <div className="absolute top-0 left-0 h-2 bg-white rounded-full transition-all" style={{ width: `${progressPercent}%` }} />
              </div>
              <div className="flex justify-between text-xs opacity-75 mt-2">
                <span>{formatTime(progress)}</span>
                <span>-{formatTime(duration - progress)}</span>
              </div>
            </div>

            {/* controls */}
            <div className="flex items-center justify-between mb-6">
              <button onClick={toggleSleeperMode} title="Sleep Mode">
                <MoonStar className={`w-6 h-6 cursor-pointer ${isSleeperMode ? "text-white" : "opacity-50 hover:opacity-100"}`} />
              </button>
              <button onClick={handlePrevClick} className="opacity-70 hover:opacity-100 cursor-pointer">
                <svg className="w-10 h-10" viewBox="0 0 24 24" fill="none">
                  <path d="M11.5 5.51515C11.5 4.39414 10.2523 3.72758 9.32432 4.3546L1.87121 9.38945C1.04543 9.94741 1.04543 11.1643 1.87121 11.7223L9.32432 16.7571C10.2523 17.3842 11.5 16.7176 11.5 15.5966V5.51515Z" fill="#fff" />
                  <path d="M22.5 5.51515C22.5 4.39414 21.2523 3.72758 20.3243 4.3546L12.8712 9.38945C12.0454 9.94741 12.0454 11.1643 12.8712 11.7223L20.3243 16.7571C21.2523 17.3842 22.5 16.7176 22.5 15.5966V5.51515Z" fill="#fff" />
                </svg>
              </button>
              <button onClick={togglePlay} className="bg-white text-black cursor-pointer p-4 rounded-full hover:scale-110 transition shadow-lg">
                {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6" />}
              </button>
              <button onClick={playNext} className="opacity-70 hover:opacity-100 cursor-pointer">
                <svg className="w-10 h-10" viewBox="0 0 24 24" fill="none">
                  <path d="M12.5 5.51515C12.5 4.39414 13.7477 3.72758 14.6757 4.3546L22.1288 9.38945C22.9546 9.94741 22.9546 11.1643 22.1288 11.7223L14.6757 16.7571C13.7477 17.3842 12.5 16.7176 12.5 15.5966V5.51515Z" fill="#fff" />
                  <path d="M1.5 5.51515C1.5 4.39414 2.74768 3.72758 3.67568 4.3546L11.1288 9.38945C11.9546 9.94741 11.9546 11.1643 11.1288 11.7223L3.67568 16.7571C2.74768 17.3842 1.5 16.7176 1.5 15.5966V5.51515Z" fill="#fff" />
                </svg>
              </button>
              <button onClick={toggleLoop}>
                <Repeat className={`w-6 h-6 cursor-pointer ${isLoop ? "text-white" : "opacity-50 hover:opacity-100"}`} />
              </button>
            </div>

            {/* volume */}
            <div className="flex items-center gap-3">
              <button onClick={toggleMute}>
                {isMuted ? <VolumeX className="w-5 h-5 opacity-80" /> : <Volume2 className="w-5 h-5 opacity-80" />}
              </button>
              <input
                type="range" min="0" max="1" step="0.01" value={volume}
                onChange={(e) => changeVolume(parseFloat(e.target.value))}
                className="w-full h-[5px] rounded-full bg-white/20 cursor-pointer accent-white"
              />
              <Volume2 className="w-5 h-5 opacity-80" />
            </div>
          </div>
        </div>

        {/* ════ SECTION 2 — LYRICS (full width) ════ */}
        <div
          className="flex flex-col w-full"
          style={{ minHeight: "100dvh", scrollSnapAlign: "start" }}
        >
          <div className="flex-1 w-full relative z-10">
            <LyricsView
              lyrics={lyrics}
              synced={lyricsSynced}
              progress={progress}
              duration={duration}
              isLoading={lyricsLoading}
              songTitle={currentSong.title}
              seekTo={seekTo}
              isVisible={showLyrics}
              isDarkBg={isDarkBg}
            />
          </div>

          <button
            className="mb-8 flex flex-col items-center gap-1 text-white/30 text-xs"
            onClick={() => scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" })}
          >
            <ChevronDown className="w-4 h-4 rotate-180" />
            <span>scroll up for player</span>
          </button>
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

      {/* collapse toggle */}
      <div className={`fixed right-6 z-[60] transition-all duration-500 ease-in-out ${isCollapsed ? "bottom-0" : "bottom-[130px] sm:bottom-[95px]"}`}>
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="bg-black/80 backdrop-blur-md relative bottom-[42px] text-white border border-[#222]
            px-3 py-1.5 rounded-t-xl shadow-2xl hover:border-[#fa4565]/50 transition-all flex items-center justify-center group"
        >
          {isCollapsed
            ? <ChevronUp size={18} className="text-[#fa4565] animate-bounce" />
            : <ChevronDown size={20} className="text-gray-400 group-hover:text-[#fa4565] transition-colors" />
          }
        </button>
      </div>

      {/* mini player bar */}
      <div
        className={`fixed bottom-0 w-full bg-black text-white pt-4 pb-3 px-3 sm:px-5 z-50 shadow-xl border-t
          transition-all duration-500 ease-in-out ${isCollapsed ? "translate-y-full" : "translate-y-0"}`}
        style={{
          borderTopColor: `${barAccentColor}55`,
          boxShadow: `0 -2px 24px 0 ${barAccentColor}22`,
        }}
      >
        {/* seek bar */}
        <div
          ref={seekBarRef}
          className="relative w-full cursor-pointer group select-none"
          onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={onMouseUp}
          onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}
        >
          <div className="w-full h-[6px] bg-[#252525] rounded-full" />
          <div
            className="absolute top-0 left-0 h-[6px] rounded-full transition-colors"
            style={{ width: `${progressPercent}%`, backgroundColor: barAccentColor }}
          />
          <div
            className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-white border-2 transition-transform
              ${seeking ? "scale-125" : "scale-0 group-hover:scale-100"}`}
            style={{ borderColor: barAccentColor, left: `calc(${progressPercent}% - 8px)` }}
          />
        </div>

        <div className="flex justify-between text-[10px] mt-1 opacity-75">
          <span>{formatTime(progress)}</span>
          <span>-{formatTime(duration)}</span>
        </div>

        <div className="flex items-center justify-between mt-3 flex-wrap sm:flex-nowrap">

          {/* song info */}
          <div className="flex items-center gap-3 w-full sm:w-1/4 mb-3 sm:mb-0 order-1">
            <img
              loading="lazy"
              src={currentSong?.cover_url || "/default-cover.png"}
              alt="cover"
              className="w-12 h-12 rounded object-cover flex-shrink-0 border border-white/10"
            />
            <div className="leading-tight truncate min-w-0">
              <h4 className="font-semibold text-sm truncate">{currentSong?.title || "No Track Selected"}</h4>
              <p className="text-[11px] opacity-60 truncate">
                {currentSong?.artists?.name || currentSong?.artist_name || "Unknown Artist"}
              </p>
            </div>
          </div>

          {/* main controls */}
          <div className="flex items-center gap-4 w-full sm:w-1/2 justify-center order-3 sm:order-2">
            <button onClick={handlePrevClick}>
              <SkipBack className="cursor-pointer w-5 h-5 opacity-75 hover:opacity-100 transition" />
            </button>
            <button
              onClick={togglePlay}
              className="cursor-pointer text-black p-3 rounded-full hover:scale-110 transition flex-shrink-0 shadow-lg"
              style={{ backgroundColor: barAccentColor, boxShadow: `0 4px 20px ${barAccentColor}55` }}
            >
              {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
            </button>
            <button onClick={playNext}>
              <SkipForward className="cursor-pointer w-5 h-5 opacity-75 hover:opacity-100 transition" />
            </button>
            <button onClick={toggleLoop}>
              <Repeat
                className="w-5 h-5 transition cursor-pointer"
                style={{ color: isLoop ? barAccentColor : undefined, opacity: isLoop ? 1 : 0.75 }}
              />
            </button>
          </div>

          {/* special controls */}
          <div className="flex items-center gap-2 w-full sm:w-1/4 justify-end relative mb-3 sm:mb-0 order-2 sm:order-3">

            <button
              onClick={toggleEnhancedAudio}
              title="Enhanced Audio"
              className={`p-2 rounded-full cursor-pointer transition-all duration-500 ${isEnhanced ? "scale-110" : "text-gray-400 hover:text-white"}`}
              style={isEnhanced ? { color: barAccentColor, backgroundColor: `${barAccentColor}22` } : {}}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                <path d="M24,20.352V3.648H0v16.704H24z M18.433,5.806h2.736v12.387h-2.736c-2.839,0-5.214-2.767-5.214-6.194S15.594,5.806,18.433,5.806z M2.831,5.806h2.736c2.839,0,5.214,2.767,5.214,6.194s-2.374,6.194-5.214,6.194H2.831V5.806z" />
              </svg>
            </button>

            <button onClick={() => setIsTimerModalOpen(true)} className="p-1 cursor-pointer relative">
              <Clock
                className="w-5 h-5 transition"
                style={{ color: hasActiveTimer ? barAccentColor : undefined, opacity: hasActiveTimer ? 1 : undefined }}
              />
              {hasActiveTimer && (
                <span className="absolute top-0 right-0 w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: barAccentColor }} />
              )}
            </button>

            <button onClick={() => setShowSpeedPopup(true)} className="p-1 cursor-pointer">
              <Gauge className="w-5 h-5 transition" style={{ color: showSpeedPopup ? barAccentColor : undefined }} />
            </button>

            <button onClick={toggleSleeperMode} className="p-1 cursor-pointer">
              <MoonStar className="w-5 h-5 transition" style={{ color: isSleeperMode ? barAccentColor : undefined, opacity: isSleeperMode ? 1 : undefined }} />
            </button>

            <button onClick={toggleMute}>
              {isMuted
                ? <VolumeX className="w-5 h-5" style={{ color: barAccentColor }} />
                : <Volume2 className="w-5 h-5 text-gray-400 hover:text-white" />
              }
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
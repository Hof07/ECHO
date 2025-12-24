"use client";

import React, {
  createContext,
  useContext,
  useRef,
  useState,
  useEffect,
} from "react";

const PlayerContext = createContext();
export const usePlayer = () => useContext(PlayerContext);

export const PlayerProvider = ({ children }) => {
  const audioRef = useRef(null);

  /* ================= AUDIO ENGINE ================= */
  const audioCtxRef = useRef(null);
  const sourceRef = useRef(null);

  const bassRef = useRef(null);
  const midRef = useRef(null);
  const trebleRef = useRef(null);
  const compressorRef = useRef(null);
  const stereoRef = useRef(null);
  const gainRef = useRef(null);

  const [playlist, setPlaylist] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentSong, setCurrentSong] = useState(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoop, setIsLoop] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);

  /* ================= CORE PLAY ================= */

  const loadAndPlay = async (song, index = 0) => {
    if (!song) return;

    setCurrentIndex(index);
    setCurrentSong(song);

    const audio = audioRef.current;
    const ctx = audioCtxRef.current;

    if (ctx && ctx.state === "suspended") {
      await ctx.resume(); // 🔥 FIX autoplay block
    }

    setTimeout(() => {
      audio?.play().catch(() => {});
    }, 120);
  };

  const playSong = (song, index, list = []) => {
    if (list?.length) setPlaylist(list);
    loadAndPlay(song, index);
  };

  const togglePlay = async () => {
    const audio = audioRef.current;
    const ctx = audioCtxRef.current;

    if (!audio) return;

    if (ctx && ctx.state === "suspended") {
      await ctx.resume();
    }

    isPlaying ? audio.pause() : audio.play().catch(() => {});
  };

  const playNext = () => {
    if (!playlist.length) return;
    const next = (currentIndex + 1) % playlist.length;
    loadAndPlay(playlist[next], next);
  };

  const playPrev = () => {
    if (!playlist.length) return;
    const prev = (currentIndex - 1 + playlist.length) % playlist.length;
    loadAndPlay(playlist[prev], prev);
  };

  const seekTo = (time) => {
    if (audioRef.current) audioRef.current.currentTime = time;
  };

  const toggleLoop = () => {
    setIsLoop((l) => {
      if (audioRef.current) audioRef.current.loop = !l;
      return !l;
    });
  };

  const changeVolume = (val) => {
    setVolume(val);
    if (!gainRef.current) return;

    const ctx = audioCtxRef.current;
    const now = ctx.currentTime;
    gainRef.current.gain.cancelScheduledValues(now);
    gainRef.current.gain.linearRampToValueAtTime(val, now + 0.15);
  };

  /* ================= AUDIO EVENTS ================= */

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onTime = () => setProgress(audio.currentTime);
    const onMeta = () => setDuration(audio.duration || 0);
    const onEnd = () => {
      if (!audio.loop) playNext(); // ✅ AUTO NEXT FIX
    };

    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("loadedmetadata", onMeta);
    audio.addEventListener("ended", onEnd);

    return () => {
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("loadedmetadata", onMeta);
      audio.removeEventListener("ended", onEnd);
    };
  }, [currentIndex, playlist]);

  /* ================= LOAD SONG ================= */

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !currentSong) return;

    audio.pause();
    audio.src = currentSong.audio_url;
    audio.crossOrigin = "anonymous";
    audio.load();
  }, [currentSong]);

  /* ================= AUDIO CONTEXT ================= */

  useEffect(() => {
    if (!audioRef.current || audioCtxRef.current) return;

    const AudioContext = window.AudioContext || window.webkitAudioContext;
    const ctx = new AudioContext();
    audioCtxRef.current = ctx;

    const source = ctx.createMediaElementSource(audioRef.current);
    sourceRef.current = source;

    /* 🎚 EQ */
    const bass = ctx.createBiquadFilter();
    bass.type = "lowshelf";
    bass.frequency.value = 120;
    bass.gain.value = 0;

    const mid = ctx.createBiquadFilter();
    mid.type = "peaking";
    mid.frequency.value = 2000;
    mid.Q.value = 1;
    mid.gain.value = 0;

    const treble = ctx.createBiquadFilter();
    treble.type = "highshelf";
    treble.frequency.value = 9000;
    treble.gain.value = 0;

    /* 🎧 COMPRESSOR (VOICE STABLE) */
    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -20;
    compressor.knee.value = 24;
    compressor.ratio.value = 2.4;
    compressor.attack.value = 0.1;   // smooth vocals
    compressor.release.value = 0.45;

    const gain = ctx.createGain();
    gain.gain.value = volume;

    const stereo = ctx.createStereoPanner();
    stereo.pan.value = 0.08; // Atmos-like widen

    source
      .connect(bass)
      .connect(mid)
      .connect(treble)
      .connect(compressor)
      .connect(gain)
      .connect(stereo)
      .connect(ctx.destination);

    bassRef.current = bass;
    midRef.current = mid;
    trebleRef.current = treble;
    compressorRef.current = compressor;
    stereoRef.current = stereo;
    gainRef.current = gain;

    /* 🎧 AUTO SAFE SMOOTH START */
    const smooth = (node, val, t = 0.25) => {
      const now = ctx.currentTime;
      node.gain.cancelScheduledValues(now);
      node.gain.setValueAtTime(node.gain.value, now);
      node.gain.linearRampToValueAtTime(val, now + t);
    };

    audioRef.current.addEventListener("playing", () => {
      smooth(bass, 3.2);
      smooth(mid, 2.4);
      smooth(treble, 1.7);
    });
  }, []);

  /* ================= MEDIA SESSION ================= */

  useEffect(() => {
    if (!navigator.mediaSession || !currentSong) return;

    navigator.mediaSession.metadata = new MediaMetadata({
      title: currentSong.title,
      artist: currentSong.artist_name,
      artwork: [
        {
          src: currentSong.cover_url,
          sizes: "512x512",
          type: "image/png",
        },
      ],
    });

    navigator.mediaSession.setActionHandler("play", togglePlay);
    navigator.mediaSession.setActionHandler("pause", togglePlay);
    navigator.mediaSession.setActionHandler("previoustrack", playPrev);
    navigator.mediaSession.setActionHandler("nexttrack", playNext);
  }, [currentSong]);

  return (
    <PlayerContext.Provider
      value={{
        playlist,
        currentIndex,
        currentSong,
        isPlaying,
        progress,
        duration,
        isLoop,
        volume,
        playSong,
        togglePlay,
        playNext,
        playPrev,
        seekTo,
        toggleLoop,
        changeVolume,
      }}
    >
      {children}
      <audio ref={audioRef} preload="auto" />
    </PlayerContext.Provider>
  );
};

"use client";

import React, {
  createContext,
  useContext,
  useRef,
  useState,
  useEffect,
} from "react";
import { Play, Headset } from "lucide-react";

const PlayerContext = createContext();
export const usePlayer = () => useContext(PlayerContext);

export const PlayerProvider = ({ children }) => {
  const audioRef = useRef(null);
  const lastTimeRef = useRef(0);

  /* ================= 3D AUDIO ENGINE NODES ================= */
  const audioCtx = useRef(null);
  const source = useRef(null);
  const bassNode = useRef(null);
  const presenceNode = useRef(null);
  const clarityNode = useRef(null);
  const airNode = useRef(null);
  const panner3D = useRef(null);
  const punchNode = useRef(null);
  const gainNode = useRef(null);
  const limiterNode = useRef(null);

  /* ================= STATE & PERSISTENCE (RESTART MEMORY) ================= */
  const [playlist, setPlaylist] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("player_playlist");
      return saved ? JSON.parse(saved) : [];
    }
    return [];
  });

  const [currentIndex, setCurrentIndex] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("player_current_index");
      return saved ? parseInt(saved) : 0;
    }
    return 0;
  });

  const [currentSong, setCurrentSong] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("player_current_song");
      return saved ? JSON.parse(saved) : null;
    }
    return null;
  });

  const [isEnhanced, setIsEnhanced] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoop, setIsLoop] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [playbackRate, setPlaybackRate] = useState(1.0);

  const [listenedSeconds, setListenedSeconds] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("total_listened_time");
      return saved ? parseFloat(saved) : 0;
    }
    return 0;
  });

  /* ================= SAVE STATE TO LOCAL STORAGE ================= */
  useEffect(() => {
    localStorage.setItem("player_playlist", JSON.stringify(playlist));
    localStorage.setItem("player_current_index", currentIndex.toString());
    localStorage.setItem("player_current_song", JSON.stringify(currentSong));
    localStorage.setItem("total_listened_time", listenedSeconds.toString());
  }, [playlist, currentIndex, currentSong, listenedSeconds]);

  /* ================= AUDIO ENGINE INITIALIZATION (MOBILE FIX) ================= */
  const initAudioEngine = () => {
    if (audioCtx.current) return;

    const Context = window.AudioContext || window.webkitAudioContext;
    // latencyHint 'playback' helps mobile browsers prevent lag
    audioCtx.current = new Context({ latencyHint: "playback" });

    source.current = audioCtx.current.createMediaElementSource(audioRef.current);

    bassNode.current = audioCtx.current.createBiquadFilter();
    presenceNode.current = audioCtx.current.createBiquadFilter();
    clarityNode.current = audioCtx.current.createBiquadFilter();
    airNode.current = audioCtx.current.createBiquadFilter();
    panner3D.current = audioCtx.current.createPanner();

    // Performance: Use equalpower on mobile to save CPU and stop crackling
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    panner3D.current.panningModel = isMobile ? "equalpower" : "HRTF";

    punchNode.current = audioCtx.current.createDynamicsCompressor();
    gainNode.current = audioCtx.current.createGain();

    // Safety Limiter: Stops the "Blast" distortion on mobile
    limiterNode.current = audioCtx.current.createDynamicsCompressor();
    limiterNode.current.threshold.value = -1.0;
    limiterNode.current.ratio.value = 20;

    bassNode.current.type = "lowshelf";
    bassNode.current.frequency.value = 60;
    presenceNode.current.type = "peaking";
    presenceNode.current.frequency.value = 2800;
    clarityNode.current.type = "highshelf";
    clarityNode.current.frequency.value = 8000;
    airNode.current.type = "highshelf";
    airNode.current.frequency.value = 14000;

    punchNode.current.threshold.value = -24;
    punchNode.current.ratio.value = 4;
    gainNode.current.gain.value = 0.9;

    source.current
      .connect(bassNode.current)
      .connect(presenceNode.current)
      .connect(clarityNode.current)
      .connect(airNode.current)
      .connect(panner3D.current)
      .connect(punchNode.current)
      .connect(gainNode.current)
      .connect(limiterNode.current)
      .connect(audioCtx.current.destination);
  };

  /* ================= TOGGLE ENHANCED AUDIO (NO CRACKLE) ================= */
  const toggleEnhancedAudio = () => {
    if (!audioCtx.current) initAudioEngine();
    const newState = !isEnhanced;
    setIsEnhanced(newState);

    if (audioCtx.current.state === "suspended") audioCtx.current.resume();

    const t = audioCtx.current.currentTime;
    const ramp = 0.4;

    const safeRamp = (param, val) => {
      param.cancelScheduledValues(t);
      param.setValueAtTime(param.value, t);
      param.linearRampToValueAtTime(val, t + ramp);
    };

    if (newState) {
      safeRamp(panner3D.current.positionY, 0.7);
      safeRamp(panner3D.current.positionZ, 1.5);
      safeRamp(bassNode.current.gain, 7);
      safeRamp(presenceNode.current.gain, 3);
      safeRamp(clarityNode.current.gain, 4);
      safeRamp(airNode.current.gain, 7);
      safeRamp(gainNode.current.gain, 1.05);
    } else {
      safeRamp(panner3D.current.positionY, 0);
      safeRamp(panner3D.current.positionZ, 0);
      [bassNode, presenceNode, clarityNode, airNode].forEach(node => safeRamp(node.current.gain, 0));
      safeRamp(gainNode.current.gain, 0.9);
    }
  };

  /* ================= PLAYER ACTIONS ================= */
  const loadAndPlay = (song, index = 0) => {
    if (!song) return;
    setCurrentIndex(index);
    setCurrentSong(song);
    lastTimeRef.current = 0;
  };

  const playSong = (song, index, list = []) => {
    if (list.length) setPlaylist(list);
    loadAndPlay(song, index);
  };

  const togglePlay = async () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      if (audioCtx.current?.state === "suspended") await audioCtx.current.resume();
      audioRef.current.play().catch(() => setIsPlaying(false));
    }
  };

  const playNext = () => {
    if (!playlist.length) return;
    const nextIndex = (currentIndex + 1) % playlist.length;
    loadAndPlay(playlist[nextIndex], nextIndex);
  };

  const playPrev = () => {
    if (!playlist.length) return;
    const prevIndex = (currentIndex - 1 + playlist.length) % playlist.length;
    loadAndPlay(playlist[prevIndex], prevIndex);
  };

  const seekTo = (time) => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = time;
  };

  const changeVolume = (val) => {
    setVolume(val);
    if (audioRef.current) audioRef.current.volume = val;
  };

  const toggleLoop = () => {
    setIsLoop((prev) => {
      const next = !prev;
      if (audioRef.current) audioRef.current.loop = next;
      return next;
    });
  };

  /* ================= MEDIA SESSION (LOCK SCREEN) ================= */
  const updatePlaybackState = () => {
    if (!navigator.mediaSession) return;
    navigator.mediaSession.playbackState = isPlaying ? "playing" : "paused";
  };

  useEffect(() => {
    if (!currentSong || !navigator.mediaSession) return;

    navigator.mediaSession.metadata = new MediaMetadata({
      title: currentSong.title || "Unknown Title",
      artist: currentSong.artist_name || "Unknown Artist",
      artwork: [{ src: currentSong.cover_url, sizes: "512x512", type: "image/png" }],
    });

    navigator.mediaSession.setActionHandler("play", togglePlay);
    navigator.mediaSession.setActionHandler("pause", togglePlay);
    navigator.mediaSession.setActionHandler("previoustrack", playPrev);
    navigator.mediaSession.setActionHandler("nexttrack", playNext);
    navigator.mediaSession.setActionHandler("seekto", (e) => seekTo(e.seekTime));

    updatePlaybackState();
  }, [currentSong, isPlaying]);

  /* ================= CORE AUDIO LISTENERS ================= */
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onTimeUpdate = () => setProgress(audio.currentTime);
    const onLoadedMeta = () => setDuration(audio.duration || 0);
    const onEnded = () => { if (!audio.loop) setTimeout(playNext, 100); };

    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("loadedmetadata", onLoadedMeta);
    audio.addEventListener("ended", onEnded);

    return () => {
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("loadedmetadata", onLoadedMeta);
      audio.removeEventListener("ended", onEnded);
    };
  }, [playlist, currentIndex]);

  // Handle URL change
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !currentSong) return;

    // Check if song is already loaded to avoid restarting on page refresh
    if (audio.src !== currentSong.audio_url) {
      audio.src = currentSong.audio_url;
      audio.crossOrigin = "anonymous";
      audio.load();
      // On browser restart, we don't auto-play to respect browser policy
      // but if the user clicks play, it works.
    }
  }, [currentSong]);

  // Sync volume and speed
  useEffect(() => { if (audioRef.current) audioRef.current.volume = volume; }, [volume]);
  useEffect(() => { if (audioRef.current) audioRef.current.playbackRate = playbackRate; }, [playbackRate]);

  // Listen time tracker
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const interval = setInterval(() => {
      if (!audio.paused && !audio.ended) {
        const current = audio.currentTime;
        if (current > lastTimeRef.current) {
          const diff = current - lastTimeRef.current;
          if (diff < 2) setListenedSeconds((prev) => prev + diff);
        }
        lastTimeRef.current = current;
      }
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const currentSongId = currentSong?.id || null;

  return (
    <PlayerContext.Provider
      value={{
        playlist, currentIndex, currentSong, isPlaying, progress, duration,
        isLoop, volume, currentSongId, playbackRate, listenedSeconds, isEnhanced,
        toggleEnhancedAudio, setPlaybackRate, playSong, togglePlay,
        playNext, playPrev, seekTo, toggleLoop, changeVolume,
      }}
    >
      {children}
      <audio ref={audioRef} preload="auto" playsInline />
    </PlayerContext.Provider>
  );
};

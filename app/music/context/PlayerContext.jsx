"use client";

import React, {
  createContext,
  useContext,
  useRef,
  useState,
  useEffect,
  useCallback,
} from "react";

/**
 * PLAYER CONTEXT & HOOK
 * Provides global access to the 3D Audio Engine and Player State
 */
const PlayerContext = createContext();
export const usePlayer = () => useContext(PlayerContext);

export const PlayerProvider = ({ children }) => {
  /* ================= REFS (AUDIO NODES & STATE) ================= */
  const audioRef = useRef(null);
  const lastTimeRef = useRef(0);
  const audioCtx = useRef(null);
  const source = useRef(null);
  
  // 3D Engine Nodes
  const bassNode = useRef(null);
  const presenceNode = useRef(null);
  const clarityNode = useRef(null);
  const airNode = useRef(null);
  const panner3D = useRef(null);
  const punchNode = useRef(null);
  const gainNode = useRef(null);
  const limiterNode = useRef(null);
  const analyzerNode = useRef(null); // For frequency visualizers

  /* ================= STATE ================= */
  const [playlist, setPlaylist] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentSong, setCurrentSong] = useState(null);
  const [isEnhanced, setIsEnhanced] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoop, setIsLoop] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [playbackRate, setPlaybackRate] = useState(1.0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // Persistence for total listening time
  const [listenedSeconds, setListenedSeconds] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("total_listened_time");
      return saved ? parseFloat(saved) : 0;
    }
    return 0;
  });

  /* ================= PERSISTENCE EFFECT ================= */
  useEffect(() => {
    localStorage.setItem("total_listened_time", listenedSeconds.toString());
  }, [listenedSeconds]);

  /* ================= 3D AUDIO ENGINE INITIALIZATION ================= */
  const initAudioEngine = useCallback(() => {
    if (audioCtx.current) return;

    try {
      const Context = window.AudioContext || window.webkitAudioContext;
      // playback hint optimizes for battery and buffer stability on mobile
      audioCtx.current = new Context({ latencyHint: "playback" });

      source.current = audioCtx.current.createMediaElementSource(audioRef.current);

      // Initialize Filters
      bassNode.current = audioCtx.current.createBiquadFilter();
      presenceNode.current = audioCtx.current.createBiquadFilter();
      clarityNode.current = audioCtx.current.createBiquadFilter();
      airNode.current = audioCtx.current.createBiquadFilter();
      
      // Spatial Panning
      panner3D.current = audioCtx.current.createPanner();
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      panner3D.current.panningModel = isMobile ? "equalpower" : "HRTF";
      panner3D.current.distanceModel = "inverse";

      // Dynamics & Volume
      punchNode.current = audioCtx.current.createDynamicsCompressor();
      gainNode.current = audioCtx.current.createGain();
      analyzerNode.current = audioCtx.current.createAnalyser();
      
      // Safety Limiter: Prevents clipping and hardware damage
      limiterNode.current = audioCtx.current.createDynamicsCompressor();
      limiterNode.current.threshold.value = -1.0;
      limiterNode.current.knee.value = 0;
      limiterNode.current.ratio.value = 20;

      // EQ Frequency Configuration
      bassNode.current.type = "lowshelf";
      bassNode.current.frequency.value = 60;
      presenceNode.current.type = "peaking";
      presenceNode.current.frequency.value = 2800;
      presenceNode.current.Q.value = 0.7;
      clarityNode.current.type = "highshelf";
      clarityNode.current.frequency.value = 8000;
      airNode.current.type = "highshelf";
      airNode.current.frequency.value = 14000;

      // Cinema Style Compression
      punchNode.current.threshold.value = -24;
      punchNode.current.ratio.value = 4;
      punchNode.current.knee.value = 30;

      gainNode.current.gain.value = volume;

      // Connection Chain
      source.current
        .connect(bassNode.current)
        .connect(presenceNode.current)
        .connect(clarityNode.current)
        .connect(airNode.current)
        .connect(panner3D.current)
        .connect(punchNode.current)
        .connect(gainNode.current)
        .connect(analyzerNode.current)
        .connect(limiterNode.current)
        .connect(audioCtx.current.destination);
    } catch (e) {
      console.error("Failed to initialize Audio Engine:", e);
      setError("Audio Engine initialization failed.");
    }
  }, [volume]);

  /* ================= AUDIO ENHANCEMENT LOGIC ================= */
  const toggleEnhancedAudio = () => {
    if (!audioCtx.current) initAudioEngine();
    const newState = !isEnhanced;
    setIsEnhanced(newState);

    if (audioCtx.current.state === "suspended") audioCtx.current.resume();

    const t = audioCtx.current.currentTime;
    const ramp = 0.5; // Smooth 500ms transition

    const safeRamp = (param, val) => {
      param.cancelScheduledValues(t);
      param.setValueAtTime(param.value, t);
      param.linearRampToValueAtTime(val, t + ramp);
    };

    if (newState) {
      // Move soundstage forward and up
      safeRamp(panner3D.current.positionX, 0);
      safeRamp(panner3D.current.positionY, 0.8);
      safeRamp(panner3D.current.positionZ, 1.8);

      // Cinematic EQ Curves
      safeRamp(bassNode.current.gain, 9);
      safeRamp(presenceNode.current.gain, 3.5);
      safeRamp(clarityNode.current.gain, 5.5);
      safeRamp(airNode.current.gain, 8.5);
      safeRamp(gainNode.current.gain, volume + 0.1);
    } else {
      // Reset soundstage to center
      safeRamp(panner3D.current.positionX, 0);
      safeRamp(panner3D.current.positionY, 0);
      safeRamp(panner3D.current.positionZ, 0);

      safeRamp(bassNode.current.gain, 0);
      safeRamp(presenceNode.current.gain, 0);
      safeRamp(clarityNode.current.gain, 0);
      safeRamp(airNode.current.gain, 0);
      safeRamp(gainNode.current.gain, volume);
    }
  };

  /* ================= NAVIGATION LOGIC ================= */
  const loadAndPlay = useCallback((song, index = 0) => {
    if (!song) return;
    setError(null);
    setIsLoading(true);
    setCurrentIndex(index);
    setCurrentSong(song);
    lastTimeRef.current = 0;
  }, []);

  const playSong = (song, index, list = []) => {
    if (Array.isArray(list) && list.length) setPlaylist(list);
    loadAndPlay(song, index);
  };

  const playNext = useCallback(() => {
    if (!playlist.length) return;
    const nextIndex = (currentIndex + 1) % playlist.length;
    loadAndPlay(playlist[nextIndex], nextIndex);
  }, [playlist, currentIndex, loadAndPlay]);

  const playPrev = useCallback(() => {
    if (!playlist.length) return;
    const prevIndex = (currentIndex - 1 + playlist.length) % playlist.length;
    loadAndPlay(playlist[prevIndex], prevIndex);
  }, [playlist, currentIndex, loadAndPlay]);

  const togglePlay = async () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
    } else {
      if (audioCtx.current?.state === "suspended") {
        await audioCtx.current.resume();
      }
      try {
        await audio.play();
      } catch (err) {
        setError("Playback blocked. Please interact with the page first.");
        setIsPlaying(false);
      }
    }
  };

  const seekTo = (time) => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = time;
    setProgress(time);
    lastTimeRef.current = time;
  };

  const toggleLoop = () => {
    setIsLoop((prev) => {
      const next = !prev;
      if (audioRef.current) audioRef.current.loop = next;
      return next;
    });
  };

  const changeVolume = (val) => {
    const cleanVal = Math.max(0, Math.min(1, val));
    setVolume(cleanVal);
    if (audioRef.current) audioRef.current.volume = cleanVal;
    if (gainNode.current) {
      const t = audioCtx.current?.currentTime || 0;
      gainNode.current.gain.setTargetAtTime(cleanVal, t, 0.1);
    }
  };

  /* ================= LISTENING STATS EFFECT ================= */
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

  /* ================= AUDIO EVENT BINDINGS ================= */
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onTimeUpdate = () => setProgress(audio.currentTime);
    const onLoadedMeta = () => {
      setDuration(audio.duration || 0);
      setIsLoading(false);
    };
    const onWaiting = () => setIsLoading(true);
    const onPlaying = () => setIsLoading(false);
    const onEnded = () => {
      if (!isLoop) setTimeout(() => playNext(), 100);
    };
    const onErr = () => {
      setError("Failed to load audio source.");
      setIsLoading(false);
    };

    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("loadedmetadata", onLoadedMeta);
    audio.addEventListener("waiting", onWaiting);
    audio.addEventListener("playing", onPlaying);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("error", onErr);

    return () => {
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("loadedmetadata", onLoadedMeta);
      audio.removeEventListener("waiting", onWaiting);
      audio.removeEventListener("playing", onPlaying);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("error", onErr);
    };
  }, [playlist, currentIndex, isLoop, playNext]);

  /* ================= SOURCE LOADING EFFECT ================= */
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (!currentSong) {
      audio.pause();
      audio.src = "";
      setIsPlaying(false);
      setProgress(0);
      setDuration(0);
      return;
    }

    setIsLoading(true);
    audio.pause();
    audio.src = currentSong.audio_url;
    audio.crossOrigin = "anonymous";
    audio.load();

    const handleAutoPlay = async () => {
      try {
        if (audioCtx.current?.state === "suspended") {
          await audioCtx.current.resume();
        }
        await audio.play();
      } catch {
        setIsPlaying(false);
      }
    };

    audio.addEventListener("canplaythrough", handleAutoPlay, { once: true });
  }, [currentSong]);

  /* ================= MEDIA SESSION (SYSTEM UI) ================= */
  const updateMediaPosition = useCallback(() => {
    if ("mediaSession" in navigator && audioRef.current) {
      try {
        navigator.mediaSession.setPositionState({
          duration: audioRef.current.duration || 0,
          playbackRate: audioRef.current.playbackRate || 1,
          position: audioRef.current.currentTime || 0,
        });
      } catch (e) {}
    }
  }, []);

  useEffect(() => {
    const interval = setInterval(updateMediaPosition, 2000);
    return () => clearInterval(interval);
  }, [updateMediaPosition]);

  useEffect(() => {
    if (!currentSong || !("mediaSession" in navigator)) return;

    navigator.mediaSession.metadata = new MediaMetadata({
      title: currentSong.title || "Unknown Title",
      artist: currentSong.artist_name || "Unknown Artist",
      album: currentSong.album_name || "Single",
      artwork: [
        { src: currentSong.cover_url, sizes: "96x96", type: "image/png" },
        { src: currentSong.cover_url, sizes: "512x512", type: "image/png" },
      ],
    });

    navigator.mediaSession.setActionHandler("play", togglePlay);
    navigator.mediaSession.setActionHandler("pause", togglePlay);
    navigator.mediaSession.setActionHandler("previoustrack", playPrev);
    navigator.mediaSession.setActionHandler("nexttrack", playNext);
    navigator.mediaSession.setActionHandler("seekto", (details) => {
      seekTo(details.seekTime);
    });

    return () => {
      navigator.mediaSession.setActionHandler("play", null);
      navigator.mediaSession.setActionHandler("pause", null);
      navigator.mediaSession.setActionHandler("previoustrack", null);
      navigator.mediaSession.setActionHandler("nexttrack", null);
      navigator.mediaSession.setActionHandler("seekto", null);
    };
  }, [currentSong, playNext, playPrev]);

  /* ================= VALUES EXPOSED TO APP ================= */
  const currentSongId = currentSong?.id || null;

  const value = {
    // State
    playlist,
    currentIndex,
    currentSong,
    currentSongId,
    isPlaying,
    isLoading,
    isLoop,
    isMuted,
    isEnhanced,
    progress,
    duration,
    volume,
    playbackRate,
    listenedSeconds,
    error,
    
    // Core Methods
    playSong,
    togglePlay,
    playNext,
    playPrev,
    seekTo,
    toggleLoop,
    
    // Engine Methods
    toggleEnhancedAudio,
    changeVolume,
    setPlaybackRate: (rate) => {
      setPlaybackRate(rate);
      if (audioRef.current) audioRef.current.playbackRate = rate;
    },
    setMute: (muted) => {
      setIsMuted(muted);
      if (audioRef.current) audioRef.current.muted = muted;
    },
    
    // Helpers
    getAnalyzer: () => analyzerNode.current,
  };

  return (
    <PlayerContext.Provider value={value}>
      {children}
      <audio 
        ref={audioRef} 
        preload="auto" 
        playsInline 
        autoPlay={false} 
      />
    </PlayerContext.Provider>
  );
};

export default PlayerProvider;

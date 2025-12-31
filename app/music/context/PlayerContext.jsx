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
  const limiterNode = useRef(null); // CRITICAL: Stops the "Blast" sound

  const [playlist, setPlaylist] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentSong, setCurrentSong] = useState(null);
  const [isEnhanced, setIsEnhanced] = useState(false);

  const [listenedSeconds, setListenedSeconds] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("total_listened_time");
      return saved ? parseFloat(saved) : 0;
    }
    return 0;
  });

  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoop, setIsLoop] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [playbackRate, setPlaybackRate] = useState(1.0);

  useEffect(() => {
    localStorage.setItem("total_listened_time", listenedSeconds.toString());
  }, [listenedSeconds]);

  /* ================= 3D ENGINE INITIALIZATION (FIXED FOR MOBILE) ================= */
  const initAudioEngine = () => {
    if (audioCtx.current) return;

    const Context = window.AudioContext || window.webkitAudioContext;
    // FIX: latencyHint 'playback' increases buffer size to prevent mobile lag
    audioCtx.current = new Context({ latencyHint: "playback" });

    source.current = audioCtx.current.createMediaElementSource(audioRef.current);

    bassNode.current = audioCtx.current.createBiquadFilter();
    presenceNode.current = audioCtx.current.createBiquadFilter();
    clarityNode.current = audioCtx.current.createBiquadFilter();
    airNode.current = audioCtx.current.createBiquadFilter();

    panner3D.current = audioCtx.current.createPanner();
    
    // FIX: Detect mobile. HRTF calculation causes crackling on mobile CPUs.
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    panner3D.current.panningModel = isMobile ? "equalpower" : "HRTF";
    panner3D.current.distanceModel = "inverse";

    punchNode.current = audioCtx.current.createDynamicsCompressor();
    gainNode.current = audioCtx.current.createGain();
    
    // FIX: Safety Limiter - This is the "shield" that stops the blast sound
    limiterNode.current = audioCtx.current.createDynamicsCompressor();
    limiterNode.current.threshold.value = -1.0; 
    limiterNode.current.knee.value = 0;
    limiterNode.current.ratio.value = 20;

    // 3D EQ Config
    bassNode.current.type = "lowshelf";
    bassNode.current.frequency.value = 60; 
    presenceNode.current.type = "peaking";
    presenceNode.current.frequency.value = 2800; 
    presenceNode.current.Q.value = 0.7;
    clarityNode.current.type = "highshelf";
    clarityNode.current.frequency.value = 8000;
    airNode.current.type = "highshelf";
    airNode.current.frequency.value = 14000;

    // Theater Loudness
    punchNode.current.threshold.value = -24; 
    punchNode.current.ratio.value = 4;
    punchNode.current.knee.value = 30;

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

  /* ================= 3D SPATIAL TOGGLE (SMOOTH RAMPING) ================= */
  const toggleEnhancedAudio = () => {
    if (!audioCtx.current) initAudioEngine();
    const newState = !isEnhanced;
    setIsEnhanced(newState);

    if (audioCtx.current.state === "suspended") audioCtx.current.resume();

    const t = audioCtx.current.currentTime;
    const ramp = 0.4; // Smooth transition time

    // FIX: Using setValueAtTime before ramp prevents the "Blast" or "Pop" sound
    const safeRamp = (param, val) => {
      param.cancelScheduledValues(t);
      param.setValueAtTime(param.value, t);
      param.linearRampToValueAtTime(val, t + ramp);
    };

    if (newState) {
      safeRamp(panner3D.current.positionX, 0);
      safeRamp(panner3D.current.positionY, 0.7); 
      safeRamp(panner3D.current.positionZ, 1.5); 

      // Cinema EQ: Toned down slightly for mobile safety
      safeRamp(bassNode.current.gain, 8);
      safeRamp(presenceNode.current.gain, 3);
      safeRamp(clarityNode.current.gain, 5);
      safeRamp(airNode.current.gain, 8);
      safeRamp(gainNode.current.gain, 1.0);
    } else {
      safeRamp(panner3D.current.positionX, 0);
      safeRamp(panner3D.current.positionY, 0);
      safeRamp(panner3D.current.positionZ, 0);

      safeRamp(bassNode.current.gain, 0);
      safeRamp(presenceNode.current.gain, 0);
      safeRamp(clarityNode.current.gain, 0);
      safeRamp(airNode.current.gain, 0);
      safeRamp(gainNode.current.gain, 0.9);
    }
  };

  /* ================= PLAYER CORE LOGIC ================= */
  const loadAndPlay = (song, index = 0) => {
    if (!song) return;
    setCurrentIndex(index);
    setCurrentSong(song);
    lastTimeRef.current = 0;
  };

  const playSong = (song, index, list = []) => {
    if (Array.isArray(list) && list.length) setPlaylist(list);
    loadAndPlay(song, index);
  };

  const togglePlay = async () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
    } else {
      if (audioCtx.current?.state === "suspended")
        await audioCtx.current.resume();
      try {
        await audio.play();
      } catch {
        setIsPlaying(false);
      }
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
    setProgress(time);
    lastTimeRef.current = time;
  };

  const toggleLoop = () => {
    setIsLoop((s) => {
      const next = !s;
      if (audioRef.current) audioRef.current.loop = next;
      return next;
    });
  };

  const changeVolume = (val) => {
    setVolume(val);
    if (audioRef.current) audioRef.current.volume = val;
  };

  /* ================= USE EFFECTS (LISTENER & STATS) ================= */
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

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    return () => {
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
    };
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onTimeUpdate = () => setProgress(audio.currentTime);
    const onLoadedMeta = () => setDuration(audio.duration || 0);
    const onEnded = () => {
      if (!audio.loop) setTimeout(() => playNext(), 50);
    };
    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("loadedmetadata", onLoadedMeta);
    audio.addEventListener("ended", onEnded);
    return () => {
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("loadedmetadata", onLoadedMeta);
      audio.removeEventListener("ended", onEnded);
    };
  }, [playlist, currentIndex, isLoop]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (!currentSong) {
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
      setIsPlaying(false);
      setProgress(0);
      setDuration(0);
      return;
    }
    audio.pause();
    audio.src = currentSong.audio_url;
    audio.crossOrigin = "anonymous";
    audio.preload = "auto";
    audio.load();

    const handleLoadedData = async () => {
      try {
        if (audioCtx.current?.state === "suspended") await audioCtx.current.resume();
        await audio.play();
      } catch {
        setIsPlaying(false);
      }
    };
    audio.addEventListener("loadeddata", handleLoadedData);
    return () => audio.removeEventListener("loadeddata", handleLoadedData);
  }, [currentSong]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
  }, [volume]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = playbackRate;
  }, [playbackRate]);

  /* ================= MEDIA SESSION (LOCK SCREEN) ================= */
  const updatePlaybackState = () => {
    if (!navigator.mediaSession) return;
    navigator.mediaSession.playbackState = isPlaying ? "playing" : "paused";
    try {
      navigator.mediaSession.setPositionState({
        duration: duration || 0,
        playbackRate: playbackRate,
        position: progress || 0,
      });
    } catch (e) { /* Fallback for older browsers */ }
  };

  useEffect(() => {
    updatePlaybackState();
  }, [duration, progress, isPlaying]);

  useEffect(() => {
    if (!currentSong || !navigator.mediaSession) return;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: currentSong.title || "Unknown Title",
      artist: currentSong.artist_name || "Unknown Artist",
      artwork: [
        { src: currentSong.cover_url, sizes: "512x512", type: "image/png" },
      ],
    });
    navigator.mediaSession.setActionHandler("play", () => togglePlay());
    navigator.mediaSession.setActionHandler("pause", () => togglePlay());
    navigator.mediaSession.setActionHandler("previoustrack", playPrev);
    navigator.mediaSession.setActionHandler("nexttrack", playNext);
    navigator.mediaSession.setActionHandler("seekto", (e) => {
      if (audioRef.current) audioRef.current.currentTime = e.seekTime;
    });
  }, [currentSong]);

  const currentSongId = currentSong?.id || null;

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
        currentSongId,
        playbackRate,
        listenedSeconds,
        isEnhanced,
        toggleEnhancedAudio,
        setPlaybackRate,
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
      {/* playsInline is important for mobile browsers */}
      <audio ref={audioRef} preload="auto" playsInline />
    </PlayerContext.Provider>
  );
};

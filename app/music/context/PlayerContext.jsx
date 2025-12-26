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

  // --- PERSISTENCE HELPER ---
  const getSaved = (key, fallback) => {
    if (typeof window === "undefined") return fallback;
    const saved = localStorage.getItem(key);
    try {
      return saved ? JSON.parse(saved) : fallback;
    } catch {
      return fallback;
    }
  };

  /* ================= STATE INITIALIZATION ================= */
  // These pull from localStorage so the player "remembers" on refresh
  const [playlist, setPlaylist] = useState(() => getSaved("player_playlist", []));
  const [currentIndex, setCurrentIndex] = useState(() => getSaved("player_index", 0));
  const [currentSong, setCurrentSong] = useState(() => getSaved("player_current_song", null));
  const [progress, setProgress] = useState(() => getSaved("player_progress", 0));
  const [volume, setVolume] = useState(() => getSaved("player_volume", 1));
  const [isLoop, setIsLoop] = useState(() => getSaved("player_loop", false));
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [isEnhanced, setIsEnhanced] = useState(false);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1.0);

  const [listenedSeconds, setListenedSeconds] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("total_listened_time");
      return saved ? parseFloat(saved) : 0;
    }
    return 0;
  });

  /* ================= PERSISTENCE EFFECTS ================= */
  useEffect(() => {
    localStorage.setItem("player_current_song", JSON.stringify(currentSong));
    localStorage.setItem("player_playlist", JSON.stringify(playlist));
    localStorage.setItem("player_index", JSON.stringify(currentIndex));
    localStorage.setItem("player_volume", JSON.stringify(volume));
    localStorage.setItem("player_loop", JSON.stringify(isLoop));
  }, [currentSong, playlist, currentIndex, volume, isLoop]);

  // Save progress frequently for high accuracy on refresh
  useEffect(() => {
    const interval = setInterval(() => {
      if (audioRef.current && !audioRef.current.paused) {
        localStorage.setItem("player_progress", JSON.stringify(audioRef.current.currentTime));
      }
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    localStorage.setItem("total_listened_time", listenedSeconds.toString());
  }, [listenedSeconds]);

  /* ================= 3D ENGINE INITIALIZATION ================= */
  const initAudioEngine = () => {
    if (audioCtx.current) return;
    const Context = window.AudioContext || window.webkitAudioContext;
    audioCtx.current = new Context();
    source.current = audioCtx.current.createMediaElementSource(audioRef.current);
    
    bassNode.current = audioCtx.current.createBiquadFilter();
    presenceNode.current = audioCtx.current.createBiquadFilter();
    clarityNode.current = audioCtx.current.createBiquadFilter();
    airNode.current = audioCtx.current.createBiquadFilter();
    panner3D.current = audioCtx.current.createPanner();
    panner3D.current.panningModel = "HRTF";
    panner3D.current.distanceModel = "inverse";
    punchNode.current = audioCtx.current.createDynamicsCompressor();
    gainNode.current = audioCtx.current.createGain();

    bassNode.current.type = "lowshelf";
    bassNode.current.frequency.value = 50;
    presenceNode.current.type = "peaking";
    presenceNode.current.frequency.value = 2800;
    presenceNode.current.Q.value = 0.7;
    clarityNode.current.type = "highshelf";
    clarityNode.current.frequency.value = 8000;
    airNode.current.type = "highshelf";
    airNode.current.frequency.value = 14000;
    punchNode.current.threshold.value = -35;
    punchNode.current.ratio.value = 6;
    punchNode.current.knee.value = 40;
    gainNode.current.gain.value = 0.9;

    source.current
      .connect(bassNode.current)
      .connect(presenceNode.current)
      .connect(clarityNode.current)
      .connect(airNode.current)
      .connect(panner3D.current)
      .connect(punchNode.current)
      .connect(gainNode.current)
      .connect(audioCtx.current.destination);
  };

  const toggleEnhancedAudio = () => {
    if (!audioCtx.current) initAudioEngine();
    const newState = !isEnhanced;
    setIsEnhanced(newState);
    if (audioCtx.current.state === "suspended") audioCtx.current.resume();
    const t = audioCtx.current.currentTime + 0.3;
    if (newState) {
      panner3D.current.positionX.linearRampToValueAtTime(0, t);
      panner3D.current.positionY.linearRampToValueAtTime(1, t);
      panner3D.current.positionZ.linearRampToValueAtTime(2, t);
      bassNode.current.gain.exponentialRampToValueAtTime(16, t);
      presenceNode.current.gain.exponentialRampToValueAtTime(10, t);
      clarityNode.current.gain.exponentialRampToValueAtTime(14, t);
      airNode.current.gain.exponentialRampToValueAtTime(12, t);
      gainNode.current.gain.linearRampToValueAtTime(1.2, t);
    } else {
      panner3D.current.positionX.linearRampToValueAtTime(0, t);
      panner3D.current.positionY.linearRampToValueAtTime(0, t);
      panner3D.current.positionZ.linearRampToValueAtTime(0, t);
      bassNode.current.gain.linearRampToValueAtTime(0, t);
      presenceNode.current.gain.linearRampToValueAtTime(0, t);
      clarityNode.current.gain.linearRampToValueAtTime(0, t);
      airNode.current.gain.linearRampToValueAtTime(0, t);
      gainNode.current.gain.linearRampToValueAtTime(0.9, t);
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
    if (Array.isArray(list) && list.length) setPlaylist(list);
    loadAndPlay(song, index);
  };

  const togglePlay = async () => {
    const audio = audioRef.current;
    if (!audio || !currentSong) return;
    if (isPlaying) {
      audio.pause();
    } else {
      if (audioCtx.current?.state === "suspended") await audioCtx.current.resume();
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
    localStorage.setItem("player_progress", JSON.stringify(time));
  };

  const toggleLoop = () => {
    setIsLoop((prev) => {
      const next = !prev;
      if (audioRef.current) audioRef.current.loop = next;
      return next;
    });
  };

  const changeVolume = (val) => {
    setVolume(val);
    if (audioRef.current) audioRef.current.volume = val;
  };

  /* ================= AUDIO EVENT LISTENERS ================= */
  // Handle Song Loading and Progress Hydration
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (!currentSong) {
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
      setIsPlaying(false);
      return;
    }

    const isNewSong = audio.src !== currentSong.audio_url;

    if (isNewSong) {
      audio.src = currentSong.audio_url;
      audio.crossOrigin = "anonymous";
      audio.load();

      const handleLoadedData = async () => {
        // Hydrate saved progress
        const savedTime = getSaved("player_progress", 0);
        if (savedTime > 0) {
          audio.currentTime = savedTime;
        }
        // Only autoplay if it's a song change, not a cold refresh
        if (lastTimeRef.current === 0 && isPlaying) {
          try { await audio.play(); } catch {}
        }
      };

      audio.addEventListener("loadeddata", handleLoadedData, { once: true });
      return () => audio.removeEventListener("loadeddata", handleLoadedData);
    }
  }, [currentSong]);

  // Sync Audio Element attributes
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
      audioRef.current.loop = isLoop;
      audioRef.current.playbackRate = playbackRate;
    }
  }, [volume, isLoop, playbackRate]);

  // Track Progress & Meta
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onTimeUpdate = () => setProgress(audio.currentTime);
    const onLoadedMeta = () => setDuration(audio.duration || 0);
    const onEnded = () => { if (!audio.loop) setTimeout(() => playNext(), 50); };
    
    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("loadedmetadata", onLoadedMeta);
    audio.addEventListener("ended", onEnded);
    return () => {
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("loadedmetadata", onLoadedMeta);
      audio.removeEventListener("ended", onEnded);
    };
  }, [playlist, currentIndex, isLoop]);

  // Play/Pause State Sync
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

  // Media Session (Notification Controls)
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
        currentSongId: currentSong?.id || null,
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
      <audio ref={audioRef} preload="auto" />
    </PlayerContext.Provider>
  );
};
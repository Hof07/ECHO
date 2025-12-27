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
  const limiterNode = useRef(null); // ADDED: Safety node to stop crackle

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

  useEffect(() => {
    localStorage.setItem("total_listened_time", listenedSeconds.toString());
  }, [listenedSeconds]);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoop, setIsLoop] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [playbackRate, setPlaybackRate] = useState(1.0);

  /* ================= 3D ENGINE INITIALIZATION ================= */
  const initAudioEngine = () => {
    if (audioCtx.current) return;

    const Context = window.AudioContext || window.webkitAudioContext;
    audioCtx.current = new Context();

    source.current = audioCtx.current.createMediaElementSource(
      audioRef.current
    );

    // Filter Stack
    bassNode.current = audioCtx.current.createBiquadFilter();
    presenceNode.current = audioCtx.current.createBiquadFilter();
    clarityNode.current = audioCtx.current.createBiquadFilter();
    airNode.current = audioCtx.current.createBiquadFilter();

    panner3D.current = audioCtx.current.createPanner();
    panner3D.current.panningModel = "HRTF"; 
    panner3D.current.distanceModel = "inverse";

    punchNode.current = audioCtx.current.createDynamicsCompressor();
    gainNode.current = audioCtx.current.createGain();
    
    // Safety Limiter: This prevents the "bubble blast/crackle" by capping the volume
    limiterNode.current = audioCtx.current.createDynamicsCompressor();
    limiterNode.current.threshold.value = -0.5;
    limiterNode.current.knee.value = 0;
    limiterNode.current.ratio.value = 20;

    // 3D EQ Config
    bassNode.current.type = "lowshelf";
    bassNode.current.frequency.value = 60; // Adjusted for cleaner sub-bass

    presenceNode.current.type = "peaking";
    presenceNode.current.frequency.value = 2800; 
    presenceNode.current.Q.value = 0.7;

    clarityNode.current.type = "highshelf";
    clarityNode.current.frequency.value = 8000;

    airNode.current.type = "highshelf";
    airNode.current.frequency.value = 14000;

    // Theater Loudness (Compression)
    punchNode.current.threshold.value = -24; // Less extreme than -35 to avoid "pumping"
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
      .connect(limiterNode.current) // Final safety check before speakers
      .connect(audioCtx.current.destination);
  };

  /* ================= 3D SPATIAL TOGGLE ================= */
  const toggleEnhancedAudio = () => {
    if (!audioCtx.current) initAudioEngine();
    const newState = !isEnhanced;
    setIsEnhanced(newState);

    if (audioCtx.current.state === "suspended") audioCtx.current.resume();

    const t = audioCtx.current.currentTime + 0.3;

    if (newState) {
      panner3D.current.positionX.linearRampToValueAtTime(0, t);
      panner3D.current.positionY.linearRampToValueAtTime(0.5, t); 
      panner3D.current.positionZ.linearRampToValueAtTime(1.5, t); 

      // Improved Gain Values: High enough to feel, low enough not to distort
      bassNode.current.gain.linearRampToValueAtTime(8, t);
      presenceNode.current.gain.linearRampToValueAtTime(4, t);
      clarityNode.current.gain.linearRampToValueAtTime(6, t);
      airNode.current.gain.linearRampToValueAtTime(7, t);

      gainNode.current.gain.linearRampToValueAtTime(1.0, t);
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

  // --- REST OF THE PLAYER LOGIC ---
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

  const updatePlaybackState = () => {
    if (!navigator.mediaSession) return;
    navigator.mediaSession.playbackState = isPlaying ? "playing" : "paused";
    navigator.mediaSession.setPositionState({
      duration: duration || 0,
      playbackRate: playbackRate,
      position: progress || 0,
    });
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
    navigator.mediaSession.setActionHandler("play", () => audioRef.current?.play());
    navigator.mediaSession.setActionHandler("pause", () => audioRef.current?.pause());
    navigator.mediaSession.setActionHandler("previoustrack", playPrev);
    navigator.mediaSession.setActionHandler("nexttrack", playNext);
    navigator.mediaSession.setActionHandler("seekto", (e) => {
      audioRef.current.currentTime = e.seekTime;
    });
    updatePlaybackState();
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
      <audio ref={audioRef} preload="auto" />
    </PlayerContext.Provider>
  );
};
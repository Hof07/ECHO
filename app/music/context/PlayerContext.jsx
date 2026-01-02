"use client";

import React, {
  createContext,
  useContext,
  useRef,
  useState,
  useEffect,
  useCallback,
  useMemo,
} from "react";

/**
 * PLAYER CONTEXT & HOOK
 * Provides a production-grade 3D Audio Engine with Dolby-style Spatial Tuning.
 * Includes Spotify-style persistence for last played song and timestamp.
 */
const PlayerContext = createContext();
export const usePlayer = () => useContext(PlayerContext);

export const PlayerProvider = ({ children }) => {
  /* =========================================================
     AUDIO ENGINE REFS (THE CORE INFRASTRUCTURE)
     ========================================================= */
  const audioRef = useRef(null);
  const audioCtx = useRef(null);
  const sourceNode = useRef(null);
  const lastTimeRef = useRef(0);
  
  // Advanced Processing Nodes for "Surround Sound"
  const bassNode = useRef(null);       // Deep Sub-Bass (Dolby feel)
  const presenceNode = useRef(null);   // Vocal/Presence Clarity
  const airNode = useRef(null);        // Cinematic High-end Air
  const spatialPanner = useRef(null);  // 3D Position (HRTF)
  const gainNode = useRef(null);       // Master Level Stage
  const compressor = useRef(null);     // Sound "Glue" and Punch
  const limiter = useRef(null);        // Digital Peak Protection
  const analyzerNode = useRef(null);   // For Waveform Visualizers

  /* =========================================================
     STATE: CORE ENGINE & PERSISTENCE
     ========================================================= */
  const [playlist, setPlaylist] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentSong, setCurrentSong] = useState(null);
  const [isEnhanced, setIsEnhanced] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoop, setIsLoop] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [playbackRate, setPlaybackRate] = useState(1.0);
  const [listenedSeconds, setListenedSeconds] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  /* =========================================================
     1. PERSISTENCE LAYER: HYDRATION (SPOTIFY STYLE)
     ========================================================= */
  useEffect(() => {
    const savedSong = localStorage.getItem("last_played_song");
    const savedPlaylist = localStorage.getItem("last_playlist");
    const savedVolume = localStorage.getItem("player_volume");
    const savedStats = localStorage.getItem("total_listened_time");
    const savedTime = localStorage.getItem("last_timestamp");

    if (savedSong) {
      try {
        const parsedSong = JSON.parse(savedSong);
        setCurrentSong(parsedSong);
      } catch (e) { console.error("Error parsing saved song", e); }
    }
    
    if (savedPlaylist) {
      try {
        setPlaylist(JSON.parse(savedPlaylist));
      } catch (e) { console.error("Error parsing saved playlist", e); }
    }
    
    if (savedVolume) setVolume(parseFloat(savedVolume));
    if (savedStats) setListenedSeconds(parseFloat(savedStats));
    if (savedTime) {
      lastTimeRef.current = parseFloat(savedTime);
    }
    
    setIsLoading(false);
  }, []);

  /* =========================================================
     2. DOLBY ATMOS ENGINE: INITIALIZATION
     ========================================================= */
  const initSpatialEngine = useCallback(() => {
    if (audioCtx.current) return;

    try {
      const Context = window.AudioContext || window.webkitAudioContext;
      audioCtx.current = new Context({ latencyHint: "playback" });

      sourceNode.current = audioCtx.current.createMediaElementSource(audioRef.current);

      bassNode.current = audioCtx.current.createBiquadFilter();
      bassNode.current.type = "lowshelf";
      bassNode.current.frequency.value = 65; 

      presenceNode.current = audioCtx.current.createBiquadFilter();
      presenceNode.current.type = "peaking";
      presenceNode.current.frequency.value = 2800;
      presenceNode.current.Q.value = 0.7;

      airNode.current = audioCtx.current.createBiquadFilter();
      airNode.current.type = "highshelf";
      airNode.current.frequency.value = 12000;

      spatialPanner.current = audioCtx.current.createPanner();
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      spatialPanner.current.panningModel = isMobile ? "equalpower" : "HRTF";
      spatialPanner.current.distanceModel = "inverse";

      gainNode.current = audioCtx.current.createGain();
      compressor.current = audioCtx.current.createDynamicsCompressor();
      compressor.current.threshold.value = -24;
      compressor.current.ratio.value = 4;

      limiter.current = audioCtx.current.createDynamicsCompressor();
      limiter.current.threshold.value = -1.0; 

      analyzerNode.current = audioCtx.current.createAnalyser();

      sourceNode.current
        .connect(bassNode.current)
        .connect(presenceNode.current)
        .connect(airNode.current)
        .connect(spatialPanner.current)
        .connect(compressor.current)
        .connect(gainNode.current)
        .connect(analyzerNode.current)
        .connect(limiter.current)
        .connect(audioCtx.current.destination);

    } catch (err) {
      console.error("Critical: 3D Audio Engine failed to start", err);
    }
  }, []);

  /* =========================================================
     3. SPATIAL ENHANCEMENT TOGGLE (DOLBY EFFECT)
     ========================================================= */
  const toggleEnhancedAudio = useCallback(() => {
    if (!audioCtx.current) initSpatialEngine();
    const newState = !isEnhanced;
    setIsEnhanced(newState);

    if (audioCtx.current.state === "suspended") audioCtx.current.resume();

    const t = audioCtx.current.currentTime;
    const fade = 0.6;

    const ramp = (node, val) => {
      if (!node) return;
      node.cancelScheduledValues(t);
      node.setValueAtTime(node.value, t);
      node.linearRampToValueAtTime(val, t + fade);
    };

    if (newState) {
      ramp(spatialPanner.current.positionZ, 2.5);
      ramp(spatialPanner.current.positionY, 1.2);
      ramp(bassNode.current.gain, 12);
      ramp(airNode.current.gain, 10);
      ramp(gainNode.current.gain, 1.1);
    } else {
      ramp(spatialPanner.current.positionZ, 0);
      ramp(spatialPanner.current.positionY, 0);
      ramp(bassNode.current.gain, 0);
      ramp(presenceNode.current.gain, 0);
      ramp(airNode.current.gain, 0);
      ramp(gainNode.current.gain, 0.9);
    }
  }, [isEnhanced, initSpatialEngine]);

  /* =========================================================
     4. CORE PLAYER ACTIONS (UPDATED FOR AUTO-NEXT FIX)
     ========================================================= */
  const togglePlay = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (audioCtx.current?.state === "suspended") {
      await audioCtx.current.resume();
    }

    if (audio.paused) {
      try {
        await audio.play();
      } catch (err) { console.warn("Autoplay was blocked by browser", err); }
    } else {
      audio.pause();
    }
  }, []);

  const playSong = (song, index, list = []) => {
    if (list.length) {
      setPlaylist(list);
      localStorage.setItem("last_playlist", JSON.stringify(list));
    }
    setCurrentIndex(index);
    setCurrentSong(song);
    setIsPlaying(true);
  };

  const playNext = useCallback(async () => {
    if (!playlist.length) return;
    const nextIdx = (currentIndex + 1) % playlist.length;
    
    if (audioCtx.current?.state === "suspended") await audioCtx.current.resume();
    
    setCurrentIndex(nextIdx);
    setCurrentSong(playlist[nextIdx]);
    setIsPlaying(true);
  }, [playlist, currentIndex]);

  const playPrev = useCallback(async () => {
    if (!playlist.length) return;
    const prevIdx = (currentIndex - 1 + playlist.length) % playlist.length;
    
    if (audioCtx.current?.state === "suspended") await audioCtx.current.resume();
    
    setCurrentIndex(prevIdx);
    setCurrentSong(playlist[prevIdx]);
    setIsPlaying(true);
  }, [playlist, currentIndex]);

  const seekTo = useCallback((time) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setProgress(time);
      localStorage.setItem("last_timestamp", time.toString());
    }
  }, []);

  /* =========================================================
     5. NOTIFICATION BAR & MEDIA CONTROL (SYSTEM LEVEL)
     ========================================================= */
  useEffect(() => {
    if (!currentSong || !("mediaSession" in navigator)) return;

    navigator.mediaSession.metadata = new MediaMetadata({
      title: currentSong.title,
      artist: currentSong.artist_name,
      artwork: [{ src: currentSong.cover_url, sizes: "512x512", type: "image/png" }]
    });

    navigator.mediaSession.setActionHandler("play", () => togglePlay());
    navigator.mediaSession.setActionHandler("pause", () => togglePlay());
    navigator.mediaSession.setActionHandler("nexttrack", () => playNext());
    navigator.mediaSession.setActionHandler("previoustrack", () => playPrev());
    navigator.mediaSession.setActionHandler("seekto", (d) => seekTo(d.seekTime));

    localStorage.setItem("last_played_song", JSON.stringify(currentSong));
  }, [currentSong, togglePlay, playNext, playPrev, seekTo]);

  /* =========================================================
     6. UI SYNC & EVENT LISTENERS
     ========================================================= */
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTimeUpdate = () => {
      setProgress(audio.currentTime);
      if (Math.floor(audio.currentTime) % 5 === 0) {
        localStorage.setItem("last_timestamp", audio.currentTime.toString());
      }
    };

    const onLoadedMetadata = () => {
      setDuration(audio.duration);
      const savedTime = localStorage.getItem("last_timestamp");
      const savedSong = localStorage.getItem("last_played_song");
      if (savedTime && savedSong && JSON.parse(savedSong).id === currentSong?.id) {
        audio.currentTime = parseFloat(savedTime);
      }
    };

    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onEnded = () => {
      if (!isLoop) {
        playNext(); 
      }
    };

    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("loadedmetadata", onLoadedMetadata);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("ended", onEnded);

    return () => {
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("loadedmetadata", onLoadedMetadata);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("ended", onEnded);
    };
  }, [currentSong, isLoop, playNext]);

  /* =========================================================
     7. SOURCE LOADING HANDLER (FIXED FOR SEAMLESS PLAY)
     ========================================================= */
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !currentSong) return;

    // Resetting src stops previous stream properly
    audio.pause();
    audio.src = currentSong.audio_url;
    audio.crossOrigin = "anonymous";
    audio.load();

    // If isPlaying is true, we force the play command
    if (isPlaying) {
      const startPlay = async () => {
        try {
          if (audioCtx.current?.state === "suspended") await audioCtx.current.resume();
          await audio.play();
        } catch (err) {
          console.warn("Playback failed during song transition", err);
          setIsPlaying(false);
        }
      };
      startPlay();
    }
  }, [currentSong, isPlaying]);

  /* =========================================================
     8. STATS TRACKING (LISTENING TIME)
     ========================================================= */
  useEffect(() => {
    const timer = setInterval(() => {
      if (isPlaying) {
        setListenedSeconds(prev => {
          const updated = prev + 1;
          localStorage.setItem("total_listened_time", updated.toString());
          return updated;
        });
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [isPlaying]);

  /* =========================================================
     CONTEXT VALUE PACKAGING
     ========================================================= */
  const currentSongId = currentSong?.id || null;

  const value = useMemo(() => ({
    playlist, currentIndex, currentSong, isPlaying, progress, duration,
    isLoop, volume, currentSongId, playbackRate, listenedSeconds, isEnhanced,
    toggleEnhancedAudio,
    setPlaybackRate: (r) => { 
      setPlaybackRate(r); 
      if(audioRef.current) audioRef.current.playbackRate = r; 
    },
    playSong, togglePlay, playNext, playPrev, seekTo,
    toggleLoop: () => {
      const next = !isLoop;
      setIsLoop(next);
      if (audioRef.current) audioRef.current.loop = next;
    },
    changeVolume: (v) => {
      setVolume(v);
      if (audioRef.current) audioRef.current.volume = v;
      localStorage.setItem("player_volume", v.toString());
    },
    getAnalyzer: () => analyzerNode.current
  }), [playlist, currentIndex, currentSong, isPlaying, progress, duration, isLoop, volume, currentSongId, playbackRate, listenedSeconds, isEnhanced]);

  return (
    <PlayerContext.Provider value={value}>
      {children}
      <audio ref={audioRef} playsInline crossOrigin="anonymous" preload="auto" />
    </PlayerContext.Provider>
  );
};

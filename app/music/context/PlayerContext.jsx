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

const PlayerContext = createContext();
export const usePlayer = () => useContext(PlayerContext);

export const PlayerProvider = ({ children }) => {
  /* =========================================================
      AUDIO ENGINE REFS (CORE INFRASTRUCTURE)
      ========================================================= */
  const audioRef = useRef(null);
  const audioCtx = useRef(null);
  const sourceNode = useRef(null);
  const lastTimeRef = useRef(0);
  
  const bassNode = useRef(null);
  const presenceNode = useRef(null);
  const airNode = useRef(null);
  const spatialPanner = useRef(null);
  const gainNode = useRef(null);
  const compressor = useRef(null);
  const limiter = useRef(null);
  const analyzerNode = useRef(null);

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
      1. PERSISTENCE LAYER: HYDRATION (STOPS RESET ON REFRESH)
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

      gainNode.current = audioCtx.current.createGain();
      compressor.current = audioCtx.current.createDynamicsCompressor();
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
      console.error("Critical: 3D Audio Engine failed", err);
    }
  }, []);

  /* =========================================================
      3. SPATIAL ENHANCEMENT TOGGLE
      ========================================================= */
  const toggleEnhancedAudio = useCallback(() => {
    if (!audioCtx.current) initSpatialEngine();
    const newState = !isEnhanced;
    setIsEnhanced(newState);

    if (audioCtx.current?.state === "suspended") audioCtx.current.resume();

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
      ramp(bassNode.current.gain, 12);
      ramp(airNode.current.gain, 10);
      ramp(gainNode.current.gain, 1.1);
    } else {
      ramp(spatialPanner.current.positionZ, 0);
      ramp(bassNode.current.gain, 0);
      ramp(airNode.current.gain, 0);
      ramp(gainNode.current.gain, 0.9);
    }
  }, [isEnhanced, initSpatialEngine]);

  /* =========================================================
      4. CORE PLAYER ACTIONS
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
      } catch (err) { console.warn("Play blocked", err); }
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
      5. NOTIFICATION BAR & MEDIA CONTROL
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
    
    localStorage.setItem("last_played_song", JSON.stringify(currentSong));
  }, [currentSong, togglePlay, playNext, playPrev]);

  /* =========================================================
      6. UI SYNC & EVENT LISTENERS
      ========================================================= */
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTimeUpdate = () => {
        setProgress(audio.currentTime);
        // Save timestamp frequently so if they navigate/refresh they don't lose spot
        localStorage.setItem("last_timestamp", audio.currentTime.toString());
    };
    
    const onLoadedMetadata = () => {
      if (audio.duration) setDuration(audio.duration);
      // Resume from last saved time if this is the first load
      if (lastTimeRef.current > 0) {
        audio.currentTime = lastTimeRef.current;
        lastTimeRef.current = 0; // Reset so it doesn't loop back on next song
      }
    };

    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onEnded = () => { if (!isLoop) playNext(); };

    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("loadedmetadata", onLoadedMetadata);
    audio.addEventListener("durationchange", onLoadedMetadata);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("ended", onEnded);

    return () => {
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("loadedmetadata", onLoadedMetadata);
      audio.removeEventListener("durationchange", onLoadedMetadata);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("ended", onEnded);
    };
  }, [isLoop, playNext]);

  /* =========================================================
      7. SOURCE LOADING HANDLER (CRITICAL FOR CONTINUITY)
      ========================================================= */
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !currentSong) return;

    const isSameSource = audio.src === currentSong.audio_url;
    if (!isSameSource) {
        audio.src = currentSong.audio_url;
        setProgress(0);
        setDuration(0); 
        audio.load();
    }

    if (isPlaying) {
      const executePlay = async () => {
        try {
          if (audioCtx.current?.state === "suspended") {
            await audioCtx.current.resume();
          }
          await audio.play();
        } catch (err) {
          console.warn("Playback prevented", err);
          setIsPlaying(false);
        }
      };
      executePlay();
    }
  }, [currentSong, isPlaying]); 

  /* =========================================================
      8. STATS TRACKING
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
  const value = useMemo(() => ({
    playlist, 
    currentIndex, 
    currentSong, 
    currentSongId: currentSong?.id || null, // ADDED THIS LINE
    isPlaying, 
    progress, 
    duration,
    isLoop, 
    volume, 
    playbackRate, 
    listenedSeconds, 
    isEnhanced,
    toggleEnhancedAudio,
    setPlaybackRate: (r) => { 
      setPlaybackRate(r); 
      if(audioRef.current) audioRef.current.playbackRate = r; 
    },
    playSong, 
    togglePlay, 
    playNext, 
    playPrev, 
    seekTo,
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
  }), [
    playlist, currentIndex, currentSong, isPlaying, progress, duration, 
    isLoop, volume, playbackRate, listenedSeconds, isEnhanced,
    currentSong?.id // ADDED TO DEPENDENCY ARRAY
  ]);

  return (
    <PlayerContext.Provider value={value}>
      {children}
      <audio 
        ref={audioRef} 
        playsInline 
        crossOrigin="anonymous" 
        preload="metadata" 
      />
    </PlayerContext.Provider>
  );
};

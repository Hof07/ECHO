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
  const audioCtxRef = useRef(null);
  const sourceRef = useRef(null);

  // Audio Nodes for "Auto-Processing"
  const eqRef = useRef({
    bass: null,
    mid: null,
    treble: null,
    compressor: null,
    panner: null,
  });

  const [playlist, setPlaylist] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentSong, setCurrentSong] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoop, setIsLoop] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [playbackRate, setPlaybackRate] = useState(1.0);

  // --- 1. SETUP AUDIO ENGINE (The "Dolby" Logic) ---
  useEffect(() => {
    if (!audioRef.current || audioCtxRef.current) return;

    // Initialize Context
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    const ctx = new AudioContext();
    audioCtxRef.current = ctx;

    const source = ctx.createMediaElementSource(audioRef.current);

    // BASS: Deep punch (80Hz)
    const bass = ctx.createBiquadFilter();
    bass.type = "lowshelf";
    bass.frequency.value = 80;
    bass.gain.value = 5; // +5dB auto-boost

    // TREBLE: Clarity for AAC/m4a (10kHz)
    const treble = ctx.createBiquadFilter();
    treble.type = "highshelf";
    treble.frequency.value = 10000;
    treble.gain.value = 3; // +3dB for "crisp" highs

    // SPATIAL: Stereo Widener (The Atmos feel)
    const panner = ctx.createStereoPanner();
    panner.pan.value = 0; // Keeping it centered but processed through the spatial engine

    // COMPRESSOR: Mobile Loudness Tuning
    // This prevents distortion while making the audio sound "richer" and louder on small speakers
    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.setValueAtTime(-24, ctx.currentTime);
    compressor.knee.setValueAtTime(30, ctx.currentTime);
    compressor.ratio.setValueAtTime(12, ctx.currentTime);
    compressor.attack.setValueAtTime(0.003, ctx.currentTime);
    compressor.release.setValueAtTime(0.25, ctx.currentTime);

    // Connect Chain
    source.connect(bass);
    bass.connect(treble);
    treble.connect(panner);
    panner.connect(compressor);
    compressor.connect(ctx.destination);

    sourceRef.current = source;
    eqRef.current = { bass, treble, panner, compressor };

    return () => ctx.close();
  }, []);

  // --- 2. AUTO-RESUME CONTEXT ---
  const resumeAudio = async () => {
    if (audioCtxRef.current && audioCtxRef.current.state === "suspended") {
      await audioCtxRef.current.resume();
    }
  };

  const loadAndPlay = (song, index = 0) => {
    if (!song) return;
    resumeAudio(); // Auto-activates processing on user interaction
    setCurrentIndex(index);
    setCurrentSong(song);
  };

  // ... (Your existing playSong, playNext, playPrev, seekTo, toggleLoop functions) ...

  const playSong = (song, index, list = []) => {
    if (Array.isArray(list) && list.length) setPlaylist(list);
    loadAndPlay(song, index);
  };

  const togglePlay = async () => {
    const audio = audioRef.current;
    if (!audio) return;
    resumeAudio();

    if (isPlaying) {
      audio.pause();
    } else {
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

  // Sync Listeners
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onTimeUpdate = () => setProgress(audio.currentTime);
    const onLoadedMeta = () => setDuration(audio.duration || 0);
    const onEnded = () => {
      if (!audio.loop) setTimeout(() => playNext(), 50);
    };

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

  // Handle Song Change
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !currentSong) return;

    audio.pause();
    audio.src = currentSong.audio_url;
    // CRITICAL: Needs to be anonymous for Web Audio API to work with CDNs
    audio.crossOrigin = "anonymous";
    audio.load();

    const handleLoadedData = async () => {
      try {
        await audio.play();
      } catch (e) {
        setIsPlaying(false);
      }
    };

    audio.addEventListener("loadeddata", handleLoadedData);
    return () => audio.removeEventListener("loadeddata", handleLoadedData);
  }, [currentSong]);

  // Media Session & Progress Sync
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
      title: currentSong.title,
      artist: currentSong.artist_name,
      artwork: [
        { src: currentSong.cover_url, sizes: "512x512", type: "image/png" },
      ],
    });
    navigator.mediaSession.setActionHandler("play", togglePlay);
    navigator.mediaSession.setActionHandler("pause", togglePlay);
    navigator.mediaSession.setActionHandler("previoustrack", playPrev);
    navigator.mediaSession.setActionHandler("nexttrack", playNext);
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
      <audio ref={audioRef} />
    </PlayerContext.Provider>
  );
};

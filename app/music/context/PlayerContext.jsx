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

  // 🎧 AUDIO ENHANCEMENT REFS
  const audioCtxRef = useRef(null);
  const sourceRef = useRef(null);
  const bassRef = useRef(null);
  const midRef = useRef(null);                 // ✅ ADDED
  const trebleRef = useRef(null);
  const compressorRef = useRef(null);          // ✅ ADDED
  const stereoRef = useRef(null);
  const isEnhancedRef = useRef(false);

  const [playlist, setPlaylist] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentSong, setCurrentSong] = useState(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoop, setIsLoop] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [playbackRate, setPlaybackRate] = useState(1.0);

  // ---------------- BASIC PLAYER LOGIC ----------------

  const loadAndPlay = (song, index = 0) => {
    if (!song) return;
    setCurrentIndex(index);
    setCurrentSong(song);
  };

  const playSong = (song, index, list = []) => {
    if (Array.isArray(list) && list.length) {
      setPlaylist(list);
    }
    loadAndPlay(song, index);
  };

  const togglePlay = async () => {
    const audio = audioRef.current;
    if (!audio) return;

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

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackRate;
    }
  }, [playbackRate]);

  // ---------------- AUDIO EVENTS ----------------

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
      if (!audio.loop) setTimeout(playNext, 50);
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

  // ---------------- LOAD SONG ----------------

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
    audio.load();

    const handleLoaded = async () => {
      try {
        await audio.play();
      } catch {
        setIsPlaying(false);
      }
    };

    audio.addEventListener("loadeddata", handleLoaded);
    return () => audio.removeEventListener("loadeddata", handleLoaded);
  }, [currentSong]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
  }, [volume]);

  // ---------------- 🎧 HEADPHONE + SPATIAL + NORMALIZATION ----------------

  useEffect(() => {
    if (!audioRef.current) return;

    const AudioContext =
      window.AudioContext || window.webkitAudioContext;

    const audioCtx = new AudioContext();
    audioCtxRef.current = audioCtx;

    const source = audioCtx.createMediaElementSource(audioRef.current);
    sourceRef.current = source;

    const bass = audioCtx.createBiquadFilter();
    bass.type = "lowshelf";
    bass.frequency.value = 120;
    bass.gain.value = 6;

    const mid = audioCtx.createBiquadFilter();
    mid.type = "peaking";
    mid.frequency.value = 1500;
    mid.Q.value = 1;
    mid.gain.value = 2;

    const treble = audioCtx.createBiquadFilter();
    treble.type = "highshelf";
    treble.frequency.value = 8000;
    treble.gain.value = 4;

    const compressor = audioCtx.createDynamicsCompressor();
    compressor.threshold.value = -18;
    compressor.knee.value = 30;
    compressor.ratio.value = 4;
    compressor.attack.value = 0.003;
    compressor.release.value = 0.25;

    const stereo = audioCtx.createStereoPanner();
    stereo.pan.value = 0;

    bassRef.current = bass;
    midRef.current = mid;
    trebleRef.current = treble;
    compressorRef.current = compressor;
    stereoRef.current = stereo;

    source.connect(audioCtx.destination);

    audioRef.current.addEventListener("play", () => {
      audioCtx.resume();
    });

    return () => {
      source.disconnect();
      audioCtx.close();
    };
  }, []);

  const enableHeadphoneEnhancement = () => {
    if (!sourceRef.current) return;

    sourceRef.current.disconnect();
    sourceRef.current
      .connect(bassRef.current)
      .connect(midRef.current)
      .connect(trebleRef.current)
      .connect(compressorRef.current)
      .connect(stereoRef.current)
      .connect(audioCtxRef.current.destination);

    isEnhancedRef.current = true;
  };

  const disableHeadphoneEnhancement = () => {
    if (!sourceRef.current) return;
    sourceRef.current.disconnect();
    sourceRef.current.connect(audioCtxRef.current.destination);
    isEnhancedRef.current = false;
  };

  // 🔁 AUTO ENABLE ON EVERY SONG
  useEffect(() => {
    enableHeadphoneEnhancement();
  }, [currentSong]);

  // ---------------- MEDIA SESSION ----------------

  useEffect(() => {
    if (!navigator.mediaSession || !currentSong) return;

    navigator.mediaSession.metadata = new MediaMetadata({
      title: currentSong.title || "Unknown Title",
      artist: currentSong.artist_name || "Unknown Artist",
      album: currentSong.album || "",
      artwork: [
        {
          src: currentSong.cover_url,
          sizes: "512x512",
          type: "image/png",
        },
      ],
    });

    navigator.mediaSession.setActionHandler("play", () => audioRef.current?.play());
    navigator.mediaSession.setActionHandler("pause", () => audioRef.current?.pause());
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
        currentSongId,
        isPlaying,
        progress,
        duration,
        isLoop,
        volume,
        playbackRate,
        setPlaybackRate,
        playSong,
        togglePlay,
        playNext,
        playPrev,
        seekTo,
        toggleLoop,
        changeVolume,
        enableHeadphoneEnhancement,
        disableHeadphoneEnhancement,
      }}
    >
      {children}
      <audio ref={audioRef} />
    </PlayerContext.Provider>
  );
};

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
  const [playbackRate, setPlaybackRate] = useState(1);

  /* ================= BASIC PLAYER ================= */

  const loadAndPlay = (song, index = 0) => {
    if (!song) return;
    setCurrentIndex(index);
    setCurrentSong(song);
  };

  const playSong = (song, index, list = []) => {
    if (list?.length) setPlaylist(list);
    loadAndPlay(song, index);
  };

  const togglePlay = async () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) audio.pause();
    else await audio.play();
  };

  const playNext = () => {
    if (!playlist.length) return;
    loadAndPlay(playlist[(currentIndex + 1) % playlist.length], (currentIndex + 1) % playlist.length);
  };

  const playPrev = () => {
    if (!playlist.length) return;
    loadAndPlay(
      playlist[(currentIndex - 1 + playlist.length) % playlist.length],
      (currentIndex - 1 + playlist.length) % playlist.length
    );
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
    if (gainRef.current) {
      const ctx = audioCtxRef.current;
      const now = ctx.currentTime;
      gainRef.current.gain.cancelScheduledValues(now);
      gainRef.current.gain.linearRampToValueAtTime(val, now + 0.05);
    }
  };

  /* ================= AUDIO EVENTS ================= */

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    audio.addEventListener("play", () => setIsPlaying(true));
    audio.addEventListener("pause", () => setIsPlaying(false));
    audio.addEventListener("timeupdate", () => setProgress(audio.currentTime));
    audio.addEventListener("loadedmetadata", () => setDuration(audio.duration || 0));
    audio.addEventListener("ended", () => !audio.loop && playNext());

    return () => audio.replaceWith(audio.cloneNode(true));
  }, []);

  /* ================= LOAD SONG ================= */

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (!currentSong) return;

    audio.src = currentSong.audio_url;
    audio.crossOrigin = "anonymous";
    audio.load();
    audio.play().catch(() => {});
  }, [currentSong]);

  /* ================= AUDIO CONTEXT (ONCE) ================= */

  useEffect(() => {
    if (!audioRef.current || audioCtxRef.current) return;

    const AudioContext = window.AudioContext || window.webkitAudioContext;
    const ctx = new AudioContext();
    audioCtxRef.current = ctx;

    const source = ctx.createMediaElementSource(audioRef.current);
    sourceRef.current = source;

    const bass = ctx.createBiquadFilter();
    bass.type = "lowshelf";
    bass.frequency.value = 120;

    const mid = ctx.createBiquadFilter();
    mid.type = "peaking";
    mid.frequency.value = 1800;
    mid.Q.value = 1;

    const treble = ctx.createBiquadFilter();
    treble.type = "highshelf";
    treble.frequency.value = 9000;

    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -16;
    compressor.knee.value = 30;
    compressor.ratio.value = 3;
    compressor.attack.value = 0.02;     // ✅ FIXED
    compressor.release.value = 0.35;

    const gain = ctx.createGain();
    gain.gain.value = volume;

    const stereo = ctx.createStereoPanner();
    stereo.pan.value = 0.12;

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

    /* ===== AUTO SAFE ENHANCEMENT ===== */
    const smooth = (node, val) => {
      const now = ctx.currentTime;
      node.gain.cancelScheduledValues(now);
      node.gain.linearRampToValueAtTime(val, now + 0.08);
    };

    audioRef.current.addEventListener("canplay", () => {
      smooth(bass, 4);
      smooth(mid, 3);
      smooth(treble, 2);
    });
  }, []);

  /* ================= MEDIA SESSION ================= */

  useEffect(() => {
    if (!navigator.mediaSession || !currentSong) return;

    navigator.mediaSession.metadata = new MediaMetadata({
      title: currentSong.title,
      artist: currentSong.artist_name,
      artwork: [{ src: currentSong.cover_url, sizes: "512x512", type: "image/png" }],
    });

    navigator.mediaSession.setActionHandler("play", () => audioRef.current?.play());
    navigator.mediaSession.setActionHandler("pause", () => audioRef.current?.pause());
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
        playbackRate,
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

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

  const [playlist, setPlaylist] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentSong, setCurrentSong] = useState(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoop, setIsLoop] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [playbackRate, setPlaybackRate] = useState(1.0);

  // -------------------------
  // LOAD SONG
  // -------------------------
  const loadAndPlay = (song, index = 0) => {
    setCurrentIndex(index);
    setCurrentSong(song);
  };

  const playSong = (song, index, list = []) => {
    if (list.length) setPlaylist(list);
    loadAndPlay(song, index);
  };

  // -------------------------
  // TOGGLE PLAY
  // -------------------------
  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (audio.paused) audio.play();
    else audio.pause();
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

  const seekTo = (t) => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = t;
  };

  const toggleLoop = () => {
    setIsLoop((p) => {
      if (audioRef.current) audioRef.current.loop = !p;
      return !p;
    });
  };

  const changeVolume = (val) => {
    setVolume(val);
    if (audioRef.current) audioRef.current.volume = val;
  };

  // -------------------------
  // AUDIO BASE EVENTS
  // -------------------------
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onTimeUpdate = () => setProgress(audio.currentTime);
    const onLoadedMetadata = () => setDuration(audio.duration);
    const onEnded = () => {
      if (!audio.loop) playNext();
    };

    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("loadedmetadata", onLoadedMetadata);
    audio.addEventListener("ended", onEnded);

    return () => {
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("loadedmetadata", onLoadedMetadata);
      audio.removeEventListener("ended", onEnded);
    };
  }, []);

  // -------------------------
  // LOAD SONG + AUTO-PLAY
  // -------------------------
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !currentSong) return;

    audio.src = currentSong.audio_url;
    audio.crossOrigin = "anonymous";
    audio.load();

    audio.play().catch(() => setIsPlaying(false));
  }, [currentSong]);

  // -------------------------
  // MEDIA SESSION API
  // -------------------------
  useEffect(() => {
    if (!("mediaSession" in navigator) || !currentSong) return;

    navigator.mediaSession.metadata = new MediaMetadata({
      title: currentSong.title,
      artist: currentSong.artist_name || "Unknown",
      artwork: [{ src: currentSong.cover_url, sizes: "512x512" }],
    });

    navigator.mediaSession.setActionHandler("play", togglePlay);
    navigator.mediaSession.setActionHandler("pause", togglePlay);
    navigator.mediaSession.setActionHandler("nexttrack", playNext);
    navigator.mediaSession.setActionHandler("previoustrack", playPrev);
    navigator.mediaSession.setActionHandler("seekto", (d) =>
      seekTo(d.seekTime)
    );
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
      <audio ref={audioRef} preload="metadata" />
    </PlayerContext.Provider>
  );
};

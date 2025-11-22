"use client";

import React, { createContext, useContext, useRef, useState, useEffect } from "react";

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

  // Sync UI state with audio element events (FIX IMPORTANT!)
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

  // Audio events
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

  // Force load and play on song change
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

    const handleLoadedData = async () => {
      try {
        await audio.play();
      } catch {
        setIsPlaying(false);
      }
    };

    audio.addEventListener("loadeddata", handleLoadedData);
    return () => {
      audio.removeEventListener("loadeddata", handleLoadedData);
    };
  }, [currentSong]);

  // Apply volume on mount / change
  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
  }, [volume]);

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

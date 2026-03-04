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
      AUDIO ENGINE REFS
      ========================================================= */
  const audioRef = useRef(null);
  const audioCtx = useRef(null);
  const sourceNode = useRef(null);
  const lastTimeRef = useRef(0);
  const lastSrcRef = useRef(null);
  const crossfadeTriggeredRef = useRef(false);

  // Always-fresh refs for Media Session (fixes stale closure / earbud stop btn)
  const togglePlayRef = useRef(null);
  const playNextRef = useRef(null);
  const playPrevRef = useRef(null);

  // 7-band EQ
  const subBassNode = useRef(null);
  const bassNode = useRef(null);
  const lowMidNode = useRef(null);
  const midNode = useRef(null);
  const presenceNode = useRef(null);
  const brillianceNode = useRef(null);
  const airNode = useRef(null);

  // Spatial / dynamics
  const spatialPanner = useRef(null);
  const gainNode = useRef(null);
  const preGain = useRef(null);
  const compressor = useRef(null);
  const limiter = useRef(null);
  const analyzerNode = useRef(null);

  // Reverb
  const convolverNode = useRef(null);
  const reverbGain = useRef(null);
  const dryGain = useRef(null);
  const reverbMixNode = useRef(null);

  // Stereo widener
  const splitter = useRef(null);
  const merger = useRef(null);
  const delayL = useRef(null);
  const delayR = useRef(null);
  const widenerGainL = useRef(null);
  const widenerGainR = useRef(null);

  /* =========================================================
      STATE
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
  const [isCrossfading, setIsCrossfading] = useState(false);

  /* =========================================================
      1. PERSISTENCE HYDRATION
      ========================================================= */
  useEffect(() => {
    const savedSong = localStorage.getItem("last_played_song");
    const savedPlaylist = localStorage.getItem("last_playlist");
    const savedVolume = localStorage.getItem("player_volume");
    const savedStats = localStorage.getItem("total_listened_time");
    const savedTime = localStorage.getItem("last_timestamp");

    if (savedSong) { try { setCurrentSong(JSON.parse(savedSong)); } catch (e) { console.error(e); } }
    if (savedPlaylist) { try { setPlaylist(JSON.parse(savedPlaylist)); } catch (e) { console.error(e); } }
    if (savedVolume) setVolume(parseFloat(savedVolume));
    if (savedStats) setListenedSeconds(parseFloat(savedStats));
    if (savedTime) lastTimeRef.current = parseFloat(savedTime);
    setIsLoading(false);
  }, []);

  /* =========================================================
      2. IMPULSE RESPONSE GENERATOR
      ========================================================= */
  const buildImpulseResponse = useCallback((ctx, dur = 2.8, decay = 3.2) => {
    const rate = ctx.sampleRate;
    const length = Math.floor(rate * dur);
    const impulse = ctx.createBuffer(2, length, rate);
    for (let ch = 0; ch < 2; ch++) {
      const data = impulse.getChannelData(ch);
      for (let i = 0; i < length; i++) {
        const t = i / rate;
        const earlyBoost = t < 0.08 ? 1.5 : 1.0;
        data[i] = (Math.random() * 2 - 1) * earlyBoost * Math.pow(1 - t / dur, decay);
      }
      if (ch === 1) { for (let i = 0; i < length; i++) data[i] *= 0.92; }
    }
    return impulse;
  }, []);

  /* =========================================================
      3. DOLBY ATMOS ENGINE INIT
      ========================================================= */
  const initSpatialEngine = useCallback(() => {
    if (audioCtx.current) return;
    try {
      const Context = window.AudioContext || window.webkitAudioContext;
      audioCtx.current = new Context({ latencyHint: "playback", sampleRate: 48000 });
      const ctx = audioCtx.current;

      sourceNode.current = ctx.createMediaElementSource(audioRef.current);
      preGain.current = ctx.createGain();
      preGain.current.gain.value = 0.8;

      subBassNode.current = ctx.createBiquadFilter();
      subBassNode.current.type = "lowshelf";
      subBassNode.current.frequency.value = 30;
      subBassNode.current.gain.value = 0;

      bassNode.current = ctx.createBiquadFilter();
      bassNode.current.type = "peaking";
      bassNode.current.frequency.value = 80;
      bassNode.current.Q.value = 0.8;
      bassNode.current.gain.value = 0;

      lowMidNode.current = ctx.createBiquadFilter();
      lowMidNode.current.type = "peaking";
      lowMidNode.current.frequency.value = 250;
      lowMidNode.current.Q.value = 1.2;
      lowMidNode.current.gain.value = 0;

      midNode.current = ctx.createBiquadFilter();
      midNode.current.type = "peaking";
      midNode.current.frequency.value = 1000;
      midNode.current.Q.value = 0.9;
      midNode.current.gain.value = 0;

      presenceNode.current = ctx.createBiquadFilter();
      presenceNode.current.type = "peaking";
      presenceNode.current.frequency.value = 3000;
      presenceNode.current.Q.value = 0.7;
      presenceNode.current.gain.value = 0;

      brillianceNode.current = ctx.createBiquadFilter();
      brillianceNode.current.type = "peaking";
      brillianceNode.current.frequency.value = 8000;
      brillianceNode.current.Q.value = 1.0;
      brillianceNode.current.gain.value = 0;

      airNode.current = ctx.createBiquadFilter();
      airNode.current.type = "highshelf";
      airNode.current.frequency.value = 16000;
      airNode.current.gain.value = 0;

      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      splitter.current = ctx.createChannelSplitter(2);
      merger.current = ctx.createChannelMerger(2);
      delayL.current = ctx.createDelay(0.1);
      delayR.current = ctx.createDelay(0.1);
      widenerGainL.current = ctx.createGain();
      widenerGainR.current = ctx.createGain();
      delayL.current.delayTime.value = 0;
      delayR.current.delayTime.value = 0;
      widenerGainL.current.gain.value = 1;
      widenerGainR.current.gain.value = 1;

      spatialPanner.current = ctx.createPanner();
      spatialPanner.current.panningModel = isMobile ? "equalpower" : "HRTF";
      spatialPanner.current.distanceModel = "inverse";
      spatialPanner.current.refDistance = 1;
      spatialPanner.current.rolloffFactor = 0;
      spatialPanner.current.positionX.value = 0;
      spatialPanner.current.positionY.value = 0;
      spatialPanner.current.positionZ.value = 0;

      convolverNode.current = ctx.createConvolver();
      convolverNode.current.buffer = buildImpulseResponse(ctx, 2.8, 3.2);
      reverbGain.current = ctx.createGain();
      reverbGain.current.gain.value = 0;
      dryGain.current = ctx.createGain();
      dryGain.current.gain.value = 1;
      reverbMixNode.current = ctx.createGain();
      reverbMixNode.current.gain.value = 1;

      compressor.current = ctx.createDynamicsCompressor();
      compressor.current.threshold.value = -24;
      compressor.current.knee.value = 12;
      compressor.current.ratio.value = 4;
      compressor.current.attack.value = 0.003;
      compressor.current.release.value = 0.15;

      gainNode.current = ctx.createGain();
      gainNode.current.gain.value = 1;

      limiter.current = ctx.createDynamicsCompressor();
      limiter.current.threshold.value = -1.0;
      limiter.current.knee.value = 0;
      limiter.current.ratio.value = 20;
      limiter.current.attack.value = 0.001;
      limiter.current.release.value = 0.05;

      analyzerNode.current = ctx.createAnalyser();
      analyzerNode.current.fftSize = 2048;

      // Signal chain
      const eqChain = [subBassNode, bassNode, lowMidNode, midNode, presenceNode, brillianceNode, airNode].map(r => r.current);
      sourceNode.current.connect(preGain.current);
      eqChain.reduce((prev, node) => { prev.connect(node); return node; }, preGain.current);

      const eqOut = eqChain[eqChain.length - 1];
      eqOut.connect(splitter.current);
      splitter.current.connect(delayL.current, 0);
      delayL.current.connect(widenerGainL.current);
      widenerGainL.current.connect(merger.current, 0, 0);
      splitter.current.connect(delayR.current, 1);
      delayR.current.connect(widenerGainR.current);
      widenerGainR.current.connect(merger.current, 0, 1);
      merger.current.connect(spatialPanner.current);
      spatialPanner.current.connect(compressor.current);
      compressor.current.connect(dryGain.current);
      dryGain.current.connect(reverbMixNode.current);
      compressor.current.connect(convolverNode.current);
      convolverNode.current.connect(reverbGain.current);
      reverbGain.current.connect(reverbMixNode.current);
      reverbMixNode.current.connect(gainNode.current);
      gainNode.current.connect(analyzerNode.current);
      analyzerNode.current.connect(limiter.current);
      limiter.current.connect(ctx.destination);

    } catch (err) {
      console.error("Critical: Dolby Atmos Engine failed", err);
    }
  }, [buildImpulseResponse]);

  /* =========================================================
      4. DOLBY ATMOS TOGGLE
      ========================================================= */
  const toggleEnhancedAudio = useCallback(() => {
    if (!audioCtx.current) initSpatialEngine();
    const newState = !isEnhanced;
    setIsEnhanced(newState);
    const ctx = audioCtx.current;
    if (!ctx) return;
    if (ctx.state === "suspended") ctx.resume();
    const now = ctx.currentTime;
    const fade = 0.4;
    const ramp = (param, target) => {
      param.cancelScheduledValues(now);
      param.setValueAtTime(param.value, now);
      param.linearRampToValueAtTime(target, now + fade);
    };
    if (newState) {
      ramp(subBassNode.current.gain, 6);
      ramp(bassNode.current.gain, 5);
      ramp(lowMidNode.current.gain, -2);
      ramp(midNode.current.gain, 1);
      ramp(presenceNode.current.gain, 4);
      ramp(brillianceNode.current.gain, 3);
      ramp(airNode.current.gain, 5);
      ramp(delayL.current.delayTime, 0.018);
      ramp(delayR.current.delayTime, 0);
      ramp(widenerGainL.current.gain, 1.1);
      ramp(widenerGainR.current.gain, 1.0);
      ramp(spatialPanner.current.positionZ, 1.8);
      ramp(reverbGain.current.gain, 0.18);
      ramp(dryGain.current.gain, 0.88);
      ramp(gainNode.current.gain, 1.15);
    } else {
      ramp(subBassNode.current.gain, 0);
      ramp(bassNode.current.gain, 0);
      ramp(lowMidNode.current.gain, 0);
      ramp(midNode.current.gain, 0);
      ramp(presenceNode.current.gain, 0);
      ramp(brillianceNode.current.gain, 0);
      ramp(airNode.current.gain, 0);
      ramp(delayL.current.delayTime, 0);
      ramp(delayR.current.delayTime, 0);
      ramp(widenerGainL.current.gain, 1);
      ramp(widenerGainR.current.gain, 1);
      ramp(spatialPanner.current.positionZ, 0);
      ramp(reverbGain.current.gain, 0);
      ramp(dryGain.current.gain, 1);
      ramp(gainNode.current.gain, 1);
    }
  }, [isEnhanced, initSpatialEngine]);

  /* =========================================================
      5. CORE PLAYER ACTIONS
      ========================================================= */
  const togglePlay = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (!audioCtx.current) initSpatialEngine();
    if (audioCtx.current?.state === "suspended") await audioCtx.current.resume();
    if (audio.paused) {
      try { await audio.play(); } catch (err) { console.warn("Play blocked", err); }
    } else {
      audio.pause();
    }
  }, [initSpatialEngine]);

  // ✅ seekTo — was accidentally missing, now restored
  const seekTo = useCallback((time) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setProgress(time);
      localStorage.setItem("last_timestamp", time.toString());
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
    crossfadeTriggeredRef.current = false;
  };

  const playNext = useCallback(async () => {
    if (!playlist.length) return;
    const nextIdx = (currentIndex + 1) % playlist.length;
    if (audioCtx.current?.state === "suspended") await audioCtx.current.resume();
    setCurrentIndex(nextIdx);
    setCurrentSong(playlist[nextIdx]);
    setIsPlaying(true);
    crossfadeTriggeredRef.current = false;
  }, [playlist, currentIndex]);

  const playPrev = useCallback(async () => {
    if (!playlist.length) return;
    const prevIdx = (currentIndex - 1 + playlist.length) % playlist.length;
    if (audioCtx.current?.state === "suspended") await audioCtx.current.resume();
    setCurrentIndex(prevIdx);
    setCurrentSong(playlist[prevIdx]);
    setIsPlaying(true);
    crossfadeTriggeredRef.current = false;
  }, [playlist, currentIndex]);

  // Keep refs fresh for Media Session
  useEffect(() => { togglePlayRef.current = togglePlay; }, [togglePlay]);
  useEffect(() => { playNextRef.current = playNext; }, [playNext]);
  useEffect(() => { playPrevRef.current = playPrev; }, [playPrev]);

  /* =========================================================
      5B. APPLE MUSIC STYLE CROSSFADE
      ── Current song fades out over last 5 sec
      ── Next song starts from beginning, fades in simultaneously
      ── Seamless handoff with no gap
      ========================================================= */
  const handleCrossfade = useCallback(async () => {
    if (
      !audioCtx.current ||
      !gainNode.current ||
      !compressor.current ||
      isCrossfading ||
      isLoop ||
      playlist.length < 2 ||
      crossfadeTriggeredRef.current
    ) return;

    const nextIndex = (currentIndex + 1) % playlist.length;
    const nextSong = playlist[nextIndex];
    if (!nextSong) return;

    // Lock immediately — prevent any re-entry
    crossfadeTriggeredRef.current = true;
    setIsCrossfading(true);

    const ctx = audioCtx.current;
    const FADE_DURATION = 5; // seconds — matches Apple Music feel
    const now = ctx.currentTime;

    try {
      // ── PRE-LOAD next song before fading ──
      const nextAudio = new Audio(nextSong.audio_url);
      nextAudio.crossOrigin = "anonymous";
      nextAudio.preload = "auto";

      // Wait for enough data to start playing
      await new Promise((resolve, reject) => {
        nextAudio.addEventListener("canplaythrough", resolve, { once: true });
        nextAudio.addEventListener("error", (e) => reject(e), { once: true });
        // Timeout fallback — if canplaythrough takes too long, proceed anyway
        setTimeout(resolve, 3000);
        nextAudio.load();
      });

      // Create a gain node for the incoming track
      const nextSource = ctx.createMediaElementSource(nextAudio);
      const nextGain = ctx.createGain();

      // Start at 0 volume — will fade in
      nextGain.gain.setValueAtTime(0, now);

      // Connect into the main chain (after compressor so EQ/reverb applies)
      nextSource.connect(nextGain);
      nextGain.connect(compressor.current);

      // ── Start next song playing immediately (inaudible at vol 0) ──
      await nextAudio.play();

      // ── FADE OUT current song ──
      gainNode.current.gain.cancelScheduledValues(now);
      gainNode.current.gain.setValueAtTime(gainNode.current.gain.value, now);
      gainNode.current.gain.linearRampToValueAtTime(0, now + FADE_DURATION);

      // ── FADE IN next song (S-curve feel using exponential) ──
      nextGain.gain.setValueAtTime(0, now);
      nextGain.gain.linearRampToValueAtTime(0.3, now + FADE_DURATION * 0.4);  // slow start
      nextGain.gain.linearRampToValueAtTime(1.0, now + FADE_DURATION);        // full by end

      // ── After fade completes: do the hard switch ──
      setTimeout(async () => {
        try {
          // ✅ FIX: Save exactly where nextAudio has reached after 5 sec of playing
          const resumeAt = nextAudio.currentTime;

          // Stop old track
          audioRef.current.pause();

          // Clean up temp nodes
          nextSource.disconnect();
          nextGain.disconnect();
          nextAudio.pause();

          // Switch main audio element to next song
          audioRef.current.src = nextSong.audio_url;
          lastSrcRef.current = nextSong.audio_url;
          audioRef.current.load();

          // ✅ Set currentTime INSIDE canplay handler — only safe place
          await new Promise((resolve) => {
            audioRef.current.addEventListener("canplay", () => {
              if (resumeAt > 0) audioRef.current.currentTime = resumeAt;
              resolve();
            }, { once: true });
            setTimeout(() => {
              if (resumeAt > 0) audioRef.current.currentTime = resumeAt;
              resolve();
            }, 2000);
          });

          // Restore gain to full
          gainNode.current.gain.cancelScheduledValues(ctx.currentTime);
          gainNode.current.gain.setValueAtTime(1, ctx.currentTime);

          // Resume context if needed
          if (audioCtx.current?.state === "suspended") {
            await audioCtx.current.resume();
          }

          // Play from exact position — seamless!
          await audioRef.current.play();

          // Update React state
          setCurrentIndex(nextIndex);
          setCurrentSong(nextSong);
          setProgress(resumeAt);
          setDuration(0);

        } catch (err) {
          console.error("Crossfade handoff failed, falling back:", err);
          // Hard fallback — just switch song normally
          gainNode.current?.gain.setValueAtTime(1, ctx.currentTime);
          setCurrentIndex(nextIndex);
          setCurrentSong(nextSong);
          setIsPlaying(true);
        } finally {
          setIsCrossfading(false);
          crossfadeTriggeredRef.current = false;
        }
      }, FADE_DURATION * 1000);

    } catch (err) {
      console.error("Crossfade preload failed, falling back:", err);
      setIsCrossfading(false);
      crossfadeTriggeredRef.current = false;
      // Fallback to normal next
      const nextIdx = (currentIndex + 1) % playlist.length;
      setCurrentIndex(nextIdx);
      setCurrentSong(playlist[nextIdx]);
      setIsPlaying(true);
    }
  }, [playlist, currentIndex, isCrossfading, isLoop]);

  /* =========================================================
      6. MEDIA SESSION — HARDWARE BUTTON FIX
      ========================================================= */
  useEffect(() => {
    if (!currentSong || !("mediaSession" in navigator)) return;

    navigator.mediaSession.metadata = new MediaMetadata({
      title: currentSong.title,
      artist: currentSong.artist_name,
      artwork: [{ src: currentSong.cover_url, sizes: "512x512", type: "image/png" }],
    });

    // Ref-based handlers — never stale, works with wired earbuds
    navigator.mediaSession.setActionHandler("play", () => togglePlayRef.current?.());
    navigator.mediaSession.setActionHandler("pause", () => togglePlayRef.current?.());
    navigator.mediaSession.setActionHandler("stop", () => {
      // Wired earbuds send "stop" not "pause"
      const audio = audioRef.current;
      if (audio) audio.pause();
      setIsPlaying(false);
    });
    navigator.mediaSession.setActionHandler("nexttrack", () => playNextRef.current?.());
    navigator.mediaSession.setActionHandler("previoustrack", () => playPrevRef.current?.());
    navigator.mediaSession.setActionHandler("seekto", (details) => {
      if (details.seekTime !== undefined) {
        const audio = audioRef.current;
        if (audio) {
          audio.currentTime = details.seekTime;
          setProgress(details.seekTime);
        }
      }
    });

    localStorage.setItem("last_played_song", JSON.stringify(currentSong));
  }, [currentSong]);

  // Sync OS playback state indicator
  useEffect(() => {
    if (!("mediaSession" in navigator)) return;
    navigator.mediaSession.playbackState = isPlaying ? "playing" : "paused";
  }, [isPlaying]);

  /* =========================================================
      7. UI SYNC & EVENT LISTENERS
      ========================================================= */
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTimeUpdate = () => {
      setProgress(audio.currentTime);
      localStorage.setItem("last_timestamp", audio.currentTime.toString());

      // Update lock screen scrub bar
      if ("mediaSession" in navigator && audio.duration && !isNaN(audio.duration)) {
        try {
          navigator.mediaSession.setPositionState({
            duration: audio.duration,
            playbackRate: audio.playbackRate,
            position: Math.min(audio.currentTime, audio.duration),
          });
        } catch (e) { /* ignore */ }
      }

      // ✅ Trigger Apple Music crossfade when 5 sec remain
      if (
        audio.duration &&
        audio.duration - audio.currentTime <= 5 &&
        !isCrossfading &&
        isPlaying &&
        !isLoop &&
        !crossfadeTriggeredRef.current
      ) {
        handleCrossfade();
      }
    };

    const onLoadedMetadata = () => {
      if (audio.duration) setDuration(audio.duration);
      if (lastTimeRef.current > 0) {
        audio.currentTime = lastTimeRef.current;
        lastTimeRef.current = 0;
      }
    };

    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);

    // Only fire playNext if crossfade didn't already handle it
    const onEnded = () => {
      if (!isLoop && !crossfadeTriggeredRef.current) {
        playNext();
      }
    };

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
  }, [isLoop, playNext, handleCrossfade, isCrossfading, isPlaying]);

  /* =========================================================
      8. SOURCE LOADING — MOBILE SCREEN OFF FIX
      ========================================================= */
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !currentSong) return;

    const isNewSong = lastSrcRef.current !== currentSong.audio_url;
    if (isNewSong) {
      audio.src = currentSong.audio_url;
      lastSrcRef.current = currentSong.audio_url;
      setProgress(0);
      setDuration(0);
      audio.load();
    }

    if (isPlaying) {
      const executePlay = async () => {
        try {
          if (audioCtx.current?.state === "suspended") await audioCtx.current.resume();
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
      9. VISIBILITY CHANGE — MOBILE WAKE RESTORE
      ========================================================= */
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.visibilityState === "visible") {
        if (audioCtx.current?.state === "suspended") {
          try { await audioCtx.current.resume(); } catch (e) { console.warn(e); }
        }
        const audio = audioRef.current;
        if (audio && audio.currentTime < 1) {
          const savedTime = parseFloat(localStorage.getItem("last_timestamp") || "0");
          if (savedTime > 1) { audio.currentTime = savedTime; setProgress(savedTime); }
        }
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);

  /* =========================================================
      10. STATS TRACKING
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
      CONTEXT VALUE
      ========================================================= */
  const value = useMemo(() => ({
    playlist, currentIndex, currentSong,
    currentSongId: currentSong?.id || null,
    isPlaying, progress, duration, isLoop, volume,
    playbackRate, listenedSeconds, isEnhanced,
    toggleEnhancedAudio,
    setPlaybackRate: (r) => {
      setPlaybackRate(r);
      if (audioRef.current) audioRef.current.playbackRate = r;
    },
    playSong,
    togglePlay,
    playNext,
    playPrev,
    seekTo,        // ✅ restored
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
    getAnalyzer: () => analyzerNode.current,
  }), [
    playlist, currentIndex, currentSong, isPlaying, progress, duration,
    isLoop, volume, playbackRate, listenedSeconds, isEnhanced, currentSong?.id,
    togglePlay, playNext, playPrev, seekTo, toggleEnhancedAudio,
  ]);

  return (
    <PlayerContext.Provider value={value}>
      {children}
      <audio ref={audioRef} playsInline crossOrigin="anonymous" preload="metadata" />
    </PlayerContext.Provider>
  );
};

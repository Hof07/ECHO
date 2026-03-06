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

/* =============================================================
    DEVICE ENGINE CONFIGS
    ─────────────────────────────────────────────────────────────
    DESKTOP_ENGINE  → Original full-quality Dolby Atmos settings
    MOBILE_ENGINE   → Lightweight, no crackling
   ============================================================= */
const DESKTOP_ENGINE = {
  sampleRate:  48000,
  latencyHint: "playback",
  preGain:     0.8,
  panningModel: "HRTF",
  impulse:     { duration: 2.8, decay: 3.2 },
  compressor:  { threshold: -24, knee: 12, ratio: 4,  release: 0.15 },
  limiter:     { threshold: -1.0 },
  fftSize:     2048,
  crossfadeDuration: 5,
  enhance: {
    subBass:    6,
    bass:       5,
    lowMid:    -2,
    mid:        1,
    presence:   4,
    brilliance: 3,
    air:        5,
    delayL:     0.018,
    delayR:     0,
    gainL:      1.1,
    gainR:      1.0,
    pannerZ:    1.8,
    reverbWet:  0.18,
    dryGain:    0.88,
    outputGain: 1.15,
  },
};

const MOBILE_ENGINE = {
  sampleRate:  44100,           // native phone DAC — avoids OS resampling jitter
  latencyHint: "interactive",
  preGain:     0.7,             // lower headroom, phone DACs clip early
  panningModel: "equalpower",   // HRTF is too CPU-heavy on mobile
  impulse:     { duration: 1.2, decay: 2.5 }, // shorter IR = less convolver CPU
  compressor:  { threshold: -18, knee: 8,  ratio: 6,  release: 0.1  },
  limiter:     { threshold: -2.0 },           // extra OS headroom
  fftSize:     1024,            // less memory bandwidth per frame
  crossfadeDuration: 3,         // shorter overlap = less simultaneous decoding
  enhance: {
    subBass:    3,              // phone speakers can't reproduce sub-bass
    bass:       4,
    lowMid:    -1,
    mid:        1,
    presence:   3,
    brilliance: 2,
    air:        3,              // phone tweeters distort above ~10 kHz
    delayL:     0.012,          // smaller delay avoids comb filter on mono speakers
    delayR:     0,
    gainL:      1.05,
    gainR:      1.0,
    pannerZ:    1.0,            // less depth — avoids loud/quiet swings on equalpower
    reverbWet:  0.10,           // less reverb = less convolver CPU
    dryGain:    0.92,
    outputGain: 1.05,           // stays safely under limiter threshold
  },
};

export const PlayerProvider = ({ children }) => {
  /* =========================================================
      AUDIO ENGINE REFS
      ========================================================= */
  const audioRef   = useRef(null);
  const audioCtx   = useRef(null);
  const sourceNode = useRef(null);
  const lastTimeRef = useRef(0);
  const lastSrcRef  = useRef(null);
  const crossfadeTriggeredRef = useRef(false);

  // Resolved once on mount — never changes
  const isMobileRef      = useRef(false);
  const engineConfigRef  = useRef(DESKTOP_ENGINE); // active config pointer

  // Always-fresh refs for Media Session (fixes stale closure / earbud stop btn)
  const togglePlayRef = useRef(null);
  const playNextRef   = useRef(null);
  const playPrevRef   = useRef(null);

  // 7-band EQ
  const subBassNode    = useRef(null);
  const bassNode       = useRef(null);
  const lowMidNode     = useRef(null);
  const midNode        = useRef(null);
  const presenceNode   = useRef(null);
  const brillianceNode = useRef(null);
  const airNode        = useRef(null);

  // Spatial / dynamics
  const spatialPanner = useRef(null);
  const gainNode      = useRef(null);
  const preGain       = useRef(null);
  const compressor    = useRef(null);
  const limiter       = useRef(null);
  const analyzerNode  = useRef(null);

  // Reverb
  const convolverNode  = useRef(null);
  const reverbGain     = useRef(null);
  const dryGain        = useRef(null);
  const reverbMixNode  = useRef(null);

  // Stereo widener
  const splitter      = useRef(null);
  const merger        = useRef(null);
  const delayL        = useRef(null);
  const delayR        = useRef(null);
  const widenerGainL  = useRef(null);
  const widenerGainR  = useRef(null);

  /* =========================================================
      STATE
      ========================================================= */
  const [playlist,        setPlaylist]        = useState([]);
  const [currentIndex,    setCurrentIndex]    = useState(0);
  const [currentSong,     setCurrentSong]     = useState(null);
  const [isEnhanced,      setIsEnhanced]      = useState(false);
  const [isPlaying,       setIsPlaying]       = useState(false);
  const [isLoop,          setIsLoop]          = useState(false);
  const [progress,        setProgress]        = useState(0);
  const [duration,        setDuration]        = useState(0);
  const [volume,          setVolume]          = useState(1);
  const [playbackRate,    setPlaybackRate]    = useState(1.0);
  const [listenedSeconds, setListenedSeconds] = useState(0);
  const [isLoading,       setIsLoading]       = useState(true);
  const [isCrossfading,   setIsCrossfading]   = useState(false);

  /* =========================================================
      1. PERSISTENCE HYDRATION + DEVICE DETECTION
      ========================================================= */
  useEffect(() => {
    // Detect device once → lock in the correct engine config for the session
    const mobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    isMobileRef.current     = mobile;
    engineConfigRef.current = mobile ? MOBILE_ENGINE : DESKTOP_ENGINE;

    const savedSong     = localStorage.getItem("last_played_song");
    const savedPlaylist = localStorage.getItem("last_playlist");
    const savedVolume   = localStorage.getItem("player_volume");
    const savedStats    = localStorage.getItem("total_listened_time");
    const savedTime     = localStorage.getItem("last_timestamp");

    if (savedSong)     { try { setCurrentSong(JSON.parse(savedSong));   } catch (e) { console.error(e); } }
    if (savedPlaylist) { try { setPlaylist(JSON.parse(savedPlaylist));   } catch (e) { console.error(e); } }
    if (savedVolume)   setVolume(parseFloat(savedVolume));
    if (savedStats)    setListenedSeconds(parseFloat(savedStats));
    if (savedTime)     lastTimeRef.current = parseFloat(savedTime);
    setIsLoading(false);
  }, []);

  /* =========================================================
      2. IMPULSE RESPONSE GENERATOR
      ========================================================= */
  const buildImpulseResponse = useCallback((ctx, dur, decay) => {
    const rate   = ctx.sampleRate;
    const length = Math.floor(rate * dur);
    const impulse = ctx.createBuffer(2, length, rate);
    for (let ch = 0; ch < 2; ch++) {
      const data = impulse.getChannelData(ch);
      for (let i = 0; i < length; i++) {
        const t          = i / rate;
        const earlyBoost = t < 0.08 ? 1.5 : 1.0;
        data[i] = (Math.random() * 2 - 1) * earlyBoost * Math.pow(1 - t / dur, decay);
      }
      if (ch === 1) { for (let i = 0; i < length; i++) data[i] *= 0.92; }
    }
    return impulse;
  }, []);

  /* =========================================================
      3. ENGINE INIT
      All parameters come from engineConfigRef — no branching needed.
      Desktop gets the original full-quality chain.
      Mobile gets the lightweight chain. Both use the exact same code.
      ========================================================= */
  const initSpatialEngine = useCallback(() => {
    if (audioCtx.current) return;
    try {
      const cfg     = engineConfigRef.current; // DESKTOP_ENGINE or MOBILE_ENGINE
      const Context = window.AudioContext || window.webkitAudioContext;

      audioCtx.current = new Context({
        latencyHint: cfg.latencyHint,
        sampleRate:  cfg.sampleRate,
      });
      const ctx = audioCtx.current;

      sourceNode.current             = ctx.createMediaElementSource(audioRef.current);
      preGain.current                = ctx.createGain();
      preGain.current.gain.value     = cfg.preGain;

      // EQ nodes
      subBassNode.current            = ctx.createBiquadFilter();
      subBassNode.current.type       = "lowshelf";
      subBassNode.current.frequency.value = 30;
      subBassNode.current.gain.value = 0;

      bassNode.current               = ctx.createBiquadFilter();
      bassNode.current.type          = "peaking";
      bassNode.current.frequency.value = 80;
      bassNode.current.Q.value       = 0.8;
      bassNode.current.gain.value    = 0;

      lowMidNode.current             = ctx.createBiquadFilter();
      lowMidNode.current.type        = "peaking";
      lowMidNode.current.frequency.value = 250;
      lowMidNode.current.Q.value     = 1.2;
      lowMidNode.current.gain.value  = 0;

      midNode.current                = ctx.createBiquadFilter();
      midNode.current.type           = "peaking";
      midNode.current.frequency.value = 1000;
      midNode.current.Q.value        = 0.9;
      midNode.current.gain.value     = 0;

      presenceNode.current           = ctx.createBiquadFilter();
      presenceNode.current.type      = "peaking";
      presenceNode.current.frequency.value = 3000;
      presenceNode.current.Q.value   = 0.7;
      presenceNode.current.gain.value = 0;

      brillianceNode.current         = ctx.createBiquadFilter();
      brillianceNode.current.type    = "peaking";
      brillianceNode.current.frequency.value = 8000;
      brillianceNode.current.Q.value = 1.0;
      brillianceNode.current.gain.value = 0;

      airNode.current                = ctx.createBiquadFilter();
      airNode.current.type           = "highshelf";
      airNode.current.frequency.value = 16000;
      airNode.current.gain.value     = 0;

      // Stereo widener
      splitter.current               = ctx.createChannelSplitter(2);
      merger.current                 = ctx.createChannelMerger(2);
      delayL.current                 = ctx.createDelay(0.1);
      delayR.current                 = ctx.createDelay(0.1);
      widenerGainL.current           = ctx.createGain();
      widenerGainR.current           = ctx.createGain();
      delayL.current.delayTime.value = 0;
      delayR.current.delayTime.value = 0;
      widenerGainL.current.gain.value = 1;
      widenerGainR.current.gain.value = 1;

      // Spatial panner — HRTF on desktop, equalpower on mobile
      spatialPanner.current                 = ctx.createPanner();
      spatialPanner.current.panningModel    = cfg.panningModel;
      spatialPanner.current.distanceModel   = "inverse";
      spatialPanner.current.refDistance     = 1;
      spatialPanner.current.rolloffFactor   = 0;
      spatialPanner.current.positionX.value = 0;
      spatialPanner.current.positionY.value = 0;
      spatialPanner.current.positionZ.value = 0;

      // Reverb — long IR on desktop, short IR on mobile
      convolverNode.current        = ctx.createConvolver();
      convolverNode.current.buffer = buildImpulseResponse(
        ctx,
        cfg.impulse.duration,
        cfg.impulse.decay
      );
      reverbGain.current           = ctx.createGain();
      reverbGain.current.gain.value = 0;
      dryGain.current              = ctx.createGain();
      dryGain.current.gain.value   = 1;
      reverbMixNode.current        = ctx.createGain();
      reverbMixNode.current.gain.value = 1;

      // Compressor
      compressor.current                  = ctx.createDynamicsCompressor();
      compressor.current.threshold.value  = cfg.compressor.threshold;
      compressor.current.knee.value       = cfg.compressor.knee;
      compressor.current.ratio.value      = cfg.compressor.ratio;
      compressor.current.attack.value     = 0.003;
      compressor.current.release.value    = cfg.compressor.release;

      gainNode.current             = ctx.createGain();
      gainNode.current.gain.value  = 1;

      // Limiter
      limiter.current                  = ctx.createDynamicsCompressor();
      limiter.current.threshold.value  = cfg.limiter.threshold;
      limiter.current.knee.value       = 0;
      limiter.current.ratio.value      = 20;
      limiter.current.attack.value     = 0.001;
      limiter.current.release.value    = 0.05;

      // Analyser
      analyzerNode.current         = ctx.createAnalyser();
      analyzerNode.current.fftSize = cfg.fftSize;

      // Signal chain (identical topology for both device types)
      const eqChain = [
        subBassNode, bassNode, lowMidNode, midNode,
        presenceNode, brillianceNode, airNode,
      ].map(r => r.current);

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
      console.error("Critical: Audio Engine failed to init", err);
    }
  }, [buildImpulseResponse]);

  /* =========================================================
      4. DOLBY ATMOS TOGGLE
      Reads enhance values from the active config — no if/else needed.
      Desktop gets the original full boosts. Mobile gets gentler values.
      ========================================================= */
  const toggleEnhancedAudio = useCallback(() => {
    if (!audioCtx.current) initSpatialEngine();
    const newState = !isEnhanced;
    setIsEnhanced(newState);
    const ctx = audioCtx.current;
    if (!ctx) return;
    if (ctx.state === "suspended") ctx.resume();

    const e   = engineConfigRef.current.enhance; // desktop or mobile values
    const now = ctx.currentTime;
    const fade = 0.4;
    const ramp = (param, target) => {
      param.cancelScheduledValues(now);
      param.setValueAtTime(param.value, now);
      param.linearRampToValueAtTime(target, now + fade);
    };

    if (newState) {
      ramp(subBassNode.current.gain,        e.subBass);
      ramp(bassNode.current.gain,           e.bass);
      ramp(lowMidNode.current.gain,         e.lowMid);
      ramp(midNode.current.gain,            e.mid);
      ramp(presenceNode.current.gain,       e.presence);
      ramp(brillianceNode.current.gain,     e.brilliance);
      ramp(airNode.current.gain,            e.air);
      ramp(delayL.current.delayTime,        e.delayL);
      ramp(delayR.current.delayTime,        e.delayR);
      ramp(widenerGainL.current.gain,       e.gainL);
      ramp(widenerGainR.current.gain,       e.gainR);
      ramp(spatialPanner.current.positionZ, e.pannerZ);
      ramp(reverbGain.current.gain,         e.reverbWet);
      ramp(dryGain.current.gain,            e.dryGain);
      ramp(gainNode.current.gain,           e.outputGain);
    } else {
      ramp(subBassNode.current.gain,        0);
      ramp(bassNode.current.gain,           0);
      ramp(lowMidNode.current.gain,         0);
      ramp(midNode.current.gain,            0);
      ramp(presenceNode.current.gain,       0);
      ramp(brillianceNode.current.gain,     0);
      ramp(airNode.current.gain,            0);
      ramp(delayL.current.delayTime,        0);
      ramp(delayR.current.delayTime,        0);
      ramp(widenerGainL.current.gain,       1);
      ramp(widenerGainR.current.gain,       1);
      ramp(spatialPanner.current.positionZ, 0);
      ramp(reverbGain.current.gain,         0);
      ramp(dryGain.current.gain,            1);
      ramp(gainNode.current.gain,           1);
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

  useEffect(() => { togglePlayRef.current = togglePlay; }, [togglePlay]);
  useEffect(() => { playNextRef.current   = playNext;   }, [playNext]);
  useEffect(() => { playPrevRef.current   = playPrev;   }, [playPrev]);

  /* =========================================================
      5B. CROSSFADE — duration read from active config
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
    const nextSong  = playlist[nextIndex];
    if (!nextSong) return;

    crossfadeTriggeredRef.current = true;
    setIsCrossfading(true);

    const ctx           = audioCtx.current;
    const FADE_DURATION = engineConfigRef.current.crossfadeDuration; // 5s desktop / 3s mobile
    const now           = ctx.currentTime;

    try {
      const nextAudio       = new Audio(nextSong.audio_url);
      nextAudio.crossOrigin = "anonymous";
      nextAudio.preload     = "auto";
      nextAudio.volume      = 0; // prevent OS mixer pop on graph attach

      await new Promise((resolve, reject) => {
        nextAudio.addEventListener("canplaythrough", resolve, { once: true });
        nextAudio.addEventListener("error", (e) => reject(e), { once: true });
        setTimeout(resolve, isMobileRef.current ? 4000 : 3000);
        nextAudio.load();
      });

      const nextSource = ctx.createMediaElementSource(nextAudio);
      const nextGain   = ctx.createGain();
      nextGain.gain.setValueAtTime(0, now);
      nextSource.connect(nextGain);
      nextGain.connect(compressor.current);

      nextAudio.volume = 1; // hand level control to Web Audio gain node
      await nextAudio.play();

      gainNode.current.gain.cancelScheduledValues(now);
      gainNode.current.gain.setValueAtTime(gainNode.current.gain.value, now);
      gainNode.current.gain.linearRampToValueAtTime(0, now + FADE_DURATION);

      nextGain.gain.setValueAtTime(0, now);
      nextGain.gain.linearRampToValueAtTime(0.3, now + FADE_DURATION * 0.4);
      nextGain.gain.linearRampToValueAtTime(1.0, now + FADE_DURATION);

      setTimeout(async () => {
        try {
          const resumeAt = nextAudio.currentTime;
          audioRef.current.pause();
          nextSource.disconnect();
          nextGain.disconnect();
          nextAudio.pause();

          audioRef.current.src = nextSong.audio_url;
          lastSrcRef.current   = nextSong.audio_url;
          audioRef.current.load();

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

          gainNode.current.gain.cancelScheduledValues(ctx.currentTime);
          gainNode.current.gain.setValueAtTime(1, ctx.currentTime);

          if (audioCtx.current?.state === "suspended") await audioCtx.current.resume();
          await audioRef.current.play();

          setCurrentIndex(nextIndex);
          setCurrentSong(nextSong);
          setProgress(resumeAt);
          setDuration(0);

        } catch (err) {
          console.error("Crossfade handoff failed, falling back:", err);
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
      title:   currentSong.title,
      artist:  currentSong.artist_name,
      artwork: [{ src: currentSong.cover_url, sizes: "512x512", type: "image/png" }],
    });

    navigator.mediaSession.setActionHandler("play",          () => togglePlayRef.current?.());
    navigator.mediaSession.setActionHandler("pause",         () => togglePlayRef.current?.());
    navigator.mediaSession.setActionHandler("stop",          () => {
      const audio = audioRef.current;
      if (audio) audio.pause();
      setIsPlaying(false);
    });
    navigator.mediaSession.setActionHandler("nexttrack",     () => playNextRef.current?.());
    navigator.mediaSession.setActionHandler("previoustrack", () => playPrevRef.current?.());
    navigator.mediaSession.setActionHandler("seekto",        (details) => {
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

    const crossfadeTriggerWindow = engineConfigRef.current.crossfadeDuration;

    const onTimeUpdate = () => {
      setProgress(audio.currentTime);
      localStorage.setItem("last_timestamp", audio.currentTime.toString());

      if ("mediaSession" in navigator && audio.duration && !isNaN(audio.duration)) {
        try {
          navigator.mediaSession.setPositionState({
            duration:     audio.duration,
            playbackRate: audio.playbackRate,
            position:     Math.min(audio.currentTime, audio.duration),
          });
        } catch (e) { /* ignore */ }
      }

      if (
        audio.duration &&
        audio.duration - audio.currentTime <= crossfadeTriggerWindow &&
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
        audio.currentTime   = lastTimeRef.current;
        lastTimeRef.current = 0;
      }
    };

    const onPlay  = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onEnded = () => {
      if (!isLoop && !crossfadeTriggeredRef.current) playNext();
    };

    audio.addEventListener("timeupdate",     onTimeUpdate);
    audio.addEventListener("loadedmetadata", onLoadedMetadata);
    audio.addEventListener("durationchange", onLoadedMetadata);
    audio.addEventListener("play",           onPlay);
    audio.addEventListener("pause",          onPause);
    audio.addEventListener("ended",          onEnded);

    return () => {
      audio.removeEventListener("timeupdate",     onTimeUpdate);
      audio.removeEventListener("loadedmetadata", onLoadedMetadata);
      audio.removeEventListener("durationchange", onLoadedMetadata);
      audio.removeEventListener("play",           onPlay);
      audio.removeEventListener("pause",          onPause);
      audio.removeEventListener("ended",          onEnded);
    };
  }, [isLoop, playNext, handleCrossfade, isCrossfading, isPlaying]);

  /* =========================================================
      8. SOURCE LOADING
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
      9. VISIBILITY CHANGE — MOBILE SCREEN-OFF RESTORE
      ========================================================= */
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.visibilityState === "visible") {
        const ctx = audioCtx.current;
        if (ctx?.state === "suspended") {
          try { await ctx.resume(); } catch (e) { console.warn(e); }
        }
        // iOS sometimes re-enters "running" but produces silence —
        // touching .volume forces the OS audio session to re-activate
        if (isMobileRef.current && ctx?.state === "running") {
          const audio = audioRef.current;
          if (audio && !audio.paused) {
            try { audio.volume = audio.volume; } catch (e) { /* noop */ }
          }
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

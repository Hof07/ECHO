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

/* =========================================================
    DEVICE TIER DETECTION
    Tier 0 = mobile  → safe, battery-friendly spatial
    Tier 1 = low desktop → half spatial resolution
    Tier 2 = full desktop → full 8-speaker cinema simulation
   ========================================================= */
function getDeviceTier() {
  if (typeof navigator === "undefined") return 2;
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  if (isMobile) return 0;
  const cores = navigator.hardwareConcurrency || 4;
  const mem   = navigator.deviceMemory || 8;
  if (cores <= 2 || mem <= 2) return 1;
  return 2;
}

/* =========================================================
    THEATER GEOMETRY
    8 virtual speakers placed around the listener, matching
    a real Dolby Atmos cinema layout:
      Front L/R  — the screen (forward, spread)
      Side L/R   — beside your ears (full width)
      Rear L/R   — behind you (surround feel)
      Overhead L/R — above (height/ceiling layer)

    x = left(-) / right(+)
    y = below(-) / above(+)
    z = front(+) / behind(-)
   ========================================================= */
const THEATER_SPEAKERS = [
  // [name,           x,     y,     z,   baseGain]
  ["frontLeft",    -1.8,   0.0,   2.5,  0.85],
  ["frontRight",    1.8,   0.0,   2.5,  0.85],
  ["sideLeft",     -3.0,   0.0,   0.0,  0.70],
  ["sideRight",     3.0,   0.0,   0.0,  0.70],
  ["rearLeft",     -2.0,   0.0,  -2.5,  0.60],
  ["rearRight",     2.0,   0.0,  -2.5,  0.60],
  ["overheadLeft", -1.2,   2.5,   0.5,  0.50],
  ["overheadRight", 1.2,   2.5,   0.5,  0.50],
];

/* 4-speaker mobile layout — safe for battery/CPU */
const MOBILE_SPEAKERS = [
  ["frontLeft",  -1.2,  0.0,  1.8,  0.80],
  ["frontRight",  1.2,  0.0,  1.8,  0.80],
  ["rearLeft",   -1.0,  0.0, -1.8,  0.55],
  ["rearRight",   1.0,  0.0, -1.8,  0.55],
];

export const PlayerProvider = ({ children }) => {
  /* =========================================================
      REFS — AUDIO ENGINE
     ========================================================= */
  const audioRef  = useRef(null);
  const audioCtx  = useRef(null);
  const sourceNode = useRef(null);
  const lastTimeRef = useRef(0);
  const lastSrcRef  = useRef(null);
  const crossfadeTriggeredRef = useRef(false);
  const deviceTierRef = useRef(2);

  const togglePlayRef = useRef(null);
  const playNextRef   = useRef(null);
  const playPrevRef   = useRef(null);

  // Input shaping (subtle EQ to help 3D perception — NOT loudness)
  const preGain    = useRef(null);
  const inputEQlo  = useRef(null); // low warmth shelf
  const inputEQmid = useRef(null); // boxiness notch
  const inputEQair = useRef(null); // high air shelf

  // Spatial matrix
  const enhancementGate = useRef(null); // gates the whole spatial path
  const dryDirectGain   = useRef(null); // bypass when enhancement off
  const spatialSpeakers = useRef([]);   // array of {panner, gain, name}
  const spatialBus      = useRef(null); // all speakers sum here

  // Room simulation
  const earlyConvolver = useRef(null); // wall reflections (15-80ms)
  const earlyGain      = useRef(null);
  const lateConvolver  = useRef(null); // room tail (100ms - 4s)
  const lateGain       = useRef(null);
  const dryGain        = useRef(null); // direct from spatial (no reverb)
  const roomBus        = useRef(null); // early + late + dry sum here

  // Output
  const compressor   = useRef(null);
  const outputGain   = useRef(null);
  const analyzerNode = useRef(null);
  const limiter      = useRef(null);

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
      1. HYDRATION
     ========================================================= */
  useEffect(() => {
    deviceTierRef.current = getDeviceTier();
    const g = (k) => localStorage.getItem(k);
    try { if (g("last_played_song"))  setCurrentSong(JSON.parse(g("last_played_song"))); }  catch(e){}
    try { if (g("last_playlist"))     setPlaylist(JSON.parse(g("last_playlist"))); }         catch(e){}
    if (g("player_volume"))           setVolume(parseFloat(g("player_volume")));
    if (g("total_listened_time"))     setListenedSeconds(parseFloat(g("total_listened_time")));
    if (g("last_timestamp"))          lastTimeRef.current = parseFloat(g("last_timestamp"));
    setIsLoading(false);
  }, []);

  /* =========================================================
      2. IMPULSE RESPONSE BUILDERS

      buildEarlyIR — simulates first wall reflections (15-80ms).
        This is what makes your brain think "I am in a room."
        Without this, reverb just sounds like distant blur.

      buildLateIR — diffuse tail (100ms+).
        This is the "size" feeling. Theater = long, slow decay.
        The L/R phase offset in the buffer creates stereo width
        inside the reverb itself.
     ========================================================= */
  const buildEarlyIR = useCallback((ctx, roomSize) => {
    const rate = ctx.sampleRate;
    const len  = Math.floor(rate * 0.08 * roomSize); // 80ms * roomSize
    const buf  = ctx.createBuffer(2, len, rate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) {
        const t = i / rate;
        // Two synthetic reflection peaks — feel like parallel walls
        const r1    = Math.sin(2 * Math.PI * i / (rate * 0.018)) * 0.40;
        const r2    = Math.sin(2 * Math.PI * i / (rate * 0.034)) * 0.25;
        const noise = (Math.random() * 2 - 1) * 0.35;
        d[i] = (r1 + r2 + noise) * Math.exp(-t * 60 / roomSize);
      }
      // Asymmetric L/R — real rooms are never perfectly symmetric
      if (ch === 1) for (let i = 0; i < len; i++) d[i] *= 0.88;
    }
    return buf;
  }, []);

  const buildLateIR = useCallback((ctx, dur, decay, diffusion) => {
    const rate   = ctx.sampleRate;
    const length = Math.floor(rate * dur);
    const buf    = ctx.createBuffer(2, length, rate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < length; i++) {
        const t = i / rate;
        if (i < Math.floor(rate * 0.005)) { d[i] = 0; continue; } // 5ms pre-delay
        d[i] = (Math.random() * 2 - 1) * diffusion * Math.pow(Math.max(0, 1 - t / dur), decay);
      }
      // Phase-offset R channel → stereo width inside reverb tail
      if (ch === 1) {
        const off = Math.floor(rate * 0.0007 * diffusion);
        for (let i = length - 1; i >= off; i--) d[i] = d[i - off];
        for (let i = 0; i < off; i++) d[i] = 0;
      }
    }
    return buf;
  }, []);

  /* =========================================================
      3. ENGINE INIT

      Signal flow diagram:

        [audio element]
              │
           preGain
              │
         EQ lo→mid→air
              │
        ┌─────┴──────────────────────────────┐
        │                                    │
   dryDirectGain                    enhancementGate
        │                                    │
        │              ┌────────────────┬────┴──────────────┐
        │         speaker0.gain    speaker1.gain    ...speakerN.gain
        │              │                │                    │
        │           panner0          panner1             pannerN
        │              └────────────────┴────────────────────┘
        │                                    │
        │                               spatialBus
        │                         ┌──────────┼──────────┐
        │                    earlyConv    lateConv    dryGain
        │                         │           │          │
        │                    earlyGain    lateGain       │
        └────────────────────┬────┘           │          │
                             └──────roomBus───┘──────────┘
                                      │
                                  compressor
                                      │
                                  outputGain
                                      │
                                  analyzerNode
                                      │
                                   limiter
                                      │
                                 destination
     ========================================================= */
  const initSpatialEngine = useCallback(() => {
    if (audioCtx.current) return;
    try {
      const tier    = deviceTierRef.current;
      const Context = window.AudioContext || window.webkitAudioContext;
      audioCtx.current = new Context({
        latencyHint : tier === 0 ? "interactive" : "playback",
        sampleRate  : tier === 0 ? 44100 : 48000,
      });
      const ctx = audioCtx.current;

      sourceNode.current = ctx.createMediaElementSource(audioRef.current);

      // Pre-gain
      preGain.current = ctx.createGain();
      preGain.current.gain.value = tier === 0 ? 0.72 : 0.78;

      // Input EQ — all start at 0 (neutral), ramped on enhance
      inputEQlo.current = ctx.createBiquadFilter();
      inputEQlo.current.type = "lowshelf";
      inputEQlo.current.frequency.value = 120;
      inputEQlo.current.gain.value = 0;

      inputEQmid.current = ctx.createBiquadFilter();
      inputEQmid.current.type = "peaking";
      inputEQmid.current.frequency.value = 350;
      inputEQmid.current.Q.value = 1.0;
      inputEQmid.current.gain.value = 0;

      inputEQair.current = ctx.createBiquadFilter();
      inputEQair.current.type = "highshelf";
      inputEQair.current.frequency.value = 8000;
      inputEQair.current.gain.value = 0;

      // Enhancement gate + bypass
      enhancementGate.current = ctx.createGain();
      enhancementGate.current.gain.value = 0;
      dryDirectGain.current = ctx.createGain();
      dryDirectGain.current.gain.value = 1;

      // Spatial bus
      spatialBus.current = ctx.createGain();
      spatialBus.current.gain.value = 1;

      // Virtual speakers
      const defs = tier === 0 ? MOBILE_SPEAKERS : THEATER_SPEAKERS;
      spatialSpeakers.current = defs.map(([name, x, y, z, baseGain]) => {
        const panner = ctx.createPanner();
        panner.panningModel  = tier === 0 ? "equalpower" : "HRTF";
        panner.distanceModel = "inverse";
        panner.refDistance   = 1;
        panner.rolloffFactor = 0.5;
        panner.positionX.value = x;
        panner.positionY.value = y;
        panner.positionZ.value = z;

        const gain = ctx.createGain();
        gain.gain.value = 0; // starts silent

        enhancementGate.current.connect(gain);
        gain.connect(panner);
        panner.connect(spatialBus.current);
        return { name, panner, gain, baseGain };
      });

      // Room simulation IRs
      const roomSize = tier === 2 ? 1.6 : tier === 1 ? 1.2 : 0.9;
      const irDur    = tier === 0 ? 1.2 : tier === 1 ? 2.5 : 3.8;
      const irDecay  = tier === 0 ? 2.8 : tier === 1 ? 3.2 : 4.0;
      const irDiff   = tier === 0 ? 0.7 : tier === 1 ? 0.85 : 0.95;

      earlyConvolver.current = ctx.createConvolver();
      earlyConvolver.current.buffer = buildEarlyIR(ctx, roomSize);
      earlyGain.current = ctx.createGain();
      earlyGain.current.gain.value = 0;

      lateConvolver.current = ctx.createConvolver();
      lateConvolver.current.buffer = buildLateIR(ctx, irDur, irDecay, irDiff);
      lateGain.current = ctx.createGain();
      lateGain.current.gain.value = 0;

      dryGain.current = ctx.createGain();
      dryGain.current.gain.value = 1;

      roomBus.current = ctx.createGain();
      roomBus.current.gain.value = 1;

      // Output
      compressor.current = ctx.createDynamicsCompressor();
      compressor.current.threshold.value = tier === 0 ? -18 : -22;
      compressor.current.knee.value      = 10;
      compressor.current.ratio.value     = tier === 0 ? 5 : 3.5;
      compressor.current.attack.value    = 0.005;
      compressor.current.release.value   = 0.15;

      outputGain.current = ctx.createGain();
      outputGain.current.gain.value = 1;

      analyzerNode.current = ctx.createAnalyser();
      analyzerNode.current.fftSize = tier === 0 ? 1024 : tier === 1 ? 2048 : 4096;

      limiter.current = ctx.createDynamicsCompressor();
      limiter.current.threshold.value = -1.5;
      limiter.current.knee.value  = 0;
      limiter.current.ratio.value = 20;
      limiter.current.attack.value   = 0.001;
      limiter.current.release.value  = 0.05;

      // ── WIRE EVERYTHING ──────────────────────────────────
      sourceNode.current.connect(preGain.current);
      preGain.current.connect(inputEQlo.current);
      inputEQlo.current.connect(inputEQmid.current);
      inputEQmid.current.connect(inputEQair.current);
      const eqOut = inputEQair.current;

      // Path A: dry bypass (active when enhancement off)
      eqOut.connect(dryDirectGain.current);
      dryDirectGain.current.connect(roomBus.current);

      // Path B: spatial matrix (active when enhancement on)
      eqOut.connect(enhancementGate.current);
      // enhancementGate → speaker gains → panners → spatialBus (wired in loop above)

      spatialBus.current.connect(earlyConvolver.current);
      earlyConvolver.current.connect(earlyGain.current);
      earlyGain.current.connect(roomBus.current);

      spatialBus.current.connect(lateConvolver.current);
      lateConvolver.current.connect(lateGain.current);
      lateGain.current.connect(roomBus.current);

      spatialBus.current.connect(dryGain.current);
      dryGain.current.connect(roomBus.current);

      roomBus.current.connect(compressor.current);
      compressor.current.connect(outputGain.current);
      outputGain.current.connect(analyzerNode.current);
      analyzerNode.current.connect(limiter.current);
      limiter.current.connect(ctx.destination);

    } catch (err) {
      console.error("Spatial Engine init failed:", err);
    }
  }, [buildEarlyIR, buildLateIR]);

  /* =========================================================
      4. TOGGLE THEATER MODE

      The goal is NOT to make it louder.
      The goal is to make the sound feel like it surrounds you.

      How:
        1. Input EQ: subtle "opening up" — warmth + air, cut boxiness
           This helps the brain localise sound (muddy mixes feel mono)
        2. Dry direct path goes to 0 — all audio now comes from
           virtual speakers placed around the listener in 3D space
        3. 8 (or 4 on mobile) HRTF panners each get the same signal
           but positioned at different angles. HRTF = Head-Related
           Transfer Function — the browser applies real ear/head
           filtering so your brain hears "that came from the left"
        4. Early reflections IR makes the brain feel "I am in a room"
        5. Late reverb tail gives the room its size/scale
        6. outputGain is REDUCED to compensate for 8 signals summing
           — net perceived volume stays the same, just spatialised
     ========================================================= */
  const toggleEnhancedAudio = useCallback(() => {
    if (!audioCtx.current) initSpatialEngine();
    const newState = !isEnhanced;
    setIsEnhanced(newState);
    const ctx = audioCtx.current;
    if (!ctx) return;
    if (ctx.state === "suspended") ctx.resume();

    const tier = deviceTierRef.current;
    const now  = ctx.currentTime;
    const fade = 0.8; // 800ms crossfade so the transition feels cinematic

    const ramp = (param, target) => {
      if (!param) return;
      param.cancelScheduledValues(now);
      param.setValueAtTime(param.value, now);
      param.linearRampToValueAtTime(target, now + fade);
    };

    if (newState) {
      // Input EQ — subtle, purely for 3D localisation clarity
      ramp(inputEQlo.current.gain,  tier === 0 ? 1.5 : tier === 1 ? 2.5 : 3.0);  // warmth
      ramp(inputEQmid.current.gain, tier === 0 ? -2.0 : tier === 1 ? -3.0 : -4.0); // cut mud
      ramp(inputEQair.current.gain, tier === 0 ? 2.0 : tier === 1 ? 3.5 : 5.0);  // air/ceiling

      // Gate: spatial path ON, dry bypass OFF
      ramp(enhancementGate.current.gain, 1);
      ramp(dryDirectGain.current.gain,   0);

      // Staggered speaker fade-in (front first, then sides, rears, overhead)
      // — feels like the cinema "opening up" around you
      spatialSpeakers.current.forEach(({ gain, baseGain }, i) => {
        const g = tier === 0 ? baseGain * 0.80 : baseGain;
        gain.gain.cancelScheduledValues(now);
        gain.gain.setValueAtTime(0, now);
        // Each speaker fades in 60ms after the previous
        gain.gain.linearRampToValueAtTime(g, now + fade + i * 0.06);
      });

      // Room: early reflections (feel of walls), then late tail (room size)
      ramp(earlyGain.current.gain, tier === 0 ? 0.12 : tier === 1 ? 0.18 : 0.25);
      ramp(lateGain.current.gain,  tier === 0 ? 0.08 : tier === 1 ? 0.14 : 0.20);
      ramp(dryGain.current.gain,   tier === 0 ? 0.65 : tier === 1 ? 0.58 : 0.52);

      // Reduce output gain to compensate for 8 panners summing (not louder, just wider)
      ramp(outputGain.current.gain, tier === 0 ? 0.82 : tier === 1 ? 0.74 : 0.68);

    } else {
      // Reset — clean stereo
      ramp(inputEQlo.current.gain,  0);
      ramp(inputEQmid.current.gain, 0);
      ramp(inputEQair.current.gain, 0);
      ramp(enhancementGate.current.gain, 0);
      ramp(dryDirectGain.current.gain,   1);
      spatialSpeakers.current.forEach(({ gain }) => ramp(gain.gain, 0));
      ramp(earlyGain.current.gain, 0);
      ramp(lateGain.current.gain,  0);
      ramp(dryGain.current.gain,   1);
      ramp(outputGain.current.gain, 1);
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
    if (list.length) { setPlaylist(list); localStorage.setItem("last_playlist", JSON.stringify(list)); }
    setCurrentIndex(index);
    setCurrentSong(song);
    setIsPlaying(true);
    crossfadeTriggeredRef.current = false;
  };

  const playNext = useCallback(async () => {
    if (!playlist.length) return;
    const i = (currentIndex + 1) % playlist.length;
    if (audioCtx.current?.state === "suspended") await audioCtx.current.resume();
    setCurrentIndex(i); setCurrentSong(playlist[i]); setIsPlaying(true);
    crossfadeTriggeredRef.current = false;
  }, [playlist, currentIndex]);

  const playPrev = useCallback(async () => {
    if (!playlist.length) return;
    const i = (currentIndex - 1 + playlist.length) % playlist.length;
    if (audioCtx.current?.state === "suspended") await audioCtx.current.resume();
    setCurrentIndex(i); setCurrentSong(playlist[i]); setIsPlaying(true);
    crossfadeTriggeredRef.current = false;
  }, [playlist, currentIndex]);

  useEffect(() => { togglePlayRef.current = togglePlay; }, [togglePlay]);
  useEffect(() => { playNextRef.current   = playNext;   }, [playNext]);
  useEffect(() => { playPrevRef.current   = playPrev;   }, [playPrev]);

  /* =========================================================
      5B. CROSSFADE
     ========================================================= */
  const handleCrossfade = useCallback(async () => {
    if (
      !audioCtx.current || !outputGain.current || !compressor.current ||
      isCrossfading || isLoop || playlist.length < 2 ||
      crossfadeTriggeredRef.current
    ) return;

    const nextIdx  = (currentIndex + 1) % playlist.length;
    const nextSong = playlist[nextIdx];
    if (!nextSong) return;

    crossfadeTriggeredRef.current = true;
    setIsCrossfading(true);

    const ctx  = audioCtx.current;
    const tier = deviceTierRef.current;
    const FADE = tier === 0 ? 3 : tier === 1 ? 4 : 5;
    const now  = ctx.currentTime;

    try {
      const nextAudio = new Audio(nextSong.audio_url);
      nextAudio.crossOrigin = "anonymous";
      nextAudio.preload = "auto";
      nextAudio.volume  = 0;

      await new Promise((res, rej) => {
        nextAudio.addEventListener("canplaythrough", res, { once: true });
        nextAudio.addEventListener("error", rej, { once: true });
        setTimeout(res, tier === 0 ? 4000 : 3000);
        nextAudio.load();
      });

      const nextSource = ctx.createMediaElementSource(nextAudio);
      const nextGain   = ctx.createGain();
      nextGain.gain.setValueAtTime(0, now);
      nextSource.connect(nextGain);
      nextGain.connect(compressor.current);
      nextAudio.volume = 1;
      await nextAudio.play();

      outputGain.current.gain.cancelScheduledValues(now);
      outputGain.current.gain.setValueAtTime(outputGain.current.gain.value, now);
      outputGain.current.gain.linearRampToValueAtTime(0, now + FADE);
      nextGain.gain.setValueAtTime(0, now);
      nextGain.gain.linearRampToValueAtTime(0.3, now + FADE * 0.4);
      nextGain.gain.linearRampToValueAtTime(1.0, now + FADE);

      setTimeout(async () => {
        try {
          const resumeAt = nextAudio.currentTime;
          audioRef.current.pause();
          nextSource.disconnect(); nextGain.disconnect(); nextAudio.pause();
          audioRef.current.src = nextSong.audio_url;
          lastSrcRef.current   = nextSong.audio_url;
          audioRef.current.load();
          await new Promise((res) => {
            audioRef.current.addEventListener("canplay", () => {
              if (resumeAt > 0) audioRef.current.currentTime = resumeAt; res();
            }, { once: true });
            setTimeout(() => { if (resumeAt > 0) audioRef.current.currentTime = resumeAt; res(); }, 2000);
          });
          const targetGain = isEnhanced ? (tier === 0 ? 0.82 : tier === 1 ? 0.74 : 0.68) : 1;
          outputGain.current.gain.cancelScheduledValues(ctx.currentTime);
          outputGain.current.gain.setValueAtTime(targetGain, ctx.currentTime);
          if (audioCtx.current?.state === "suspended") await audioCtx.current.resume();
          await audioRef.current.play();
          setCurrentIndex(nextIdx); setCurrentSong(nextSong); setProgress(resumeAt); setDuration(0);
        } catch (err) {
          console.error("Crossfade handoff failed:", err);
          outputGain.current?.gain.setValueAtTime(1, ctx.currentTime);
          setCurrentIndex(nextIdx); setCurrentSong(nextSong); setIsPlaying(true);
        } finally {
          setIsCrossfading(false);
          crossfadeTriggeredRef.current = false;
        }
      }, FADE * 1000);
    } catch (err) {
      console.error("Crossfade preload failed:", err);
      setIsCrossfading(false);
      crossfadeTriggeredRef.current = false;
      const i = (currentIndex + 1) % playlist.length;
      setCurrentIndex(i); setCurrentSong(playlist[i]); setIsPlaying(true);
    }
  }, [playlist, currentIndex, isCrossfading, isLoop, isEnhanced]);

  /* =========================================================
      6. MEDIA SESSION
     ========================================================= */
  useEffect(() => {
    if (!currentSong || !("mediaSession" in navigator)) return;
    navigator.mediaSession.metadata = new MediaMetadata({
      title  : currentSong.title,
      artist : currentSong.artist_name,
      artwork: [{ src: currentSong.cover_url, sizes: "512x512", type: "image/png" }],
    });
    navigator.mediaSession.setActionHandler("play",          () => togglePlayRef.current?.());
    navigator.mediaSession.setActionHandler("pause",         () => togglePlayRef.current?.());
    navigator.mediaSession.setActionHandler("stop",          () => { audioRef.current?.pause(); setIsPlaying(false); });
    navigator.mediaSession.setActionHandler("nexttrack",     () => playNextRef.current?.());
    navigator.mediaSession.setActionHandler("previoustrack", () => playPrevRef.current?.());
    navigator.mediaSession.setActionHandler("seekto", (d) => {
      if (d.seekTime !== undefined && audioRef.current) {
        audioRef.current.currentTime = d.seekTime; setProgress(d.seekTime);
      }
    });
    localStorage.setItem("last_played_song", JSON.stringify(currentSong));
  }, [currentSong]);

  useEffect(() => {
    if (!("mediaSession" in navigator)) return;
    navigator.mediaSession.playbackState = isPlaying ? "playing" : "paused";
  }, [isPlaying]);

  /* =========================================================
      7. UI SYNC
     ========================================================= */
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const tier = deviceTierRef.current;
    const xfadeOffset = tier === 0 ? 3 : tier === 1 ? 4 : 5;

    const onTimeUpdate = () => {
      setProgress(audio.currentTime);
      localStorage.setItem("last_timestamp", audio.currentTime.toString());
      if ("mediaSession" in navigator && audio.duration && !isNaN(audio.duration)) {
        try {
          navigator.mediaSession.setPositionState({
            duration: audio.duration, playbackRate: audio.playbackRate,
            position: Math.min(audio.currentTime, audio.duration),
          });
        } catch(e) {}
      }
      if (
        audio.duration && audio.duration - audio.currentTime <= xfadeOffset &&
        !isCrossfading && isPlaying && !isLoop && !crossfadeTriggeredRef.current
      ) handleCrossfade();
    };
    const onLoadedMetadata = () => {
      if (audio.duration) setDuration(audio.duration);
      if (lastTimeRef.current > 0) { audio.currentTime = lastTimeRef.current; lastTimeRef.current = 0; }
    };
    const onPlay  = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onEnded = () => { if (!isLoop && !crossfadeTriggeredRef.current) playNext(); };

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
    const isNew = lastSrcRef.current !== currentSong.audio_url;
    if (isNew) {
      audio.src = currentSong.audio_url;
      lastSrcRef.current = currentSong.audio_url;
      setProgress(0); setDuration(0); audio.load();
    }
    if (isPlaying) {
      (async () => {
        try {
          if (audioCtx.current?.state === "suspended") await audioCtx.current.resume();
          await audio.play();
        } catch (err) { console.warn("Playback prevented", err); setIsPlaying(false); }
      })();
    }
  }, [currentSong, isPlaying]);

  /* =========================================================
      9. iOS WAKE RESTORE
     ========================================================= */
  useEffect(() => {
    const handle = async () => {
      if (document.visibilityState !== "visible") return;
      const ctx = audioCtx.current;
      if (ctx?.state === "suspended") { try { await ctx.resume(); } catch(e){} }
      if (ctx?.state === "running" && deviceTierRef.current === 0) {
        const audio = audioRef.current;
        if (audio && !audio.paused) { try { audio.volume = audio.volume; } catch(e){} }
      }
      const audio = audioRef.current;
      if (audio && audio.currentTime < 1) {
        const t = parseFloat(localStorage.getItem("last_timestamp") || "0");
        if (t > 1) { audio.currentTime = t; setProgress(t); }
      }
    };
    document.addEventListener("visibilitychange", handle);
    return () => document.removeEventListener("visibilitychange", handle);
  }, []);

  /* =========================================================
      10. STATS
     ========================================================= */
  useEffect(() => {
    const timer = setInterval(() => {
      if (isPlaying) setListenedSeconds(prev => {
        const u = prev + 1;
        localStorage.setItem("total_listened_time", u.toString());
        return u;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [isPlaying]);

  /* =========================================================
      CONTEXT VALUE
     ========================================================= */
  const value = useMemo(() => ({
    playlist, currentIndex, currentSong,
    currentSongId : currentSong?.id || null,
    isPlaying, progress, duration, isLoop, volume,
    playbackRate, listenedSeconds, isEnhanced,
    deviceTier : deviceTierRef.current,
    toggleEnhancedAudio,
    setPlaybackRate : (r) => {
      setPlaybackRate(r);
      if (audioRef.current) audioRef.current.playbackRate = r;
    },
    playSong, togglePlay, playNext, playPrev, seekTo,
    toggleLoop : () => {
      const next = !isLoop;
      setIsLoop(next);
      if (audioRef.current) audioRef.current.loop = next;
    },
    changeVolume : (v) => {
      setVolume(v);
      if (audioRef.current) audioRef.current.volume = v;
      localStorage.setItem("player_volume", v.toString());
    },
    getAnalyzer : () => analyzerNode.current,
  }), [
    playlist, currentIndex, currentSong, isPlaying, progress, duration,
    isLoop, volume, playbackRate, listenedSeconds, isEnhanced,
    currentSong?.id, togglePlay, playNext, playPrev, seekTo, toggleEnhancedAudio,
  ]);

  return (
    <PlayerContext.Provider value={value}>
      {children}
      <audio ref={audioRef} playsInline crossOrigin="anonymous" preload="metadata" />
    </PlayerContext.Provider>
  );
};
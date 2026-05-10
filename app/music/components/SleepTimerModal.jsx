"use client";

import { useState, useRef, useCallback, useEffect } from 'react';
import { X, Clock, Music, Timer, Trash2, CheckCircle2 } from 'lucide-react';

const MAX_MINUTES = 120;
const DIAL_RADIUS = 120;

export default function SleepTimerModal({
    isActive,
    timeRemaining,   // Time remaining in seconds (for sleep timer)
    isSongTimer,     // boolean: true if "stop after this song" is active
    onSetTimer,      // (seconds) => void
    onSetSongTimer,  // () => void
    onCancelTimer,   // () => void  — cancels either timer type
    onClose,
    audioRef,        // NEW: ref to the <audio> or <video> element to pause
    onPause,         // NEW: optional callback to call when timer fires (e.g. update play state)
}) {
    const [localTime, setLocalTime] = useState(30);
    const [isDragging, setIsDragging] = useState(false);
    const [mode, setMode] = useState("time");
    const dialRef = useRef(null);
    const timerRef = useRef(null);

    useEffect(() => {
        if (isActive && timeRemaining === 0 && !isSongTimer) {
            setLocalTime(30);
        }
    }, [isActive, timeRemaining, isSongTimer]);

    // ── Countdown: pause audio when timeRemaining hits 0 ──
    useEffect(() => {
        if (timeRemaining > 0) {
            // Clear any existing timeout
            clearTimeout(timerRef.current);

            timerRef.current = setTimeout(() => {
                // Pause the audio element if provided
                if (audioRef?.current) {
                    audioRef.current.pause();
                }
                // Notify parent to update play state
                onPause?.();
                // Cancel the timer record
                onCancelTimer?.();
            }, timeRemaining * 1000);
        }

        return () => clearTimeout(timerRef.current);
    }, [timeRemaining, audioRef, onPause, onCancelTimer]);

    const hasActiveTimer = timeRemaining > 0 || isSongTimer;

    const formatTime = (totalSeconds) => {
        if (!totalSeconds || totalSeconds <= 0) return "0:00";
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = Math.floor(totalSeconds % 60).toString().padStart(2, '0');
        return `${minutes}:${seconds}`;
    };

    const handleSet = useCallback((minutes) => {
        onSetTimer(minutes * 60);
        onClose();
    }, [onSetTimer, onClose]);

    const handleSetSongTimer = useCallback(() => {
        onSetSongTimer?.();
        onClose();
    }, [onSetSongTimer, onClose]);

    const calculateAngle = useCallback((clientX, clientY) => {
        if (!dialRef.current) return 0;
        const rect = dialRef.current.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        let angle = Math.atan2(clientY - centerY, clientX - centerX) * (180 / Math.PI);
        angle = angle + 90;
        if (angle < 0) angle += 360;
        return angle;
    }, []);

    const angleToMinutes = useCallback((angle) => {
        let minutes = Math.round(angle * (MAX_MINUTES / 360));
        minutes = Math.min(minutes, MAX_MINUTES);
        minutes = Math.max(minutes, 0);
        return Math.round(minutes / 5) * 5;
    }, []);

    const handleDrag = useCallback((clientX, clientY) => {
        const angle = calculateAngle(clientX, clientY);
        setLocalTime(angleToMinutes(angle));
    }, [calculateAngle, angleToMinutes]);

    const handleStartDrag = (e) => {
        e.preventDefault();
        setIsDragging(true);
        const clientX = e.clientX ?? e.touches[0].clientX;
        const clientY = e.clientY ?? e.touches[0].clientY;
        handleDrag(clientX, clientY);
    };

    const handleStopDrag = () => setIsDragging(false);

    const handleMove = useCallback((e) => {
        if (!isDragging) return;
        const clientX = e.clientX ?? e.touches[0].clientX;
        const clientY = e.clientY ?? e.touches[0].clientY;
        handleDrag(clientX, clientY);
    }, [isDragging, handleDrag]);

    useEffect(() => {
        if (isDragging) {
            window.addEventListener('mousemove', handleMove);
            window.addEventListener('mouseup', handleStopDrag);
            window.addEventListener('touchmove', handleMove, { passive: false });
            window.addEventListener('touchend', handleStopDrag);
        }
        return () => {
            window.removeEventListener('mousemove', handleMove);
            window.removeEventListener('mouseup', handleStopDrag);
            window.removeEventListener('touchmove', handleMove);
            window.removeEventListener('touchend', handleStopDrag);
        };
    }, [isDragging, handleMove]);

    const handRotationDeg = localTime * (360 / MAX_MINUTES);

    if (!isActive) return null;

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center">
            <div className="bg-[#121212] p-8 rounded-2xl shadow-2xl w-full max-w-sm border border-[#222]">

                {/* Header */}
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-2xl font-extrabold text-white flex items-center gap-2">
                        <Clock className="w-6 h-6 text-[#fa4565]" />
                        Sleep Timer
                    </h3>
                    <button
                        onClick={onClose}
                        className="p-1 rounded-full text-gray-400 hover:bg-[#fa4565] hover:text-black transition"
                        title="Close"
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* ── ACTIVE TIMER STATUS ── */}
                {hasActiveTimer ? (
                    <div className="text-center">
                        {isSongTimer ? (
                            <>
                                <div className="flex flex-col items-center gap-3 mb-6">
                                    <div className="w-16 h-16 rounded-full bg-[#fa4565]/20 flex items-center justify-center">
                                        <Music className="w-8 h-8 text-[#fa4565]" />
                                    </div>
                                    <p className="text-lg font-semibold text-white">Song Timer Active</p>
                                    <p className="text-sm text-gray-400 leading-relaxed">
                                        Playback will stop after the<br />
                                        <span className="text-white font-medium">current song</span> finishes.
                                    </p>
                                </div>

                                <div className="flex items-center justify-center gap-2 bg-[#fa4565]/10 border border-[#fa4565]/30 rounded-xl py-3 px-4 mb-6">
                                    <CheckCircle2 className="w-4 h-4 text-[#fa4565]" />
                                    <span className="text-sm text-[#fa4565] font-medium">Active — stops after this song</span>
                                </div>
                            </>
                        ) : (
                            <>
                                <p className="text-sm font-light text-gray-400 mb-4">Timer Active. Time remaining:</p>
                                <p className="text-6xl font-extrabold text-[#fa4565] mb-4 tabular-nums">
                                    {formatTime(timeRemaining)}
                                </p>
                                <p className="text-base font-medium text-gray-300 mb-6">
                                    (Set for {Math.ceil(timeRemaining / 60)} minutes)
                                </p>
                            </>
                        )}

                        <button
                            onClick={onCancelTimer}
                            className="w-full py-3 flex items-center justify-center gap-2 border border-red-500/40 text-red-400 rounded-full hover:bg-red-500/10 transition font-medium text-base"
                        >
                            <Trash2 className="w-4 h-4" />
                            Delete Timer
                        </button>
                    </div>
                ) : (
                    <div className="flex flex-col items-center">

                        {/* Mode Toggle */}
                        <div className="flex w-full rounded-xl overflow-hidden border border-[#333] mb-6">
                            <button
                                onClick={() => setMode("time")}
                                className={`flex-1 py-2.5 flex items-center justify-center gap-2 text-sm font-semibold transition-all ${mode === "time"
                                    ? "bg-[#fa4565] text-black"
                                    : "bg-[#1a1a1a] text-gray-400 hover:text-white"
                                    }`}
                            >
                                <Timer className="w-4 h-4" />
                                Set Duration
                            </button>
                            <button
                                onClick={() => setMode("song")}
                                className={`flex-1 py-2.5 flex items-center justify-center gap-2 text-sm font-semibold transition-all ${mode === "song"
                                    ? "bg-[#fa4565] text-black"
                                    : "bg-[#1a1a1a] text-gray-400 hover:text-white"
                                    }`}
                            >
                                <Music className="w-4 h-4" />
                                After Song
                            </button>
                        </div>

                        {mode === "time" ? (
                            <>
                                <p className="text-sm text-gray-400 mb-4">Drag the selector to set time (Max 120 min)</p>

                                <div
                                    ref={dialRef}
                                    className={`relative my-6 select-none bg-[#1a1a1a] rounded-full shadow-inner ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
                                    style={{ width: `${DIAL_RADIUS * 2}px`, height: `${DIAL_RADIUS * 2}px` }}
                                    onMouseDown={handleStartDrag}
                                    onTouchStart={handleStartDrag}
                                >
                                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                        <span className="text-6xl font-extrabold text-white leading-none">{localTime}</span>
                                        <span className="text-lg text-gray-400 mt-1">Minutes</span>
                                    </div>

                                    {[...Array(MAX_MINUTES / 5)].map((_, i) => {
                                        const minutes = (i + 1) * 5;
                                        const angle = minutes * (360 / MAX_MINUTES);
                                        const rad = (angle - 90) * (Math.PI / 180);
                                        const x = DIAL_RADIUS + DIAL_RADIUS * Math.cos(rad);
                                        const y = DIAL_RADIUS + DIAL_RADIUS * Math.sin(rad);
                                        const size = minutes % 30 === 0 ? 6 : 4;
                                        const isCurrent = minutes === localTime;
                                        return (
                                            <div
                                                key={minutes}
                                                className={`absolute rounded-full transition-all duration-100 ${isCurrent ? 'bg-[#fa4565] border border-white scale-125' : 'bg-gray-500/70'}`}
                                                style={{ width: `${size}px`, height: `${size}px`, left: `${x - size / 2}px`, top: `${y - size / 2}px` }}
                                            />
                                        );
                                    })}

                                    <div
                                        className="absolute pointer-events-none"
                                        style={{
                                            transform: `rotate(${handRotationDeg}deg)`,
                                            transformOrigin: '50% 100%',
                                            width: '2px',
                                            height: `${DIAL_RADIUS - 10}px`,
                                            top: `${10}px`,
                                            left: `${DIAL_RADIUS - 1}px`,
                                        }}
                                    >
                                        <div className={`w-5 h-5 rounded-full shadow-xl absolute left-1/2 -translate-x-1/2 -top-2 ${localTime > 0 ? 'bg-[#fa4565]' : 'bg-gray-500'}`} />
                                    </div>
                                </div>

                                <button
                                    onClick={() => localTime > 0 && handleSet(localTime)}
                                    disabled={localTime <= 0}
                                    className={`w-full py-3 rounded-full font-bold text-lg transition shadow-xl ${localTime > 0
                                        ? 'bg-[#fa4565] text-black hover:bg-pink-700'
                                        : 'bg-gray-700 text-gray-500 cursor-not-allowed'}`}
                                >
                                    Set Timer for {localTime} min
                                </button>
                            </>
                        ) : (
                            <div className="flex flex-col items-center w-full gap-4 py-4">
                                <div className="w-20 h-20 rounded-full bg-[#fa4565]/10 border-2 border-[#fa4565]/30 flex items-center justify-center">
                                    <Music className="w-10 h-10 text-[#fa4565]" />
                                </div>
                                <div className="text-center">
                                    <p className="text-white font-semibold text-base mb-1">Stop after current song</p>
                                    <p className="text-gray-400 text-sm leading-relaxed">
                                        Music will automatically stop once the song that's currently playing finishes.
                                    </p>
                                </div>
                                <button
                                    onClick={handleSetSongTimer}
                                    className="mt-2 w-full py-3 rounded-full font-bold text-lg bg-[#fa4565] text-black hover:bg-pink-700 transition shadow-xl flex items-center justify-center gap-2"
                                >
                                    <Music className="w-5 h-5" />
                                    Stop After This Song
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
"use client";

import { useState, useRef, useCallback, useEffect } from 'react';
import { X, Clock } from 'lucide-react';

const MAX_MINUTES = 120; // Max time user can set (2 hours)
const DIAL_RADIUS = 120; // Radius of the circular dial in pixels

export default function SleepTimerModal({ 
    isActive, 
    timeRemaining, // Time remaining in seconds
    onSetTimer, 
    onCancelTimer, 
    onClose 
}) {
    // Local state for the time being set (in minutes)
    const [localTime, setLocalTime] = useState(30); 
    const [isDragging, setIsDragging] = useState(false);
    const dialRef = useRef(null);

    // Initial setting of local time when the modal opens if no timer is active
    useEffect(() => {
        // Only reset to a default (e.g., 30) if modal is active AND there's no timer running
        if (isActive && timeRemaining === 0) {
            setLocalTime(30);
        }
    }, [isActive, timeRemaining]);


    // -------------------------------------------------------------------
    // --- UTILITY FUNCTIONS ---
    // -------------------------------------------------------------------
    
    // Convert seconds remaining to minutes and seconds for display (MM:SS)
    const formatTime = (totalSeconds) => {
        if (!totalSeconds || totalSeconds <= 0) return "0:00";
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = Math.floor(totalSeconds % 60).toString().padStart(2, '0');
        return `${minutes}:${seconds}`;
    };

    // Handler to set the timer
    const handleSet = useCallback((minutes) => {
        // Convert minutes to seconds before calling the context function
        onSetTimer(minutes * 60); 
        onClose(); // Close the modal after setting the timer
    }, [onSetTimer, onClose]);


    // Calculate angle from coordinates relative to the dial center
    const calculateAngle = useCallback((clientX, clientY) => {
        if (!dialRef.current) return 0;
        
        const rect = dialRef.current.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;

        const deltaX = clientX - centerX;
        const deltaY = clientY - centerY;
        
        let angle = Math.atan2(deltaY, deltaX) * (180 / Math.PI);
        
        // Adjust angle so 0 degrees is at the top (12 o'clock)
        angle = angle + 90;
        if (angle < 0) angle += 360;

        return angle;
    }, []);

    // Convert angle (0-360) to time (0-120 minutes)
    const angleToMinutes = useCallback((angle) => {
        // Map 360 degrees to 120 minutes (1 degree = 1/3 minute)
        let minutes = Math.round(angle * (MAX_MINUTES / 360));
        
        minutes = Math.min(minutes, MAX_MINUTES);
        minutes = Math.max(minutes, 0);

        // Snap to nearest 5 minutes
        minutes = Math.round(minutes / 5) * 5; 

        return minutes;
    }, []);

    // -------------------------------------------------------------------
    // --- DRAG HANDLERS ---
    // -------------------------------------------------------------------

    const handleDrag = useCallback((clientX, clientY) => {
        const angle = calculateAngle(clientX, clientY);
        const minutes = angleToMinutes(angle);
        setLocalTime(minutes);
    }, [calculateAngle, angleToMinutes]);

    const handleStartDrag = (e) => {
        e.preventDefault();
        setIsDragging(true);
        const clientX = e.clientX || e.touches[0].clientX;
        const clientY = e.clientY || e.touches[0].clientY;
        handleDrag(clientX, clientY);
    };

    const handleStopDrag = () => {
        setIsDragging(false);
    };

    const handleMove = useCallback((e) => {
        if (!isDragging) return;
        const clientX = e.clientX || e.touches[0].clientX;
        const clientY = e.clientY || e.touches[0].clientY;
        handleDrag(clientX, clientY);
    }, [isDragging, handleDrag]);

    // Attach global listeners for dragging 
    useEffect(() => {
        if (isDragging) {
            window.addEventListener('mousemove', handleMove);
            window.addEventListener('mouseup', handleStopDrag);
            window.addEventListener('touchmove', handleMove);
            window.addEventListener('touchend', handleStopDrag);
        } else {
            window.removeEventListener('mousemove', handleMove);
            window.removeEventListener('mouseup', handleStopDrag);
            window.removeEventListener('touchmove', handleMove);
            window.removeEventListener('touchend', handleStopDrag);
        }
        return () => {
            window.removeEventListener('mousemove', handleMove);
            window.removeEventListener('mouseup', handleStopDrag);
            window.removeEventListener('touchmove', handleMove);
            window.removeEventListener('touchend', handleStopDrag);
        };
    }, [isDragging, handleMove]);

    // Calculate rotation of the selector hand based on localTime
    const handRotationDeg = localTime * (360 / MAX_MINUTES);


    if (!isActive) return null;

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center">
            <div className="bg-[#121212] p-8 rounded-2xl shadow-2xl w-full max-w-sm border border-[#222]">
                
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

                {/* --- Active Timer Status (THIS IS THE PORTION YOU REQUESTED) --- */}
                {timeRemaining > 0 ? (
                    <div className="text-center">
                        {/* 1. Timer Countdown */}
                        <p className="text-sm font-light text-gray-400 mb-4">Timer Active. Time remaining:</p>
                        <p className="text-6xl font-extrabold text-[#fa4565] mb-6">
                            {formatTime(timeRemaining)}
                        </p>
                        
                        {/* 2. Display Set Duration */}
                        <p className="text-lg font-medium text-gray-200 mb-8">
                            (Set for {Math.ceil(timeRemaining / 60)} minutes) 
                        </p>
                        
                        {/* 3. Cancel Button */}
                        <button 
                            onClick={onCancelTimer} 
                            className="w-full py-3 border border-gray-600 text-gray-300 rounded-full hover:bg-gray-800 transition font-medium text-lg shadow-md"
                        >
                            Cancel Timer
                        </button>
                    </div>
                ) : (
                    // --- Rotary Dial UI (Setting Mode) ---
                    <div className="flex flex-col items-center">
                        <p className="text-sm text-gray-400 mb-4">Drag the selector to set time (Max 120 min)</p>
                        
                        <div 
                            ref={dialRef}
                            className={`relative my-6 select-none bg-[#1a1a1a] rounded-full shadow-inner ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
                            style={{ width: `${DIAL_RADIUS * 2}px`, height: `${DIAL_RADIUS * 2}px` }}
                            onMouseDown={handleStartDrag}
                            onTouchStart={handleStartDrag}
                        >
                            {/* Dial Center Display */}
                            <div className="absolute inset-0 flex flex-col items-center justify-center">
                                <span className="text-6xl font-extrabold text-white leading-none">
                                    {localTime}
                                </span>
                                <span className="text-lg text-gray-400 mt-1">
                                    Minutes
                                </span>
                            </div>

                            {/* Minute Markers */}
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
                                        className={`absolute rounded-full transition-all duration-100 ${
                                            isCurrent ? 'bg-[#fa4565] border border-white scale-125' : 'bg-gray-500/70 hover:bg-gray-300'
                                        }`}
                                        style={{
                                            width: `${size}px`,
                                            height: `${size}px`,
                                            left: `${x - size / 2}px`,
                                            top: `${y - size / 2}px`,
                                        }}
                                    />
                                );
                            })}
                            
                            {/* Selector Hand */}
                            <div 
                                className="absolute top-1/2 left-1/2 origin-top-left pointer-events-none transition-transform"
                                style={{ 
                                    transform: `rotate(${handRotationDeg}deg)`, 
                                    transformOrigin: '0% 100%',
                                    width: '100%',
                                    height: '50%',
                                    top: '0%', 
                                    left: '50%',
                                }}
                            >
                                {/* The actual selector visual */}
                                <div 
                                    className={`absolute left-[-10px] w-5 h-5 rounded-full shadow-xl transition-colors ${
                                        localTime > 0 ? 'bg-[#fa4565]' : 'bg-gray-500'
                                    }`}
                                    style={{ 
                                        top: '-1px', 
                                        transform: 'translateY(-12px) translateX(-20%)',

                                    }}
                                />
                            </div>
                        </div>

                        {/* Set Button */}
                        <button 
                            onClick={() => localTime > 0 && handleSet(localTime)}
                            disabled={localTime <= 0}
                            className={`mt-4 w-full py-3 rounded-full font-bold text-lg transition shadow-xl ${localTime > 0 
                                ? 'bg-[#fa4565] text-black hover:bg-pink-700' 
                                : 'bg-gray-700 text-gray-500 cursor-not-allowed'}`}
                        >
                            Set Timer for {localTime} min
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
"use client";
import React, { useState } from "react";
import { X } from "lucide-react";

const SpeedPopup = ({ isOpen, onClose, value, onChange }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl p-6 w-[90%] max-w-sm shadow-xl relative">

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-gray-600 hover:text-black"
        >
          <X size={20} />
        </button>

        {/* Title */}
        <h2 className="text-xl font-semibold text-center mb-4">
          Playback Speed
        </h2>

        {/* Slider */}
        <div className="flex flex-col items-center">
          <input
            type="range"
            min="0.25"
            max="2"
            step="0.05"
            value={value}
            onChange={(e) => onChange(parseFloat(e.target.value))}
            className="w-full"
          />
          <div className="mt-2 text-lg font-medium">
            {value.toFixed(2)}x
          </div>
        </div>

        {/* Preset Buttons */}
        <div className="grid grid-cols-5 gap-2 mt-6">
          {[0.25, 0.75, 1, 1.5, 2].map((preset) => (
            <button
              key={preset}
              onClick={() => onChange(preset)}
              className={`py-2 rounded-xl text-sm font-medium border 
                ${value === preset ? "bg-black text-white" : "bg-gray-100"}`}
            >
              {preset}x
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default SpeedPopup;

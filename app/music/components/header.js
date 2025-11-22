"use client";
import React from "react";
import Link from "next/link";
import { AudioWaveform, Search } from "lucide-react";

export default function Header() {
   return (
      <header className="w-full bg-black text-white sticky top-0 z-50 shadow-lg shadow-black/25">
         <div className="max-w-[1400px] w-full mx-auto flex items-center justify-between px-10 py-4 gap-6">

            {/* Logo */}
            <Link href="/" className="flex items-center select-none">
               <AudioWaveform
                  size={42}
                  className="text-[#fa4565] cursor-pointer hover:scale-110 transition-transform duration-300"
               />
            </Link>

            {/* Search Bar */}
            <div className="relative flex-1 max-w-[550px]">
               <input
                  type="text"
                  placeholder="Search songs, artists..."
                  className="w-full bg-[#161616] px-5 py-2.5 rounded-full text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#fa4565]"
               />

               <Search className="absolute right-5 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
            </div>

            {/* Premium Button */}
            <Link
               href="/premium"
               className="bg-white text-black px-6 py-2 rounded-full font-semibold
             hover:bg-gray-200 transition-all duration-300 min-w-[120px] text-center"
            >
               Premium
            </Link>

         </div>
      </header>
   );
}

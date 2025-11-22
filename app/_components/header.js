"use client";

import React, { useState } from "react";
import Link from "next/link";
import { AudioWaveform, User, Menu, X } from "lucide-react";

export default function Header() {
    const navItems = ["Home", "Genres", "Artists", "Premium"];
    // State to handle the mobile menu visibility
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    // Function to toggle the menu state
    const toggleMenu = () => setIsMenuOpen(!isMenuOpen);

    return (
        <header className="w-full bg-black text-white sticky top-0 z-50">
            <div className="max-w-[1400px] mx-auto flex items-center justify-between py-4 px-4 md:px-8">

                {/* Logo and Mobile Menu Button */}
                <div className="flex items-center">
                    {/* Logo */}
                    <AudioWaveform
                        size={38}
                        className="text-[#fa4565] cursor-pointer hover:scale-110 transition-transform duration-200"
                    />

                    {/* Hamburger Menu Icon (Visible on mobile, hidden on md and up) */}
                    <button 
                        onClick={toggleMenu} 
                        className="md:hidden ml-4 p-2 focus:outline-none"
                        aria-label="Toggle menu"
                    >
                        {isMenuOpen ? (
                            <X size={24} className="text-[#fa4565]" />
                        ) : (
                            <Menu size={24} className="text-white" />
                        )}
                    </button>
                </div>


                {/* Desktop Navbar (Hidden on mobile, visible on md and up) */}
                <nav className="hidden md:block">
                    <ul className="flex items-center gap-12 text-base font-medium tracking-wide">
                        {navItems.map((item) => (
                            <li
                                key={item}
                                className="relative cursor-pointer hover:text-[#fa4565] pb-1 transition
                                after:content-[''] after:absolute after:left-0 after:bottom-0 after:h-[2px]
                                after:w-0 after:bg-[#fa4565] after:transition-all after:duration-300
                                hover:after:w-full"
                            >
                                <Link href={`/${item.toLowerCase() === 'home' ? '' : item.toLowerCase()}`}>
                                    {item}
                                </Link>
                            </li>
                        ))}
                    </ul>
                </nav>

                {/* Login Button (Always visible but styling might change) */}
                <Link href="/music" className="flex items-center gap-2 border border-[#fa4565] px-4 py-2 text-sm md:px-6 md:py-2.5 md:text-base rounded-lg
                    hover:bg-[#fa4565] hover:text-black transition font-medium cursor-pointer select-none">
                    <User size={20} />
                    Login
                </Link>

            </div>

            {/* Mobile Menu Overlay (Conditional Rendering) */}
            {isMenuOpen && (
                <div className="md:hidden bg-black/95 absolute top-full left-0 w-full shadow-lg">
                    <ul className="flex flex-col items-center py-4 space-y-4 text-lg font-medium">
                        {navItems.map((item) => (
                            <li key={`mobile-${item}`}>
                                <Link
                                    href={`/${item.toLowerCase() === 'home' ? '' : item.toLowerCase()}`}
                                    onClick={toggleMenu} // Close menu on click
                                    className="block py-2 text-white hover:text-[#fa4565] transition duration-200"
                                >
                                    {item}
                                </Link>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </header>
    );
}
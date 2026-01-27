import React from 'react';

// Main component, adhering to the single-file React structure.
// This component simulates the structure of an email body or card.
const App = ({ recipientName = "Valued Listener", senderName = "The echo Team" }) => {

    // Main brand color constant for easy reference in inline styles/classes
    const PRIMARY_COLOR = "#fa4565";
    const HOVER_COLOR = "#e03f5d"; // A slightly darker shade for the hover effect
    const CODE_BG_COLOR = "#1f2937"; // Dark gray/almost black for high contrast code block

    // Updated inline SVG for the audio waveform icon
    const AudioWaveformIcon = () => (
        <svg 
            className="w-16 h-16 mx-auto" 
            style={{ color: PRIMARY_COLOR }} 
            width="24" height="24" viewBox="0 0 24 24" 
            fill="none" stroke="currentColor" strokeWidth="2" 
            strokeLinecap="round" strokeLinejoin="round" 
            xmlns="http://www.w3.org/2000/svg"
        >
            <path d="M2 13a2 2 0 0 0 2-2V7a2 2 0 0 1 4 0v13a2 2 0 0 0 4 0V4a2 2 0 0 1 4 0v13a2 2 0 0 0 4 0v-4a2 2 0 0 1 2-2"/>
        </svg>
    );

    return (
        <div className="min-h-screen bg-gray-100 p-4 sm:p-8 flex items-center justify-center font-[Inter]">
            <div 
                className="w-full max-w-xl bg-white rounded-xl shadow-2xl overflow-hidden border-t-8"
                style={{ borderColor: PRIMARY_COLOR }} // Use custom color for border
            >
                
                {/* Header Section */}
                <div className="text-center py-8 px-6 bg-gray-50">
                    <AudioWaveformIcon /> {/* Updated Icon */}
                    <h1 
                        className="text-4xl font-extrabold mt-4 tracking-tight"
                        style={{ color: PRIMARY_COLOR }} // Use custom color for main title
                    >
                        Your Birthday Playlist
                    </h1>
                    <p className="text-lg text-gray-700 mt-2">
                        Celebrate with a special gift from us.
                    </p>
                </div>

                {/* Body Content */}
                <div className="p-6 sm:p-8 space-y-6">
                    <p className="text-xl text-gray-800">
                        Hey <span className="font-bold text-gray-900">{recipientName}</span>,
                    </p>
                    
                    <p className="text-gray-600 leading-relaxed">
                        We noticed your birthday is today! To thank you for being a dedicated listener, we want to give you the gift of unlimited, ad-free music.
                    </p>
                    <p className="text-gray-600 leading-relaxed">
                        Enjoy access to all exclusive tracks, offline downloads, and superior audio quality for the next month, completely on us.
                    </p>

                    {/* The Offer / CTA Block */}
                    {/* Using a complementary teal/cyan border for the offer block for visual separation */}
                    <div className="bg-cyan-50 border-l-4 border-cyan-400 p-4 rounded-lg text-center">
                        <p className="text-sm font-medium text-cyan-800">Your Birthday Perk:</p>
                        <p className="text-3xl font-bold text-cyan-900 my-2">
                            1 MONTH FREE Premium Access!
                        </p>
                        <p className="text-sm text-cyan-700">
                            No payment required today. Cancel anytime.
                        </p>
                    </div>

                    {/* Coupon Code (Optional for streaming, but included if they use codes) */}
                    <div className="text-center py-4">
                        <p className="text-xs text-gray-500 mb-2">Use this code during signup or renewal:</p>
                        <span 
                            className="inline-block text-white text-2xl font-mono px-6 py-3 rounded-lg shadow-lg tracking-wider select-all"
                            style={{ backgroundColor: CODE_BG_COLOR }}
                        >
                            MUSICWISH24
                        </span>
                    </div>

                    {/* Button */}
                    <div className="text-center">
                        <a 
                            href="https://yourwebsite.com/premium-signup" 
                            className="inline-block text-white font-bold text-lg py-3 px-8 rounded-full transition duration-300 transform hover:scale-105 shadow-md hover:shadow-xl"
                            style={{ 
                                textDecoration: 'none',
                                backgroundColor: PRIMARY_COLOR, // Use custom color for button BG
                            }} 
                            onMouseOver={e => e.currentTarget.style.backgroundColor = HOVER_COLOR}
                            onMouseOut={e => e.currentTarget.style.backgroundColor = PRIMARY_COLOR}
                        >
                            Unlock Ad-Free Music!
                        </a>
                    </div>
                </div>

                {/* Footer Section */}
                <div className="bg-gray-50 p-6 text-center text-sm text-gray-500 border-t">
                    <p>Happy listening,</p>
                    {/* Updated sender name to The echo Team */}
                    <p className="font-semibold text-gray-700">{senderName}</p>
                    <p className="mt-4">
                        <a href="https://yourwebsite.com/unsubscribe" className="text-gray-400 hover:text-gray-600 underline">Unsubscribe</a> | <a href="https://yourwebsite.com/contact" className="text-gray-400 hover:text-gray-600 underline">Help Center</a>
                    </p>
                </div>

            </div>
        </div>
    );
};

export default App;
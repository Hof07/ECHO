'use client'
import React, { useState } from 'react';
import {
  AudioWaveform, User, Menu, X, Play, ArrowRight, Music, TrendingUp, Mic, ListMusic, Headset, Globe, Clock, ChevronDown, Sparkles, Search,
} from 'lucide-react';
import './styles.css'
import '../globals.css'

// --- Configuration Constants ---
const PRIMARY_COLOR = '#fa4565';
const BACKGROUND_COLOR = '#0a0a0a';
const MAX_WIDTH = '1400px';
const CARD_BG = '#141414';

// Note: API key is left empty as it is provided by the runtime environment.
const GEMINI_MODEL = 'gemini-2.5-flash-preview-09-2025';
const GEMINI_API_URL = (model = GEMINI_MODEL, apiKey = "AIzaSyA_Mp2CY3JhPiKnpMTQNtxwNU9T2V6OfXM") =>
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

// Mock data
const trendingArtists = [
  { name: "Ed Sheeran", genre: "Synthwave", image: "https://placehold.co/128x128/333333/ffffff?text=ES" },
  { name: "The Weekend", genre: "Future Bass", image: "https://placehold.co/128x128/fa4565/000000?text=TW" },
  { name: "David Kushner", genre: "Alternative Rock", image: "https://placehold.co/128x128/6a0dad/ffffff?text=DK" },
  { name: "Lukas Graham", genre: "Lo-Fi Beats", image: "https://placehold.co/128x128/00bcd4/000000?text=LG" },
];

const trendingPlaylists = [
  {
    name: "After Hours",
    artist: "The Weeknd",
    tracks: 14,
    image: "https://upload.wikimedia.org/wikipedia/en/c/c1/The_Weeknd_-_After_Hours.png"
  },
  {
    name: "Divide",
    artist: "Ed Sheeran",
    tracks: 16,
    image: "https://upload.wikimedia.org/wikipedia/en/4/45/Divide_cover.png"
  },
  {
    name: "Random Access Memories",
    artist: "Daft Punk",
    tracks: 13,
    image: "https://i.scdn.co/image/ab67616d0000b2739b9b36b0e22870b9f542d937"
  },
  {
    name: "Beerbongs & Bentleys",
    artist: "Post Malone",
    tracks: 18,
    image: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTfjHrJ7wbCpmzliVah4h2tGZyvlqxE94tdQQ&s"
  },
  {
    name: "1989 (Taylor’s Version)",
    artist: "Taylor Swift",
    tracks: 21,
    image: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSXgdLXLIBm6d9WjF9vfSg54qCzqjzgYKGU_Q&s"
  },
  {
    name: "Scorpion",
    artist: "Drake",
    tracks: 25,
    image: "https://upload.wikimedia.org/wikipedia/en/9/90/Scorpion_by_Drake.jpg"
  },
  {
    name: "Astroworld",
    artist: "Travis Scott",
    tracks: 17,
    image: "https://upload.wikimedia.org/wikipedia/en/4/4b/Travis_Scott_-_Astroworld.png"
  },
  {
    name: "Planet Her",
    artist: "Doja Cat",
    tracks: 14,
    image: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQ8US8adqPFVparVcVTMI1heL9b55Pzbm67_w&s"
  }
];


const globalCharts = [
  { rank: 1, title: "Blinding Lights", artist: "The Weeknd", duration: " 3:20" },
  { rank: 2, title: "Shape of You", artist: "Ed Sheeran", duration: " 3:53" },
  { rank: 3, title: "Starboy", artist: "The Weeknd and Daft Punk", duration: " 3:50" },
  { rank: 4, title: "Sweater Weather", artist: "The Neighbourhood", duration: "4:00" },
  { rank: 5, title: "Someone You Loved", artist: "Lewis Capaldi", duration: " 3:02" },
];

// Helper for exponential backoff during fetch
const exponentialBackoffFetch = async (url, options, retries = 5, delay = 1000) => {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, options);
      if (response.ok) {
        return response;
      }
      // If response is not ok, throw error to trigger retry
      throw new Error(`HTTP error! status: ${response.status}`);
    } catch (error) {
      if (i === retries - 1) {
        console.error('All retries failed:', error);
        throw error;
      }
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, delay * (2 ** i)));
    }
  }
};

/**
 * Custom Card component for aesthetic consistency and hover effects
 */
const AnimatedCard = ({ children, className = '' }) => (
  <div
    className={`
      ${className}
      p-6 md:p-8 border border-[#222] rounded-xl shadow-2xl transition-all duration-300
      transform hover:-translate-y-1
    `}
    style={{
      backgroundColor: CARD_BG,
      '--primary-shadow-color': PRIMARY_COLOR + '50',
      boxShadow: '0 0 10px rgba(0,0,0,0.5)',
    }}
    onMouseEnter={(e) => {
      e.currentTarget.style.boxShadow = `0 0 30px var(--primary-shadow-color)`;
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.boxShadow = '0 0 10px rgba(0,0,0,0.5)';
    }}
  >
    {children}
  </div>
);

/**
 * AI Powered Track Analyzer Component (New Section)
 */
const AiTrackAnalyzer = ({ apiKey }) => {
  const [songTitle, setSongTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [analysisResult, setAnalysisResult] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!songTitle.trim() || !artist.trim()) return;

    setIsLoading(true);
    setAnalysisResult(null);
    setError(null);

    const userQuery = `Provide a creative analysis for the song "${songTitle}" by "${artist}". Describe its main theme, the mood, and provide 3 interesting facts about its production or cultural impact.`;
    const systemPrompt = "You are a professional music critic and historian. Provide a concise, engaging analysis in Markdown format. Use clear headings for 'Theme Analysis' and 'Fun Facts'.";

    const payload = {
      contents: [{ parts: [{ text: userQuery }] }],
      systemInstruction: { parts: [{ text: systemPrompt }] },
      // Use Google Search for up-to-date and grounded information
      tools: [{ "google_search": {} }], 
    };

    try {
      const response = await exponentialBackoffFetch(GEMINI_API_URL(GEMINI_MODEL, apiKey), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const result = await response.json();
      const text = result.candidates?.[0]?.content?.parts?.[0]?.text || 'No response generated.';
      
      // Basic Markdown to HTML conversion for rendering:
      let html = text.replace(/## (.*)/g, '<h3>$1</h3>'); // Convert H2 (##) to H3
      html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>'); // Convert bold
      html = html.replace(/\n/g, '<br/>'); // Convert new lines to <br>

      setAnalysisResult(html);

    } catch (err) {
      console.error("Gemini API Error:", err);
      setError('Failed to fetch analysis. Please try a different song or check your connection.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <section id="analyzer" className={`py-20 px-6 md:px-8 max-w-[${MAX_WIDTH}] mx-auto relative z-10`}>
      <div className="text-center mb-12">
        <h2 className="text-4xl font-bold mb-2 flex items-center justify-center gap-3">
          <Sparkles size={36} style={{ color: PRIMARY_COLOR }} /> AI Track Analyzer
        </h2>
        <p className="text-gray-400 text-xl">Unlock the story behind any song using Gemini's creative intelligence.</p>
      </div>

      <AnimatedCard className="max-w-4xl mx-auto p-6 sm:p-8">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input
              type="text"
              placeholder="Enter Song Title (e.g., Blinding Lights)"
              value={songTitle}
              onChange={(e) => setSongTitle(e.target.value)}
              className="w-full p-3 rounded-lg bg-[#222] border border-[#333] text-white focus:ring-2 focus:ring-offset-2 focus:ring-offset-[#141414]"
              style={{ caretColor: PRIMARY_COLOR, '--focus-ring-color': PRIMARY_COLOR }}
              required
            />
            <input
              type="text"
              placeholder="Enter Artist Name (e.g., The Weeknd)"
              value={artist}
              onChange={(e) => setArtist(e.target.value)}
              className="w-full p-3 rounded-lg bg-[#222] border border-[#333] text-white focus:ring-2 focus:ring-offset-2 focus:ring-offset-[#141414]"
              style={{ caretColor: PRIMARY_COLOR, '--focus-ring-color': PRIMARY_COLOR }}
              required
            />
          </div>
          <button
            type="submit"
            disabled={isLoading || !songTitle.trim() || !artist.trim()}
            className="w-full text-black font-bold text-lg px-8 py-3 rounded-full flex items-center justify-center space-x-2 transition transform hover:scale-[1.01] shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              backgroundColor: PRIMARY_COLOR,
              boxShadow: `0 5px 10px ${PRIMARY_COLOR}50`,
            }}
          >
            {isLoading ? (
              <>
                <div className="w-5 h-5 border-2 border-black border-t-white rounded-full animate-spin"></div>
                <span>Analyzing...</span>
              </>
            ) : (
              <>
                <Search size={20} />
                <span>Get Creative Analysis</span>
              </>
            )}
          </button>
        </form>

        {/* Results Display */}
        {analysisResult && (
          <div className="mt-6 pt-6 border-t border-[#222] text-sm md:text-base">
            <h3 className="text-2xl font-bold mb-3" style={{ color: PRIMARY_COLOR }}>Gemini's Analysis</h3>
            <div
              className="prose prose-sm md:prose-base max-w-none text-gray-300"
              dangerouslySetInnerHTML={{ __html: analysisResult }}
            />
          </div>
        )}

        {error && (
          <div className="mt-6 p-4 bg-red-900/30 border border-red-700 rounded-lg text-red-400">
            {error}
          </div>
        )}
      </AnimatedCard>
    </section>
  );
};


/**
 * Main Application Component
 */
export default function App() {
  const apiKey = ""; // Canvas runtime provides API key.

  // Main Page Content
  return (
    <div id='main' style={{ backgroundColor: BACKGROUND_COLOR }} className="min-h-screen font-sans text-white antialiased">
      <div className='absolute hidden'>
        {/* Placeholder for header file user mentioned not to include */}
      </div>

      {/* 1. HERO SECTION */}
      <section id="home" className="relative h-screen flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 flex items-center justify-center z-0">
          <div
            className={`w-[80vw] h-[80vw] max-w-[800px] max-h-[800px] rounded-full blur-3xl opacity-30
                        animate-hero-glow transition-all duration-1000`}
            style={{ backgroundColor: PRIMARY_COLOR }}
          >
          </div>
        </div>

        {/* Content Layer (Z-index 10) */}
        <div className={`z-10 max-w-[${MAX_WIDTH}] mx-auto px-6 md:px-8 text-center pt-24 relative bottom-[74px]`}>
          <h1 className="text-5xl sm:text-7xl lg:text-8xl font-extrabold tracking-tight mb-6 leading-tight sm:leading-snug
                            animate-fade-in-up transition-all duration-1000">
            Listen to the Future of <br /> <span style={{ color: PRIMARY_COLOR }} className="relative">
              Sound
              <span
                className="absolute -bottom-1 left-0 w-full h-1 rounded-full animate-pulse opacity-75"
                style={{ backgroundColor: PRIMARY_COLOR }}
              ></span>
            </span>.
          </h1>
          <p className="text-lg sm:text-xl text-gray-400 mb-10 max-w-3xl mx-auto
                            transition-all duration-1000 delay-200 opacity-0 animate-fade-in-up-delay-200">
            Experience millions of tracks, curated playlists, and crystal-clear audio quality. No limits. Just music.
          </p>

         <div className="flex flex-col sm:flex-row justify-center items-center gap-4 sm:gap-6 transition-all duration-1000 delay-400 opacity-0 animate-fade-in-up-delay-400">
  <a href="/music">
    <button
      className="text-black font-bold text-lg px-8 sm:px-10 py-3 sm:py-4 rounded-full
                 flex items-center justify-center space-x-2 transition transform hover:scale-105 shadow-xl font-bold
                 active:scale-95 duration-200 cursor-pointer"
      style={{
        backgroundColor: PRIMARY_COLOR,
        boxShadow: `0 10px 15px -3px ${PRIMARY_COLOR}50, 0 4px 6px -4px ${PRIMARY_COLOR}50`,
      }}
    >
      <Play size={24} fill="currentColor" />
      <span>Start Free Trial</span>
    </button>
  </a>

  <a href="/music">
    <button
      className="border border-gray-600 text-white font-semibold text-lg px-8 sm:px-10 py-3 sm:py-4 rounded-full
                 flex items-center justify-center space-x-2 transition hover:bg-gray-800 hover:border-white/20 active:scale-95 duration-200 cursor-pointer"
    >
      <Music size={24} />
      <span>Explore Music</span>
    </button>
  </a>
</div>

        </div>

        {/* Dynamic Gradient Overlay for better contrast */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] via-transparent to-[#0a0a0a] opacity-90 z-0"></div>
      </section>

      {/* 2. TOP ARTISTS SECTION */}
      <section id="artists" className={`py-20 px-6 md:px-8 max-w-[${MAX_WIDTH}] mx-auto relative z-10`}>
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold mb-2 flex items-center justify-center gap-3">
            <Mic size={36} style={{ color: PRIMARY_COLOR }} /> Top Trending Artists
          </h2>
          <p className="text-base sm:text-xl text-gray-400">Discover the hottest talent on Wavey this week.</p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
          {trendingArtists.map((artist, index) => (
            <AnimatedCard key={index} className="p-4 text-center group">
              <img
                src={artist.image}
                alt={artist.name}
                className={`w-20 h-20 sm:w-28 sm:h-28 mx-auto mb-3 rounded-full object-cover border-4 border-black ring-2 ring-gray-700
                                    transition-all duration-300 group-hover:scale-110`}
                style={{
                  borderColor: BACKGROUND_COLOR, // Using BG_COLOR for internal border
                  '--tw-ring-color': artist.name === 'The Weekend' ? PRIMARY_COLOR : '#4b5563',
                  boxShadow: '0 0 0 2px var(--tw-ring-color)',
                }}
                onError={(e) => { e.target.onerror = null; e.target.src = "https://placehold.co/96x96/333/fff?text=No+Pic"; }}
              />
              <h3 className="text-base sm:text-lg font-semibold truncate transition duration-300" style={{ color: PRIMARY_COLOR }} >{artist.name}</h3>
              <p className="text-xs sm:text-sm text-gray-500">{artist.genre}</p>
            </AnimatedCard>
          ))}
        </div>
      </section>

      {/* 3. TRENDING PLAYLISTS SECTION */}
      <section id="genres" className={`py-20 px-6 md:px-8 max-w-[${MAX_WIDTH}] mx-auto relative z-10`}>
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold mb-2 flex items-center justify-center gap-3">
            <ListMusic size={36} style={{ color: PRIMARY_COLOR }} /> Featured Playlists
          </h2>
          <p className="text-base sm:text-xl text-gray-400">Hand-picked collections for every moment.</p>
        </div>

        {/* Horizontal Scroll Container - Excellent for mobile */}
        <div className="flex overflow-x-auto space-x-4 sm:space-x-6 pb-4 scrollbar-hide">
          {trendingPlaylists.map((playlist, index) => (
            <div
              key={index}
              className={`flex-shrink-0 w-40 sm:w-52 p-3 sm:p-4 rounded-xl border border-[#222] shadow-lg
                                hover:shadow-[0_0_15px_rgba(250,69,101,0.3)] transition duration-300 cursor-pointer group transform hover:-translate-y-1`}
              style={{ backgroundColor: CARD_BG }}
            >
              <div className="relative mb-3">
                <img
                  src={playlist.image}
                  alt={playlist.name}
                  className="w-full h-36 sm:h-48 object-cover rounded-lg transition-opacity duration-300 group-hover:opacity-70"
                  onError={(e) => { e.target.onerror = null; e.target.src = "https://placehold.co/208x208/333/fff?text=Playlist"; }}
                />
                <div className={`absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition duration-300 bg-black/50 rounded-lg`}>
                  {/* <Play size={30} sm:size={40}  /> */}
                  {/* <Play size={30} sm:size-{40} /> */}
                </div>
              </div>
              <h3 className="text-base sm:text-lg font-semibold truncate transition duration-300 group-hover:text-white" style={{ color: PRIMARY_COLOR }} >{playlist.name}</h3>
              <p className="text-xs sm:text-sm text-gray-500">{playlist.tracks} Tracks</p>
            </div>
          ))}
        </div>
      </section>

      {/* 4. GLOBAL CHARTS SECTION */}
      <section id="charts" className={`py-20 px-6 md:px-8 max-w-[${MAX_WIDTH}] mx-auto relative z-10`}>
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold mb-2 flex items-center justify-center gap-3">
            <Globe size={36} style={{ color: PRIMARY_COLOR }} /> Global Top 5
          </h2>
          <p className="text-base sm:text-xl text-gray-400">The tracks defining the sound of the world right now.</p>
        </div>

        <AnimatedCard className="p-0 overflow-hidden max-w-4xl mx-auto">
          <ul className="divide-y divide-gray-800">
            {globalCharts.map((track, index) => (
              <li
                key={index}
                className={`flex items-center justify-between p-4 md:p-6 transition-all duration-300
                                hover:bg-[#1a1a1a] cursor-pointer group ${index === 0 ? `bg-[#1a1a1a] border-l-4` : ''}`}
                style={index === 0 ? { borderLeftColor: PRIMARY_COLOR } : {}}
              >
                <div className="flex items-center space-x-4">
                  <span className={`text-lg sm:text-xl font-mono w-6 text-center
                                        ${index === 0 ? 'font-extrabold' : 'text-gray-500'}`}
                    style={index === 0 ? { color: PRIMARY_COLOR } : {}}
                  >
                    {track.rank}
                  </span>
                  <div>
                    <h3 className="text-base sm:text-lg font-semibold transition-colors duration-300 group-hover:text-white"
                      style={index === 0 ? { color: PRIMARY_COLOR } : {}}
                    >{track.title}</h3>
                    <p className="text-xs sm:text-sm text-gray-500">{track.artist}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  <span className="text-sm text-gray-500 hidden sm:flex items-center">
                    <Clock size={16} className="inline mr-1" />
                    {track.duration}
                  </span>
                  <button
                    className={`p-2 rounded-full bg-gray-700/50 hover:text-black transition-all duration-300 transform hover:scale-110`}
                    style={{ backgroundColor: `rgb(55 65 81 / 0.5)`, '--hover-bg': PRIMARY_COLOR }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = e.currentTarget.style.getPropertyValue('--hover-bg')}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = `rgb(55 65 81 / 0.5)`}
                  >
                    <Play size={20} fill='currentColor' />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </AnimatedCard>
      </section>

      {/* 5. AI TRACK ANALYZER (NEW SECTION with Gemini API) */}
      <AiTrackAnalyzer apiKey={apiKey} />

      {/* 6. CORE FEATURES SECTION */}
      <section className={`py-20 md:py-32 px-6 md:px-8 max-w-[${MAX_WIDTH}] mx-auto relative z-10`}>
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">Why Choose Wavey?</h2>
          <p className="text-base sm:text-xl text-gray-400">The ultimate streaming platform built for audiophiles.</p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-10">
          {[
            { icon: <Music size={40} style={{ color: PRIMARY_COLOR }} />, title: "Vast Library", desc: "Access over 100 million songs, from chart-toppers to obscure indie gems." },
            { icon: <TrendingUp size={40} style={{ color: PRIMARY_COLOR }} />, title: "Personalized Discovery", desc: "Our AI learns your taste to find music you'll love, every time." },
            { icon: <Headset size={40} style={{ color: PRIMARY_COLOR }} />, title: "Lossless Audio", desc: "Stream in Hi-Res Lossless quality (up to 24-bit/192 kHz) for pure sound." },
          ].map((feature, index) => (
            <AnimatedCard key={index} className="flex flex-col items-start">
              <div className="mb-4 transition-transform duration-300 hover:scale-110">{feature.icon}</div>
              <h3 className="text-xl sm:text-2xl font-semibold mb-3">{feature.title}</h3>
              <p className="text-sm sm:text-base text-gray-400">{feature.desc}</p>
            </AnimatedCard>
          ))}
        </div>
      </section>

      {/* 7. CALL TO ACTION FOOTER */}
      <footer className="bg-[#111] py-16 mt-10 md:mt-20">
        <div className={`max-w-[${MAX_WIDTH}] mx-auto px-6 md:px-8 text-center`}>
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">Ready to elevate your listening?</h2>
          <p className="text-base sm:text-xl text-gray-400 mb-8">Join millions of users who trust Wavey for their daily soundtrack.</p>

          <button
            className="text-black font-bold text-lg sm:text-xl px-10 sm:px-12 py-3 sm:py-4 rounded-full
                            flex items-center justify-center space-x-2 mx-auto transition transform hover:scale-105 active:scale-95 duration-200"
            style={{
              backgroundColor: PRIMARY_COLOR,
              boxShadow: `0 10px 15px -3px ${PRIMARY_COLOR}70, 0 4px 6px -4px ${PRIMARY_COLOR}70`
            }}
          >
            <span>Get Started Now</span>
            <ArrowRight size={24} />
          </button>

          <p className="text-xs sm:text-sm text-gray-500 mt-8">&copy; {new Date().getFullYear()} Wavey Music Streaming. All rights reserved.</p>
        </div>
      </footer>

      {/* Global Style Definitions and Keyframes */}
      <style>{`
                body {
                    margin: 0;
                    padding: 0;
                    font-family: 'Inter', sans-serif;
                }
                .scrollbar-hide::-webkit-scrollbar {
                    display: none;
                }
                .scrollbar-hide {
                    -ms-overflow-style: none;
                    scrollbar-width: none;
                }
                @keyframes fadeInUp {
                    from { opacity: 0; transform: translateY(20px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .animate-fade-in-up {
                    animation: fadeInUp 1s ease-out both;
                }
                .animate-fade-in-up-delay-200 {
                    animation: fadeInUp 1s ease-out 0.2s both;
                }
                .animate-fade-in-up-delay-400 {
                    animation: fadeInUp 1s ease-out 0.4s both;
                }

                @keyframes heroGlow {
                    0% { transform: scale(1); opacity: 0.3; }
                    50% { transform: scale(1.05); opacity: 0.45; }
                    100% { transform: scale(1); opacity: 0.3; }
                }
                .animate-hero-glow {
                    animation: heroGlow 6s ease-in-out infinite;
                }
                
                /* Simple Prose styling for markdown content */
                .prose h3 {
                  font-size: 1.25rem;
                  font-weight: 700;
                  color: ${PRIMARY_COLOR};
                  margin-top: 1.5rem;
                  margin-bottom: 0.5rem;
                  border-bottom: 1px solid #333;
                  padding-bottom: 4px;
                }
                .prose strong {
                  color: white;
                }
                .prose br {
                  content: "";
                  display: block;
                  margin-top: 0.5em; /* Add space between lines */
                }
            `}</style>
    </div>
  );
}
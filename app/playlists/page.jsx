"use client"
import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

// 🚨 Router Import (Uncomment the appropriate one)
import { useRouter } from 'next/navigation'; 
// import { useRouter } from 'next/router'; 

// --- CONFIGURATION ---
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Supabase configuration missing. Ensure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are set in your .env file."
  );
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);
// ---------------------

function UltraPremiumPlaylistsPage() {
  const [playlists, setPlaylists] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [hoveredId, setHoveredId] = useState(null); // State to track hover for advanced styling

  // Initialize Router
  const router = useRouter(); 

  const handlePlaylistClick = (id) => {
    router.push(`/playlist/${id}`);
  };

  useEffect(() => {
    const fetchPlaylists = async () => {
      setIsLoading(true);
      setError(null);

      const { data, error } = await supabase
        .from('playlists')
        .select('id, name, image_url, description, created_by, created_at')
        .eq('is_public', true)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Supabase fetch error:', error);
        setError(`Failed to fetch playlists: ${error.message}`);
      } else {
        setPlaylists(data);
      }
      
      setIsLoading(false);
    };

    fetchPlaylists();
  }, []); 

  // --- Render Logic ---

  if (isLoading) {
    return <div style={styles.loadingContainer}>Loading Top Playlists...</div>;
  }

  if (error) {
    return <div style={styles.errorContainer}>Error: {error}</div>;
  }

  return (
    // Main container with a subtle vertical gradient for depth
    <div style={styles.mainContainer}>
      <h1 style={styles.sectionHeader}>🎶 Top Hits & Trending Playlists</h1>
      
      {playlists.length === 0 ? (
        <p style={styles.noData}>No public playlists are currently trending.</p>
      ) : (
        <div style={styles.gridContainer}>
          {playlists.map((playlist) => (
            // Individual Card Item
            <div 
              key={playlist.id} 
              onClick={() => handlePlaylistClick(playlist.id)}
              onMouseEnter={() => setHoveredId(playlist.id)} // Set hover state
              onMouseLeave={() => setHoveredId(null)}         // Clear hover state
              // Apply dynamic style based on hover state
              style={{
                ...styles.cardBase, 
                // Enhanced hover effect: lift and slightly lighten the background
                ...(hoveredId === playlist.id ? styles.cardHover : {}) 
              }}
            >
              <div style={styles.imageWrapper}>
                <img 
                loading="lazy"
                  src={playlist.image_url || '/placeholder-playlist.png'} 
                  alt={`${playlist.name} cover`} 
                  style={styles.playlistImage}
                />
                
                {/* Play Button Overlay (Conceptual UI element) */}
                {hoveredId === playlist.id && (
                  <div style={styles.playButton}>
                    <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor" style={{marginLeft: '2px'}}>
                      <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zm2.46-7.12l3.21-3.6V11h5.83v2h-5.83v2.72l-3.21-3.6z"/>
                    </svg>
                  </div>
                )}

              </div>

              {/* Title */}
              <h3 style={styles.cardTitle}>
                {playlist.name}
              </h3>
              
              {/* Subtext */}
              <p style={styles.cardSubtext}>
                {/* Truncate long descriptions or use a clean subtitle */}
                {playlist.description?.substring(0, 40) + (playlist.description?.length > 40 ? '...' : '') || `Playlist by ${playlist.created_by}`}
              </p>

              {/* Created Date as small metadata */}
              <p style={styles.cardMetadata}>
                Added: {new Date(playlist.created_at).toLocaleDateString()}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// --- Styles Object for Ultra-Premium Look ---
const styles = {
  // Main Container with a subtle gradient background
  mainContainer: {
    padding: '40px',
    background: 'linear-gradient(180deg, #181818 0%, #0A0A0A 100%)', // Gradient for depth
    minHeight: '100vh',
    color: '#EFEFEF',
    fontFamily: 'Inter, system-ui, sans-serif', // Modern, sleek font choice
  },
  sectionHeader: {
    fontSize: '2.5em',
    fontWeight: 800,
    marginBottom: '35px',
    color: '#FFFFFF',
    textShadow: '0 1px 3px rgba(0,0,0,0.5)',
  },
  gridContainer: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', 
    gap: '30px', // Increased gap for a luxurious feel
  },
  cardBase: {
    backgroundColor: '#1E1E1E', // Base dark card color
    borderRadius: '12px', // More rounded corners
    padding: '16px',
    cursor: 'pointer',
    transition: 'background-color 0.3s ease, transform 0.2s ease, box-shadow 0.3s ease',
    boxShadow: '0 4px 15px rgba(0, 0, 0, 0.4)',
    willChange: 'transform', // Performance hint for animation
  },
  cardHover: {
    backgroundColor: '#282828', // Brighter on hover
    transform: 'translateY(-5px)', // Subtle lift
    boxShadow: '0 8px 25px rgba(0, 0, 0, 0.7)',
  },
  imageWrapper: {
    position: 'relative',
    paddingTop: '100%',
    marginBottom: '15px',
  },
  playlistImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    borderRadius: '8px', // Slightly rounded image corners
  },
  playButton: {
    position: 'absolute',
    bottom: '8px',
    right: '8px',
    width: '45px',
    height: '45px',
    backgroundColor: '#1DB954', // Spotify green or similar accent
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.9,
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.5)',
    transition: 'transform 0.2s ease',
    // Hover on play button itself (concept)
    ':hover': { transform: 'scale(1.05)' }
  },
  cardTitle: {
    fontSize: '1.1em',
    fontWeight: 700,
    margin: '0 0 4px 0',
    color: '#FFFFFF',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  cardSubtext: {
    fontSize: '0.85em',
    color: '#B3B3B3',
    margin: 0,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  cardMetadata: {
    fontSize: '0.75em',
    color: '#6A6A6A',
    marginTop: '8px',
    fontWeight: 500,
  },
  loadingContainer: {
    padding: '40px', 
    color: '#B3B3B3',
    backgroundColor: '#0A0A0A',
    minHeight: '100vh',
  },
  errorContainer: {
    padding: '40px', 
    color: '#FF4D4D',
    backgroundColor: '#0A0A0A',
    minHeight: '100vh',
  }
};

export default UltraPremiumPlaylistsPage;
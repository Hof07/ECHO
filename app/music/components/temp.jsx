<div
  className="fixed inset-0 flex items-center justify-center p-4 z-[100] transition-all duration-700"
  style={{
    background: `linear-gradient(160deg, ${dominantColor}, #000)`,
  }}
>
  {/* 🔥 4K ULTRA HD FILTER LAYER */}

  {/* 🔘 Exit Fullscreen Button */}
  <button
    onClick={toggleFullscreen}
    className="absolute top-2 sm:top-4 right-2 sm:right-4 p-2 sm:p-3 rounded-full
      hover:bg-white/20 backdrop-blur-md transition border border-white/30
      shadow-lg text-white scale-90 sm:scale-100 z-10"
  >
    <Minimize className="w-4 h-4 sm:w-6 sm:h-6 opacity-90 hover:opacity-100" />
  </button>

  {/* 🎵 Glass Card */}
  <div
    className="
      relative z-10 w-full max-w-sm text-white rounded-3xl p-6
      shadow-2xl bg-white/10 backdrop-blur-2xl
      border border-white/15
      ultra-hd-card
    "
  >
    {/* Album Artwork */}
    <img
      src={currentSong.cover_url}
      alt="cover"
      className="w-full aspect-square object-cover rounded-2xl mb-6 shadow-xl ultra-hd-image"
    />

    {/* Song Info */}
    <div className="text-center mb-4">
      <h1 className="text-xl font-semibold truncate">
        "{currentSong.title}"
      </h1>
      <p className="text-sm opacity-80 truncate">
        {currentSong.artists?.name ||
          currentSong.artist_name ||
          "Unknown Artist"}
      </p>
    </div>

    {/* Controls */}
    <div className="flex items-center justify-between mb-6">
      <button onClick={handlePrevClick}>
        <SkipBack className="w-7 h-7 opacity-70 hover:opacity-100" />
      </button>

      <button
        onClick={togglePlay}
        className="bg-white text-black p-4 rounded-full shadow-lg
        hover:scale-110 transition"
      >
        {isPlaying ? <Pause /> : <Play />}
      </button>

      <button onClick={playNext}>
        <SkipForward className="w-7 h-7 opacity-70 hover:opacity-100" />
      </button>
    </div>

    {/* Volume */}
    <div className="flex items-center gap-3">
      <Volume2 className="w-5 h-5 opacity-80" />
      <input
        type="range"
        min="0"
        max="1"
        step="0.01"
        value={volume}
        onChange={(e) => changeVolume(+e.target.value)}
        className="w-full accent-white"
      />
    </div>
  </div>
</div>

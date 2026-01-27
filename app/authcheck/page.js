"use client";

import { useEffect, useState } from "react";

export default function ScrollOpacityDemo() {
  const [opacity, setOpacity] = useState(0);

  useEffect(() => {
    const onScroll = () => {
      const scrollY = window.scrollY;

      // if scroll even 1px → opacity = 1
      if (scrollY > 1) {
        setOpacity(1);
      } else {
        setOpacity(0);
      }
    };

    window.addEventListener("scroll", onScroll);
    onScroll(); // run once

    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div style={{ minHeight: "200vh", background: "#111", color: "white" }}>
      {/* This box opacity changes on scroll */}
      <h2
        style={{
          position: "fixed",
          top: 20,
          left: "50%",
          transform: "translateX(-50%)",
          fontSize: 24,
          fontWeight: "bold",
          opacity: opacity,
          transition: "opacity 0.2s ease-in-out",
        }}
      >
        SCROLL TITLE
      </h2>

      {/* Big dummy block so page scrolls */}
      <div style={{ paddingTop: 200 }}>
        <h1 style={{ fontSize: 60, padding: 50 }}>Scroll Down</h1>
      </div>
    </div>
  );
}

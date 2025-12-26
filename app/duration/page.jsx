"use client";

import { usePlayer } from "../music/context/PlayerContext";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
} from "chart.js";
import { Bar } from "react-chartjs-2";

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip);

export default function DurationPage() {
  const { listenedSeconds } = usePlayer();
  const [mounted, setMounted] = useState(false);
  const router = useRouter(); // Initialize the router

  useEffect(() => setMounted(true), []);

  if (!mounted) return null;

  const todayIndex = new Date().getDay();
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const rawChartData = [0, 0, 0, 0, 0, 0, 0]; 
  rawChartData[todayIndex] = Math.floor(listenedSeconds / 60);

  const data = {
    labels: days,
    datasets: [
      {
        data: rawChartData,
        backgroundColor: (context) => {
          return context.dataIndex === todayIndex ? "#fa4565" : "#3a3a3c";
        },
        borderRadius: 20,
        borderSkipped: false,
        barThickness: 25, 
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      tooltip: {
        enabled: true,
        backgroundColor: "#1c1c1e",
        bodyColor: "#fa4565",
        callbacks: {
          label: (context) => ` ${context.raw} min`,
        },
      },
    },
    scales: {
      x: { 
        grid: { display: false },
        ticks: { color: "#8e8e93", font: { size: 10 } } 
      },
      y: { 
        display: false,
        beginAtZero: true,
        max: 1440 
      },
    },
  };

  const formatTime = (totalSeconds) => {
    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = Math.floor(totalSeconds % 60);
    const pad = (n) => String(n).padStart(2, "0");

    return (
      <div style={styles.counterContainer}>
        <div style={styles.timeItem}>
          <span style={styles.counterNum}>{pad(hrs)}</span>
          <span style={styles.counterUnit}>h</span>
        </div>
        <span style={styles.separator}>:</span>
        <div style={styles.timeItem}>
          <span style={styles.counterNum}>{pad(mins)}</span>
          <span style={styles.counterUnit}>m</span>
        </div>
        <span style={styles.separator}>:</span>
        <div style={styles.timeItem}>
          <span style={styles.counterNum}>{pad(secs)}</span>
          <span style={styles.counterUnit}>s</span>
        </div>
      </div>
    );
  };

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        {/* Updated Header with Back Button */}
        <div style={styles.headerContainer}>
          <button 
            onClick={() => router.back()} 
            style={styles.backButton}
            aria-label="Go back"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6"/>
            </svg>
          </button>
          <h2 style={styles.headerTitle}>Dashboard</h2>
          <div style={{ width: 40 }} /> {/* Spacer to keep title centered */}
        </div>
        
        <div style={styles.mainBox}>
          <p style={styles.todayLabel}>Today's Activity</p>
          
          <div style={styles.counterBox}>
            {formatTime(listenedSeconds)}
          </div>

          <div style={styles.graphWrapper}>
            <div style={{ height: "200px", width: "100%" }}>
               <Bar data={data} options={options} />
            </div>
          </div>

          <div style={styles.innerFooter}>
             <span style={styles.viewAll}>Lifetime Stats</span>
          </div>
        </div>
      </div>
    </div>
  );
}

const styles = {
  page: {
    background: "#000",
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "20px",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  },
  card: { 
    width: "100%", 
    maxWidth: "420px", 
    color: "white",
    display: "flex",
    flexDirection: "column",
  },
  headerContainer: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: "30px",
    padding: "0 10px",
  },
  backButton: {
    background: "#1c1c1e",
    border: "none",
    color: "white",
    width: "40px",
    height: "40px",
    borderRadius: "12px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    transition: "background 0.2s",
  },
  headerTitle: { fontSize: "24px", fontWeight: "600", margin: 0 },
  mainBox: {
    background: "#121214",
    borderRadius: "32px",
    padding: "32px 24px",
    border: "1px solid #1c1c1e",
    boxShadow: "0 10px 40px rgba(0,0,0,0.5)",
  },
  todayLabel: { 
    color: "#8e8e93", 
    fontSize: "13px", 
    textTransform: "uppercase", 
    letterSpacing: "1px",
    textAlign: "center",
    marginBottom: "20px"
  },
  counterBox: {
    background: "#1c1c1e",
    borderRadius: "20px",
    padding: "20px",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: "30px",
  },
  counterContainer: {
    display: "flex",
    alignItems: "baseline",
    gap: "8px",
  },
  timeItem: {
    display: "flex",
    alignItems: "baseline",
  },
  counterNum: { 
    fontSize: "46px", 
    fontWeight: "800", 
    color: "#fa4565", 
    fontFamily: "monospace" 
  },
  counterUnit: { 
    fontSize: "16px", 
    color: "#4a4a4d", 
    marginLeft: "2px",
    fontWeight: "700" 
  },
  separator: {
    fontSize: "30px",
    color: "#2c2c2e",
    fontWeight: "300",
    paddingBottom: "5px"
  },
  graphWrapper: { 
    marginTop: "10px",
    padding: "0 5px"
  },
  innerFooter: {
    textAlign: "center",
    marginTop: "30px",
    borderTop: "1px solid #1c1c1e",
    paddingTop: "20px",
  },
  viewAll: { color: "#4a4a4d", fontSize: "12px", fontWeight: "600", cursor: "pointer" },
};
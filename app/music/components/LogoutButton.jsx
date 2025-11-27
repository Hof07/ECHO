// components/LogoutButton.jsx 
"use client";

import { useRouter } from "next/navigation";
import React, { useState } from "react";
import { LogOut } from "lucide-react";

export default function LogoutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleLogout = async () => {
    setLoading(true);
    try {
      // 1. Call the custom Logout API Route
      await fetch("/api/logout", {
        method: "POST",
      });

      // 2. Redirect to the login page after clearing the cookie
      router.push("/login");
    } catch (error) {
      console.error("Logout failed:", error);
      alert("Logout failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleLogout}
      disabled={loading}
      className="flex items-center gap-2 text-white bg-red-600/50 hover:bg-red-600 transition-colors font-medium p-3 rounded-lg"
    >
      <LogOut className="w-5 h-5" />
      {loading ? "Logging out..." : "Logout"}
    </button>
  );
}
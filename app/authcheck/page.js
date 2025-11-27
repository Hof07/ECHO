"use client";

import { useState } from "react";

export default function AuthCheckPage() {
  const [identifier, setIdentifier] = useState("");
  const [result, setResult] = useState("");

  async function handleCheck() {
    if (!identifier.trim()) {
      setResult("❌ Enter email or username");
      return;
    }

    setResult("⏳ Checking...");

    const res = await fetch("/api/checkemail", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier }),
    });

    const data = await res.json();

    if (!data.exists) {
      setResult("❌ Account not found");
      return;
    }

    setResult(`✅ Found user: ${data.user.email || data.user.username}`);
  }

  return (
    <div className="p-6 text-white">
      <h1 className="text-xl mb-4">Check User</h1>

      <input
        type="text"
        placeholder="Enter email or username"
        className="p-2 bg-gray-800 text-white rounded w-full mb-3"
        value={identifier}
        onChange={(e) => setIdentifier(e.target.value)}
      />

      <button
        onClick={handleCheck}
        className="p-2 bg-blue-600 rounded w-full"
      >
        Check
      </button>

      <p className="mt-4">{result}</p>
    </div>
  );
}

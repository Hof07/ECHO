"use client";

import { useEffect } from "react";

export default function ClientCheck({ email }) {
  useEffect(() => {
    console.log("User Email From JWT:", email);
  }, [email]);

  return (
    <div className="text-white p-6">
      <h1 className="text-2xl font-bold">JWT Cookie Check</h1>
      <p className="mt-3 text-lg">
        <strong>Email:</strong> {email || "Failed to read token"}
      </p>
    </div>
  );
}

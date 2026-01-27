"use client";

import { useState, useCallback } from "react";
// Removed dependency on 'next/navigation' as it caused a build error
import {
  ArrowLeft,
  Eye,
  EyeOff,
  AudioWaveform,
  AlertCircle,
} from "lucide-react";

// 🔑 Define the primary accent color
const ACCENT_COLOR = "#fa4565";

// --- Helper Components ---

/**
 * Renders the social login button with consistent styling.
 */
const SocialButton = ({ onClick, icon, text }) => (
  <button
    type="button"
    onClick={onClick}
    className="w-full bg-black border border-zinc-700 text-white py-3 rounded-full flex items-center justify-center gap-3 hover:border-white transition-colors text-base font-medium mb-3"
  >
    {icon}
    {text}
  </button>
);

// --- Main Component ---

export default function LoginPage() {
  const [step, setStep] = useState(1);
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [result, setResult] = useState(""); // Holds the message text
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  /**
   * Helper to determine if the current result text is an error message for styling.
   */
  const isErrorMessage = (msg) => {
    const errorKeywords = [
      "enter email", "not found", "failed", "Network error",
    ];
    return errorKeywords.some(keyword => msg.toLowerCase().includes(keyword.toLowerCase()));
  };

  // --- Core Logic Handlers ---

  /**
   * Handles the 'Continue' click in Step 1.
   * Performs an API call to check if the user/email exists.
   */
  async function handleNext() {
    if (!identifier.trim()) {
      setResult("Please enter email or username");
      return;
    }

    setLoading(true);
    // Display simple loading text
    setResult("");

    try {
      // API call to check user existence (Placeholder endpoint)
      const res = await fetch("/api/checkemail", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier }),
      });

      const data = await res.json();

      if (!res.ok || !data.exists) {
        // Account not found or API returned an error status (Change 1 & 2)
        setResult(`Mail/username not found. Please sign up.`);
        return;
      }

      // Change 4: Clear result message and proceed to step 2 on success
      setResult(""); 
      setStep(2); 
    } catch (error) {
      setResult("Network error or connection failed.");
    } finally {
      setLoading(false);
    }
  }

  /**
   * Handles the 'Log in' click in Step 2.
   * Validates password and calls the login API.
   */
  async function handleLogin() {
    if (!password) {
      setResult("Enter password");
      return;
    }

    setLoading(true);
    setResult("");

    try {
      // --- Placeholder API Call ---
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          identifier,
          password,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        // Assume data.message contains the error text from the backend
        setResult(data.message || "Login failed.");
        return;
      }

      setResult("Login successful! Redirecting...");
      // Using standard window redirection instead of router.push
      window.location.href = "/music";
    } catch (error) {
      setResult("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  // --- OAuth Handlers (Placeholders) ---

  const handleGoogle = useCallback(() => {
    setResult("Initiating Google sign-in...");
    // TODO: Implement actual Google OAuth logic here
    // console.log("Starting Google OAuth flow...");
  }, []);

  const handleApple = useCallback(() => {
    setResult("Initiating Apple sign-in...");
    // TODO: Implement actual Apple OAuth logic here
    // console.log("Starting Apple OAuth flow...");
  }, []);

  // --- Render Logic ---

  const isFinalError = isErrorMessage(result);
  const isSuccessMessage = result.includes("successful");


  return (
    <div className="min-h-screen bg-black text-white flex justify-center items-center px-4 py-12 font-sans relative">
      {/* Custom CSS for the loading spinner */}
      <style>{`
        .loader {
          /* Updated loader to be visible on the accent color button */
          border: 4px solid rgba(255, 255, 255, 0.3); 
          border-top: 4px solid #fff; /* White spinner line */
          border-radius: 50%;
          width: 1.5rem;
          height: 1.5rem;
          animation: spin 1s linear infinite;
          display: inline-block;
        }
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>

      <div className="max-w-sm w-full text-center">
        {/* Back Button for Step 2 */}
        {step === 2 && (
          <button
            onClick={() => {
              setStep(1);
              setPassword(""); // Clear password when going back
              setResult(""); // Clear result/error message
            }}
            className="absolute top-8 left-4 text-white hover:text-[#fa4565] transition p-2 rounded-full"
            aria-label="Go back to identifier entry"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
        )}

        {/* Logo */}
        <AudioWaveform
          className="w-10 h-10 mx-auto mb-8"
          style={{ color: ACCENT_COLOR }}
        />

        <h1 className="text-white text-3xl font-extrabold mb-8">
          {step === 1 ? "Sign in to continue" : "Enter your password"}
        </h1>

        {/* Identifier Display (Step 2) / Input (Step 1) */}
        <div className="mb-4">
          {step === 2 ? (
            // Display identifier in Step 2 (Read-only)
            <p className="text-left text-lg font-medium text-zinc-400 mb-2 truncate p-4 bg-zinc-900 rounded-lg border border-zinc-700">
              {identifier}
            </p>
          ) : (
            // Input field for identifier in Step 1
            <input
              type="text"
              className={`w-full bg-black border p-4 rounded-lg text-white placeholder-zinc-500 outline-none transition border-zinc-500 focus:border-[#fa4565]`}
              placeholder="Email or username"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              required
              autoComplete="username"
              // Allow pressing Enter key to trigger the action
              onKeyPress={(e) => {
                if (e.key === 'Enter') handleNext();
              }}
              disabled={loading}
            />
          )}
        </div>

        {/* Password Input (Step 2 Only) */}
        {step === 2 && (
          <div className="relative mb-6">
            <input
              type={showPassword ? "text" : "password"}
              className="w-full bg-black border border-zinc-500 p-4 rounded-lg text-white placeholder-zinc-500 outline-none transition focus:border-[#fa4565] pr-12"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoFocus
              autoComplete="current-password"
              // Allow pressing Enter key to trigger the action
              onKeyPress={(e) => {
                if (e.key === 'Enter') handleLogin();
              }}
              disabled={loading}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-zinc-500 hover:text-white p-1 rounded-full transition"
              aria-label={showPassword ? "Hide password" : "Show password"}
              disabled={loading}
            >
              {showPassword ? (
                <EyeOff className="w-5 h-5" />
              ) : (
                <Eye className="w-5 h-5" />
              )}
            </button>
          </div>
        )}
        
        {/* Result Message - Styling updated per user request (Change 3) */}
        {result && (
          <p
            className={`mb-4 p-3 rounded-md text-sm flex items-center justify-center gap-2 =
              ${isFinalError
                // Error: Only red text, transparent background, no border
                ? "text-red-400"
                // Success/Loading: Use neutral/success styling (Success is green, loading is neutral)
                : isSuccessMessage 
                  ? ""
                  : "text-red-400" // Neutral text for "Checking for account..." / "Logging in..."
              }
            `}
          >
            {/* Show AlertCircle icon specifically for error states */}
            {isFinalError && <AlertCircle className="w-5 h-5 shrink-0 text-red-400" />}
            {result}
          </p>
        )}

        {/* Action Buttons (Different button for each step) */}
        {step === 1 ? (
          // Button for Step 1: Next (Continue) - Triggers API Check
          <button
            onClick={handleNext}
            disabled={!identifier.trim() || loading}
            style={{ backgroundColor: ACCENT_COLOR, color: "black" }}
            className="w-full cursor-pointer py-4 rounded-full font-bold transition-all disabled:opacity-50 hover:opacity-90 flex items-center justify-center"
          >
            {loading ? (
              // Display loader inside the button
              <span className="loader"></span>
            ) : (
              "CONTINUE".toUpperCase()
            )}
          </button>
        ) : (
          // Button for Step 2: Login
          <button
            onClick={handleLogin}
            disabled={!password || loading}
            style={{ backgroundColor: ACCENT_COLOR, color: "black" }}
            className="w-full cursor-pointer py-4 rounded-full font-bold transition-all disabled:opacity-50 hover:opacity-90 flex items-center justify-center"
          >
            {loading ? <span className="loader"></span> : "LOG IN".toUpperCase()}
          </button>
        )}

        {/* Social Login (Visible in Step 1 Only) */}
        {step === 1 && (
          <>
            <p className="text-zinc-500 font-bold text-sm my-6">OR</p>

            <div className="space-y-3">
              <SocialButton
                onClick={handleGoogle}
                text="Continue with Google"
                icon={
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 48 48"
                    width="24px"
                    height="24px"
                  >
                    <path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z" />
                    <path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z" />
                    <path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z" />
                    <path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571c0.001-0.001,0.002-0.001,0.003-0.002l6.19,5.238C36.971,39.205,44,34,44,24C44,22.659,43.862,21.35,43.611,20.083z" />
                  </svg>
                }
              />
              <SocialButton
                onClick={handleApple}
                text="Continue with Apple"
                icon={
                  <svg
                    fill="#fff"
                    width="24px"
                    height="24px"
                    viewBox="-3.5 -2 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                    preserveAspectRatio="xMinYMin"
                  >
                    <path d="M13.623 10.627c-.025-2.533 2.066-3.748 2.159-3.808-1.175-1.72-3.005-1.955-3.657-1.982-1.557-.158-3.039.917-3.83.917-.788 0-2.008-.894-3.3-.87C3.299 4.909 1.734 5.87.86 7.39c-1.764 3.06-.452 7.595 1.267 10.077.84 1.215 1.842 2.58 3.157 2.53 1.266-.05 1.745-.819 3.276-.819 1.531 0 1.962.82 3.302.795 1.363-.026 2.226-1.239 3.06-2.457.965-1.41 1.362-2.775 1.386-2.845-.03-.013-2.658-1.02-2.684-4.045zm-2.518-7.433c.698-.847 1.169-2.022 1.04-3.194C11.14.04 9.921.67 9.2 1.515c-.647.75-1.214 1.945-1.062 3.094 1.122.088 2.268-.57 2.967-1.415z" />
                  </svg>
                }
              />
            </div>
          </>
        )}

        {/* Footer Signup Link */}
        <p className="text-zinc-400 text-sm mt-10">
          Don't have an account?
          <a
            href="/signup"
            className="text-white font-semibold hover:opacity-70 transition ml-1"
          >
            Sign up
          </a>
        </p>

      </div>
    </div>
  );
}
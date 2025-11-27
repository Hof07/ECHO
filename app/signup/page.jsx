// app/signup/page.jsx
"use client";

import React, { useState, useMemo } from "react";
import {
  Chrome,
  AudioWaveform,
  Eye,
  EyeOff,
  CheckCircle,
  ArrowLeft,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { supabaseAuth } from "@/app/lib/supabaseAuth";
import { supabase } from "@/app/lib/supabaseClient";
import jwt from "jwt-simple";
import bcrypt from "bcryptjs";
import { v4 as uuidv4 } from "uuid";
import { signToken } from "../lib/jwt";
// signToken
// 🔑 Define the primary accent color
const ACCENT_COLOR = "#fa4565";

// --- Helper Components ---

const NextButton = ({ onClick, loading, text = "Next", disabled }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled || loading}
    style={{ backgroundColor: ACCENT_COLOR }}
    className="w-full text-black cursor-pointer py-4 rounded-full font-bold hover:opacity-90 transition-opacity disabled:opacity-50 mt-8"
  >
    {loading ? <span className="loader"></span> : text.toUpperCase()}
  </button>
);

const SocialButton = ({ onClick, icon, text }) => (
  <button
    onClick={onClick}
    className="w-full bg-black border border-zinc-500 text-white py-3 rounded-full flex items-center justify-center gap-3 hover:border-white transition-colors text-base font-medium mb-3"
  >
    {icon}
    {text}
  </button>
);

const PasswordRequirement = ({ text, isValid }) => (
  <div
    className={`flex items-center text-sm ${
      isValid ? "text-rose-500" : "text-zinc-400"
    }`}
  >
    <CheckCircle
      className={`w-4 h-4 mr-2 ${isValid ? "text-rose-500" : "text-zinc-600"}`}
    />
    {text}
  </div>
);

const DetailRow = ({ label, value }) => (
  <div className="flex justify-between text-white text-sm border-b border-zinc-700 py-2 last:border-b-0">
    <span className="text-zinc-400 font-light">{label}:</span>
    <span className="font-medium">{value}</span>
  </div>
);

// --- Main Component ---

export default function SignupPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  // error state now used for success/error messages
  const [error, setError] = useState("");

  // --- State for all form fields ---
  const [form, setForm] = useState({
    email: "",
    password: "",
    username: "",
    name: "",
    dob: {
      year: "",
      month: "",
      day: "",
    },
    gender: "Prefer not to say",
  });

  // dicebear avatar url generator
  const avatarFor = (name = "") =>
    `https://api.dicebear.com/9.x/thumbs/svg?seed=${encodeURIComponent(
      name || Math.random().toString(36).slice(2, 8)
    )}`;

  // --- Validation logic ---
  const isStep1Valid = form.email && form.email.includes("@");
  const isStep2Valid = form.password.length >= 10;
  const isStep3Valid =
    form.name &&
    form.username &&
    form.dob.year &&
    form.dob.month &&
    form.dob.day;

  // --- Password Validation Status ---
  const passwordChecks = useMemo(
    () => ({
      hasLetter: /[a-zA-Z]/.test(form.password),
      hasNumberOrSpecial: /[0-9!@#$%^&*()]/.test(form.password),
      isMinLength: form.password.length >= 10,
    }),
    [form.password]
  );

  // --- Handlers for navigation ---
  const handleNext = () => {
    setError(""); // Clear error on step change
    if (step === 1 && isStep1Valid) {
      setStep(2);
    } else if (step === 2 && isStep2Valid) {
      setStep(3);
    } else if (step === 3 && isStep3Valid) {
      setStep(4);
    }
  };

  const handleBack = () => {
    setError(""); // Clear error on step change
    if (step > 1) {
      setStep(step - 1);
    }
  };

  // --- FINAL SIGNUP HANDLER (STAGE 4) ---

  //   const SECRET_KEY = process.env.NEXT_PUBLIC_JWT_SECRET; // MAKE SURE THIS EXISTS

  const handleSignup = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (!form.email || !form.password || !form.name) {
        setError("All fields required");
        setLoading(false);
        return;
      }

      // Check if email exists
      const { data: exists } = await supabase
        .from("profiles")
        .select("email")
        .eq("email", form.email)
        .maybeSingle();

      if (exists) {
        setError("Email already exists");
        setLoading(false);
        return;
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(form.password, 10);
      const userId = uuidv4();

      const { error: insertError } = await supabase.from("profiles").insert([
        {
          id: userId,
          email: form.email,
          username: form.username,
          full_name: form.name,
          img: avatarFor(form.username || form.email),
          password: hashedPassword,
          created_at: new Date().toISOString(),
        },
      ]);

      if (insertError) {
        setError("Signup failed!");
        setLoading(false);
        return;
      }

      // JWT Token
      const token = signToken({
        id: userId,
        email: form.email,
        username: form.username,
        exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7,
      });

      await fetch("/api/set-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });

      router.push("/music");
    } catch (err) {
      console.error("Signup Error:", err);
      setError("Something went wrong");
    }

    setLoading(false);
  };

  // OAuth handlers
  const handleGoogle = () =>
    supabaseAuth.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${location.origin}/auth/callback` },
    });
  const handleApple = () =>
    supabaseAuth.auth.signInWithOAuth({
      provider: "apple",
      options: { redirectTo: `${location.origin}/auth/callback` },
    });

  // --- JSX Fragments for Each Step ---

  const StageOne = (
    <div className="w-full space-y-4 text-left">
      <h2 className="text-white text-[30px] font-bold mb-4 text-center">
        Sign up to listen music flowlessly
      </h2>
      {/* Email Input */}
      <div>
        <input
          type="email"
          className="w-full bg-black border border-zinc-500 p-3 rounded-md text-white placeholder-zinc-500 outline-none transition focus:border-[#fa4565]"
          placeholder="Email address"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          required
        />
      </div>
      <NextButton
        onClick={handleNext}
        loading={loading}
        text="Next"
        disabled={!isStep1Valid}
      />
      {error && <p className="text-red-500 text-center text-sm">{error}</p>}{" "}
      {/* Display error message */}
      {/* OR Divider and Socials */}
      <div className="flex items-center my-8">
        <hr className="flex-grow border-zinc-700" />
        <p className="text-zinc-500 text-sm mx-4 font-bold">or</p>
        <hr className="flex-grow border-zinc-700" />
      </div>
      <SocialButton
        onClick={handleGoogle}
        text="Continue with Google"
        icon={<Chrome className="w-6 h-6" />}
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
  );

  const StageTwo = (
    <div className="w-full space-y-6 text-left">
      <h2 className="text-white text-xl font-bold mb-8 text-center">
        Create a password
      </h2>

      {/* Password Input */}
      <div className="relative">
        <input
          type={showPassword ? "text" : "password"}
          className="w-full bg-black border border-zinc-500 p-3 rounded-md text-white placeholder-zinc-500 outline-none focus:border-[#fa4565] transition pr-12"
          placeholder="Password"
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
        />

        <button
          type="button"
          onClick={() => setShowPassword(!showPassword)}
          className="absolute right-3 top-3 text-zinc-500 hover:text-white p-1"
        >
          {showPassword ? (
            <EyeOff className="w-5 h-5" />
          ) : (
            <Eye className="w-5 h-5" />
          )}
        </button>
      </div>

      {/* Password Requirements */}
      <div className="space-y-1 pt-2">
        <p className="text-zinc-400 font-medium">
          Your password must contain at least:
        </p>
        <PasswordRequirement
          text="1 letter"
          isValid={passwordChecks.hasLetter}
        />
        <PasswordRequirement
          text="1 number or special character (example: #?1.6)"
          isValid={passwordChecks.hasNumberOrSpecial}
        />
        <PasswordRequirement
          text="10 characters"
          isValid={passwordChecks.isMinLength}
        />
      </div>

      <NextButton
        onClick={handleNext}
        loading={loading}
        text="Next"
        disabled={!isStep2Valid}
      />
    </div>
  );

  const StageThree = (
    <div className="w-full space-y-6 text-left">
      <h2 className="text-white text-xl font-bold mb-4 text-center">
        Tell us about yourself
      </h2>

      {/* Name Input */}
      <div>
        <label className="block text-white mb-1 font-medium">Name</label>
        <p className="text-sm text-zinc-400 mb-1">
          This name will appear on your profile.
        </p>
        <input
          className="w-full bg-black border border-zinc-500 p-3 rounded-md text-white placeholder-zinc-500 outline-none transition focus:border-[#fa4565]"
          placeholder="Your Full Name"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          required
        />
      </div>

      {/* Username Input */}
      <div>
        <label className="block text-white mb-1 font-medium">
          Choose a username
        </label>
        <p className="text-sm text-zinc-400 mb-1">Used for profile URL.</p>
        <input
          className="w-full bg-black border border-zinc-500 p-3 rounded-md text-white placeholder-zinc-500 outline-none focus:border-[#fa4565] transition"
          placeholder="Your unique name"
          value={form.username}
          onChange={(e) => setForm({ ...form, username: e.target.value })}
          required
        />
      </div>

      {/* Date of Birth */}
      <div>
        <label className="block text-white mb-1 font-medium ]">
          Date of birth
        </label>
        <p className="text-sm text-zinc-400 mb-2">
          Why do we need your date of birth?{" "}
          <a href="#" className="text-white underline">
            Learn more.
          </a>
        </p>
        <div className="flex gap-2">
          <input
            type="number"
            placeholder="YYYY"
            className="w-1/3 bg-black border border-zinc-500 p-3 rounded-md text-white placeholder-zinc-500 outline-none focus:border-[#fa4565"
            value={form.dob.year}
            onChange={(e) =>
              setForm({
                ...form,
                dob: { ...form.dob, year: e.target.value.slice(0, 4) },
              })
            }
            min="1900"
            max={new Date().getFullYear()}
          />
          <select
            className="w-1/3 bg-black border border-zinc-500 p-3 rounded-md text-white outline-none appearance-none"
            value={form.dob.month}
            onChange={(e) =>
              setForm({ ...form, dob: { ...form.dob, month: e.target.value } })
            }
          >
            <option value="">Month</option>
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <option key={m} value={m.toString().padStart(2, "0")}>
                {new Date(0, m, 0).toLocaleString("en", { month: "long" })}
              </option>
            ))}
          </select>
          <input
            type="number"
            placeholder="DD"
            className="w-1/3 bg-black border border-zinc-500 p-3 rounded-md text-white placeholder-zinc-500 outline-none focus:border-[#fa4565]"
            value={form.dob.day}
            onChange={(e) =>
              setForm({
                ...form,
                dob: { ...form.dob, day: e.target.value.slice(0, 2) },
              })
            }
            min="1"
            max="31"
          />
        </div>
      </div>

      {/* Gender */}
      <div>
        <label className="block text-white mb-3 font-semibold text-lg">
          Gender
        </label>

        <div className="space-y-3">
          {["Male", "Female", "Prefer not to say"].map((g) => (
            <div
              key={g}
              className="flex items-center p-3 bg-zinc-800/50 rounded-lg hover:bg-zinc-700/40 transition cursor-pointer"
              onClick={() => setForm({ ...form, gender: g })}
            >
              <input
                type="radio"
                id={g}
                name="gender"
                value={g}
                checked={form.gender === g}
                onChange={(e) => setForm({ ...form, gender: e.target.value })}
                className="w-4 h-4 text-[#fa4565] bg-zinc-900 border-zinc-600 focus:ring-[#fa4565] focus:ring-2"
                style={{ accentColor: "#fa4565" }}
              />
              <label htmlFor={g} className="ml-3 text-white text-base">
                {g}
              </label>
            </div>
          ))}
        </div>
      </div>

      <NextButton
        onClick={handleNext}
        loading={loading}
        text="Next"
        disabled={!isStep3Valid}
      />
    </div>
  );

  const StageFour = (
    <div className="w-full space-y-6 text-center">
      <h2 className="text-white text-xl font-bold mb-4">
        Confirm Your Profile
      </h2>

      {/* Error/Success Message display */}
      {error && (
        <p
          className={`text-center text-sm ${
            error.startsWith("🎉") ? "text-green-500" : "text-red-500"
          }`}
        >
          {error}
        </p>
      )}

      {/* Profile Avatar */}
      <img
        src={avatarFor(form.username || form.email)}
        alt="User Avatar"
        className="w-24 h-24 rounded-full mx-auto shadow-xl border-4"
        style={{ borderColor: ACCENT_COLOR }}
      />

      {/* Details Summary */}
      <div className="bg-zinc-900 p-6 rounded-xl space-y-3 mt-6">
        <DetailRow label="Username" value={form.username} />
        <DetailRow label="Full Name" value={form.name} />
        <DetailRow label="Email" value={form.email} />
        <DetailRow
          label="Date of Birth"
          value={`${form.dob.day}/${form.dob.month}/${form.dob.year}`}
        />
        <DetailRow label="Gender" value={form.gender} />
      </div>

      <p className="text-sm text-zinc-400 max-w-sm mx-auto">
        By clicking "Confirm & Sign Up", you agree to our Terms and Conditions
        and confirm your details are correct.
      </p>

      <NextButton
        onClick={handleSignup}
        loading={loading}
        text="Confirm & Sign Up"
      />
    </div>
  );

  // --- Main Render ---
  const isProgressBarVisible = step > 1 && step < 4;

  return (
    <div className="min-h-screen bg-black flex justify-center items-center px-4 py-12">
      <div className="max-w-sm w-full text-center">
        {/* Logo and Header */}
        <AudioWaveform
          className="w-10 h-10 mx-auto mb-8"
          style={{ color: ACCENT_COLOR }}
        />

        <div className="flex items-center justify-between mb-8">
          {step > 1 && (
            <button
              onClick={handleBack}
              className="text-white cursor-pointer hover:opacity-70 transition p-2"
            >
              <ArrowLeft />
            </button>
          )}
          <h1
            className={`text-white text-3xl font-extrabold mx-auto ${
              step === 1 ? "hidden" : ""
            }`}
          >
            Sign up
          </h1>
          <div className="w-10"> {/* Spacer */}</div>
        </div>

        {/* Progress Bar */}
        {isProgressBarVisible && (
          <div className="mb-10 w-full">
            <div className="h-1 bg-zinc-700 rounded-full overflow-hidden mb-2">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${((step - 1) / 3) * 100}%`,
                  backgroundColor: ACCENT_COLOR,
                }}
              ></div>
            </div>
            <p className="text-sm text-zinc-400 text-left">
              Step {step - 1} of 3
            </p>
          </div>
        )}

        {/* --- RENDER CURRENT STAGE --- */}
        {step === 1 && StageOne}
        {step === 2 && StageTwo}
        {step === 3 && StageThree}
        {step === 4 && StageFour}

        {/* Footer Login Link */}
        {step === 1 && (
          <p className="text-zinc-400 text-sm mt-10">
            Already have an account?
            <a
              href="/login"
              className="text-white font-semibold hover:opacity-70 transition ml-1"
            >
              Log in
            </a>
          </p>
        )}
      </div>
    </div>
  );
}

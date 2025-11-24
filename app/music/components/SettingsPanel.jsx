"use client";
import { X, User2, Palette, Globe, ShieldCheck, LogOut } from "lucide-react";

export default function SettingsPanel({ open, onClose }) {
  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[90]"
          onClick={onClose}
        />
      )}

      {/* Panel */}
      <aside
        className={`fixed top-0 right-0 h-full w-[330px] bg-[#0f0f0f] text-white 
        shadow-xl z-[100] transform transition-transform duration-300 
        ${open ? "translate-x-0" : "translate-x-full"}`}
      >
        {/* Close */}
        <div className="flex justify-end p-4">
          <button
            onClick={onClose}
            className="p-2 hover:bg-[#1c1c1c] rounded-lg transition-colors"
          >
            <X size={22} />
          </button>
        </div>

        <div className="px-6 space-y-6">
          {/* Profile Static */}
          <div className="flex items-center gap-3 p-3 bg-[#161616] rounded-xl border border-[#fa4565]/20">
            <div className="w-12 h-12 bg-[#fa4565] rounded-full flex items-center justify-center font-bold text-lg shadow-lg">
              U
            </div>
            <div>
              <h4 className="font-semibold text-white">User Name</h4>
              <p className="text-[12px] text-gray-400">Guest User</p>
            </div>
          </div>

          {/* Menu */}
          <ul className="space-y-2 border-t border-[#2a2a2a] pt-4">
            <li className="flex items-center gap-3 p-3 rounded-lg text-sm text-gray-300 hover:text-white hover:bg-[#1c1c1c] cursor-pointer transition-colors">
              <User2 /> My Account
            </li>
            <li className="flex items-center gap-3 p-3 rounded-lg text-sm text-gray-300 hover:text-white hover:bg-[#1c1c1c] cursor-pointer transition-colors">
              <Palette /> Theme
            </li>
            <li className="flex items-center gap-3 p-3 rounded-lg text-sm text-gray-300 hover:text-white hover:bg-[#1c1c1c] cursor-pointer transition-colors">
              <Globe /> Language
            </li>
            <li className="flex items-center gap-3 p-3 rounded-lg text-sm text-gray-300 hover:text-white hover:bg-[#1c1c1c] cursor-pointer transition-colors">
              <ShieldCheck /> Security
            </li>
          </ul>

          {/* Logout Button — Just UI for now */}
          <button
            onClick={() => console.log("Logout clicked")}
            className="w-full cursor-pointer flex items-center justify-center gap-2 mt-6 py-3 bg-[#fa4565] 
            hover:bg-[#ff5c79] rounded-lg font-semibold transition-colors"
          >
            <LogOut size={18} />
            Logout
          </button>
        </div>
      </aside>
    </>
  );
}

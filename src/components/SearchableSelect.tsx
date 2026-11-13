"use client";

import React, { useState, useRef, useEffect } from "react";

interface Option {
  value: string;
  label: string;
}

interface SearchableSelectProps {
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
}

export default function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = "Pilih opsi...",
  label = "Jabatan Fungsional",
}: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  // Menutup dropdown jika user mengklik area di luar komponen
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Filter opsi berdasarkan teks pencarian
  const filteredOptions = options.filter((option) =>
    option.label.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const selectedLabel = options.find((opt) => opt.value === value)?.label || placeholder;

  return (
    <div className="flex flex-col gap-2 w-full max-w-md text-white font-sans" ref={containerRef}>
      {/* Label Dropdown */}
      <label className="text-sm font-medium text-gray-200">{label}</label>

      <div className="relative w-full">
        {/* Tombol Trigger Dropdown */}
        <div
          className={`w-full px-4 py-2.5 bg-[#2b366b] border rounded-md cursor-pointer flex justify-between items-center transition-colors ${
            isOpen ? "border-yellow-500" : "border-gray-500 hover:border-gray-400"
          }`}
          onClick={() => setIsOpen(!isOpen)}
        >
          <span className="truncate">{selectedLabel}</span>
          <span className="text-[10px] text-gray-300">▼</span>
        </div>

        {/* Panel Dropdown (Opsi & Input Pencarian) */}
        {isOpen && (
          <div className="absolute z-50 w-full mt-1 bg-[#2b366b] border border-gray-500 rounded-md shadow-xl overflow-hidden">
            {/* Input Pencarian */}
            <div className="p-2 border-b border-gray-500/50">
              <input
                type="text"
                className="w-full px-3 py-2 bg-[#212a55] border border-yellow-500 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-yellow-500"
                placeholder="Ketik untuk mencari..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                autoFocus
              />
            </div>

            {/* Daftar Opsi Hasil Pencarian */}
            <ul className="max-h-56 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-400 scrollbar-track-transparent">
              {filteredOptions.length > 0 ? (
                filteredOptions.map((option) => (
                  <li
                    key={option.value}
                    className={`px-4 py-2.5 cursor-pointer text-sm transition-colors hover:bg-[#3d4c94] ${
                      value === option.value
                        ? "bg-[#3d4c94] font-semibold border-l-2 border-yellow-500"
                        : ""
                    }`}
                    onClick={() => {
                      onChange(option.value);
                      setIsOpen(false);
                      setSearchQuery("");
                    }}
                  >
                    {option.label}
                  </li>
                ))
              ) : (
                <li className="px-4 py-3 text-gray-300 text-sm italic text-center">
                  Jabatan tidak ditemukan
                </li>
              )}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

"use client";

import React, { useState, useRef, useEffect, KeyboardEvent } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";

interface Option {
  value: string;
  label: string;
}

interface JfSearchableSelectProps {
  options: Option[];
  value: string | null;
}

export function JfSearchableSelect({ options, value }: JfSearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(0); // State untuk navigasi keyboard

  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Filter opsi berdasarkan pencarian
  const filteredOptions = options.filter((option) =>
    option.label.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  // Reset highlight ke elemen pertama setiap kali pencarian berubah
  useEffect(() => {
    setHighlightedIndex(filteredOptions.length > 0 ? 0 : -1);
  }, [searchQuery, filteredOptions.length]);

  // Auto-scroll agar item yang di-highlight dengan keyboard selalu terlihat
  useEffect(() => {
    if (isOpen && highlightedIndex >= 0 && listRef.current) {
      const listElement = listRef.current;
      const activeElement = listElement.children[highlightedIndex] as HTMLElement;
      if (activeElement) {
        const listRect = listElement.getBoundingClientRect();
        const activeRect = activeElement.getBoundingClientRect();

        if (activeRect.bottom > listRect.bottom) {
          listElement.scrollTop += activeRect.bottom - listRect.bottom;
        } else if (activeRect.top < listRect.top) {
          listElement.scrollTop -= listRect.top - activeRect.top;
        }
      }
    }
  }, [highlightedIndex, isOpen]);

  // Menutup dropdown jika user klik di luar komponen
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (selectedValue: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("jf", selectedValue);
    params.delete("pelatihan"); // Hapus detail pelatihan jika JF diganti agar tidak 404

    router.push(`${pathname}?${params.toString()}`);
    setIsOpen(false);
    setSearchQuery("");
  };

  // Fungsi untuk menangani penekanan tombol di keyboard
  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen) {
      if (e.key === "Enter" || e.key === "ArrowDown") setIsOpen(true);
      return;
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setHighlightedIndex((prev) => (prev < filteredOptions.length - 1 ? prev + 1 : prev));
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : 0));
        break;
      case "Enter":
        e.preventDefault();
        const selectedOption = filteredOptions[highlightedIndex];
        if (selectedOption) {
          handleSelect(selectedOption.value);
        }
        break;
      case "Escape":
        setIsOpen(false);
        break;
    }
  };

  const selectedLabel =
    options.find((opt) => opt.value === value)?.label || "Pilih Jabatan Fungsional...";

  return (
    <div className="relative w-full max-w-lg font-sans" ref={containerRef}>
      {/* Tombol Trigger */}
      <div
        className={`flex w-full cursor-pointer items-center justify-between rounded-md border bg-[#0f172a] px-4 py-2 text-sm text-gray-200 transition-all ${
          isOpen
            ? "border-blue-500 ring-1 ring-blue-500"
            : "border-slate-600 hover:border-slate-400"
        }`}
        onClick={() => setIsOpen(!isOpen)}
        tabIndex={0} // Agar bisa di-focus dengan tombol Tab
        onKeyDown={(e) => {
          if (e.key === "Enter" && !isOpen) setIsOpen(true);
        }}
      >
        <span className="truncate">{selectedLabel}</span>
        <span className="ml-2 text-[10px] text-gray-400">▼</span>
      </div>

      {/* Panel Dropdown */}
      {isOpen && (
        <div className="absolute top-full z-[100] mt-1 w-full overflow-hidden rounded-md border border-slate-600 bg-[#0f172a] text-slate-200 shadow-2xl">
          {/* Input Pencarian */}
          <div className="border-b border-slate-700 p-2">
            <input
              type="text"
              className="flex w-full rounded-md border border-slate-600 bg-[#1e293b] px-3 py-2 text-sm text-white shadow-inner placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="Cari jabatan..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              autoFocus
            />
          </div>

          {/* Daftar Opsi */}
          <ul
            ref={listRef}
            className="max-h-64 overflow-y-auto py-1 scrollbar-thin scrollbar-thumb-slate-500 scrollbar-track-transparent"
          >
            {filteredOptions.length > 0 ? (
              filteredOptions.map((option, index) => (
                <li
                  key={option.value}
                  className={`relative flex cursor-pointer select-none items-center px-4 py-2.5 text-sm transition-colors ${
                    highlightedIndex === index ? "bg-blue-600 text-white" : "hover:bg-slate-800"
                  } ${value === option.value ? "font-semibold text-white" : ""}`}
                  onClick={() => handleSelect(option.value)}
                  onMouseEnter={() => setHighlightedIndex(index)}
                >
                  {option.label}
                </li>
              ))
            ) : (
              <li className="px-4 py-4 text-center text-sm italic text-slate-400">
                Jabatan tidak ditemukan
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

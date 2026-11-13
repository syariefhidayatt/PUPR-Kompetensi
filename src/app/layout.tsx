import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Sistem Kompetensi & Pelatihan", template: "%s · Kompetensi & Pelatihan" },
  description: "Pembinaan kompetensi Jabatan Fungsional: program, pelatihan, matriks, dan learning path.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}

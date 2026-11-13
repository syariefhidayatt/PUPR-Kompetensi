"use client";

import {
  Award,
  BookOpenCheck,
  Briefcase,
  Building,
  Building2,
  CalendarRange,
  ClipboardCheck,
  ClipboardList,
  FileSpreadsheet,
  GraduationCap,
  Grid3x3,
  Landmark,
  Layers,
  LayoutDashboard,
  ListChecks,
  Medal,
  Network,
  Route,
  Workflow,
  School,
  Send,
  UserCheck,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { pilihAktif } from "./nav-active";

type Icon = React.ComponentType<{ className?: string }>;
type NavItem = { href: string; label: string; icon: Icon; perm?: string };

// Menu tampil hanya bila user punya permission-nya. Perubahan role/permission baru berlaku setelah login ulang.
const NAV: { group: string; items: NavItem[] }[] = [
  { group: "Umum", items: [{ href: "/", label: "Beranda", icon: LayoutDashboard }] },
  {
    group: "Pengelolaan",
    items: [
      {
        href: "/pengelolaan/kebutuhan",
        label: "Kebutuhan Pelatihan",
        icon: ClipboardList,
        perm: "kebutuhan.view",
      },
      {
        href: "/pengelolaan/batch",
        label: "Batch Pelatihan",
        icon: CalendarRange,
        perm: "batch.view",
      },
      {
        href: "/pengelolaan/usulan",
        label: "List Daftar Usulan Peserta",
        icon: Send,
        perm: "usulan.view",
      },
      {
        href: "/pengelolaan/kehadiran",
        label: "Verifikasi Kehadiran",
        icon: ClipboardCheck,
        perm: "kehadiran.view",
      },
      {
        href: "/pengelolaan/rekap",
        label: "Rekap Peserta",
        icon: FileSpreadsheet,
        perm: "rekap.view",
      },
    ],
  },
  {
    group: "Learning Path",
    items: [
      { href: "/pelatihan/learning-path", label: "Learning Path", icon: Route },
      {
        href: "/pelatihan/skema",
        label: "Skema Pelatihan",
        icon: Workflow,
        perm: "pelatihan.view",
      },
    ],
  },

  {
    group: "Master",
    items: [
      { href: "/master/instansi", label: "Instansi", icon: Building2, perm: "instansi.view" },
      {
        href: "/master/unit-organisasi",
        label: "Unit Organisasi",
        icon: Landmark,
        perm: "unit_organisasi.view",
      },
      { href: "/master/unit-kerja", label: "Unit Kerja", icon: Network, perm: "unit_kerja.view" },
      {
        href: "/master/sertifikasi",
        label: "Jenis Sertifikasi",
        icon: Award,
        perm: "sertifikasi.view",
      },
      {
        href: "/master/jenis-kompetensi",
        label: "Jenis Kompetensi",
        icon: ListChecks,
        perm: "jenis_kompetensi.view",
      },
      { href: "/master/jenjang", label: "Jenjang Jabatan", icon: Layers, perm: "jenjang.view" },
      { href: "/master/jf", label: "Jabatan Fungsional", icon: Briefcase, perm: "jf.view" },
      {
        href: "/master/kompetensi",
        label: "Kompetensi",
        icon: BookOpenCheck,
        perm: "kompetensi.view",
      },
      {
        href: "/master/penyelenggara",
        label: "Penyelenggara",
        icon: Building,
        perm: "penyelenggara.view",
      },
    ],
  },

  {
    group: "Program Bangkom",
    items: [
      {
        href: "/program/bangkom",
        label: "Program",
        icon: GraduationCap,
        perm: "program_bangkom.view",
      },
      { href: "/pelatihan", label: "Pelatihan", icon: GraduationCap, perm: "pelatihan.view" },
      {
        href: "/pelatihan/matriks",
        label: "Matriks Pelatihan",
        icon: Grid3x3,
        perm: "pelatihan.view",
      },
    ],
  },

  {
    group: "Kepegawaian",
    items: [
      { href: "/kepegawaian/pegawai", label: "Pegawai", icon: Users, perm: "pegawai.view" },
      {
        href: "/master/status-pegawai",
        label: "Status Pegawai",
        icon: UserCheck,
        perm: "status_pegawai.view",
      },
      { href: "/master/pendidikan", label: "Pendidikan", icon: School, perm: "pendidikan.view" },
      { href: "/master/golongan", label: "Golongan", icon: Medal, perm: "golongan.view" },
    ],
  },
];

export function NavList({
  permissions,
  onNavigate,
}: {
  permissions: string[];
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const groups = NAV.map((g) => ({
    ...g,
    items: g.items.filter((i) => !i.perm || permissions.includes(i.perm)),
  })).filter((g) => g.items.length > 0);
  const aktif = pilihAktif(
    pathname,
    groups.flatMap((g) => g.items.map((i) => i.href)),
  );
  const aktifRef = useRef<HTMLAnchorElement | null>(null);
  // Sidebar punya scroll sendiri (sticky); pastikan menu aktif selalu terlihat setelah berpindah halaman.
  useEffect(() => {
    aktifRef.current?.scrollIntoView({ block: "nearest" });
  }, [aktif]);

  return (
    <nav aria-label="Menu utama" className="space-y-5">
      {groups.map((section) => (
        <div key={section.group}>
          <p className="px-2 pb-1 text-xs uppercase tracking-wide opacity-60">{section.group}</p>
          <ul className="space-y-0.5">
            {section.items.map(({ href, label, icon: Icon }) => (
              <li key={href}>
                <Link
                  href={href}
                  ref={href === aktif ? aktifRef : null}
                  onClick={onNavigate}
                  aria-current={href === aktif ? "page" : undefined}
                  className={`flex items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-white/10 ${href === aktif ? "bg-white/15 font-medium" : ""}`}
                >
                  <Icon className="size-4" />
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}

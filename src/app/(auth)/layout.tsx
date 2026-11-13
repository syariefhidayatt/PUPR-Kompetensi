export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-screen items-start justify-center p-4 md:p-10">{children}</div>;
}

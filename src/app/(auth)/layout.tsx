// Layout minimo de las paginas de auth (sin marca; el shell con marca es B3).
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 p-6">
      {children}
    </main>
  );
}

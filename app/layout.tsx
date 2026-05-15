import "./globals.css";
import { ThemeScript } from "@/features/theme/ThemeScript";
import { AuthProvider } from "@/features/auth/AuthProvider";
import { QueryProvider } from "@/providers/QueryProvider";
import { AppToaster } from "@/providers/AppToaster";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark antialiased" suppressHydrationWarning>
      <body className="min-h-screen bg-surface text-ink">
        <ThemeScript />
        <QueryProvider>
          <AuthProvider>{children}</AuthProvider>
          <AppToaster />
        </QueryProvider>
      </body>
    </html>
  );
}


import type { Metadata } from "next";
import Link from "next/link";
import { getAdminSession } from "@/lib/authServer";
import "./globals.css";

export const metadata: Metadata = {
  title: "Job Application Accountability Tracker",
  description: "Track applications and follow-up tasks in one place",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getAdminSession();

  return (
    <html lang="en">
      <body>
        <header className="topbar">
          <div className="container topbar-inner">
            <h1>Job Accountability Tracker</h1>
            {session ? (
              <nav>
                <Link href="/">Dashboard</Link>
                <Link href="/applications">Applications</Link>
                <Link href="/tasks">Tasks</Link>
                <Link href="/review">Review Queue</Link>
                <Link href="/settings" aria-label="Settings" title="Settings">
                  <span aria-hidden="true">⚙</span>
                </Link>
                <form action="/api/auth/logout" method="post" className="sign-out-form">
                  <button type="submit" className="nav-button">
                    Sign out
                  </button>
                </form>
              </nav>
            ) : (
              <nav>
                <Link href="/login">Admin Mode</Link>
              </nav>
            )}
          </div>
        </header>
        <main className="container">{children}</main>
      </body>
    </html>
  );
}

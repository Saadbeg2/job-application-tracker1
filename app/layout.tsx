import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Job Application Accountability Tracker",
  description: "Track applications and follow-up tasks in one place",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <header className="topbar">
          <div className="container topbar-inner">
            <h1>Job Accountability Tracker</h1>
            <nav>
              <Link href="/">Dashboard</Link>
              <Link href="/applications">Applications</Link>
              <Link href="/tasks">Tasks</Link>
            </nav>
          </div>
        </header>
        <main className="container">{children}</main>
      </body>
    </html>
  );
}

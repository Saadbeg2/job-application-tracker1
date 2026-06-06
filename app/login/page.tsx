import Link from "next/link";
import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/authServer";

type LoginPageProps = {
  searchParams: Promise<{
    error?: string;
    next?: string;
  }>;
};

function errorMessage(error: string | undefined) {
  if (error === "not_admin") return "That Google account is not allowed to access this app.";
  if (error === "missing_config") return "Authentication is not configured yet.";
  if (error === "oauth") return "Google sign-in failed. Try again.";
  return null;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const session = await getAdminSession();
  const params = await searchParams;
  const next = params.next && params.next.startsWith("/") ? params.next : "/";

  if (session) redirect(next);

  const message = errorMessage(params.error);
  const loginHref = `/api/auth/login?next=${encodeURIComponent(next)}`;

  return (
    <section className="login-page">
      <div className="card login-card stack">
        <div className="stack compact-stack">
          <h2>Admin Login</h2>
          <p className="muted">Sign in with the approved Google account to access the tracker.</p>
        </div>

        {message ? <p className="error">{message}</p> : null}

        <Link className="primary login-button" href={loginHref}>
          Continue with Google
        </Link>
      </div>
    </section>
  );
}


import { useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const { user, login, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const nextPath = location.state?.from || "/";

  if (user) {
    return <Navigate to={nextPath} replace />;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setError("");

    const result = await login(email, password);

    if (result.success) {
      navigate(nextPath, { replace: true });
    } else {
      setError(result.error || "Login failed");
    }

    setSubmitting(false);
  }

  if (authLoading) {
    return <div className="page-message">Loading...</div>;
  }

  return (
    <div className="page-stack login-page">
      <div className="login-card">
        <h1>Login to Inventory</h1>
        <p>Sign in with your assigned account. Paused accounts cannot access the system.</p>
        {error ? <div className="page-message error">{error}</div> : null}
        <form onSubmit={handleSubmit}>
          <input
            className="input"
            type="email"
            placeholder="Email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
          <input
            className="input"
            type="password"
            placeholder="Password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
          <button className="button dark full" type="submit" disabled={submitting}>
            {submitting ? "Logging in..." : "Login"}
          </button>
        </form>
      </div>
    </div>
  );
}

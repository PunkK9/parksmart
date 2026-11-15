import { useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import api, { errMsg } from "../api";
import { useAuth } from "../auth.jsx";
import AuthHero from "../components/AuthHero.jsx";

export default function Login() {
  const { user, login } = useAuth();
  const nav = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [unverified, setUnverified] = useState(false);
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to="/" replace />;

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setInfo("");
    setUnverified(false);
    setBusy(true);
    try {
      await login(form.email, form.password);
      nav("/");
    } catch (err) {
      setError(errMsg(err));
      setUnverified(err.response?.data?.code === "EMAIL_NOT_VERIFIED");
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    try {
      const { data } = await api.post("/auth/resend-verification", { email: form.email });
      setInfo(data.emailSent ? "A new verification email is on its way." : "Couldn't send the email. Check the backend EMAIL settings.");
    } catch (err) {
      setInfo(errMsg(err));
    }
  };

  return (
    <div className="auth">
      <AuthHero />
      <div className="auth-form-wrap">
        <div className="auth-card">
          <div className="brand" style={{ marginBottom: 28 }}>
            <div className="brand-mark">O</div>
            <div className="brand-text">
              <span className="brand-title">Orbit</span>
              <span className="brand-tag">Autonomous Access Portal</span>
            </div>
          </div>
          <h2>Welcome back</h2>
          <p className="muted">Log in to book a slot.</p>

          {location.state?.verified && !error && (
            <div className="notice notice-ok">Email verified. You can log in now.</div>
          )}
          {error && (
            <div className={`notice ${unverified ? "notice-warn" : "notice-error"}`}>
              <div>
                {error}
                {unverified && (
                  <div style={{ marginTop: 8 }}>
                    <button type="button" className="btn btn-sm" onClick={resend}>Resend verification email</button>
                  </div>
                )}
              </div>
            </div>
          )}
          {info && <div className="notice notice-info">{info}</div>}

          <form onSubmit={submit}>
            <div className="field">
              <label htmlFor="email">Email</label>
              <input id="email" type="email" value={form.email} onChange={set("email")} placeholder="you@gmail.com" required />
            </div>
            <div className="field">
              <label htmlFor="password">Password</label>
              <input id="password" type="password" value={form.password} onChange={set("password")} required />
            </div>
            <button className="btn btn-primary btn-block" disabled={busy}>
              {busy ? <Loader2 size={18} className="spin" /> : "Log in"}
            </button>
          </form>
          <p className="auth-foot">
            New here? <Link to="/register">Create an account</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

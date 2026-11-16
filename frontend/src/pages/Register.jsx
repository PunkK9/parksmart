import { useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { AlertTriangle, Loader2, Mail } from "lucide-react";
import api, { errMsg } from "../api";
import { useAuth } from "../auth.jsx";
import AuthHero from "../components/AuthHero.jsx";

export default function Register() {
  const { user } = useAuth();
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "student" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null); // { email, emailSent }
  const [resendMsg, setResendMsg] = useState("");

  if (user) return <Navigate to="/" replace />;

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const { data } = await api.post("/auth/register", form);
      setDone({ email: data.email, emailSent: data.emailSent, devLink: data.devLink });
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    setResendMsg("");
    try {
      const { data } = await api.post("/auth/resend-verification", { email: done.email });
      setResendMsg(data.emailSent ? "Sent again. Check your inbox." : "Couldn't send the email. Check the backend EMAIL settings.");
      if (data.devLink) setDone((prev) => ({ ...prev, devLink: data.devLink }));
    } catch (err) {
      setResendMsg(errMsg(err));
    }
  };

  return (
    <div className="auth">
      <AuthHero />
      <div className="auth-form-wrap">
        <div className="auth-card">
          {done ? (
            <div className="status-screen">
              <div className={`status-icon ${done.emailSent ? "info" : "bad"}`}>
                {done.emailSent ? <Mail size={30} /> : <AlertTriangle size={30} />}
              </div>
              <h2>{done.emailSent ? "Check your email" : "Account created"}</h2>
              <p className="muted">
                {done.emailSent ? (
                  <>
                    We sent a verification link to <b>{done.email}</b>. Open it to activate your account, then log in. The link
                    expires in 24 hours.
                  </>
                ) : (
                  "We couldn't send the verification email. Try Resend below. If it keeps failing, the Gmail settings in the backend .env need fixing."
                )}
              </p>
              {done.devLink && (
                <div className="notice notice-ok" style={{ marginTop: 12, textAlign: "left" }}>
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>Direct verification link (Dev/Testing):</div>
                  <a href={done.devLink} style={{ color: "#2563eb", textDecoration: "underline", wordBreak: "break-all" }}>
                    Click here to verify {done.email} immediately &rarr;
                  </a>
                </div>
              )}
              {resendMsg && <div className="notice notice-info">{resendMsg}</div>}
              <button className="btn btn-block" onClick={resend}>Resend email</button>
              <p className="auth-foot">
                Verified already? <Link to="/login">Log in</Link>
              </p>
            </div>
          ) : (
            <>
              <div className="brand" style={{ marginBottom: 28 }}>
                <div className="brand-mark">O</div>
                <div className="brand-text">
                  <span className="brand-title">Orbit</span>
                  <span className="brand-tag">Smart Parking</span>
                </div>
              </div>
              <h2>Create your account</h2>
              <p className="muted">We'll email you a link to verify your address.</p>

              {error && <div className="notice notice-error">{error}</div>}

              <form onSubmit={submit}>
                <div className="field">
                  <label htmlFor="name">Full name</label>
                  <input id="name" value={form.name} onChange={set("name")} placeholder="Pankaj Kumar" required />
                </div>
                <div className="field">
                  <label htmlFor="email">Email</label>
                  <input id="email" type="email" value={form.email} onChange={set("email")} placeholder="you@gmail.com" required />
                </div>
                <div className="form-row">
                  <div className="field">
                    <label htmlFor="password">Password</label>
                    <input id="password" type="password" value={form.password} onChange={set("password")} placeholder="At least 6 characters" minLength={6} required />
                  </div>
                  <div className="field">
                    <label htmlFor="role">I am a</label>
                    <select id="role" value={form.role} onChange={set("role")}>
                      <option value="student">Student</option>
                      <option value="staff">Staff</option>
                    </select>
                  </div>
                </div>
                <button className="btn btn-primary btn-block" disabled={busy}>
                  {busy ? <Loader2 size={18} className="spin" /> : "Sign up"}
                </button>
              </form>
              <p className="auth-foot">
                Already have an account? <Link to="/login">Log in</Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

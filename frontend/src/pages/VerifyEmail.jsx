import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import api, { errMsg } from "../api";
import AuthHero from "../components/AuthHero.jsx";

// The link in the email opens this page: /verify-email?token=...
export default function VerifyEmail() {
  const [params] = useSearchParams();
  const nav = useNavigate();
  const [state, setState] = useState({ status: "loading", message: "" });
  const ran = useRef(false); // React StrictMode runs effects twice in dev; the token is single-use

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    const token = params.get("token");
    if (!token) {
      setState({ status: "error", message: "This link is missing its verification token." });
      return;
    }
    api
      .post("/auth/verify-email", { token })
      .then(({ data }) => {
        setState({ status: "ok", message: data.message });
        setTimeout(() => nav("/login", { state: { verified: true } }), 2500);
      })
      .catch((err) => setState({ status: "error", message: errMsg(err) }));
  }, [params, nav]);

  return (
    <div className="auth">
      <AuthHero />
      <div className="auth-form-wrap">
        <div className="auth-card status-screen">
          {state.status === "loading" && (
            <>
              <div className="status-icon info"><Loader2 size={30} className="spin" /></div>
              <h2>Verifying your email…</h2>
            </>
          )}
          {state.status === "ok" && (
            <>
              <div className="status-icon ok"><CheckCircle2 size={32} /></div>
              <h2>Email verified</h2>
              <p className="muted">{state.message} Taking you to the login page…</p>
              <Link className="btn btn-primary btn-block" to="/login" state={{ verified: true }}>Log in now</Link>
            </>
          )}
          {state.status === "error" && (
            <>
              <div className="status-icon bad"><XCircle size={32} /></div>
              <h2>Couldn't verify</h2>
              <p className="muted">{state.message}</p>
              <Link className="btn btn-block" to="/login">Back to login</Link>
              <p className="auth-foot">On the login page you can request a new link.</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

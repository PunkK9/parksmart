import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  BarChart3,
  Bot,
  CalendarCheck,
  LogOut,
  Moon,
  ParkingSquare,
  ScanLine,
  Settings2,
  ShieldCheck,
  Sun,
  User,
} from "lucide-react";
import { useAuth } from "../auth.jsx";
import { useTheme } from "../ThemeContext.jsx";
import { FACILITY_NAME } from "../config";

export default function Layout() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme, isDark } = useTheme();
  const nav = useNavigate();

  const links = [
    { to: "/", label: "Book a Bay", icon: ParkingSquare, end: true },
    { to: "/bookings", label: "My Passes & QR", icon: CalendarCheck },
    { to: "/assistant", label: "AI Assistant", icon: Bot },
  ];
  if (user?.role === "admin" || user?.role === "staff") {
    links.push({ to: "/gate", label: "Gate Desk", icon: ScanLine });
  }
  if (user?.role === "admin") {
    links.push({ to: "/analytics", label: "Live Analytics", icon: BarChart3 });
    links.push({ to: "/manage", label: "Admin Control", icon: Settings2 });
  }

  return (
    <div className="app">
      {/* Desktop Spatial Glass Sidebar */}
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">O</div>
          <div className="brand-text">
            <span className="brand-title">Orbit</span>
            <span className="brand-tag">Spatial Telemetry Grid</span>
          </div>
        </div>

        <nav className="nav">
          {links.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) => (isActive ? "active" : "")}
            >
              <Icon size={18} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="userbox">
          <div className="avatar">
            {user?.name?.[0]?.toUpperCase() || <User size={16} />}
          </div>
          <div className="userbox-text">
            <strong>{user?.name}</strong>
            <span className={`userbox-role-badge role-${user?.role || "student"}`}>
              {user?.role}
            </span>
          </div>
          <button
            className="icon-btn"
            title="Log out"
            aria-label="Log out"
            onClick={() => {
              logout();
              nav("/login");
            }}
          >
            <LogOut size={16} />
          </button>
        </div>
      </aside>

      {/* Main Stage & Top HUD */}
      <div className="main">
        <header className="topbar">
          <div className="topbar-left">
            <div className="facility-indicator">
              <span className="pulse-beacon" />
              <span>{FACILITY_NAME}</span>
            </div>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                fontSize: 11,
                padding: "2px 8px",
                borderRadius: 9999,
                background: "var(--brand-soft)",
                color: "var(--brand)",
                border: "1px solid var(--brand-border)",
                fontWeight: 700,
              }}
            >
              <ShieldCheck size={12} /> Spatial Node
            </span>
          </div>

          <div className="topbar-right">
            {/* Theme Toggle Button */}
            <button
              className="icon-btn"
              onClick={toggleTheme}
              title={`Switch to ${isDark ? "Light" : "Dark"} mode`}
              aria-label="Toggle visual theme"
            >
              {isDark ? <Sun size={17} /> : <Moon size={17} />}
            </button>
          </div>
        </header>

        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

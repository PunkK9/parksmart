import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  BarChart3,
  Bot,
  CalendarCheck,
  LogOut,
  Moon,
  ParkingSquare,
  ScanLine,
  Search,
  Settings2,
  Sun,
} from "lucide-react";
import { useAuth } from "../auth.jsx";
import { useTheme } from "../ThemeContext.jsx";

export default function Layout() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme, isDark } = useTheme();
  const nav = useNavigate();

  // `short` is the label in the phone tab bar, where six tabs share ~375px.
  const links = [
    { to: "/", label: "Book a Bay", short: "Book", icon: ParkingSquare, end: true },
    { to: "/bookings", label: "My Bookings", short: "Bookings", icon: CalendarCheck },
    { to: "/assistant", label: "Assistant", short: "Ask", icon: Bot },
  ];
  if (user?.role === "admin" || user?.role === "staff") {
    links.push({ to: "/gate", label: "Gate Desk", short: "Gate", icon: ScanLine });
  }
  if (user?.role === "admin") {
    links.push({ to: "/analytics", label: "Analytics", short: "Stats", icon: BarChart3 });
    links.push({ to: "/manage", label: "Manage Bays", short: "Manage", icon: Settings2 });
  }

  const doLogout = () => {
    logout();
    nav("/login");
  };

  const searchBay = (e) => {
    e.preventDefault();
    const q = new FormData(e.currentTarget).get("bay")?.toString().trim();
    if (q) nav(`/?bay=${encodeURIComponent(q)}`);
  };

  return (
    <div className="app as-app">
      {/* Mac App Store-style sidebar */}
      <aside className="as-sidebar">
        <NavLink to="/" className="as-brand" aria-label="Orbit home">
          <span className="as-brand-icon">O</span>
          <span>Orbit</span>
        </NavLink>

        <form className="as-search" onSubmit={searchBay} role="search">
          <Search size={15} />
          <input name="bay" placeholder="Search bays" aria-label="Search bays" />
        </form>

        <nav className="as-nav" aria-label="Main">
          {links.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} className={({ isActive }) => (isActive ? "active" : "")}>
              <Icon size={18} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="as-account">
          <div className="as-avatar">{user?.name?.[0]?.toUpperCase() || "?"}</div>
          <div className="as-account-text">
            <strong>{user?.name}</strong>
            <span>{user?.role}</span>
          </div>
          <button
            className="icon-btn"
            onClick={toggleTheme}
            title={`Switch to ${isDark ? "light" : "dark"} mode`}
            aria-label="Toggle light and dark mode"
          >
            {isDark ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          <button className="icon-btn" title="Log out" aria-label="Log out" onClick={doLogout}>
            <LogOut size={16} />
          </button>
        </div>
      </aside>

      <div className="as-main">
        {/* Phones: slim top bar (the sidebar is hidden) */}
        <header className="as-topbar">
          <NavLink to="/" className="as-brand" aria-label="Orbit home">
            <span className="as-brand-icon">O</span>
            <span>Orbit</span>
          </NavLink>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="icon-btn" onClick={toggleTheme} aria-label="Toggle light and dark mode">
              {isDark ? <Sun size={16} /> : <Moon size={16} />}
            </button>
            <button className="icon-btn" aria-label="Log out" onClick={doLogout}>
              <LogOut size={16} />
            </button>
          </div>
        </header>

        <main className="content">
          <Outlet />
        </main>
      </div>

      {/* iOS-style tab bar on phones */}
      <nav className="mobile-nav" aria-label="Main">
        {links.map(({ to, short, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end} className={({ isActive }) => (isActive ? "active" : "")}>
            <Icon size={22} />
            <span>{short}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

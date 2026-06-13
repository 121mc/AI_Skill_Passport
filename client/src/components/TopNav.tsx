import { Library, ListChecks, Settings, Share2, Sparkles } from "lucide-react";
import { NavLink } from "react-router-dom";

const links = [
  { to: "/", label: "Library", icon: Library },
  { to: "/task", label: "Task", icon: Sparkles },
  { to: "/timeline", label: "Timeline", icon: ListChecks },
  { to: "/settings", label: "Settings", icon: Settings }
];

export function TopNav() {
  return (
    <header className="top-nav">
      <NavLink to="/" className="brand" aria-label="AI Skill Passport home">
        <Share2 size={22} />
        <span>AI Skill Passport</span>
      </NavLink>
      <nav aria-label="Primary">
        {links.map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} className={({ isActive }) => (isActive ? "active" : "")}>
            <Icon size={18} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
    </header>
  );
}

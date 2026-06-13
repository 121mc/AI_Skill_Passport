import { Library, ListChecks, Settings, Share2, Sparkles } from "lucide-react";
import { NavLink } from "react-router-dom";

const links = [
  { to: "/", label: "卡片库", icon: Library },
  { to: "/task", label: "任务生成", icon: Sparkles },
  { to: "/timeline", label: "时间线", icon: ListChecks },
  { to: "/settings", label: "设置", icon: Settings }
];

export function TopNav() {
  return (
    <header className="top-nav">
      <NavLink to="/" className="brand" aria-label="AI 技能护照首页">
        <Share2 size={22} />
        <span>AI 技能护照</span>
      </NavLink>
      <nav aria-label="主导航">
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

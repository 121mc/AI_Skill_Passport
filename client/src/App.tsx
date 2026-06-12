import { BrowserRouter, Route, Routes } from "react-router-dom";
import { TopNav } from "./components/TopNav";
import { CardDetail } from "./pages/CardDetail";
import { Dashboard } from "./pages/Dashboard";
import { Settings } from "./pages/Settings";
import { SharePreview } from "./pages/SharePreview";
import { TaskComposer } from "./pages/TaskComposer";
import { Timeline } from "./pages/Timeline";
import "./styles/app.css";

export function App() {
  return (
    <BrowserRouter>
      <div className="app-shell">
        <TopNav />
        <main>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/cards/:cardId" element={<CardDetail />} />
            <Route path="/task" element={<TaskComposer />} />
            <Route path="/timeline" element={<Timeline />} />
            <Route path="/share/:shareId" element={<SharePreview />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

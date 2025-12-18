import { Outlet, Link, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  BookOpen,
  CheckSquare,
  RotateCcw,
  Settings,
  Sparkles,
} from "lucide-react";
import { cn } from "../lib/utils";

interface NavItem {
  name: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
}

const navItems: NavItem[] = [
  { name: "Dashboard", path: "/", icon: LayoutDashboard },
  { name: "Library", path: "/library", icon: BookOpen },
  { name: "Tasks", path: "/tasks", icon: CheckSquare },
  { name: "Review", path: "/review", icon: RotateCcw },
  { name: "Settings", path: "/settings", icon: Settings },
];

const pageNames: Record<string, string> = {
  "/": "Dashboard",
  "/library": "Library",
  "/tasks": "Tasks",
  "/review": "Review",
  "/settings": "Settings",
};

export default function Layout() {
  const location = useLocation();
  const currentPageName = pageNames[location.pathname] || "MindLoop";

  return (
    <div className="flex h-screen bg-transparent">
      {/* 悬浮式极简侧边栏 */}
      <motion.aside
        className="group relative z-50 flex flex-col border-r border-white/10 bg-white/5 backdrop-blur-xl transition-all duration-300 ease-out w-16 hover:w-56"
      >
        {/* Logo 区域 - 可拖拽 */}
        <div
          data-tauri-drag-region
          className="h-14 flex items-center justify-center px-4 border-b border-white/10 cursor-move"
        >
          <motion.div
            className="flex items-center gap-3"
            whileHover={{ scale: 1.02 }}
          >
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg shadow-purple-500/25">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <span className="text-lg font-semibold text-white opacity-0 group-hover:opacity-100 transition-opacity duration-300 whitespace-nowrap">
              MindLoop
            </span>
          </motion.div>
        </div>

        {/* 导航菜单 */}
        <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto overflow-x-hidden">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className="block"
              >
                <motion.div
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200",
                    {
                      "bg-white/15 text-white shadow-lg shadow-black/10": isActive,
                      "text-white/60 hover:bg-white/10 hover:text-white": !isActive,
                    }
                  )}
                  whileHover={{ x: 4 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Icon className="w-5 h-5 flex-shrink-0" />
                  <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 whitespace-nowrap">
                    {item.name}
                  </span>
                </motion.div>
              </Link>
            );
          })}
        </nav>

        {/* 底部版本信息 */}
        <div className="px-4 py-3 border-t border-white/10">
          <p className="text-xs text-white/30 opacity-0 group-hover:opacity-100 transition-opacity duration-300 whitespace-nowrap">
            MindLoop v2.0
          </p>
        </div>
      </motion.aside>

      {/* 主内容区 */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* 顶部动态岛/面包屑 - 可拖拽 */}
        <header
          data-tauri-drag-region
          className="h-12 flex items-center justify-between px-6 border-b border-white/10 bg-white/5 backdrop-blur-xl cursor-move"
        >
          <div className="flex items-center gap-2">
            <motion.h2
              key={currentPageName}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-sm font-medium text-white/80"
            >
              {currentPageName}
            </motion.h2>
          </div>
          
          {/* 窗口控制占位（macOS 红绿灯在左上角，这里留空） */}
          <div className="w-20" />
        </header>

        {/* 页面内容区 */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="h-full"
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}

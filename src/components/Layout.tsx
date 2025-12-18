import { Outlet, Link, useLocation } from "react-router-dom";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  BookOpen,
  CheckSquare,
  RotateCcw,
  Settings,
  ChevronLeft,
  ChevronRight,
  Clock,
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
  { name: "Archives", path: "/archives", icon: Clock },
  { name: "Settings", path: "/settings", icon: Settings },
];

const pageNames: Record<string, string> = {
  "/": "仪表盘",
  "/library": "笔记库",
  "/tasks": "待办事项",
  "/review": "复习",
  "/archives": "复习历史",
  "/settings": "设置",
};

export default function Layout() {
  const location = useLocation();
  const [isExpanded, setIsExpanded] = useState(false);

  const currentPageName = pageNames[location.pathname] || "MindLoop";

  return (
    <div className="flex h-screen w-full overflow-hidden bg-slate-50/80">
      {/* 侧边栏 */}
      <motion.aside
        className={cn(
          "relative h-full flex-shrink-0 flex flex-col",
          "sidebar-bg",
          "border-r border-slate-200/60"
        )}
        initial={false}
        animate={{
          width: isExpanded ? 200 : 64,
        }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        onMouseEnter={() => setIsExpanded(true)}
        onMouseLeave={() => setIsExpanded(false)}
      >
        {/* 顶部安全区域 - 为红绿灯按钮留空间 */}
        <div
          className="h-8 flex-shrink-0"
          data-tauri-drag-region
        />

        {/* Logo 区域 */}
        <div
          className="h-14 flex items-center px-4 border-b border-slate-200/40"
          data-tauri-drag-region
        >
          <motion.div
            className="flex items-center gap-3"
            initial={false}
            animate={{ opacity: 1 }}
          >
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center flex-shrink-0 shadow-soft">
              <span className="text-white font-bold text-sm">M</span>
            </div>
            <AnimatePresence>
              {isExpanded && (
                <motion.span
                  className="text-slate-800 font-semibold text-lg whitespace-nowrap"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  transition={{ duration: 0.15 }}
                >
                  MindLoop
                </motion.span>
              )}
            </AnimatePresence>
          </motion.div>
        </div>

        {/* 导航菜单 */}
        <nav className="flex-1 px-2 py-4 space-y-1 overflow-hidden">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
                  isActive
                    ? "bg-indigo-50 text-indigo-700"
                    : "text-slate-600 hover:bg-slate-100/80 hover:text-slate-900"
                )}
              >
                <Icon className={cn(
                  "w-5 h-5 flex-shrink-0",
                  isActive ? "text-indigo-600" : ""
                )} />
                <AnimatePresence>
                  {isExpanded && (
                    <motion.span
                      className="whitespace-nowrap"
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -10 }}
                      transition={{ duration: 0.15 }}
                    >
                      {item.name}
                    </motion.span>
                  )}
                </AnimatePresence>
              </Link>
            );
          })}
        </nav>

        {/* 展开/收起指示器 */}
        <div className="px-3 py-4 border-t border-slate-200/40">
          <div className="flex items-center justify-center text-slate-400">
            {isExpanded ? (
              <ChevronLeft className="w-4 h-4" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
          </div>
        </div>
      </motion.aside>

      {/* 主内容区 */}
      <main className="flex-1 min-w-0 flex flex-col overflow-hidden main-content-bg">
        {/* 顶部导航栏 */}
        <header
          className="h-14 flex items-center justify-between px-6 border-b border-slate-200/40 bg-white/60"
          data-tauri-drag-region
        >
          {/* 左侧留空给红绿灯 */}
          <div className="w-20" data-tauri-drag-region />
          
          <div className="flex items-center gap-4" data-tauri-drag-region>
            {/* 当前页面指示器 */}
            <motion.div
              className="bg-slate-100/80 px-4 py-1.5 rounded-full"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              key={location.pathname}
            >
              <span className="text-sm font-medium text-slate-700">
                {currentPageName}
              </span>
            </motion.div>
          </div>

          {/* 右侧状态指示 */}
          <div className="flex items-center gap-3" data-tauri-drag-region>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs text-slate-500">已连接</span>
            </div>
          </div>
        </header>

        {/* 页面内容 */}
        <div className="flex-1 overflow-y-auto bg-white/40">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.2 }}
              className="h-full"
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}

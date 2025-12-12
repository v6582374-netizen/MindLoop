import { Outlet, Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  BookOpen,
  CheckSquare,
  RotateCcw,
  Settings,
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

export default function Layout() {
  const location = useLocation();

  return (
    <div className="flex h-screen bg-gray-50">
      {/* 左侧侧边栏 */}
      <aside className="w-[250px] bg-gray-900 text-gray-100 flex flex-col border-r border-gray-800">
        {/* Logo */}
        <div className="h-16 flex items-center px-6 border-b border-gray-800">
          <h1 className="text-xl font-bold text-white">MindLoop</h1>
        </div>

        {/* 导航菜单 */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                  {
                    "bg-gray-800 text-white": isActive,
                    "text-gray-400 hover:bg-gray-800 hover:text-white": !isActive,
                  }
                )}
              >
                <Icon className="w-5 h-5" />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>

        {/* 底部版本信息 */}
        <div className="px-6 py-4 border-t border-gray-800">
          <p className="text-xs text-gray-500">MindLoop v2.0</p>
        </div>
      </aside>

      {/* 右侧内容区 */}
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}

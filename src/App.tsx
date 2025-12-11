import { useState } from "react";
import Settings from "./components/Settings";
import NotesList from "./components/NotesList";
import Home from "./components/Home";

type Page = "home" | "notes" | "settings";

function App() {
  const [currentPage, setCurrentPage] = useState<Page>("home");

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* 导航栏 */}
      <nav className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-bold text-indigo-600">MindLoop</h1>
            </div>
            <div className="flex space-x-1">
              <button
                onClick={() => setCurrentPage("home")}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  currentPage === "home"
                    ? "bg-indigo-100 text-indigo-700"
                    : "text-gray-600 hover:bg-gray-100"
                }`}
              >
                主页
              </button>
              <button
                onClick={() => setCurrentPage("notes")}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  currentPage === "notes"
                    ? "bg-indigo-100 text-indigo-700"
                    : "text-gray-600 hover:bg-gray-100"
                }`}
              >
                笔记列表
              </button>
              <button
                onClick={() => setCurrentPage("settings")}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  currentPage === "settings"
                    ? "bg-indigo-100 text-indigo-700"
                    : "text-gray-600 hover:bg-gray-100"
                }`}
              >
                设置
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* 主内容区 */}
      <main className="py-8">
        {currentPage === "home" && <Home />}
        {currentPage === "notes" && <NotesList />}
        {currentPage === "settings" && <Settings />}
      </main>
    </div>
  );
}

export default App;


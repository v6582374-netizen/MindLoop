import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";

interface Note {
  id: number;
  content: string;
  source: string | null;
  note_type: string;
  created_at: number;
  is_reviewed: boolean;
}

export default function NotesList() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadNotes = async () => {
    try {
      setLoading(true);
      setError(null);
      console.log("🔄 [前端] 开始调用 get_all_notes 命令...");
      const result = await invoke<Note[]>("get_all_notes");
      console.log("✅ [前端] get_all_notes 调用成功，返回笔记数量:", result.length);
      console.log("📝 [前端] 笔记数据:", JSON.stringify(result, null, 2));
      setNotes(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载笔记失败");
      console.error("❌ [前端] 加载笔记失败:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNotes();
    
    // 监听笔记保存事件
    let unlistenFn: (() => void) | undefined;
    
    const setupListener = async () => {
      try {
        const { listen } = await import("@tauri-apps/api/event");
        const unlisten = await listen("note-saved", () => {
          loadNotes();
        });
        unlistenFn = unlisten;
      } catch (err) {
        console.error("设置事件监听失败:", err);
      }
    };
    
    setupListener();
    
    return () => {
      if (unlistenFn) {
        unlistenFn();
      }
    };
  }, []);

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp * 1000);
    return date.toLocaleString("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <div className="text-center py-12">
            <p className="text-red-600 mb-4">{error}</p>
            <button
              onClick={loadNotes}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
            >
              重试
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow-lg p-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-800">笔记列表</h2>
          <button
            onClick={loadNotes}
            className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
          >
            刷新
          </button>
        </div>

        {notes.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 text-lg">还没有笔记</p>
            <p className="text-gray-400 text-sm mt-2">
              使用快捷键保存剪贴板内容作为笔记
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {notes.map((note) => (
              <div
                key={note.id}
                className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    {note.source && (
                      <p className="text-sm text-indigo-600 font-medium mb-1">
                        {note.source}
                      </p>
                    )}
                    <p className="text-gray-800 whitespace-pre-wrap break-words">
                      {note.content}
                    </p>
                  </div>
                  {note.is_reviewed && (
                    <span className="ml-4 px-2 py-1 text-xs bg-green-100 text-green-800 rounded-full">
                      已复习
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
                  <span className="text-xs text-gray-500">
                    {formatDate(note.created_at)}
                  </span>
                  <span className="text-xs text-gray-400">ID: {note.id}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}


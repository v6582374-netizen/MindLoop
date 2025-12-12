import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { convertFileSrc } from "@tauri-apps/api/core";
import { Card, CardContent } from "../components/ui/Card";
import DropdownMenu, { DropdownMenuItem } from "../components/ui/DropdownMenu";
import { MoreVertical, Trash2, CheckSquare, Edit } from "lucide-react";
import { cn } from "../lib/utils";

interface Note {
  id: number;
  content: string;
  source: string | null;
  note_type: string;
  content_type: "text" | "image" | "markdown";
  category: string;
  image_path: string | null;
  created_at: number;
  is_reviewed: boolean;
  review_count: number;
  last_reviewed_at: number | null;
  next_review_at: number | null;
  ease_factor: number;
}

export default function Library() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [category, setCategory] = useState<string>("inbox");
  const [imageUrls, setImageUrls] = useState<Map<number, string>>(new Map());

  const loadNotes = async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await invoke<Note[]>("get_all_notes", {
        category: category,
      });
      setNotes(result);

      // 为所有图片笔记转换路径
      const urlMap = new Map<number, string>();
      for (const note of result) {
        if (note.content_type === "image" && note.image_path) {
          try {
            const { appDataDir } = await import("@tauri-apps/api/path");
            const dataDir = await appDataDir();
            const fullPath = `${dataDir}/${note.image_path}`;
            const url = convertFileSrc(fullPath);
            urlMap.set(note.id, url);
          } catch (err) {
            console.error(`转换图片路径失败 (note ${note.id}):`, err);
          }
        }
      }
      setImageUrls(urlMap);
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载笔记失败");
      console.error("加载笔记失败:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNotes();
  }, [category]);

  const handleDelete = async (id: number) => {
    if (!confirm("确定要删除这条笔记吗？")) {
      return;
    }

    try {
      await invoke("delete_note", { id });
      await loadNotes();
    } catch (err) {
      alert(err instanceof Error ? err.message : "删除失败");
      console.error("删除笔记失败:", err);
    }
  };

  const handleMoveToTodo = async (id: number) => {
    try {
      await invoke("update_note", {
        id,
        category: "todo",
      });
      await loadNotes();
    } catch (err) {
      alert(err instanceof Error ? err.message : "操作失败");
      console.error("转为待办失败:", err);
    }
  };

  const handleEdit = async (note: Note) => {
    const newContent = prompt("编辑笔记内容:", note.content);
    if (newContent !== null && newContent !== note.content) {
      try {
        await invoke("update_note", {
          id: note.id,
          content: newContent,
        });
        await loadNotes();
      } catch (err) {
        alert(err instanceof Error ? err.message : "编辑失败");
        console.error("编辑笔记失败:", err);
      }
    }
  };

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


  const truncateText = (text: string, maxLength: number = 150) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + "...";
  };

  if (loading) {
    return (
      <div className="p-8">
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8">
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
    );
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">笔记库</h1>
        <p className="text-gray-600 mt-2">管理你的所有笔记</p>
      </div>

      {/* 分类筛选 */}
      <div className="mb-6 flex gap-2">
        <button
          onClick={() => setCategory("inbox")}
          className={cn(
            "px-4 py-2 rounded-lg text-sm font-medium transition-colors",
            category === "inbox"
              ? "bg-indigo-600 text-white"
              : "bg-gray-100 text-gray-700 hover:bg-gray-200"
          )}
        >
          收件箱
        </button>
        <button
          onClick={() => setCategory("todo")}
          className={cn(
            "px-4 py-2 rounded-lg text-sm font-medium transition-colors",
            category === "todo"
              ? "bg-indigo-600 text-white"
              : "bg-gray-100 text-gray-700 hover:bg-gray-200"
          )}
        >
          待办
        </button>
        <button
          onClick={() => setCategory("archive")}
          className={cn(
            "px-4 py-2 rounded-lg text-sm font-medium transition-colors",
            category === "archive"
              ? "bg-indigo-600 text-white"
              : "bg-gray-100 text-gray-700 hover:bg-gray-200"
          )}
        >
          归档
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {notes.map((note) => {
            const imageUrl = note.content_type === "image" && note.image_path
              ? imageUrls.get(note.id) || null
              : null;

            return (
              <Card key={note.id} className="relative group">
                <CardContent className="p-4">
                  {/* 操作菜单 */}
                  <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                    <DropdownMenu
                      trigger={
                        <button className="p-1 rounded-md hover:bg-gray-100 transition-colors">
                          <MoreVertical className="w-4 h-4 text-gray-600" />
                        </button>
                      }
                    >
                      <DropdownMenuItem onClick={() => handleEdit(note)}>
                        <div className="flex items-center gap-2">
                          <Edit className="w-4 h-4" />
                          <span>编辑</span>
                        </div>
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleMoveToTodo(note.id)}>
                        <div className="flex items-center gap-2">
                          <CheckSquare className="w-4 h-4" />
                          <span>转为待办</span>
                        </div>
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleDelete(note.id)}
                        className="text-red-600"
                      >
                        <div className="flex items-center gap-2">
                          <Trash2 className="w-4 h-4" />
                          <span>删除</span>
                        </div>
                      </DropdownMenuItem>
                    </DropdownMenu>
                  </div>

                  {/* 图片笔记 */}
                  {note.content_type === "image" && imageUrl ? (
                    <div className="space-y-2">
                      <img
                        src={imageUrl}
                        alt={note.content}
                        className="w-full h-auto rounded-lg object-cover"
                        onError={(e) => {
                          console.error("图片加载失败:", imageUrl);
                          (e.target as HTMLImageElement).style.display = "none";
                        }}
                      />
                      {note.content && (
                        <p className="text-sm text-gray-600 line-clamp-2">
                          {note.content}
                        </p>
                      )}
                    </div>
                  ) : (
                    /* 文本笔记 */
                    <div className="space-y-2">
                      {note.source && (
                        <p className="text-xs text-indigo-600 font-medium">
                          {note.source}
                        </p>
                      )}
                      <p className="text-sm text-gray-800 whitespace-pre-wrap break-words line-clamp-6">
                        {truncateText(note.content)}
                      </p>
                    </div>
                  )}

                  {/* 底部信息 */}
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-500">
                        {formatDate(note.created_at)}
                      </span>
                      {note.is_reviewed && (
                        <span className="px-2 py-0.5 text-xs bg-green-100 text-green-800 rounded-full">
                          已复习
                        </span>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

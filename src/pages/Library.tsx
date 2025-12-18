import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { convertFileSrc } from "@tauri-apps/api/core";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent } from "../components/ui/Card";
import { Dialog, DialogHeader, DialogContent, DialogFooter } from "../components/ui/Dialog";
import { Trash2, CheckSquare, Edit, Inbox, Archive } from "lucide-react";
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
  
  // 编辑弹窗状态
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [editContent, setEditContent] = useState("");
  const [saving, setSaving] = useState(false);

  const loadNotes = async () => {
    try {
      setLoading(true);
      setError(null);
      // Library 只显示 inbox 和 archive，不显示 todo
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

  // 删除笔记 - 乐观更新
  const handleDelete = async (id: number) => {
    console.log("父组件收到删除请求, ID:", id);
    
    // 1. 乐观更新：立刻在界面上移除，不需要等待后端
    setNotes((currentNotes) => {
      const newNotes = currentNotes.filter((note) => note.id !== id);
      console.log("更新后的笔记数量:", newNotes.length);
      return newNotes;
    });
    
    // 2. 后台静默同步数据库
    try {
      await invoke('delete_note', { id });
      console.log("数据库删除成功");
    } catch (error) {
      console.error("数据库删除失败:", error);
      // 如果失败了，重新加载列表
      loadNotes();
    }
  };

  // 转为待办 - 动画移除
  const handleMoveToTodo = async (id: number) => {
    try {
      await invoke("update_note", {
        id,
        category: "todo",
      });
      // 直接从本地状态移除（动画效果由 AnimatePresence 处理）
      setNotes(prev => prev.filter(note => note.id !== id));
    } catch (err) {
      alert(err instanceof Error ? err.message : "操作失败");
      console.error("转为待办失败:", err);
    }
  };

  // 打开编辑弹窗
  const handleOpenEdit = (note: Note) => {
    setEditingNote(note);
    setEditContent(note.content);
  };

  // 保存编辑
  const handleSaveEdit = async () => {
    if (!editingNote || editContent === editingNote.content) {
      setEditingNote(null);
      return;
    }

    try {
      setSaving(true);
      await invoke("update_note", {
        id: editingNote.id,
        content: editContent,
      });
      // 更新本地状态
      setNotes(prev => prev.map(note => 
        note.id === editingNote.id 
          ? { ...note, content: editContent }
          : note
      ));
      setEditingNote(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : "保存失败");
      console.error("编辑笔记失败:", err);
    } finally {
      setSaving(false);
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
        <h1 className="text-2xl font-semibold text-slate-900">笔记库</h1>
        <p className="text-slate-500 mt-1">管理你的所有笔记</p>
      </div>

      {/* 分类筛选 - 只显示 inbox 和 archive */}
      <div className="mb-6 flex gap-2">
        <button
          onClick={() => setCategory("inbox")}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all",
            category === "inbox"
              ? "bg-indigo-50 text-indigo-700 shadow-soft"
              : "bg-white text-slate-600 hover:bg-slate-50 border border-slate-200/60"
          )}
        >
          <Inbox className="w-4 h-4" />
          收件箱
        </button>
        <button
          onClick={() => setCategory("archive")}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all",
            category === "archive"
              ? "bg-indigo-50 text-indigo-700 shadow-soft"
              : "bg-white text-slate-600 hover:bg-slate-50 border border-slate-200/60"
          )}
        >
          <Archive className="w-4 h-4" />
          归档
        </button>
      </div>

      {notes.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-slate-500 text-lg">还没有笔记</p>
          <p className="text-slate-400 text-sm mt-2">
            使用快捷键保存剪贴板内容作为笔记
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          <AnimatePresence mode="popLayout">
            {notes.map((note) => {
              const imageUrl = note.content_type === "image" && note.image_path
                ? imageUrls.get(note.id) || null
                : null;

              return (
                <motion.div
                  key={note.id}
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9, x: 50 }}
                  transition={{ duration: 0.2 }}
                >
                  <Card className="relative group bg-white border-slate-200/60 shadow-soft hover:shadow-soft-md transition-shadow overflow-visible">
                    <CardContent className="p-4">
                      {/* 操作按钮组 - 直接按钮，不用下拉菜单 */}
                      <div 
                        className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                        style={{ zIndex: 9999, pointerEvents: 'auto' }}
                      >
                        {/* 编辑按钮 */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            handleOpenEdit(note);
                          }}
                          className="relative z-[9999] p-1.5 rounded-lg bg-white hover:bg-slate-100 border border-slate-200 cursor-pointer transition-colors"
                          style={{ pointerEvents: 'auto' }}
                        >
                          <Edit className="w-4 h-4 text-slate-500 pointer-events-none" />
                        </button>
                        
                        {/* 转待办按钮 */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            handleMoveToTodo(note.id);
                          }}
                          className="relative z-[9999] p-1.5 rounded-lg bg-white hover:bg-slate-100 border border-slate-200 cursor-pointer transition-colors"
                          style={{ pointerEvents: 'auto' }}
                        >
                          <CheckSquare className="w-4 h-4 text-slate-500 pointer-events-none" />
                        </button>
                        
                        {/* 删除按钮 */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            console.log("点击了删除按钮, ID:", note.id);
                            handleDelete(note.id);
                          }}
                          className="relative z-[9999] p-1.5 rounded-lg bg-white hover:bg-red-50 border border-slate-200 hover:border-red-200 cursor-pointer transition-colors"
                          style={{ pointerEvents: 'auto' }}
                        >
                          <Trash2 className="w-4 h-4 text-red-500 pointer-events-none" />
                        </button>
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
                            <p className="text-sm text-slate-600 line-clamp-2">
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
                          <p className="text-sm text-slate-700 whitespace-pre-wrap break-words line-clamp-6">
                            {truncateText(note.content)}
                          </p>
                        </div>
                      )}

                      {/* 底部信息 */}
                      <div className="mt-3 pt-3 border-t border-slate-100">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-slate-400">
                            {formatDate(note.created_at)}
                          </span>
                          {note.is_reviewed && (
                            <span className="px-2 py-0.5 text-xs bg-emerald-50 text-emerald-700 rounded-full">
                              已复习
                            </span>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* 编辑弹窗 */}
      <Dialog open={!!editingNote} onClose={() => setEditingNote(null)}>
        <DialogHeader onClose={() => setEditingNote(null)}>
          编辑笔记
        </DialogHeader>
        <DialogContent>
          <textarea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            className="w-full h-48 p-3 rounded-lg border border-slate-200/60 bg-white text-slate-900 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            placeholder="输入笔记内容..."
          />
        </DialogContent>
        <DialogFooter>
          <button
            onClick={() => setEditingNote(null)}
            className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleSaveEdit}
            disabled={saving}
            className="px-4 py-2 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
          >
            {saving ? "保存中..." : "保存"}
          </button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}

import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { motion, AnimatePresence } from "framer-motion";
import { Dialog, DialogHeader, DialogContent, DialogFooter } from "../components/ui/Dialog";
import { Check, Trash2, Edit, MoreVertical, CheckCircle2, Circle } from "lucide-react";
import DropdownMenu, { DropdownMenuItem } from "../components/ui/DropdownMenu";

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

export default function Tasks() {
  const [tasks, setTasks] = useState<Note[]>([]);
  const [completedTasks, setCompletedTasks] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // 编辑弹窗状态
  const [editingTask, setEditingTask] = useState<Note | null>(null);
  const [editContent, setEditContent] = useState("");
  const [saving, setSaving] = useState(false);

  const loadTasks = async () => {
    try {
      setLoading(true);
      setError(null);
      // Tasks 只显示 category == 'todo'
      const result = await invoke<Note[]>("get_all_notes", {
        category: "todo",
      });
      setTasks(result);
      
      // 使用 is_reviewed 作为完成状态（临时方案）
      const completed = new Set<number>();
      result.forEach(task => {
        if (task.is_reviewed) {
          completed.add(task.id);
        }
      });
      setCompletedTasks(completed);
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载任务失败");
      console.error("加载任务失败:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTasks();
  }, []);

  // 切换完成状态
  const handleToggleComplete = async (id: number) => {
    const isCurrentlyCompleted = completedTasks.has(id);
    
    try {
      // 使用 update_review_status 来标记完成状态
      // quality = 5 表示完成，quality = 0 表示未完成
      await invoke("update_review_status", {
        noteId: id,
        quality: isCurrentlyCompleted ? 0 : 5,
      });
      
      // 更新本地状态
      setCompletedTasks(prev => {
        const newSet = new Set(prev);
        if (isCurrentlyCompleted) {
          newSet.delete(id);
        } else {
          newSet.add(id);
        }
        return newSet;
      });
    } catch (err) {
      console.error("更新任务状态失败:", err);
    }
  };

  // 删除任务
  const handleDelete = async (id: number) => {
    if (!confirm("确定要删除这个任务吗？")) {
      return;
    }

    try {
      await invoke("delete_note", { id });
      setTasks(prev => prev.filter(task => task.id !== id));
      setCompletedTasks(prev => {
        const newSet = new Set(prev);
        newSet.delete(id);
        return newSet;
      });
    } catch (err) {
      alert(err instanceof Error ? err.message : "删除失败");
      console.error("删除任务失败:", err);
    }
  };

  // 打开编辑弹窗
  const handleOpenEdit = (task: Note) => {
    setEditingTask(task);
    setEditContent(task.content);
  };

  // 保存编辑
  const handleSaveEdit = async () => {
    if (!editingTask || editContent === editingTask.content) {
      setEditingTask(null);
      return;
    }

    try {
      setSaving(true);
      await invoke("update_note", {
        id: editingTask.id,
        content: editContent,
      });
      setTasks(prev => prev.map(task => 
        task.id === editingTask.id 
          ? { ...task, content: editContent }
          : task
      ));
      setEditingTask(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : "保存失败");
      console.error("编辑任务失败:", err);
    } finally {
      setSaving(false);
    }
  };

  // 移回收件箱
  const handleMoveToInbox = async (id: number) => {
    try {
      await invoke("update_note", {
        id,
        category: "inbox",
      });
      setTasks(prev => prev.filter(task => task.id !== id));
    } catch (err) {
      alert(err instanceof Error ? err.message : "操作失败");
      console.error("移回收件箱失败:", err);
    }
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp * 1000);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return "今天";
    if (diffDays === 1) return "昨天";
    if (diffDays < 7) return `${diffDays}天前`;
    
    return date.toLocaleDateString("zh-CN", {
      month: "short",
      day: "numeric",
    });
  };

  // 分离未完成和已完成的任务
  const pendingTasks = tasks.filter(task => !completedTasks.has(task.id));
  const doneTasks = tasks.filter(task => completedTasks.has(task.id));

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
            onClick={loadTasks}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            重试
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">待办事项</h1>
          <p className="text-slate-500 mt-1">
            {pendingTasks.length} 个待完成，{doneTasks.length} 个已完成
          </p>
        </div>
      </div>

      {/* 待完成任务 */}
      <div className="space-y-2 mb-8">
        <AnimatePresence mode="popLayout">
          {pendingTasks.map((task) => (
            <motion.div
              key={task.id}
              layout
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              className="group flex items-start gap-3 p-4 bg-white rounded-xl border border-slate-200/60 shadow-soft hover:shadow-soft-md transition-all"
            >
              {/* Checkbox */}
              <button
                onClick={() => handleToggleComplete(task.id)}
                className="mt-0.5 flex-shrink-0 w-5 h-5 rounded-full border-2 border-slate-300 hover:border-indigo-500 transition-colors flex items-center justify-center"
              >
                <Circle className="w-5 h-5 text-slate-300" />
              </button>
              
              {/* 内容 */}
              <div className="flex-1 min-w-0">
                <p className="text-sm text-slate-700 whitespace-pre-wrap break-words">
                  {task.content}
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  {formatDate(task.created_at)}
                </p>
              </div>
              
              {/* 操作菜单 */}
              <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                <DropdownMenu
                  trigger={
                    <button className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors">
                      <MoreVertical className="w-4 h-4 text-slate-400" />
                    </button>
                  }
                >
                  <DropdownMenuItem onClick={() => handleOpenEdit(task)}>
                    <div className="flex items-center gap-2">
                      <Edit className="w-4 h-4" />
                      <span>编辑</span>
                    </div>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleMoveToInbox(task.id)}>
                    <div className="flex items-center gap-2">
                      <Check className="w-4 h-4" />
                      <span>移回收件箱</span>
                    </div>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => handleDelete(task.id)}
                    className="text-red-600"
                  >
                    <div className="flex items-center gap-2">
                      <Trash2 className="w-4 h-4" />
                      <span>删除</span>
                    </div>
                  </DropdownMenuItem>
                </DropdownMenu>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        
        {pendingTasks.length === 0 && (
          <div className="text-center py-8 text-slate-400">
            <CheckCircle2 className="w-12 h-12 mx-auto mb-3 text-emerald-300" />
            <p>所有任务已完成！</p>
          </div>
        )}
      </div>

      {/* 已完成任务 */}
      {doneTasks.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-slate-500 mb-3">已完成</h3>
          <div className="space-y-2">
            <AnimatePresence mode="popLayout">
              {doneTasks.map((task) => (
                <motion.div
                  key={task.id}
                  layout
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="group flex items-start gap-3 p-4 bg-slate-50/50 rounded-xl border border-slate-100 transition-all"
                >
                  {/* Checkbox - 已完成 */}
                  <button
                    onClick={() => handleToggleComplete(task.id)}
                    className="mt-0.5 flex-shrink-0 w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center"
                  >
                    <Check className="w-3 h-3 text-white" />
                  </button>
                  
                  {/* 内容 - 删除线 */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-400 line-through whitespace-pre-wrap break-words">
                      {task.content}
                    </p>
                    <p className="text-xs text-slate-300 mt-1">
                      {formatDate(task.created_at)}
                    </p>
                  </div>
                  
                  {/* 删除按钮 */}
                  <button
                    onClick={() => handleDelete(task.id)}
                    className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-slate-200 transition-all"
                  >
                    <Trash2 className="w-4 h-4 text-slate-400" />
                  </button>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      )}

      {/* 编辑弹窗 */}
      <Dialog open={!!editingTask} onClose={() => setEditingTask(null)}>
        <DialogHeader onClose={() => setEditingTask(null)}>
          编辑任务
        </DialogHeader>
        <DialogContent>
          <textarea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            className="w-full h-32 p-3 rounded-lg border border-slate-200/60 bg-white text-slate-900 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            placeholder="输入任务内容..."
          />
        </DialogContent>
        <DialogFooter>
          <button
            onClick={() => setEditingTask(null)}
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

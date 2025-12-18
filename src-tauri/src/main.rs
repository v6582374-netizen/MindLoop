
// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use rusqlite::{Connection, Result as SqlResult};
use tauri::{Emitter, Manager, WebviewWindow};
#[cfg(target_os = "macos")]
use window_vibrancy::{apply_vibrancy, NSVisualEffectMaterial};
use tauri_plugin_global_shortcut::{Code, Modifiers, Shortcut, GlobalShortcutExt};
use tauri_plugin_notification::NotificationExt;
use std::sync::Mutex;
use std::collections::HashSet;
use rand::seq::SliceRandom;
use rand::thread_rng;
use rand::RngCore;
use chrono::Utc;
use std::path::PathBuf;

// 数据库连接状态（线程安全）
struct DbState {
    db_path: std::path::PathBuf,
}

// 检查表结构是否匹配新版本
fn check_table_schema(conn: &Connection) -> Result<bool, rusqlite::Error> {
    // 检查是否存在新字段
    let mut stmt = conn.prepare("PRAGMA table_info(notes)")?;
    let columns: Vec<String> = stmt.query_map([], |row| {
        Ok(row.get::<_, String>(1)?) // 获取列名
    })?
    .collect::<Result<Vec<_>, _>>()?;
    
    // 检查必需的新字段是否存在
    let required_fields = vec!["content_type", "category", "review_count", "ease_factor"];
    let has_all_fields = required_fields.iter().all(|field| columns.contains(&field.to_string()));
    
    Ok(has_all_fields)
}

// 初始化数据库并创建表
fn init_database(app: &tauri::AppHandle) -> SqlResult<std::path::PathBuf> {
    // 获取应用数据目录
    let app_data_dir = app.path().app_data_dir().expect("无法获取应用数据目录");
    std::fs::create_dir_all(&app_data_dir).expect("无法创建应用数据目录");
    
    // 数据库文件路径
    let db_path = app_data_dir.join("mindloop.db");
    
    // 连接数据库
    let conn = Connection::open(&db_path)?;
    
    // 检查表结构是否匹配新版本
    let schema_ok = check_table_schema(&conn).unwrap_or(false);
    
    if !schema_ok {
        println!("⚠️ [数据库初始化] 检测到旧表结构，删除并重建...");
        conn.execute("DROP TABLE IF EXISTS notes", [])?;
        conn.execute("DROP INDEX IF EXISTS idx_notes_category", [])?;
        conn.execute("DROP INDEX IF EXISTS idx_notes_next_review_at", [])?;
    }
    
    // 创建 notes 表（MindLoop 2.0 结构）
    conn.execute(
        "CREATE TABLE IF NOT EXISTS notes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            content TEXT NOT NULL,
            source TEXT,
            note_type TEXT NOT NULL DEFAULT 'text',
            content_type TEXT NOT NULL DEFAULT 'text',
            category TEXT NOT NULL DEFAULT 'inbox',
            image_path TEXT,
            created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
            is_reviewed INTEGER NOT NULL DEFAULT 0,
            review_count INTEGER NOT NULL DEFAULT 0,
            last_reviewed_at INTEGER,
            next_review_at INTEGER,
            ease_factor REAL NOT NULL DEFAULT 2.5
        )",
        [],
    )?;
    
    // 创建索引
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_notes_category ON notes(category)",
        [],
    )?;
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_notes_next_review_at ON notes(next_review_at)",
        [],
    )?;
    
    println!("✅ [数据库初始化] 表结构创建/更新成功");
    
    // 插入测试数据（如果表是空的）
    let count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM notes",
        [],
        |row| row.get(0),
    ).unwrap_or(0);
    
    if count == 0 {
        println!("📝 [数据库初始化] 表为空，插入测试数据...");
        conn.execute(
            "INSERT INTO notes (content, source, note_type, content_type, category, created_at, is_reviewed, review_count, ease_factor) 
             VALUES (?1, ?2, 'text', 'text', 'inbox', strftime('%s', 'now'), 0, 0, 2.5)",
            ["这是一条测试笔记，用于验证数据库连接是否正常。", "系统测试"],
        )?;
        println!("✅ [数据库初始化] 测试数据插入成功");
    }
    
    println!("✅ [数据库初始化] 数据库初始化成功: {:?}", db_path);
    Ok(db_path)
}

// 笔记结构（MindLoop 2.0）
#[derive(serde::Serialize)]
struct Note {
    id: i64,
    content: String,
    source: Option<String>,
    note_type: String,
    content_type: String, // 'text', 'image', 'markdown'
    category: String,     // 'inbox', 'todo', 'archive'
    image_path: Option<String>,
    created_at: i64,
    is_reviewed: bool,
    review_count: i64,
    last_reviewed_at: Option<i64>,
    next_review_at: Option<i64>,
    ease_factor: f64,
}

// 题目结构
#[derive(serde::Deserialize, serde::Serialize, Debug, Clone)]
struct QuizQuestion {
    id: u32,
    #[serde(rename = "type")]
    question_type: String, // "choice" 或 "qa"
    question: String,
    options: Vec<String>,
    answer: String,
    explanation: String,
}

// 保存笔记到数据库
fn save_note_to_db(
    db_path: &std::path::PathBuf,
    content: String,
    source: Option<String>,
    category: Option<String>,
    content_type: Option<String>,
    image_path: Option<String>,
) -> SqlResult<i64> {
    println!("💾 [数据库] 打开数据库连接: {:?}", db_path);
    let conn = Connection::open(db_path)?;
    
    let category_val = category.unwrap_or_else(|| "inbox".to_string());
    let content_type_val = content_type.unwrap_or_else(|| "text".to_string());
    
    println!("💾 [数据库] 执行 INSERT 语句，内容长度: {}, category: {}, content_type: {}", 
             content.len(), category_val, content_type_val);
    
    let image_path_str = image_path.as_deref().unwrap_or("");
    
    conn.execute(
        "INSERT INTO notes (content, source, note_type, content_type, category, image_path, created_at, is_reviewed, review_count, ease_factor) 
         VALUES (?1, ?2, 'text', ?3, ?4, ?5, strftime('%s', 'now'), 0, 0, 2.5)",
        [&content, &source.unwrap_or_default(), &content_type_val, &category_val, image_path_str],
    )?;
    
    let note_id = conn.last_insert_rowid();
    println!("💾 [数据库] INSERT 成功，返回 ID: {}", note_id);
    Ok(note_id)
}

// 保存图片到本地并返回路径
fn save_image_to_local(app_data_dir: &PathBuf, image_data: &[u8]) -> Result<String, String> {
    // 创建 images 目录
    let images_dir = app_data_dir.join("images");
    std::fs::create_dir_all(&images_dir)
        .map_err(|e| format!("创建图片目录失败: {}", e))?;
    
    // 生成唯一文件名（使用时间戳 + 随机数）
    let timestamp = Utc::now().timestamp();
    let mut rng = rand::thread_rng();
    let random: u32 = rng.next_u32();
    let filename = format!("{}_{}.png", timestamp, random);
    let file_path = images_dir.join(&filename);
    
    // 保存图片
    std::fs::write(&file_path, image_data)
        .map_err(|e| format!("保存图片失败: {}", e))?;
    
    // 返回相对路径（相对于数据库目录）
    let relative_path = format!("images/{}", filename);
    println!("📸 [图片保存] 图片已保存到: {:?}, 相对路径: {}", file_path, relative_path);
    
    Ok(relative_path)
}

// 获取所有笔记（支持按 category 筛选）
#[tauri::command]
fn get_all_notes(
    category: Option<String>,
    db_state: tauri::State<'_, Mutex<DbState>>,
) -> Result<Vec<Note>, String> {
    let db_path = {
        let state = db_state.lock().map_err(|e| format!("获取数据库状态失败: {}", e))?;
        state.db_path.clone()
    };
    
    let conn = Connection::open(&db_path)
        .map_err(|e| format!("打开数据库失败: {}", e))?;
    
    // 构建查询语句
    let (query, has_category) = if let Some(ref cat) = category {
        (
            "SELECT id, content, source, note_type, content_type, category, image_path, created_at, is_reviewed, review_count, last_reviewed_at, next_review_at, ease_factor 
             FROM notes 
             WHERE category = ?1
             ORDER BY created_at DESC".to_string(),
            Some(cat.clone()),
        )
    } else {
        (
            "SELECT id, content, source, note_type, content_type, category, image_path, created_at, is_reviewed, review_count, last_reviewed_at, next_review_at, ease_factor 
             FROM notes 
             ORDER BY created_at DESC".to_string(),
            None,
        )
    };
    
    let mut stmt = conn.prepare(&query)
        .map_err(|e| format!("准备查询失败: {}", e))?;
    
    // 定义统一的闭包来解析行数据
    let parse_row = |row: &rusqlite::Row| -> rusqlite::Result<Note> {
        Ok(Note {
            id: row.get(0)?,
            content: row.get(1)?,
            source: row.get(2)?,
            note_type: row.get(3)?,
            content_type: row.get(4)?,
            category: row.get(5)?,
            image_path: row.get(6)?,
            created_at: row.get(7)?,
            is_reviewed: row.get::<_, i32>(8)? != 0,
            review_count: row.get(9)?,
            last_reviewed_at: row.get(10)?,
            next_review_at: row.get(11)?,
            ease_factor: row.get(12)?,
        })
    };
    
    let notes_iter = if let Some(cat) = has_category {
        stmt.query_map([cat.as_str()], parse_row)
    } else {
        stmt.query_map([], parse_row)
    }
    .map_err(|e| format!("查询失败: {}", e))?;
    
    let mut notes = Vec::new();
    for note in notes_iter {
        notes.push(note.map_err(|e| format!("读取笔记失败: {}", e))?);
    }
    
    Ok(notes)
}

// 删除笔记
#[tauri::command]
fn delete_note(id: i64, db_state: tauri::State<'_, Mutex<DbState>>) -> Result<(), String> {
    let db_path = {
        let state = db_state.lock().map_err(|e| format!("获取数据库状态失败: {}", e))?;
        state.db_path.clone()
    };
    
    let conn = Connection::open(&db_path)
        .map_err(|e| format!("打开数据库失败: {}", e))?;
    
    // 先获取图片路径，如果存在则删除图片文件
    let image_path: Option<Option<String>> = conn.query_row(
        "SELECT image_path FROM notes WHERE id = ?1",
        [id],
        |row| row.get(0),
    ).ok();
    
    if let Some(Some(ref img_path)) = image_path {
        if !img_path.is_empty() {
            let app_data_dir = db_path.parent().ok_or("无法获取应用数据目录")?;
            let image_file = app_data_dir.join(&img_path);
            if image_file.exists() {
                if let Err(e) = std::fs::remove_file(&image_file) {
                    eprintln!("⚠️ [删除笔记] 删除图片文件失败: {} (路径: {:?})", e, image_file);
                } else {
                    println!("🗑️ [删除笔记] 已删除图片文件: {:?}", image_file);
                }
            }
        }
    }
    
    // 删除数据库记录
    let rows_affected = conn.execute(
        "DELETE FROM notes WHERE id = ?1",
        [id],
    )
    .map_err(|e| format!("删除笔记失败: {}", e))?;
    
    if rows_affected == 0 {
        return Err(format!("未找到 ID 为 {} 的笔记", id));
    }
    
    println!("✅ [删除笔记] 笔记 ID {} 已删除", id);
    Ok(())
}

// 更新笔记
#[tauri::command]
fn update_note(
    id: i64,
    content: Option<String>,
    category: Option<String>,
    db_state: tauri::State<'_, Mutex<DbState>>,
) -> Result<(), String> {
    let db_path = {
        let state = db_state.lock().map_err(|e| format!("获取数据库状态失败: {}", e))?;
        state.db_path.clone()
    };
    
    let conn = Connection::open(&db_path)
        .map_err(|e| format!("打开数据库失败: {}", e))?;
    
    // 构建更新语句
    let mut updates = Vec::new();
    
    if content.is_some() {
        updates.push("content = ?");
    }
    
    if category.is_some() {
        updates.push("category = ?");
    }
    
    if updates.is_empty() {
        return Err("没有提供要更新的字段".to_string());
    }
    
    let update_sql = format!(
        "UPDATE notes SET {} WHERE id = ?",
        updates.join(", ")
    );
    
    // 执行更新
    let rows_affected = match (content.as_ref(), category.as_ref()) {
        (Some(cont), Some(cat)) => {
            // 更新 content 和 category
            conn.execute(&update_sql, rusqlite::params![cont, cat, id])
        }
        (Some(cont), None) => {
            // 只更新 content
            conn.execute(&update_sql, rusqlite::params![cont, id])
        }
        (None, Some(cat)) => {
            // 只更新 category
            conn.execute(&update_sql, rusqlite::params![cat, id])
        }
        (None, None) => {
            return Err("没有提供要更新的字段".to_string());
        }
    }
    .map_err(|e| format!("更新笔记失败: {}", e))?;
    
    if rows_affected == 0 {
        return Err(format!("未找到 ID 为 {} 的笔记", id));
    }
    
    println!("✅ [更新笔记] 笔记 ID {} 已更新", id);
    Ok(())
}

// OpenAI API 请求结构
#[derive(serde::Serialize)]
struct ChatMessage {
    role: String,
    content: String,
}

#[derive(serde::Serialize)]
struct ChatRequest {
    model: String,
    messages: Vec<ChatMessage>,
    #[serde(skip_serializing_if = "Option::is_none")]
    temperature: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    stream: Option<bool>,
}

// 创建配置好的 HTTP 客户端
// 注意：reqwest 在启用 gzip, deflate, brotli 特性后会自动解压响应
// 无需显式调用 .gzip(true)，默认行为已启用自动解压
fn create_http_client() -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(120)) // 总超时时间 120 秒（DeepSeek 生成较慢）
        .connect_timeout(std::time::Duration::from_secs(15)) // 连接超时 15 秒
        // 自动解压已通过 Cargo.toml 中的 gzip, deflate, brotli 特性启用
        .build()
        .map_err(|e| format!("创建 HTTP 客户端失败: {}", e))
}

// 安全截取字符串，避免在多字节字符边界处 panic
fn safe_truncate(s: &str, max_chars: usize) -> String {
    s.chars().take(max_chars).collect::<String>()
}

// 清理 JSON 字符串，提取有效的 JSON 内容
// 新逻辑：找到第一个 { 或 [ 和最后一个 } 或 ]，提取中间的 JSON
// 这样无论 AI 是否加了 ```json，或者内容里是否有 "json" 这个词，只要它包含合法的 JSON 结构，我们就能挖出来
fn clean_json_string(input: &str) -> String {
    let trimmed = input.trim();
    
    // 查找第一个 JSON 开始标记 { 或 [
    let brace_start = trimmed.find('{');
    let bracket_start = trimmed.find('[');
    
    // 选择更靠前的开始位置（如果两者都存在）
    let start_pos = match (brace_start, bracket_start) {
        (Some(b), Some(a)) => Some(b.min(a)), // 取更靠前的
        (Some(b), None) => Some(b),
        (None, Some(a)) => Some(a),
        (None, None) => None,
    };
    
    // 查找最后一个 JSON 结束标记 } 或 ]
    let brace_end = trimmed.rfind('}');
    let bracket_end = trimmed.rfind(']');
    
    // 选择更靠后的结束位置（如果两者都存在）
    let end_pos = match (brace_end, bracket_end) {
        (Some(b), Some(a)) => Some(b.max(a)), // 取更靠后的
        (Some(b), None) => Some(b),
        (None, Some(a)) => Some(a),
        (None, None) => None,
    };
    
    // 如果找到了开始和结束位置，提取 JSON 内容
    if let (Some(start), Some(end)) = (start_pos, end_pos) {
        // 确保 end >= start
        if end >= start {
            let json_content = &trimmed[start..=end];
            println!("🧹 [清理函数] 找到 JSON 结构，提取内容（位置: {} 到 {}，长度: {} 字符）", start, end, json_content.len());
            return json_content.to_string();
        }
    }
    
    // 如果没找到 JSON 结构，返回原字符串（去除首尾空白）
    println!("🧹 [清理函数] 未找到 JSON 结构（{{ 或 [），返回原始内容（长度: {} 字符）", trimmed.len());
    trimmed.to_string()
}

#[derive(serde::Deserialize)]
struct ChatResponse {
    choices: Vec<Choice>,
}

#[derive(serde::Deserialize)]
struct Choice {
    message: MessageContent,
}

#[derive(serde::Deserialize)]
struct MessageContent {
    content: String,
}

// 获取昨天未复习的笔记（保留用于向后兼容）
#[allow(dead_code)]
fn get_yesterday_unreviewed_notes(db_path: &std::path::PathBuf) -> Result<Vec<Note>, String> {
    // 计算昨天的开始和结束时间戳（UTC）
    // 昨天 00:00:00 到今天 00:00:00
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs() as i64;
    
    // 获取今天的开始时间戳（UTC 00:00:00）
    let today_start = now - (now % 86400); // 86400 秒 = 1 天
    let yesterday_start = today_start - 86400;
    let yesterday_end = today_start;
    
    get_notes_by_time_range(db_path, Some(yesterday_start), Some(yesterday_end))
}

// 获取到期的笔记（next_review_at <= 当前时间）
fn get_due_notes(db_path: &std::path::PathBuf) -> Result<Vec<Note>, String> {
    let conn = Connection::open(db_path)
        .map_err(|e| format!("打开数据库失败: {}", e))?;
    
    let current_time = Utc::now().timestamp();
    
    let mut stmt = conn.prepare(
        "SELECT id, content, source, note_type, content_type, category, image_path, created_at, is_reviewed, review_count, last_reviewed_at, next_review_at, ease_factor 
         FROM notes 
         WHERE (next_review_at IS NOT NULL AND next_review_at <= ?) OR (next_review_at IS NULL AND is_reviewed = 0)
         ORDER BY next_review_at ASC, created_at ASC"
    )
    .map_err(|e| format!("准备查询失败: {}", e))?;
    
    let notes_iter = stmt.query_map([current_time], |row| {
        Ok(Note {
            id: row.get(0)?,
            content: row.get(1)?,
            source: row.get(2)?,
            note_type: row.get(3)?,
            content_type: row.get(4)?,
            category: row.get(5)?,
            image_path: row.get(6)?,
            created_at: row.get(7)?,
            is_reviewed: row.get::<_, i32>(8)? != 0,
            review_count: row.get(9)?,
            last_reviewed_at: row.get(10)?,
            next_review_at: row.get(11)?,
            ease_factor: row.get(12)?,
        })
    })
    .map_err(|e| format!("查询失败: {}", e))?;
    
    let mut notes = Vec::new();
    for note in notes_iter {
        notes.push(note.map_err(|e| format!("读取笔记失败: {}", e))?);
    }
    
    Ok(notes)
}

// 根据时间范围获取笔记
// 如果提供了时间范围，则查询该时间段内的所有笔记（包括已复习的）
// 如果没有提供时间范围，则只查询未复习的笔记（向后兼容）
fn get_notes_by_time_range(
    db_path: &std::path::PathBuf,
    start_time: Option<i64>,
    end_time: Option<i64>,
) -> Result<Vec<Note>, String> {
    let conn = Connection::open(db_path)
        .map_err(|e| format!("打开数据库失败: {}", e))?;
    
    // 构建 SQL 查询
    // 如果用户选择了特定时间段，查询该时间段的所有笔记（包括已复习的）
    // 这样可以支持根据艾宾浩斯曲线复习已复习过的内容
    let mut query = "SELECT id, content, source, note_type, content_type, category, image_path, created_at, is_reviewed, review_count, last_reviewed_at, next_review_at, ease_factor 
         FROM notes".to_string();
    let mut params: Vec<i64> = Vec::new();
    let mut conditions = Vec::new();
    
    // 如果提供了时间范围，不限制 is_reviewed；否则只查询未复习的笔记
    if start_time.is_none() && end_time.is_none() {
        // 没有提供时间范围，默认只查询未复习的笔记（向后兼容）
        conditions.push("is_reviewed = 0".to_string());
    }
    
    if let Some(start) = start_time {
        conditions.push("created_at >= ?".to_string());
        params.push(start);
    }
    
    if let Some(end) = end_time {
        conditions.push("created_at <= ?".to_string());
        params.push(end);
    }
    
    if !conditions.is_empty() {
        query.push_str(" WHERE ");
        query.push_str(&conditions.join(" AND "));
    }
    
    query.push_str(" ORDER BY created_at ASC");
    
    let mut stmt = conn.prepare(&query)
        .map_err(|e| format!("准备查询失败: {}", e))?;
    
    // 定义统一的闭包来解析行数据
    let parse_row = |row: &rusqlite::Row| -> rusqlite::Result<Note> {
        Ok(Note {
            id: row.get(0)?,
            content: row.get(1)?,
            source: row.get(2)?,
            note_type: row.get(3)?,
            content_type: row.get(4)?,
            category: row.get(5)?,
            image_path: row.get(6)?,
            created_at: row.get(7)?,
            is_reviewed: row.get::<_, i32>(8)? != 0,
            review_count: row.get(9)?,
            last_reviewed_at: row.get(10)?,
            next_review_at: row.get(11)?,
            ease_factor: row.get(12)?,
        })
    };
    
    // 根据参数数量执行查询
    let notes_iter = if params.is_empty() {
        stmt.query_map([], parse_row)
    } else if params.len() == 1 {
        stmt.query_map([params[0]], parse_row)
    } else {
        stmt.query_map([params[0], params[1]], parse_row)
    }
    .map_err(|e| format!("查询失败: {}", e))?;
    
    let mut notes = Vec::new();
    for note in notes_iter {
        notes.push(note.map_err(|e| format!("读取笔记失败: {}", e))?);
    }
    
    Ok(notes)
}

// 生成每日复习
#[tauri::command]
async fn generate_daily_review(
    api_key: String,
    base_url: String,
    model_name: String,
    start_time: Option<i64>,
    end_time: Option<i64>,
    db_state: tauri::State<'_, Mutex<DbState>>,
) -> Result<String, String> {
    println!("🔍 [生成试卷] ========== 开始调试 ==========");
    println!("📥 [生成试卷] 接收到的参数:");
    println!("   - model_name: {}", model_name);
    println!("   - base_url: {}", base_url);
    println!("   - api_key: {}...{}", safe_truncate(&api_key, 10), if api_key.len() > 10 { "..." } else { "" });
    println!("   - start_time: {:?}", start_time);
    println!("   - end_time: {:?}", end_time);
    
    // 获取数据库路径
    let db_path = {
        let state = db_state.lock().map_err(|e| format!("获取数据库状态失败: {}", e))?;
        state.db_path.clone()
    };
    
    // 优先查询到期的笔记（next_review_at <= 当前时间）
    // 如果提供了时间范围，则使用时间范围查询；否则优先查询到期的笔记
    let notes = if start_time.is_some() || end_time.is_some() {
        // 如果提供了时间范围，使用时间范围查询（保持向后兼容）
        get_notes_by_time_range(&db_path, start_time, end_time)?
    } else {
        // 优先查询到期的笔记
        let due_notes = get_due_notes(&db_path)?;
        println!("📅 [生成试卷] 找到 {} 条到期的笔记", due_notes.len());
        
        // 如果到期的笔记不足 10 条，补充一些新笔记
        if due_notes.len() < 10 {
            let additional_notes = get_unreviewed_notes(&db_path)?;
            println!("📝 [生成试卷] 找到 {} 条未复习的笔记作为补充", additional_notes.len());
            
            // 合并到期笔记和新笔记，去重
            let mut all_notes = due_notes;
            let due_ids: HashSet<i64> = all_notes.iter().map(|n| n.id).collect();
            
            for note in additional_notes {
                if !due_ids.contains(&note.id) {
                    all_notes.push(note);
                }
            }
            
            all_notes
        } else {
            due_notes
        }
    };
    
    if notes.is_empty() {
        let time_range_msg = match (start_time, end_time) {
            (Some(start), Some(end)) => format!("在指定时间范围内（{} 到 {}）", start, end),
            (Some(start), None) => format!("从 {} 开始", start),
            (None, Some(end)) => format!("到 {} 为止", end),
            (None, None) => "在到期的笔记和未复习的笔记中".to_string(),
        };
        println!("⚠️ [生成试卷] {}没有笔记", time_range_msg);
        return Err("在选择的复习范围内没有笔记".to_string());
    }
    
    println!("📝 [生成试卷] 找到 {} 条笔记", notes.len());
    
    // 智能抽样：如果笔记数量超过 10 条，随机打乱后取前 10 条
    let notes_to_use: Vec<&Note> = if notes.len() > 10 {
        println!("🎲 [生成试卷] 笔记数量超过 10 条，进行随机抽样...");
        let mut notes_vec: Vec<&Note> = notes.iter().collect();
        let mut rng = thread_rng();
        notes_vec.shuffle(&mut rng);
        notes_vec.into_iter().take(10).collect()
    } else {
        notes.iter().collect()
    };
    
    println!("📝 [生成试卷] 最终使用 {} 条笔记（避免请求过大）", notes_to_use.len());
    
    // 组合所有笔记内容
    let notes_content: String = notes_to_use
        .iter()
        .enumerate()
        .map(|(i, note)| {
            format!(
                "笔记 {}:\n{}\n",
                i + 1,
                note.content
            )
        })
        .collect();
    
    // 构建用户消息
    let user_message = format!("以下是我昨天记录的笔记：\n\n{}", notes_content);
    
    // 构建 API 请求
    let system_prompt = r#"你是一个学习助手。用户会给你一些碎片笔记，请根据这些内容生成 3 道选择题和 1 道简答题，用于测试用户是否理解。

重要：你必须只返回纯 JSON 格式的数据，不要包含任何 Markdown 代码块标记（如 ```json 或 ```）。
请输出压缩后的 JSON (Minified JSON)，不要包含任何换行符或多余空格，以加快生成速度。

JSON 结构必须是一个数组，每个元素包含以下字段：
- id: 数字（从 1 开始）
- type: 字符串，值为 "choice"（选择题）或 "qa"（简答题）
- question: 题目文本
- options: 字符串数组（如果是选择题则包含 4 个选项，如果是简答题则为空数组）
- answer: 正确答案（选择题为选项字母如 "A"，简答题为答案文本）
- explanation: 解析说明

示例格式：
[
  {
    "id": 1,
    "type": "choice",
    "question": "题目内容",
    "options": ["选项A", "选项B", "选项C", "选项D"],
    "answer": "A",
    "explanation": "解析内容"
  },
  {
    "id": 2,
    "type": "qa",
    "question": "简答题题目",
    "options": [],
    "answer": "答案内容",
    "explanation": "解析内容"
  }
]"#;
    
    let request = ChatRequest {
        model: model_name.clone(),
        messages: vec![
            ChatMessage {
                role: "system".to_string(),
                content: system_prompt.to_string(),
            },
            ChatMessage {
                role: "user".to_string(),
                content: user_message.clone(),
            },
        ],
        temperature: Some(0.7),
        stream: Some(false), // 显式禁用流式连接
    };
    
    // 打印请求体
    let request_json = serde_json::to_string_pretty(&request)
        .unwrap_or_else(|e| format!("序列化请求失败: {}", e));
    println!("📤 [生成试卷] 准备发送的请求体:");
    println!("{}", request_json);
    
    // 创建配置好的 HTTP 客户端
    let client = create_http_client()?;
    println!("🔧 [生成试卷] HTTP 客户端已创建，超时设置: 连接 15s, 总超时 120s");
    
    // 调用 OpenAI API
    let url = format!("{}/chat/completions", base_url.trim_end_matches('/'));
    println!("🌐 [生成试卷] 请求 URL: {}", url);
    println!("⏳ [生成试卷] 正在发送 HTTP 请求（异步执行，不会阻塞主线程）...");
    
    let response = client
        .post(&url)
        .header("Authorization", format!("Bearer {}", api_key))
        .header("Content-Type", "application/json")
        .json(&request)
        .send()
        .await
        .map_err(|e| {
            let error_str = e.to_string();
            let error_msg = if error_str.contains("timeout") || error_str.contains("timed out") {
                if error_str.contains("connect") {
                    format!("连接超时（15秒内无法连接到服务器）: {}", error_str)
                } else {
                    format!("请求超时（120秒内未收到完整响应）: {}", error_str)
                }
            } else {
                format!("API 请求失败: {}", error_str)
            };
            println!("❌ [生成试卷] HTTP 请求失败: {}", error_msg);
            error_msg
        })?;
    
    println!("📥 [生成试卷] 收到 HTTP 响应，状态码: {}", response.status());
    
    if !response.status().is_success() {
        let status = response.status();
        let error_text = response.text().await.unwrap_or_else(|_| "未知错误".to_string());
        println!("❌ [生成试卷] API 返回错误状态码: {}", status);
        println!("❌ [生成试卷] 错误响应内容: {}", error_text);
        return Err(format!("API 返回错误 ({}): {}", status, error_text));
    }
    
    // 先获取原始响应文本
    let response_text = response.text().await.map_err(|e| {
        let error_msg = format!("读取响应文本失败: {}", e);
        println!("❌ [生成试卷] 读取响应文本失败: {}", error_msg);
        error_msg
    })?;
    
    println!("📄 [生成试卷] ========== 原始 AI 响应 ==========");
    println!("{}", response_text);
    println!("📄 [生成试卷] ========== 原始响应结束 ==========");
    
    // 尝试解析为 ChatResponse
    let chat_response: ChatResponse = serde_json::from_str(&response_text).map_err(|e| {
        let error_msg = format!("解析响应 JSON 失败: {}", e);
        println!("❌ [生成试卷] JSON 解析失败:");
        println!("   错误类型: {:?}", e.classify());
        println!("   错误位置: line {}, column {}", e.line(), e.column());
        println!("   错误详情: {}", e);
        error_msg
    })?;
    
    if chat_response.choices.is_empty() {
        println!("❌ [生成试卷] API 返回空响应（choices 为空）");
        return Err("API 返回空响应".to_string());
    }
    
    let ai_response = chat_response.choices[0].message.content.clone();
    println!("✅ [生成试卷] 成功提取 AI 响应内容，长度: {} 字符", ai_response.len());
    
    // 清理响应文本，移除可能的 Markdown 代码块标记
    println!("🧹 [生成试卷] 开始清理响应文本...");
    println!("📝 [生成试卷] 清理前的响应（前 200 字符）: {}", safe_truncate(&ai_response, 200));
    
    let cleaned_response = clean_json_string(&ai_response);
    
    println!("📝 [生成试卷] 清理后的响应（前 200 字符）: {}", safe_truncate(&cleaned_response, 200));
    println!("📝 [生成试卷] 清理后的响应完整长度: {} 字符", cleaned_response.len());
    
    // 尝试解析为 JSON
    println!("🔍 [生成试卷] 开始解析 JSON...");
    match serde_json::from_str::<Vec<QuizQuestion>>(&cleaned_response) {
        Ok(questions) => {
            println!("✅ [生成试卷] 成功解析 {} 道题目", questions.len());
            for (i, q) in questions.iter().enumerate() {
                println!("   题目 {}: {} (类型: {})", i + 1, safe_truncate(&q.question, 50), q.question_type);
            }
            // 返回 JSON 字符串给前端
            let result = serde_json::to_string(&questions)
                .map_err(|e| format!("序列化题目数据失败: {}", e));
            println!("✅ [生成试卷] ========== 调试结束 ==========");
            result
        }
        Err(e) => {
            println!("❌ [生成试卷] JSON 解析失败:");
            println!("   错误类型: {:?}", e.classify());
            println!("   错误位置: line {}, column {}", e.line(), e.column());
            println!("   错误详情: {}", e);
            println!("   清理后的响应（完整）:");
            println!("   {}", cleaned_response);
            println!("❌ [生成试卷] ========== 调试结束（失败） ==========");
            Err(format!("AI 返回的数据格式不正确，无法解析为题目。错误: {}。原始响应: {}", e, cleaned_response))
        }
    }
}

// 获取所有未复习的笔记
fn get_unreviewed_notes(db_path: &std::path::PathBuf) -> Result<Vec<Note>, String> {
    let conn = Connection::open(db_path)
        .map_err(|e| format!("打开数据库失败: {}", e))?;
    
    let mut stmt = conn.prepare(
        "SELECT id, content, source, note_type, content_type, category, image_path, created_at, is_reviewed, review_count, last_reviewed_at, next_review_at, ease_factor 
         FROM notes 
         WHERE is_reviewed = 0
         ORDER BY created_at DESC"
    )
    .map_err(|e| format!("准备查询失败: {}", e))?;
    
    let notes_iter = stmt.query_map([], |row| {
        Ok(Note {
            id: row.get(0)?,
            content: row.get(1)?,
            source: row.get(2)?,
            note_type: row.get(3)?,
            content_type: row.get(4)?,
            category: row.get(5)?,
            image_path: row.get(6)?,
            created_at: row.get(7)?,
            is_reviewed: row.get::<_, i32>(8)? != 0,
            review_count: row.get(9)?,
            last_reviewed_at: row.get(10)?,
            next_review_at: row.get(11)?,
            ease_factor: row.get(12)?,
        })
    })
    .map_err(|e| format!("查询失败: {}", e))?;
    
    let mut notes = Vec::new();
    for note in notes_iter {
        notes.push(note.map_err(|e| format!("读取笔记失败: {}", e))?);
    }
    
    Ok(notes)
}

// 生成跨学科洞察
#[tauri::command]
async fn generate_insights(
    api_key: String,
    base_url: String,
    model_name: String,
    db_state: tauri::State<'_, Mutex<DbState>>,
) -> Result<String, String> {
    println!("🔍 [思维启发] ========== 开始调试 ==========");
    println!("📥 [思维启发] 接收到的参数:");
    println!("   - model_name: {}", model_name);
    println!("   - base_url: {}", base_url);
    println!("   - api_key: {}...{}", safe_truncate(&api_key, 10), if api_key.len() > 10 { "..." } else { "" });
    
    // 获取数据库路径
    let db_path = {
        let state = db_state.lock().map_err(|e| format!("获取数据库状态失败: {}", e))?;
        state.db_path.clone()
    };
    
    // 获取所有未复习的笔记
    let notes = get_unreviewed_notes(&db_path)?;
    
    if notes.is_empty() {
        println!("⚠️ [思维启发] 没有未复习的笔记");
        return Err("没有未复习的笔记".to_string());
    }
    
    println!("📝 [思维启发] 找到 {} 条未复习的笔记", notes.len());
    
    // 限制笔记数量为前 10 条，避免请求过大
    let notes_to_use: Vec<_> = notes.iter().take(10).collect();
    println!("📝 [思维启发] 限制为前 {} 条笔记（避免请求过大）", notes_to_use.len());
    
    // 组合所有笔记内容
    let notes_content: String = notes_to_use
        .iter()
        .enumerate()
        .map(|(i, note)| {
            format!(
                "笔记 {}:\n{}\n",
                i + 1,
                note.content
            )
        })
        .collect();
    
    // 构建用户消息
    let user_message = format!("以下是我记录的碎片化信息：\n\n{}", notes_content);
    
    // 构建 API 请求
    let request = ChatRequest {
        model: model_name.clone(),
        messages: vec![
            ChatMessage {
                role: "system".to_string(),
                content: "你是一个跨学科思维导师。用户会给你碎片化的信息。请分析这些信息之间的潜在联系，或者用其他学科的视角（如生物学、经济学、物理学）对这些概念进行类比和解释，给用户意想不到的启发。".to_string(),
            },
            ChatMessage {
                role: "user".to_string(),
                content: user_message.clone(),
            },
        ],
        temperature: Some(0.7),
        stream: Some(false), // 显式禁用流式连接
    };
    
    // 打印请求体
    let request_json = serde_json::to_string_pretty(&request)
        .unwrap_or_else(|e| format!("序列化请求失败: {}", e));
    println!("📤 [思维启发] 准备发送的请求体:");
    println!("{}", request_json);
    
    // 创建配置好的 HTTP 客户端
    let client = create_http_client()?;
    println!("🔧 [思维启发] HTTP 客户端已创建，超时设置: 连接 15s, 总超时 120s");
    
    // 调用 OpenAI API
    let url = format!("{}/chat/completions", base_url.trim_end_matches('/'));
    println!("🌐 [思维启发] 请求 URL: {}", url);
    println!("⏳ [思维启发] 正在发送 HTTP 请求（异步执行，不会阻塞主线程）...");
    
    let response = client
        .post(&url)
        .header("Authorization", format!("Bearer {}", api_key))
        .header("Content-Type", "application/json")
        .json(&request)
        .send()
        .await
        .map_err(|e| {
            let error_str = e.to_string();
            let error_msg = if error_str.contains("timeout") || error_str.contains("timed out") {
                if error_str.contains("connect") {
                    format!("连接超时（15秒内无法连接到服务器）: {}", error_str)
                } else {
                    format!("请求超时（120秒内未收到完整响应）: {}", error_str)
                }
            } else {
                format!("API 请求失败: {}", error_str)
            };
            println!("❌ [思维启发] HTTP 请求失败: {}", error_msg);
            error_msg
        })?;
    
    println!("📥 [思维启发] 收到 HTTP 响应，状态码: {}", response.status());
    
    if !response.status().is_success() {
        let status = response.status();
        let error_text = response.text().await.unwrap_or_else(|_| "未知错误".to_string());
        println!("❌ [思维启发] API 返回错误状态码: {}", status);
        println!("❌ [思维启发] 错误响应内容: {}", error_text);
        return Err(format!("API 返回错误 ({}): {}", status, error_text));
    }
    
    // 先获取原始响应文本
    let response_text = response.text().await.map_err(|e| {
        let error_msg = format!("读取响应文本失败: {}", e);
        println!("❌ [思维启发] 读取响应文本失败: {}", error_msg);
        error_msg
    })?;
    
    println!("📄 [思维启发] ========== 原始 AI 响应 ==========");
    println!("{}", response_text);
    println!("📄 [思维启发] ========== 原始响应结束 ==========");
    
    // 尝试解析为 ChatResponse
    let chat_response: ChatResponse = serde_json::from_str(&response_text).map_err(|e| {
        let error_msg = format!("解析响应 JSON 失败: {}", e);
        println!("❌ [思维启发] JSON 解析失败:");
        println!("   错误类型: {:?}", e.classify());
        println!("   错误位置: line {}, column {}", e.line(), e.column());
        println!("   错误详情: {}", e);
        error_msg
    })?;
    
    if chat_response.choices.is_empty() {
        println!("❌ [思维启发] API 返回空响应（choices 为空）");
        return Err("API 返回空响应".to_string());
    }
    
    let result = chat_response.choices[0].message.content.clone();
    println!("✅ [思维启发] 成功提取 AI 响应内容，长度: {} 字符", result.len());
    println!("✅ [思维启发] ========== 调试结束 ==========");
    Ok(result)
}

// 标记所有未复习的笔记为已复习
#[tauri::command]
fn mark_notes_as_reviewed(db_state: tauri::State<'_, Mutex<DbState>>) -> Result<usize, String> {
    let db_path = {
        let state = db_state.lock().map_err(|e| format!("获取数据库状态失败: {}", e))?;
        state.db_path.clone()
    };
    
    let conn = Connection::open(&db_path)
        .map_err(|e| format!("打开数据库失败: {}", e))?;
    
    let count = conn
        .execute(
            "UPDATE notes SET is_reviewed = 1 WHERE is_reviewed = 0",
            [],
        )
        .map_err(|e| format!("更新笔记失败: {}", e))?;
    
    Ok(count)
}

// 获取仪表盘统计数据
#[tauri::command]
fn get_dashboard_stats(
    db_state: tauri::State<'_, Mutex<DbState>>,
) -> Result<serde_json::Value, String> {
    let db_path = {
        let state = db_state.lock().map_err(|e| format!("获取数据库状态失败: {}", e))?;
        state.db_path.clone()
    };
    
    let conn = Connection::open(&db_path)
        .map_err(|e| format!("打开数据库失败: {}", e))?;
    
    let current_time = Utc::now().timestamp();
    let today_start = Utc::now().date_naive().and_hms_opt(0, 0, 0)
        .unwrap()
        .and_utc()
        .timestamp();
    
    // 总笔记数
    let total_notes: i64 = conn.query_row(
        "SELECT COUNT(*) FROM notes",
        [],
        |row| row.get(0),
    )
    .map_err(|e| format!("查询总笔记数失败: {}", e))?;
    
    // 待复习项（next_review_at <= 当前时间 或 next_review_at IS NULL AND is_reviewed = 0）
    let due_reviews: i64 = conn.query_row(
        "SELECT COUNT(*) FROM notes WHERE (next_review_at IS NOT NULL AND next_review_at <= ?) OR (next_review_at IS NULL AND is_reviewed = 0)",
        [current_time],
        |row| row.get(0),
    )
    .map_err(|e| format!("查询待复习项失败: {}", e))?;
    
    // 今日已复习（last_reviewed_at 是今天）
    let today_reviewed: i64 = conn.query_row(
        "SELECT COUNT(*) FROM notes WHERE last_reviewed_at IS NOT NULL AND last_reviewed_at >= ?",
        [today_start],
        |row| row.get(0),
    )
    .map_err(|e| format!("查询今日已复习失败: {}", e))?;
    
    // 平均 ease_factor
    let avg_ease_factor: f64 = conn.query_row(
        "SELECT AVG(ease_factor) FROM notes WHERE ease_factor IS NOT NULL",
        [],
        |row| row.get(0),
    )
    .unwrap_or(2.5); // 如果没有数据，默认 2.5
    
    Ok(serde_json::json!({
        "total_notes": total_notes,
        "due_reviews": due_reviews,
        "today_reviewed": today_reviewed,
        "avg_ease_factor": avg_ease_factor,
    }))
}

// 获取热力图数据（过去365天的活动）
#[tauri::command]
fn get_heatmap_data(
    db_state: tauri::State<'_, Mutex<DbState>>,
) -> Result<serde_json::Value, String> {
    let db_path = {
        let state = db_state.lock().map_err(|e| format!("获取数据库状态失败: {}", e))?;
        state.db_path.clone()
    };
    
    let conn = Connection::open(&db_path)
        .map_err(|e| format!("打开数据库失败: {}", e))?;
    
    // 计算365天前的日期
    let end_date = Utc::now().date_naive();
    let start_date = end_date - chrono::Duration::days(365);
    let start_timestamp = start_date.and_hms_opt(0, 0, 0)
        .unwrap()
        .and_utc()
        .timestamp();
    
    // 查询每天创建的笔记数
    let mut stmt = conn.prepare(
        "SELECT 
             DATE(created_at, 'unixepoch', 'localtime') as date,
             COUNT(*) as count
          FROM notes
          WHERE created_at >= ?
          GROUP BY date
          ORDER BY date"
    )
    .map_err(|e| format!("准备查询失败: {}", e))?;
    
    let mut created_map: std::collections::HashMap<String, i64> = std::collections::HashMap::new();
    let rows = stmt.query_map([start_timestamp], |row| {
        Ok((
            row.get::<_, String>(0)?,
            row.get::<_, i64>(1)?,
        ))
    })
    .map_err(|e| format!("查询失败: {}", e))?;
    
    for row in rows {
        let (date, count) = row.map_err(|e| format!("读取数据失败: {}", e))?;
        created_map.insert(date, count);
    }
    
    // 查询每天复习的笔记数
    let mut stmt2 = conn.prepare(
        "SELECT 
             DATE(last_reviewed_at, 'unixepoch', 'localtime') as date,
             COUNT(*) as count
          FROM notes
          WHERE last_reviewed_at IS NOT NULL AND last_reviewed_at >= ?
          GROUP BY date
          ORDER BY date"
    )
    .map_err(|e| format!("准备查询失败: {}", e))?;
    
    let mut reviewed_map: std::collections::HashMap<String, i64> = std::collections::HashMap::new();
    let rows2 = stmt2.query_map([start_timestamp], |row| {
        Ok((
            row.get::<_, String>(0)?,
            row.get::<_, i64>(1)?,
        ))
    })
    .map_err(|e| format!("查询失败: {}", e))?;
    
    for row in rows2 {
        let (date, count) = row.map_err(|e| format!("读取数据失败: {}", e))?;
        reviewed_map.insert(date, count);
    }
    
    // 合并数据：每天的总活动数 = 创建数 + 复习数
    let mut heatmap_data: std::collections::HashMap<String, i64> = std::collections::HashMap::new();
    
    // 添加创建数据
    for (date, count) in created_map {
        *heatmap_data.entry(date).or_insert(0) += count;
    }
    
    // 添加复习数据
    for (date, count) in reviewed_map {
        *heatmap_data.entry(date).or_insert(0) += count;
    }
    
    // 转换为 JSON 格式
    let mut result = Vec::new();
    for (date, count) in heatmap_data {
        result.push(serde_json::json!({
            "date": date,
            "count": count,
        }));
    }
    
    Ok(serde_json::json!(result))
}

// 更新笔记复习状态（SuperMemo-2 算法）
#[tauri::command]
fn update_review_status(
    note_id: i64,
    quality: i32,
    db_state: tauri::State<'_, Mutex<DbState>>,
) -> Result<(), String> {
    // 验证 quality 范围 (0-5)
    if quality < 0 || quality > 5 {
        return Err("quality 必须在 0-5 之间".to_string());
    }
    
    let db_path = {
        let state = db_state.lock().map_err(|e| format!("获取数据库状态失败: {}", e))?;
        state.db_path.clone()
    };
    
    let conn = Connection::open(&db_path)
        .map_err(|e| format!("打开数据库失败: {}", e))?;
    
    // 获取当前笔记的复习状态
    let mut stmt = conn.prepare(
        "SELECT review_count, ease_factor, last_reviewed_at, next_review_at FROM notes WHERE id = ?"
    )
    .map_err(|e| format!("准备查询失败: {}", e))?;
    
    let (current_review_count, current_ease_factor, last_reviewed_at, previous_next_review_at) = stmt.query_row(
        [note_id],
        |row| {
            Ok((
                row.get::<_, i64>(0)?,
                row.get::<_, f64>(1)?,
                row.get::<_, Option<i64>>(2)?,
                row.get::<_, Option<i64>>(3)?,
            ))
        }
    )
    .map_err(|e| format!("查询笔记失败: {}", e))?;
    
    let current_time = Utc::now().timestamp();
    
    // SuperMemo-2 算法逻辑
    if quality < 3 {
        // 忘记：重置复习状态
        // review_count = 0, interval = 1 (天)
        let interval_days = 1;
        let next_review_at = current_time + (interval_days * 24 * 60 * 60);
        
        conn.execute(
            "UPDATE notes SET review_count = 0, ease_factor = 2.5, last_reviewed_at = ?, next_review_at = ?, is_reviewed = 0 WHERE id = ?",
            rusqlite::params![current_time, next_review_at, note_id],
        )
        .map_err(|e| format!("更新笔记失败: {}", e))?;
        
        println!("⚠️ [SM-2] 笔记 {} 复习失败，已重置: review_count=0, ease_factor=2.5, interval={}天", 
                 note_id, interval_days);
    } else {
        // 记得：更新复习次数和间隔
        // 先计算新的 ease_factor
        // EF' = EF + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
        // 其中 q 是 quality (0-5)
        let q = quality as f64;
        let ease_factor_change = 0.1 - (5.0 - q) * (0.08 + (5.0 - q) * 0.02);
        let mut new_ease_factor = current_ease_factor + ease_factor_change;
        
        // ease_factor 最小值为 1.3
        if new_ease_factor < 1.3 {
            new_ease_factor = 1.3;
        }
        
        // 根据当前的 review_count 计算间隔（天数）
        let interval_days = if current_review_count == 0 {
            // review_count = 0: interval = 1
            1
        } else if current_review_count == 1 {
            // review_count = 1: interval = 6
            6
        } else {
            // review_count > 1: interval = last_interval * ease_factor
            // 计算上次的间隔（天数）
            let previous_interval_days = if let (Some(last_reviewed), Some(previous_next)) = (last_reviewed_at, previous_next_review_at) {
                // 使用上次的 next_review_at - last_reviewed_at 作为上次间隔
                let interval_seconds = previous_next - last_reviewed;
                (interval_seconds as f64 / (24.0 * 60.0 * 60.0)).max(1.0)
            } else {
                // 如果无法获取，使用默认值 6 天
                6.0
            };
            
            // 新间隔 = 上次间隔 * ease_factor（使用新的 ease_factor）
            let calculated_interval = previous_interval_days * new_ease_factor;
            calculated_interval.max(1.0) as i64
        };
        
        // 更新 review_count（递增）
        let new_review_count = current_review_count + 1;
        
        // 计算下次复习时间（当前时间 + interval_days 的秒数）
        let next_review_at = current_time + (interval_days * 24 * 60 * 60);
        
        // 更新数据库
        conn.execute(
            "UPDATE notes SET review_count = ?, ease_factor = ?, last_reviewed_at = ?, next_review_at = ?, is_reviewed = 1 WHERE id = ?",
            rusqlite::params![new_review_count, new_ease_factor, current_time, next_review_at, note_id],
        )
        .map_err(|e| format!("更新笔记失败: {}", e))?;
        
        println!("✅ [SM-2] 笔记 {} 复习成功: review_count={}->{}, ease_factor={:.2}->{:.2}, interval={}天", 
                 note_id, current_review_count, new_review_count, current_ease_factor, new_ease_factor, interval_days);
    }
    
    Ok(())
}

// 处理剪贴板内容（支持文本和图片）
fn handle_clipboard_content(
    app: tauri::AppHandle,
    db_path: std::path::PathBuf,
    category: String,
) {
    println!("🎹 [全局快捷键] 快捷键被触发，开始处理... (category: {})", category);
    // 在异步上下文中处理，避免阻塞
    tauri::async_runtime::spawn(async move {
        // 读取剪贴板内容
        println!("📋 [全局快捷键] 正在读取剪贴板内容...");
        
        let mut clipboard = match arboard::Clipboard::new() {
            Ok(clip) => clip,
            Err(e) => {
                eprintln!("初始化剪贴板失败: {}", e);
                return;
            }
        };
        
        // 先尝试读取图片
        let image_result = clipboard.get_image();
        let (content, content_type, image_path) = match image_result {
            Ok(img) => {
                println!("📸 [全局快捷键] 检测到剪贴板中的图片，尺寸: {}x{}", img.width, img.height);
                // 将图片数据转换为 PNG 格式
                // 注意：arboard 返回的是 RGBA 格式的字节数组
                let image_data = img.bytes.to_vec();
                
                // 获取应用数据目录
                let app_data_dir = db_path.parent().expect("无法获取应用数据目录").to_path_buf();
                
                // 保存图片
                match save_image_to_local(&app_data_dir, &image_data) {
                    Ok(path) => {
                        println!("📸 [全局快捷键] 图片已保存: {}", path);
                        (format!("图片已保存: {}", path), "image".to_string(), Some(path))
                    }
                    Err(e) => {
                        eprintln!("❌ [全局快捷键] 保存图片失败: {}", e);
                        return;
                    }
                }
            }
            Err(_) => {
                // 不是图片，尝试读取文本
                match clipboard.get_text() {
                    Ok(text) => {
                        if text.trim().is_empty() {
                            println!("剪贴板内容为空，跳过保存");
                            return;
                        }
                        println!("📝 [全局快捷键] 检测到剪贴板中的文本，长度: {} 字符", text.len());
                        (text, "text".to_string(), None)
                    }
                    Err(e) => {
                        eprintln!("读取剪贴板文本失败: {}", e);
                        return;
                    }
                }
            }
        };

        println!("📋 [全局快捷键] 剪贴板内容读取成功，类型: {}, 长度: {} 字符", content_type, content.len());
        // 保存到数据库
        println!("💾 [全局快捷键] 开始保存笔记到数据库...");
        match save_note_to_db(&db_path, content.clone(), None, Some(category.clone()), Some(content_type.clone()), image_path) {
                Ok(note_id) => {
                    let preview = if content.len() > 50 {
                        format!("{}...", safe_truncate(&content, 50))
                    } else {
                        content.clone()
                    };
                    println!("✅ [全局快捷键] 数据库写入成功! ID: {}, 内容预览: {}", note_id, preview);
                    
                    // 发送系统通知
                    let notification_title = "MindLoop";
                    let notification_body = if content.len() > 20 {
                        format!("已保存：{}...", safe_truncate(&content, 20))
                    } else {
                        format!("已保存：{}", content)
                    };
                    
                    // 使用 Tauri 通知插件发送系统通知
                    println!("🔔 [通知] 准备发送通知，标题: {}, 内容: {}", notification_title, notification_body);
                    let app_clone = app.clone();
                    let title_clone = notification_title.to_string();
                    let body_clone = notification_body.clone();
                    tauri::async_runtime::spawn(async move {
                        println!("🔔 [通知] 进入异步任务，开始构建通知...");
                        // 使用通知插件的 Builder API
                        let notification = app_clone.notification();
                        println!("🔔 [通知] 获取 notification 对象成功");
                        let builder = notification.builder();
                        println!("🔔 [通知] 获取 builder 成功");
                        let builder = builder.title(&title_clone);
                        println!("🔔 [通知] 设置标题成功: {}", title_clone);
                        let builder = builder.body(&body_clone);
                        println!("🔔 [通知] 设置内容成功: {}", body_clone);
                        match builder.show() {
                            Ok(_) => {
                                println!("🔔 [通知] ✅ 系统通知发送成功: {}", body_clone);
                            }
                            Err(e) => {
                                eprintln!("🔔 [通知] ❌ 发送系统通知失败: {:?}", e);
                                eprintln!("🔔 [通知] 错误详情: {}", e);
                            }
                        }
                    });
                    
                    // 向前端发送事件（如果前端有监听器）
                    if let Err(e) = app.emit("note-saved", serde_json::json!({
                        "id": note_id,
                        "content": content,
                        "message": "笔记已保存"
                    })) {
                        eprintln!("发送事件失败: {}", e);
                    }
                }
                Err(e) => {
                    eprintln!("❌ 保存笔记到数据库失败: {}", e);
                }
            }
    });
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_sql::Builder::default().build())
        .plugin(tauri_plugin_notification::init())
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .build(),
        )
        .invoke_handler(tauri::generate_handler![get_all_notes, generate_daily_review, generate_insights, mark_notes_as_reviewed, delete_note, update_note, update_review_status, get_dashboard_stats, get_heatmap_data])
        .setup(|app| {
            // 配置窗口磨砂效果
            let window = app.get_webview_window("main").unwrap();
            #[cfg(target_os = "macos")]
            apply_vibrancy(&window, NSVisualEffectMaterial::HudWindow, None, None)
                .expect("Unsupported platform! 'apply_vibrancy' is only supported on macOS");

            // 应用启动时初始化数据库
            let db_path = match init_database(app.handle()) {
                Ok(path) => path,
                Err(e) => {
                    eprintln!("数据库初始化失败: {}", e);
                    return Err(Box::new(e).into());
                }
            };

            // 将数据库路径存储到应用状态中
            app.manage(Mutex::new(DbState {
                db_path: db_path.clone(),
            }));

            // 注册第一个全局快捷键：快速摘录 (Command+Shift+X / Alt+X)
            // macOS 使用 Command+Shift+X，Windows/Linux 使用 Alt+X
            #[cfg(target_os = "macos")]
            let (shortcut1, shortcut1_str) = (
                Shortcut::new(Some(Modifiers::SUPER | Modifiers::SHIFT), Code::KeyX),
                "Command+Shift+X",
            );
            #[cfg(not(target_os = "macos"))]
            let (shortcut1, shortcut1_str) = (
                Shortcut::new(Some(Modifiers::ALT), Code::KeyX),
                "Alt+X",
            );
            
            // 注册第二个全局快捷键：待办收集 (Command+Shift+T / Alt+T)
            #[cfg(target_os = "macos")]
            let (shortcut2, shortcut2_str) = (
                Shortcut::new(Some(Modifiers::SUPER | Modifiers::SHIFT), Code::KeyT),
                "Command+Shift+T",
            );
            #[cfg(not(target_os = "macos"))]
            let (shortcut2, shortcut2_str) = (
                Shortcut::new(Some(Modifiers::ALT), Code::KeyT),
                "Alt+T",
            );
            
            // 注册第一个快捷键（快速摘录 - inbox）
            let _db_path_clone1 = db_path.clone();
            match app.handle()
                .global_shortcut()
                .on_shortcut(shortcut1, move |app, _, _| {
                    if let Some(db_state) = app.try_state::<Mutex<DbState>>() {
                        let db_path = {
                            let state = db_state.lock().unwrap();
                            state.db_path.clone()
                        };
                        handle_clipboard_content(app.clone(), db_path, "inbox".to_string());
                    }
                }) {
                Ok(_) => {
                    println!("✅ 快捷键注册成功: {} (快速摘录 - inbox)", shortcut1_str);
                }
                Err(e) => {
                    eprintln!("⚠️ 快捷键注册失败: {} - {}", shortcut1_str, e);
                    eprintln!("   提示: 该快捷键可能已被其他应用占用，或者需要 macOS 辅助功能权限");
                    eprintln!("   请前往 系统设置 > 隐私与安全性 > 辅助功能 中授权 MindLoop");
                }
            }

            // 注册第二个快捷键（待办收集 - todo）
            let _db_path_clone2 = db_path.clone();
            match app.handle()
                .global_shortcut()
                .on_shortcut(shortcut2, move |app, _, _| {
                    if let Some(db_state) = app.try_state::<Mutex<DbState>>() {
                        let db_path = {
                            let state = db_state.lock().unwrap();
                            state.db_path.clone()
                        };
                        handle_clipboard_content(app.clone(), db_path, "todo".to_string());
                    }
                }) {
                Ok(_) => {
                    println!("✅ 快捷键注册成功: {} (待办收集 - todo)", shortcut2_str);
                }
                Err(e) => {
                    eprintln!("⚠️ 快捷键注册失败: {} - {}", shortcut2_str, e);
                    eprintln!("   提示: 该快捷键可能已被其他应用占用，或者需要 macOS 辅助功能权限");
                    eprintln!("   请前往 系统设置 > 隐私与安全性 > 辅助功能 中授权 MindLoop");
                }
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}


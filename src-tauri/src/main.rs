
// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use rusqlite::{Connection, Result as SqlResult};
use tauri::{Emitter, Manager};
use tauri_plugin_global_shortcut::{Code, Modifiers, Shortcut, GlobalShortcutExt};
use tauri_plugin_notification::NotificationExt;
use std::sync::Mutex;
use rand::seq::SliceRandom;
use rand::thread_rng;

// 数据库连接状态（线程安全）
struct DbState {
    db_path: std::path::PathBuf,
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
    
    // 创建 notes 表
    conn.execute(
        "CREATE TABLE IF NOT EXISTS notes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            content TEXT NOT NULL,
            source TEXT,
            note_type TEXT NOT NULL DEFAULT 'text',
            created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
            is_reviewed INTEGER NOT NULL DEFAULT 0
        )",
        [],
    )?;
    
    // 插入测试数据（如果表是空的）
    let count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM notes",
        [],
        |row| row.get(0),
    ).unwrap_or(0);
    
    if count == 0 {
        println!("📝 [数据库初始化] 表为空，插入测试数据...");
        conn.execute(
            "INSERT INTO notes (content, source, note_type, created_at, is_reviewed) 
             VALUES (?1, ?2, 'text', strftime('%s', 'now'), 0)",
            ["这是一条测试笔记，用于验证数据库连接是否正常。", "系统测试"],
        )?;
        println!("✅ [数据库初始化] 测试数据插入成功");
    }
    
    println!("✅ [数据库初始化] 数据库初始化成功: {:?}", db_path);
    Ok(db_path)
}

// 笔记结构
#[derive(serde::Serialize)]
struct Note {
    id: i64,
    content: String,
    source: Option<String>,
    note_type: String,
    created_at: i64,
    is_reviewed: bool,
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
fn save_note_to_db(db_path: &std::path::PathBuf, content: String, source: Option<String>) -> SqlResult<i64> {
    println!("💾 [数据库] 打开数据库连接: {:?}", db_path);
    let conn = Connection::open(db_path)?;
    
    println!("💾 [数据库] 执行 INSERT 语句，内容长度: {}", content.len());
    conn.execute(
        "INSERT INTO notes (content, source, note_type, created_at, is_reviewed) 
         VALUES (?1, ?2, 'text', strftime('%s', 'now'), 0)",
        [&content, &source.unwrap_or_default()],
    )?;
    
    let note_id = conn.last_insert_rowid();
    println!("💾 [数据库] INSERT 成功，返回 ID: {}", note_id);
    Ok(note_id)
}

// 获取所有笔记
#[tauri::command]
fn get_all_notes(db_state: tauri::State<'_, Mutex<DbState>>) -> Result<Vec<Note>, String> {
    let db_path = {
        let state = db_state.lock().map_err(|e| format!("获取数据库状态失败: {}", e))?;
        state.db_path.clone()
    };
    
    let conn = Connection::open(&db_path)
        .map_err(|e| format!("打开数据库失败: {}", e))?;
    
    let mut stmt = conn.prepare(
        "SELECT id, content, source, note_type, created_at, is_reviewed 
         FROM notes 
         ORDER BY created_at DESC"
    )
    .map_err(|e| format!("准备查询失败: {}", e))?;
    
    let notes_iter = stmt.query_map([], |row| {
        Ok(Note {
            id: row.get(0)?,
            content: row.get(1)?,
            source: row.get(2)?,
            note_type: row.get(3)?,
            created_at: row.get(4)?,
            is_reviewed: row.get::<_, i32>(5)? != 0,
        })
    })
    .map_err(|e| format!("查询失败: {}", e))?;
    
    let mut notes = Vec::new();
    for note in notes_iter {
        notes.push(note.map_err(|e| format!("读取笔记失败: {}", e))?);
    }
    
    Ok(notes)
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
    let mut query = "SELECT id, content, source, note_type, created_at, is_reviewed 
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
            created_at: row.get(4)?,
            is_reviewed: row.get::<_, i32>(5)? != 0,
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
    
    // 根据时间范围获取笔记
    // 逻辑：
    // 1. 如果提供了时间范围（start_time 或 end_time 有值），查询该时间段的所有笔记（包括已复习的）
    // 2. 如果都没有提供（都是 None），查询所有未复习的笔记
    let notes = get_notes_by_time_range(&db_path, start_time, end_time)?;
    
    if notes.is_empty() {
        let time_range_msg = match (start_time, end_time) {
            (Some(start), Some(end)) => format!("在指定时间范围内（{} 到 {}）", start, end),
            (Some(start), None) => format!("从 {} 开始", start),
            (None, Some(end)) => format!("到 {} 为止", end),
            (None, None) => "在所有未复习的笔记中".to_string(),
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
        "SELECT id, content, source, note_type, created_at, is_reviewed 
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
            created_at: row.get(4)?,
            is_reviewed: row.get::<_, i32>(5)? != 0,
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

// 处理全局快捷键回调
fn handle_shortcut(app: tauri::AppHandle, db_path: std::path::PathBuf) {
    println!("🎹 [全局快捷键] 快捷键被触发，开始处理...");
    // 在异步上下文中处理，避免阻塞
    tauri::async_runtime::spawn(async move {
        // 读取剪贴板内容
        println!("📋 [全局快捷键] 正在读取剪贴板内容...");
        let clipboard_content = match arboard::Clipboard::new() {
            Ok(mut clipboard) => {
                match clipboard.get_text() {
                    Ok(text) => {
                        if text.trim().is_empty() {
                            println!("剪贴板内容为空，跳过保存");
                            return;
                        }
                        Some(text)
                    }
                    Err(e) => {
                        eprintln!("读取剪贴板失败: {}", e);
                        None
                    }
                }
            }
            Err(e) => {
                eprintln!("初始化剪贴板失败: {}", e);
                None
            }
        };

        if let Some(content) = clipboard_content {
            println!("📋 [全局快捷键] 剪贴板内容读取成功，长度: {} 字符", content.len());
            // 保存到数据库
            println!("💾 [全局快捷键] 开始保存笔记到数据库...");
            match save_note_to_db(&db_path, content.clone(), None) {
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
                .with_handler(move |app, _shortcut, _event| {
                    // 从应用状态获取数据库路径
                    if let Some(db_state) = app.try_state::<Mutex<DbState>>() {
                        let db_path = {
                            let state = db_state.lock().unwrap();
                            state.db_path.clone()
                        };
                        handle_shortcut(app.clone(), db_path);
                    }
                })
                .build(),
        )
        .invoke_handler(tauri::generate_handler![get_all_notes, generate_daily_review, generate_insights, mark_notes_as_reviewed])
        .setup(|app| {
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

            // 注册全局快捷键
            // macOS 使用 Command+Shift+X，Windows/Linux 使用 Alt+X
            #[cfg(target_os = "macos")]
            let (shortcut, shortcut_str) = (
                Shortcut::new(Some(Modifiers::SUPER | Modifiers::SHIFT), Code::KeyX),
                "Command+Shift+X",
            );
            #[cfg(not(target_os = "macos"))]
            let (shortcut, shortcut_str) = (
                Shortcut::new(Some(Modifiers::ALT), Code::KeyX),
                "Alt+X",
            );
            
            // 注册全局快捷键
            app.handle()
                .global_shortcut()
                .register(shortcut)
                .expect("注册全局快捷键失败");

            println!("🎹 全局快捷键注册成功: {}", shortcut_str);
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}


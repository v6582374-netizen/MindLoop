# 🧠 MindLoop (思维闭环)

<div align="center">

![MindLoop Banner](https://via.placeholder.com/1200x400.png?text=MindLoop+Banner)
**From Fragmentation to Wisdom.**
**从碎片到智慧：基于 Rust 与 AI 的本地化知识内化引擎。**

[![Rust](https://img.shields.io/badge/Built_with-Rust-orange?style=flat-square&logo=rust)](https://www.rust-lang.org/)
[![Tauri 2.0](https://img.shields.io/badge/Framework-Tauri_2.0-blue?style=flat-square&logo=tauri)](https://tauri.app/)
[![React](https://img.shields.io/badge/Frontend-React_18-61DAFB?style=flat-square&logo=react)](https://react.dev/)
[![Cursor](https://img.shields.io/badge/Built_with-Cursor_AI-black?style=flat-square)](https://cursor.com/)
[![License](https://img.shields.io/badge/license-MIT-green?style=flat-square)](LICENSE)

[核心功能](#-核心功能) • [技术栈](#-技术栈) • [安装指南](#-安装指南) • [Vibe Coding 开发故事](#-vibe-coding-开发故事)

</div>

---

## 📖 项目简介

**MindLoop** 不仅仅是一个笔记应用，它是为终身学习者、开发者和研究人员打造的**知识内化引擎**。

开发这个系统的理由有二：
1. 我认为未来AI时代的学习范式将被彻底重构，但是很少有人主动的探索和需求转变，而我又对当下的大学教育非常不满，于是想着先做个小工具提升我的自学效率，顺便是对新的学历路径的探索。
在信息过载的时代，我们收藏了太多内容，却记住了太少。尤其是在跨学科教育被大力推崇的今天，MindLoop 致力于解决“收藏”与“掌握”之间的断层。通过结合**本地优先（Local-First）**的隐私策略、**间隔重复算法（SRS）**以及**生成式 AI**，它能帮助你将碎片化的信息真正转化为长期的智慧。
你只管通过全局快捷键极速捕获灵感，剩下的——出题、复习、调度——交给 AI 和算法。

2. 这同时也是我的第一个vibe coding项目，所以也是对AI Agent辅助开发的尝试。



## ✨ 核心功能

### 🚀 极速捕获与灵感收集
* **全局快捷键：** 无论你在浏览网页还是阅读 PDF，按下 `Cmd+Shift+X` 即可瞬间摘录。
* **智能剪贴板：** 自动识别文本或图片，无需手动切换模式。
* **本地存储：** 所有数据存储于本地 SQLite 数据库 (`rusqlite`)。你的数据完全属于你，除非你主动请求 AI，否则绝不上云。

### 🧠 智能复习系统
* **AI 出题引擎：** 支持接入 **OpenAI** 或 **DeepSeek** 等大模型，自动将你的原始笔记转化为交互式试卷（选择题/简答题/思维启发）。
* **SRS 记忆算法：** 内置改良版 **SuperMemo-2** 算法。系统会根据你的记忆反馈（简单/困难/模糊），动态计算下一次复习的最佳时间点，对抗遗忘曲线。
* **复习仪表盘：** 通过 GitHub 风格的热力图和数据统计，直观展示你的学习轨迹。

### 🎨 企业级交互体验
* **现代化 UI：** 基于 **Shadcn/UI** 和 TailwindCSS 构建，提供干净、无干扰的沉浸式体验。
* **高效布局：** 侧边栏导航设计，在仪表盘、笔记库、任务清单和复习室之间无缝切换。
* **深色模式：** 专为夜间编码和深度阅读优化的配色方案。

### 🛡️ 隐私与自由
* **BYOK (Bring Your Own Key)：** 你完全控制 API Key。我们没有中间服务器，不通过二道贩子。
* **高度自定义：** 支持自定义 AI 的 System Prompt（提示词），定制属于你自己的苏格拉底式导师。

## 🛠 技术栈

MindLoop 构建在高性能的 "Rust-Frontend" 生态之上，兼顾了原生应用的性能与 Web 开发的灵活性。

* **核心后端 (Backend):** Rust 🦀 (负责系统调用、数据库、AI 流式处理)
* **应用框架:** Tauri 2.0 (提供极小的包体积和原生安全沙箱)
* **前端框架:** React + TypeScript + Vite
* **UI 组件库:** Shadcn/UI + TailwindCSS + Lucide Icons
* **数据库:** SQLite (通过 `rusqlite` 与 `tauri-plugin-sql`)
* **网络层:** `reqwest` (处理异步 AI 请求)

## ⚡️ Vibe Coding 开发故事

MindLoop 是 **Vibe Coding**（AI 辅助编程）理念的一次极致实践。

> “我作为架构师（Architect），Cursor AI 作为构建者（Builder），我们在极短的时间内从零构建了这个复杂的多模态桌面应用。”

这个项目证明了开发者如何利用 LLM 跨越想法与实现之间的鸿沟。绝大部分样板代码、类型定义甚至算法逻辑均由 AI 辅助生成，而开发者专注于核心业务逻辑与产品体验的打磨。

## 📦 安装与开发

### 环境要求
* Rust (最新稳定版)
* Node.js (LTS 版本) & pnpm/npm
* Tauri CLI (`cargo install tauri-cli`)

### 开始开发
1.  **克隆仓库：**
    ```bash
    git clone [https://github.com/yourusername/mindloop.git](https://github.com/yourusername/mindloop.git)
    cd mindloop
    ```

2.  **安装前端依赖：**
    ```bash
    npm install
    # 或者
    pnpm install
    ```

3.  **启动开发模式：**
    ```bash
    cargo tauri dev
    ```

4.  **构建生产版本：**
    ```bash
    cargo tauri build
    ```

## 🗺 路线图 (Roadmap)

* [x] MVP 版本发布 (v0.1.0)
* [x] 实现基础 SRS 间隔重复算法
* [x] 集成 OpenAI/DeepSeek API
* [ ] **向量数据库 (RAG):** 实现“与过去一年的笔记对话”。
* [ ] **OCR 支持:** 截图自动提取文字。
* [ ] **多端同步:** 基于加密的云同步或局域网 WiFi 同步。

## 🤝 贡献指南

欢迎任何形式的贡献！无论是修复 Bug、提交新功能，还是 UI 改进。

1.  Fork 本项目
2.  创建你的特性分支 (`git checkout -b feature/AmazingFeature`)
3.  提交你的修改 (`git commit -m 'Add some AmazingFeature'`)
4.  推送到分支 (`git push origin feature/AmazingFeature`)
5.  开启 Pull Request

## 📄 开源协议

本项目基于 MIT 协议分发。详见 `LICENSE` 文件。

---

<div align="center">

**Crafted with ❤️ and 🦀 by [MR.42]**

</div>
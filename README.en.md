# 🧠 MindLoop 
# My Project

*This project supports multiple languages. Please select your language below.*

- [English](README.en.md)
- [中文 (简体)](README.zh-CN.md)

---

*Default README content (e.g., a summary in English or a neutral intro).*


<div align="center">

![MindLoop Banner](https://via.placeholder.com/1200x400.png?text=MindLoop+Banner)
**From Fragmentation to Wisdom.**

[![Rust](https://img.shields.io/badge/Built_with-Rust-orange?style=flat-square&logo=rust)](https://www.rust-lang.org/)
[![Tauri 2.0](https://img.shields.io/badge/Framework-Tauri_2.0-blue?style=flat-square&logo=tauri)](https://tauri.app/)
[![React](https://img.shields.io/badge/Frontend-React_18-61DAFB?style=flat-square&logo=react)](https://react.dev/)
[![Cursor](https://img.shields.io/badge/Built_with-Cursor_AI-black?style=flat-square)](https://cursor.com/)
[![License](https://img.shields.io/badge/license-MIT-green?style=flat-square)](LICENSE)

[Features](#-key-features) • [Tech Stack](#-tech-stack) • [Installation](#-installation) • [The Vibe Coding Story](#-the-vibe-coding-story)

</div>

---

## 📖 Introduction

**MindLoop** is not just another note-taking app. It is a **"Knowledge Internalization Engine"** designed for lifelong learners, developers, and researchers.

In the age of information overload, we collect too much but remember too little. MindLoop bridges the gap between "Collecting" and "Mastering" by combining **Local-First Privacy**, **Spaced Repetition Systems (SRS)**, and **Generative AI**.

Capture anything instantly via global shortcuts, and let the AI generate quizzes based on your notes to help you fight the forgetting curve.

> **MindLoop** 是一个“知识内化引擎”。在信息过载的时代，我们收藏得太多，记住得太少。MindLoop 利用本地优先的隐私策略、间隔重复算法 (SRS) 和生成式 AI，帮你把碎片化的信息真正转化为长期的智慧。

## ✨ Key Features

### 🚀 Capture Flow 
* **Global Shortcuts:** Press `Cmd+Shift+X` (or your custom key) to capture text from any app instantly.
* **Smart Clipboard:** Automatically detects text or images.
* **Local Storage:** All data is stored in a local SQLite database (`rusqlite`). Your data never leaves your device unless you ask the AI.

### 🧠 Intelligent Review 
* **AI-Generated Quizzes:** Connects to **DeepSeek** or **OpenAI** to transform your raw notes into interactive quizzes (Choice/QA).
* **SRS Algorithm:** Implements a modified **SuperMemo-2** algorithm. The system schedules reviews based on your memory strength (Ease Factor).
* **Review Dashboard:** Visualize your learning progress with GitHub-style contribution heatmaps and review analytics.

### 🎨 Enterprise-Grade UI 
* **Modern Design:** Built with **Shadcn/UI** and TailwindCSS for a clean, distraction-free experience.
* **Sidebar Layout:** Easy navigation between Dashboard, Library, Tasks, and Review sessions.
* **Dark Mode:** Optimized for late-night coding/reading sessions.

### 🔒 Privacy & Freedom
* **Bring Your Own Key (BYOK):** You control the API keys (DeepSeek/OpenAI). No middleman servers.
* **Custom Prompts:** You can customize the system prompts to tailor the AI's personality and questioning style.

## 🛠 Tech Stack

MindLoop is built on the bleeding edge of the "Rust-Frontend" ecosystem, ensuring blazing fast performance and a tiny memory footprint.

* **Core (Backend):** Rust 🦀
* **Framework:** Tauri 2.0 (Beta/RC)
* **Frontend:** React + TypeScript + Vite
* **UI Library:** Shadcn/UI + TailwindCSS + Lucide Icons
* **Database:** SQLite (via `rusqlite` & `tauri-plugin-sql`)
* **AI Integration:** `reqwest` with async Rust for handling LLM streams.

## ⚡️ The "Vibe Coding" Story

MindLoop is a testament to the power of **Vibe Coding** (AI-Assisted Programming).

> "I built this entire application from scratch without writing boilerplate code manually. I acted as the Architect, and the AI acted as the Builder."

This project demonstrates how a developer can leverage LLMs to bridge the gap between idea and implementation, moving from zero to a complex, multi-modal desktop application in record time.

## 📦 Installation & Development

### Prerequisites
* Rust (latest stable)
* Node.js (LTS) & pnpm/npm
* Tauri CLI (`cargo install tauri-cli`)

### Setup
1.  **Clone the repository:**
    ```bash
    git clone [https://github.com/yourusername/mindloop.git](https://github.com/yourusername/mindloop.git)
    cd mindloop
    ```

2.  **Install frontend dependencies:**
    ```bash
    npm install
    # or
    pnpm install
    ```

3.  **Run in Development Mode:**
    ```bash
    cargo tauri dev
    ```

4.  **Build for Production:**
    ```bash
    cargo tauri build
    ```

## 🗺 Roadmap

* [x] MVP Release (v0.1.0)
* [x] SRS Algorithm Implementation
* [x] DeepSeek/OpenAI Integration
* [ ] **Vector Database (RAG):** Chat with your past notes.
* [ ] **OCR Support:** Extract text from captured screenshots.
* [ ] **Mobile Sync:** Sync database via encrypted cloud or local Wi-Fi.

## 🤝 Contributing

Contributions are welcome! Whether it's a bug fix, a new feature, or a UI improvement.

1.  Fork the Project
2.  Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3.  Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4.  Push to the Branch (`git push origin feature/AmazingFeature`)
5.  Open a Pull Request

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.

---

<div align="center">

**Crafted with ❤️ and 🦀 by [Mr.42]**

</div>
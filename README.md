# MindLoop

一个使用 Tauri + React + TypeScript + TailwindCSS 构建的桌面应用。

## 技术栈

- **前端**: React 18 + TypeScript + TailwindCSS
- **构建工具**: Vite
- **桌面框架**: Tauri 2.0
- **后端**: Rust

## 前置要求

1. **Node.js** (推荐 v18 或更高版本)
   ```bash
   # 使用 Homebrew 安装 (macOS)
   brew install node
   ```

2. **Rust** (已安装 ✓)
   ```bash
   # 如果未安装，请访问 https://rustup.rs/
   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
   ```

## 安装依赖

```bash
cd mindloop
npm install
```

## 开发模式

启动开发服务器（会自动打开桌面应用窗口）：

```bash
npm run tauri dev
```

这个命令会：
1. 启动 Vite 开发服务器（端口 1420）
2. 编译 Rust 后端代码
3. 打开桌面应用窗口

## 构建生产版本

```bash
npm run tauri build
```

构建完成后，可执行文件位于 `src-tauri/target/release/` 目录。

## 项目结构

```
mindloop/
├── src/                 # React 前端源码
│   ├── App.tsx         # 主应用组件
│   ├── main.tsx        # 入口文件
│   └── index.css       # 全局样式（包含 Tailwind）
├── src-tauri/          # Tauri 后端（Rust）
│   ├── src/
│   │   └── main.rs     # Rust 入口文件
│   ├── Cargo.toml      # Rust 依赖配置
│   └── tauri.conf.json # Tauri 配置文件
├── index.html          # HTML 入口
├── package.json        # Node.js 依赖配置
├── vite.config.ts      # Vite 配置
├── tailwind.config.js  # TailwindCSS 配置
└── tsconfig.json       # TypeScript 配置
```

## 开发提示

- 修改 `src/App.tsx` 来开发前端界面
- 修改 `src-tauri/src/main.rs` 来添加 Rust 后端功能
- TailwindCSS 已配置完成，可以直接使用 Tailwind 类名
- 热重载已启用，修改代码后会自动刷新

## 更多资源

- [Tauri 文档](https://tauri.app/)
- [React 文档](https://react.dev/)
- [TailwindCSS 文档](https://tailwindcss.com/)
- [Vite 文档](https://vitejs.dev/)


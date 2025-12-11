import { useState, useEffect } from "react";

interface Settings {
  apiKey: string;
  baseUrl: string;
  modelName: string;
}

interface Preset {
  name: string;
  baseUrl: string;
  modelName: string;
}

const PRESETS: Preset[] = [
  {
    name: "OpenAI",
    baseUrl: "https://api.openai.com/v1",
    modelName: "gpt-4o",
  },
  {
    name: "DeepSeek",
    baseUrl: "https://api.deepseek.com",
    modelName: "deepseek-chat",
  },
  {
    name: "Moonshot",
    baseUrl: "https://api.moonshot.cn/v1",
    modelName: "moonshot-v1-8k",
  },
];

export default function Settings() {
  const [settings, setSettings] = useState<Settings>({
    apiKey: "",
    baseUrl: "https://api.openai.com/v1",
    modelName: "gpt-4o",
  });
  const [saved, setSaved] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<string>("");

  useEffect(() => {
    // 从 localStorage 加载设置
    const savedApiKey = localStorage.getItem("openai_api_key") || "";
    const savedBaseUrl = localStorage.getItem("openai_base_url") || "https://api.openai.com/v1";
    const savedModelName = localStorage.getItem("openai_model_name") || "gpt-4o";
    
    setSettings({
      apiKey: savedApiKey,
      baseUrl: savedBaseUrl,
      modelName: savedModelName,
    });
  }, []);

  const handlePresetChange = (presetName: string) => {
    setSelectedPreset(presetName);
    if (presetName) {
      const preset = PRESETS.find((p) => p.name === presetName);
      if (preset) {
        setSettings({
          ...settings,
          baseUrl: preset.baseUrl,
          modelName: preset.modelName,
        });
      }
    }
  };

  const handleSave = () => {
    localStorage.setItem("openai_api_key", settings.apiKey);
    localStorage.setItem("openai_base_url", settings.baseUrl);
    localStorage.setItem("openai_model_name", settings.modelName);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow-lg p-8">
        <h2 className="text-2xl font-bold text-gray-800 mb-6">设置</h2>
        
        <div className="space-y-6">
          <div>
            <label htmlFor="preset" className="block text-sm font-medium text-gray-700 mb-2">
              快速预设
            </label>
            <select
              id="preset"
              value={selectedPreset}
              onChange={(e) => handlePresetChange(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all bg-white"
            >
              <option value="">选择预设（可选）</option>
              {PRESETS.map((preset) => (
                <option key={preset.name} value={preset.name}>
                  {preset.name}: URL={preset.baseUrl}, Model={preset.modelName}
                </option>
              ))}
            </select>
            <p className="mt-1 text-sm text-gray-500">
              选择预设将自动填充 Base URL 和模型名称
            </p>
          </div>

          <div>
            <label htmlFor="apiKey" className="block text-sm font-medium text-gray-700 mb-2">
              API Key
            </label>
            <input
              type="password"
              id="apiKey"
              value={settings.apiKey}
              onChange={(e) => setSettings({ ...settings, apiKey: e.target.value })}
              placeholder="sk-..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
            />
            <p className="mt-1 text-sm text-gray-500">
              您的 API Key 将安全地保存在本地存储中
            </p>
          </div>

          <div>
            <label htmlFor="baseUrl" className="block text-sm font-medium text-gray-700 mb-2">
              Base URL
            </label>
            <input
              type="text"
              id="baseUrl"
              value={settings.baseUrl}
              onChange={(e) => setSettings({ ...settings, baseUrl: e.target.value })}
              placeholder="https://api.openai.com/v1"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
            />
            <p className="mt-1 text-sm text-gray-500">
              API 的基础 URL（兼容 OpenAI 格式）
            </p>
          </div>

          <div>
            <label htmlFor="modelName" className="block text-sm font-medium text-gray-700 mb-2">
              模型名称 (Model Name)
            </label>
            <input
              type="text"
              id="modelName"
              value={settings.modelName}
              onChange={(e) => setSettings({ ...settings, modelName: e.target.value })}
              placeholder="gpt-4o 或 deepseek-chat"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
            />
            <p className="mt-1 text-sm text-gray-500">
              模型名称，例如：gpt-4o、deepseek-chat、moonshot-v1-8k
            </p>
          </div>

          <button
            onClick={handleSave}
            className="w-full px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium shadow-md hover:shadow-lg"
          >
            {saved ? "✓ 已保存" : "保存设置"}
          </button>
        </div>
      </div>
    </div>
  );
}


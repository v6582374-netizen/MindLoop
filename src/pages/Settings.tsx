import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/Card";
import Input from "../components/ui/Input";
import Button from "../components/ui/Button";

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
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">设置</h1>
        <p className="text-gray-600 mt-2">配置你的 API 和模型设置</p>
      </div>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>API 配置</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <label htmlFor="preset" className="block text-sm font-medium text-gray-700 mb-2">
              快速预设
            </label>
            <select
              id="preset"
              value={selectedPreset}
              onChange={(e) => handlePresetChange(e.target.value)}
              className="w-full h-10 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-950 focus:ring-offset-2"
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
            <Input
              type="password"
              id="apiKey"
              value={settings.apiKey}
              onChange={(e) => setSettings({ ...settings, apiKey: e.target.value })}
              placeholder="sk-..."
            />
            <p className="mt-1 text-sm text-gray-500">
              您的 API Key 将安全地保存在本地存储中
            </p>
          </div>

          <div>
            <label htmlFor="baseUrl" className="block text-sm font-medium text-gray-700 mb-2">
              Base URL
            </label>
            <Input
              type="text"
              id="baseUrl"
              value={settings.baseUrl}
              onChange={(e) => setSettings({ ...settings, baseUrl: e.target.value })}
              placeholder="https://api.openai.com/v1"
            />
            <p className="mt-1 text-sm text-gray-500">
              API 的基础 URL（兼容 OpenAI 格式）
            </p>
          </div>

          <div>
            <label htmlFor="modelName" className="block text-sm font-medium text-gray-700 mb-2">
              模型名称 (Model Name)
            </label>
            <Input
              type="text"
              id="modelName"
              value={settings.modelName}
              onChange={(e) => setSettings({ ...settings, modelName: e.target.value })}
              placeholder="gpt-4o 或 deepseek-chat"
            />
            <p className="mt-1 text-sm text-gray-500">
              模型名称，例如：gpt-4o、deepseek-chat、moonshot-v1-8k
            </p>
          </div>

          <Button onClick={handleSave} className="w-full">
            {saved ? "✓ 已保存" : "保存设置"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

type SettingsMap = {
  rex_producthunt_mode: boolean;
  rex_popup_enabled: boolean;
};

export default function REXChatToggleCard() {
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<SettingsMap>({
    rex_producthunt_mode: false,
    rex_popup_enabled: true,
  });

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('system_settings')
        .select('key,value')
        .in('key', ['rex_producthunt_mode', 'rex_popup_enabled']);
      if (data) {
        const mapped: any = { ...settings };
        data.forEach((d: any) => {
          mapped[d.key] = String(d.value) === 'true' || d.value === true;
        });
        setSettings(mapped);
      }
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleToggle(key: keyof SettingsMap) {
    const newVal = !settings[key];
    setSettings({ ...settings, [key]: newVal });
    await supabase
      .from('system_settings')
      .upsert([{ key, value: String(newVal) }]);
  }

  if (loading) return <div className="text-sm text-gray-500">Loading REX chat settings...</div>;

  return (
    <div className="border rounded-xl p-5 shadow-sm bg-white w-full max-w-xl">
      <div className="text-lg font-semibold mb-2">REX Chat Settings</div>
      <p className="text-sm text-gray-500 mb-4">Control how the REX popup appears across the site, including special launch behavior for Product Hunt.</p>

      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-medium text-sm">Enable Product Hunt Mode</div>
            <p className="text-xs text-gray-500">Use the non-chat FAQ popup instead of the chatbot on Product Hunt pages.</p>
          </div>
          <label className="inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              className="sr-only peer"
              checked={settings.rex_producthunt_mode}
              onChange={() => handleToggle('rex_producthunt_mode')}
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-indigo-500 rounded-full peer dark:bg-gray-700 peer-checked:bg-indigo-600"></div>
          </label>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <div className="font-medium text-sm">Enable REX Popup Globally</div>
            <p className="text-xs text-gray-500">Display the FAQ popup across all marketing pages.</p>
          </div>
          <label className="inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              className="sr-only peer"
              checked={settings.rex_popup_enabled}
              onChange={() => handleToggle('rex_popup_enabled')}
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-indigo-500 rounded-full peer dark:bg-gray-700 peer-checked:bg-indigo-600"></div>
          </label>
        </div>
      </div>
    </div>
  );
}



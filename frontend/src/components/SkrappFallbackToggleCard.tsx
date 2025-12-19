import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

type SettingsMap = {
  skrapp_apollo_fallback_enabled: boolean;
};

export default function SkrappFallbackToggleCard() {
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<SettingsMap>({
    skrapp_apollo_fallback_enabled: false,
  });

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('system_settings')
        .select('key,value')
        .in('key', ['skrapp_apollo_fallback_enabled']);
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

  async function handleToggle() {
    const key: keyof SettingsMap = 'skrapp_apollo_fallback_enabled';
    const newVal = !settings[key];
    setSettings({ ...settings, [key]: newVal });
    await supabase
      .from('system_settings')
      .upsert([{ key, value: String(newVal) }]);
  }

  if (loading) return <div className="text-sm text-gray-500">Loading Skrapp fallback setting...</div>;

  return (
    <div className="border rounded-xl p-5 shadow-sm bg-white w-full max-w-xl">
      <div className="text-lg font-semibold mb-2">Skrapp Fallback (Apollo)</div>
      <p className="text-sm text-gray-500 mb-4">
        When enabled, HirePilot may use <strong>Skrapp</strong> as a fallback only if Apollo fails/disconnects and the
        user has added their own Skrapp API key.
      </p>

      <div className="flex items-center justify-between">
        <div>
          <div className="font-medium text-sm">Enable Skrapp as Apollo fallback</div>
          <p className="text-xs text-gray-500">
            Default is off. This does not use any platform-wide Skrapp key.
          </p>
        </div>
        <label className="inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            className="sr-only peer"
            checked={settings.skrapp_apollo_fallback_enabled}
            onChange={handleToggle}
          />
          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-indigo-500 rounded-full peer dark:bg-gray-700 peer-checked:bg-indigo-600"></div>
        </label>
      </div>
    </div>
  );
}



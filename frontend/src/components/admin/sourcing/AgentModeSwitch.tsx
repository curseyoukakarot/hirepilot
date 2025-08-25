import React from 'react';
import { api } from '../../../lib/api';

export default function AgentModeSwitch() {
  const [enabled, setEnabled] = React.useState(false);

  React.useEffect(() => {
    (async () => {
      try {
        const data = await api('/api/agent-mode');
        setEnabled(!!data.agent_mode_enabled);
      } catch (e) {}
    })();
  }, []);

  return (
    <button
      onClick={async () => {
        const next = !enabled;
        setEnabled(next);
        try {
          await api('/api/agent-mode', { method: 'POST', body: JSON.stringify({ enabled: next }) });
        } catch (e) {
          setEnabled(!next);
        }
      }}
      className={`px-3 py-2 rounded-lg text-white ${enabled ? 'bg-green-600' : 'bg-gray-600'}`}
      title="Agent Mode"
    >
      {enabled ? 'Agent: On' : 'Agent: Off'}
    </button>
  );
}



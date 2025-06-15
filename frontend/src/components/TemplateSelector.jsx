import React, { useEffect, useState } from 'react';
import { getTemplates } from '../services/templatesService';

function TemplateSelector({ userId, onSelect }) {
  const [templates, setTemplates] = useState([]);
  const [selectedId, setSelectedId] = useState('');

  useEffect(() => {
    async function load() {
      const data = await getTemplates(userId);
      setTemplates(data);
    }
    load();
  }, [userId]);

  const handleChange = (e) => {
    const selected = templates.find((t) => t.id === e.target.value);
    setSelectedId(e.target.value);
    onSelect(selected);
  };

  return (
    <div className="mb-4">
      <label className="block mb-2 font-semibold">Select Template:</label>
      <select
        className="border p-2 rounded w-full"
        value={selectedId}
        onChange={handleChange}
      >
        <option value="">-- Select --</option>
        {templates.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>
    </div>
  );
}

export default TemplateSelector;

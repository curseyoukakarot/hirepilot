import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getForm as apiGetForm, upsertFields as apiUpsertFields } from '../../../lib/api/forms';
import type { BuilderField } from '../types';

function useDebouncedCallback<T extends (...args: any[]) => any>(fn: T, delayMs: number) {
  const timeoutRef = useRef<number | null>(null);
  const saved = useRef<T>(fn);
  useEffect(() => { saved.current = fn; }, [fn]);
  return useCallback((...args: Parameters<T>) => {
    if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    timeoutRef.current = window.setTimeout(() => saved.current(...args), delayMs);
  }, [delayMs]);
}

export function useFormBuilder(formId: string) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [form, setForm] = useState<any | null>(null);
  const [fields, setFields] = useState<BuilderField[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        const f = await apiGetForm(formId);
        if (!mounted) return;
        setForm(f);
        setFields((f.fields || []).map((ff: any) => ({
          id: ff.id,
          label: ff.label,
          type: ff.type,
          placeholder: ff.placeholder ?? null,
          help_text: ff.help_text ?? null,
          required: !!ff.required,
          options: ff.options ?? null,
          width: ff.width || 'full',
          position: typeof ff.position === 'number' ? ff.position : 0,
        })));
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [formId]);

  const persist = useCallback(async (current: BuilderField[]) => {
    setSaving(true);
    try {
      await apiUpsertFields(formId, current);
      setDirty(false);
    } finally {
      setSaving(false);
    }
  }, [formId]);

  const debouncedPersist = useDebouncedCallback(persist, 800);

  const setAndSave = useCallback((updater: (prev: BuilderField[]) => BuilderField[]) => {
    setFields(prev => {
      const next = updater(prev).map((f, idx) => ({ ...f, position: idx }));
      setDirty(true);
      debouncedPersist(next);
      return next;
    });
  }, [debouncedPersist]);

  const addField = useCallback((type: BuilderField['type']) => {
    setAndSave(prev => [
      ...prev,
      {
        id: crypto.randomUUID(),
        type,
        label: 'Untitled',
        required: false,
        width: 'full',
        position: prev.length,
      } as BuilderField,
    ]);
  }, [setAndSave]);

  const duplicateField = useCallback((id: string) => {
    setAndSave(prev => {
      const idx = prev.findIndex(f => f.id === id);
      if (idx < 0) return prev;
      const src = prev[idx];
      const dup: BuilderField = { ...src, id: crypto.randomUUID() };
      const next = [...prev];
      next.splice(idx + 1, 0, dup);
      return next;
    });
  }, [setAndSave]);

  const deleteField = useCallback((id: string) => {
    setAndSave(prev => prev.filter(f => f.id !== id));
    setSelectedId(s => (s === id ? null : s));
  }, [setAndSave]);

  const reorderField = useCallback((fromIndex: number, toIndex: number) => {
    setAndSave(prev => {
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
  }, [setAndSave]);

  const selected = useMemo(() => fields.find(f => f.id === selectedId) || null, [fields, selectedId]);

  return {
    loading,
    saving,
    dirty,
    form,
    fields,
    selected,
    setSelectedId,
    setForm,
    setFields,
    addField,
    duplicateField,
    deleteField,
    reorderField,
  };
}

export default useFormBuilder;



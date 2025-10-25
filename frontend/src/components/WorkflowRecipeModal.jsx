import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import useModalAnimation from '../hooks/useModalAnimation';
import { copyToClipboard } from '../utils/copyToClipboard';

const TABS = ["Overview", "Setup", "Formula", "Copy Zone"];

export default function WorkflowRecipeModal({
  isOpen,
  onClose,
  title,
  summary,
  tools = [],
  setupTime,
  difficulty,
  formula = '',
  setupSteps = [],
}) {
  const [activeTab, setActiveTab] = useState('Overview');
  const [devMode, setDevMode] = useState(false);
  const closeBtnRef = useRef(null);
  const { overlay, modal } = useModalAnimation();

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    document.addEventListener('keydown', onKey);
    // initial focus
    setTimeout(() => { try { closeBtnRef.current?.focus(); } catch(_){} }, 0);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen) {
      setActiveTab('Overview');
    }
  }, [isOpen]);

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) onClose?.();
  };

  const copyWithFeedback = (text, button) => copyToClipboard(text, button);

  const toolsGrid = useMemo(() => {
    const subtitleFor = (t) => {
      const k = String(t || '').toLowerCase();
      if (k === 'slack') return 'Team notification';
      if (k === 'stripe') return 'Billing';
      if (k === 'hirepilot') return 'Trigger source';
      if (k === 'apollo') return 'Lead source';
      if (k === 'sendgrid') return 'Email';
      if (k === 'google calendar' || k === 'calendar') return 'Calendar';
      if (k === 'linkedin') return 'Social';
      if (k === 'rex') return 'AI';
      if (k === 'skrapp') return 'Lead source';
      if (k === 'asana') return 'Tasks';
      if (k === 'hubspot') return 'CRM';
      if (k === 'docusign') return 'E-signature';
      if (k === 'bigquery') return 'Warehouse';
      if (k === 'sniper') return 'Capture';
      return 'Integration';
    };

    return tools?.slice(0, 3).map((tool, idx) => {
      const k = String(tool).toLowerCase();
      let iconNode = null;
      if (k === 'slack') iconNode = <i className="fa-brands fa-slack text-2xl text-[#4A154B]"></i>;
      else if (k === 'stripe') iconNode = <i className="fa-brands fa-stripe text-2xl text-[#635BFF]"></i>;
      else if (k === 'linkedin') iconNode = <i className="fa-brands fa-linkedin text-2xl text-[#0A66C2]"></i>;
      else if (k === 'sendgrid') iconNode = <img src="/sendgrid.png" alt="SendGrid" className="h-6 w-6" />;
      else if (k === 'apollo') iconNode = <img src="/apollo-logo-v2.png" alt="Apollo" className="h-6 w-6" />;
      else if (k === 'hirepilot') iconNode = <img src="/logo.png" alt="HirePilot" className="h-6 w-6" />;
      else if (k === 'rex') iconNode = <span className="font-mono text-sm bg-slate-800 text-slate-100 px-1.5 py-0.5 rounded">&gt;_</span>;
      else iconNode = (
        <div className="w-8 h-8 bg-gradient-to-br from-primary to-secondary rounded-lg flex items-center justify-center">
          <i className="fa-solid fa-rocket text-white text-sm"></i>
        </div>
      );

      return (
        <div key={`${tool}-${idx}`} className="flex items-center space-x-3 p-4 bg-gray-50 rounded-lg">
          {iconNode}
        <div>
          <div className="font-medium text-gray-900">{tool}</div>
          <div className="text-sm text-gray-600">{subtitleFor(tool)}</div>
        </div>
        </div>
      );
    });
  }, [tools]);

  return (
    <AnimatePresence>
      {isOpen ? (
        <motion.div
          className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4"
          onMouseDown={handleOverlayClick}
          initial={overlay.initial}
          animate={overlay.animate}
          exit={overlay.exit}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            className="bg-slate-950 text-white rounded-2xl shadow-lg border border-slate-800 max-w-4xl mx-auto overflow-hidden w-full"
            initial={modal.initial}
            animate={modal.animate}
            exit={modal.exit}
            transition={modal.transition}
            onMouseDown={(e) => e.stopPropagation()}
          >
            {/* Modal Header (preserve classes) */}
            <div className="bg-slate-900 border-b border-slate-800 p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-accent to-accent/80 rounded-xl flex items-center justify-center">
                    <i className="fa-solid fa-bolt text-white"></i>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white">{title}</h3>
                    <p className="text-slate-300">{summary}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-slate-300">Developer View</span>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        className="sr-only peer"
                        id="devToggle"
                        checked={devMode}
                        onChange={(e) => setDevMode(e.target.checked)}
                      />
                      <div className="w-11 h-6 bg-slate-700 rounded-full peer peer-checked:bg-primary peer-focus:outline-none peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:h-5 after:w-5 after:rounded-full after:transition-all"></div>
                    </label>
                  </div>
                  <button ref={closeBtnRef} className="text-slate-400 hover:text-white" onClick={onClose} aria-label="Close">
                    <i className="fa-solid fa-times text-xl"></i>
                  </button>
                </div>
              </div>
            </div>

            {/* Modal Tabs */}
            <div className="p-6">
              <div className="flex space-x-1 mb-6">
                {TABS.map((tab) => (
                  <button
                    key={tab}
                    className={
                      tab === activeTab
                        ? 'px-4 py-2 bg-primary text-white rounded-lg font-medium'
                        : 'px-4 py-2 text-slate-300 hover:text-white rounded-lg'
                    }
                    onClick={() => setActiveTab(tab)}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              {/* Overview Content */}
              {activeTab === 'Overview' && (
                <div id="modal-content" className="space-y-6">
                  <div className="flex items-start space-x-4">
                    <div className="w-10 h-10 bg-gradient-to-br from-success to-success/80 rounded-lg flex items-center justify-center">
                      <i className="fa-solid fa-info text-white"></i>
                    </div>
                    <div>
                      <h4 className="font-semibold text-white mb-2">What This Does</h4>
                      <p className="text-slate-300">{summary}</p>
                    </div>
                  </div>

                  <div className="grid md:grid-cols-3 gap-4">
                    {toolsGrid}
                  </div>

                  <div className="flex items-center justify-between p-4 bg-gradient-to-r from-primary/10 to-secondary/10 rounded-lg border border-primary/20">
                    <div className="flex items-center space-x-3">
                      <i className="fa-solid fa-clock text-primary"></i>
                      <span className="font-medium text-white">Setup Time: {setupTime}</span>
                    </div>
                    <div className="flex items-center space-x-3">
                      <i className="fa-solid fa-star text-warning"></i>
                      <span className="font-medium text-white">Difficulty: {difficulty}</span>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'Setup' && (
                <div className="space-y-4">
                  {setupSteps?.length ? (
                    setupSteps.map((step, idx) => (
                      <div key={idx} className="flex items-start space-x-3 p-4 bg-gray-50 rounded-lg">
                        <div className="w-8 h-8 bg-gradient-to-br from-primary to-secondary rounded-md text-black flex items-center justify-center font-semibold">
                          {idx + 1}
                        </div>
                        <div className="text-black">{step}</div>
                      </div>
                    ))
                  ) : (
                    <div className="text-slate-400">No setup steps provided.</div>
                  )}
                </div>
              )}

              {activeTab === 'Formula' && (
                <div className="space-y-4">
                  {devMode ? (
                    <div className="bg-slate-900 rounded-xl p-4">
                      <pre className="code-block"><code className="language-yaml">{formula}</code></pre>
                    </div>
                  ) : (
                    <div className="p-4 bg-slate-900 rounded-lg text-slate-200">
                      Enable Developer View to see YAML formula and API code examples.
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'Copy Zone' && (
                <div className="space-y-4">
                  <div className="flex flex-wrap gap-3">
                    <button
                      onClick={(e) => copyWithFeedback('Zapier configuration copied! Import this into your Zapier account.', e.currentTarget)}
                      className="px-6 py-3 bg-primary hover:bg-primary/90 rounded-lg font-semibold transition-all flex items-center text-white"
                    >
                      <i className="fa-solid fa-bolt mr-2"></i>
                      Copy Zap
                    </button>
                    <button
                      onClick={(e) => copyWithFeedback('Make.com blueprint copied! Import this into your Make account.', e.currentTarget)}
                      className="px-6 py-3 bg-slate-700 hover:bg-slate-600 rounded-lg font-semibold transition-all flex items-center text-white"
                    >
                      <i className="fa-solid fa-puzzle-piece mr-2"></i>
                      Copy Make Blueprint
                    </button>
                    <button
                      onClick={(e) => copyWithFeedback('API code copied! Use this in your custom implementation.', e.currentTarget)}
                      className="px-6 py-3 bg-slate-700 hover:bg-slate-600 rounded-lg font-semibold transition-all flex items-center text-white"
                    >
                      <i className="fa-solid fa-terminal mr-2"></i>
                      Copy API Code
                    </button>
                    <button
                      onClick={(e) => copyWithFeedback(formula || '', e.currentTarget)}
                      className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 rounded-lg font-semibold transition-all flex items-center text-white"
                    >
                      <i className="fa-solid fa-file-code mr-2"></i>
                      Copy Formula
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="bg-slate-900 border-t border-slate-800 p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-2 h-2 bg-success rounded-full"></div>
                  <span className="text-sm text-slate-300">Ready to deploy</span>
                </div>
                <div className="flex space-x-3">
                  <button className="border border-slate-700 text-slate-200 hover:bg-slate-800 px-6 py-2 rounded-lg font-medium transition-all">
                    Preview
                  </button>
                  <button className="bg-primary hover:bg-primary/90 text-white px-6 py-2 rounded-lg font-medium transition-all">
                    <i className="fa-solid fa-rocket mr-2"></i>Deploy Recipe
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}



import React, { useState } from 'react';
import { useRexWidget } from './useRexWidget';
import { ChatLauncher } from './ChatLauncher';
import { ChatPanel } from './ChatPanel';
import { MobileOverlay } from './MobileOverlay';
import { LeadModal } from './LeadModal';
import type { RexWidgetProps } from './types';
import './theme.css';

export const RexWidget: React.FC<RexWidgetProps> = ({ mode = 'sales', config, className }) => {
  const {
    isOpen,
    isMobile,
    open,
    close,
    toggle,
    messages,
    sendMessage,
    loading,
    setMode,
    showSalesCtas,
    sendHandoff,
    sendLead,
    shouldPulse,
    setSalesCtaOverride,
  } = useRexWidget({ initialMode: mode, config });
  const [leadOpen, setLeadOpen] = useState(false);

  return (
    <div className={className}>
      <ChatLauncher onClick={toggle} pulse={shouldPulse} />
      <ChatPanel
        isOpen={isOpen}
        onClose={close}
        onSend={sendMessage}
        loading={loading}
        messages={messages}
        mode={mode}
        demoUrl={config?.demoUrl}
        calendlyUrl={config?.calendlyUrl}
        showSalesCtas={showSalesCtas}
        onHandoff={sendHandoff}
        onOpenLead={() => setLeadOpen(true)}
        onContactSupport={async () => {
          try { await sendHandoff('support'); } catch {}
          try { (await import('react-hot-toast')).toast.success('We notified support. We\'ll be in touch shortly.'); } catch {}
        }}
      />
      <MobileOverlay
        isOpen={isOpen}
        onClose={close}
        onSend={sendMessage}
        loading={loading}
        messages={messages}
        mode={mode}
        demoUrl={config?.demoUrl}
        calendlyUrl={config?.calendlyUrl}
        showSalesCtas={showSalesCtas}
        onHandoff={sendHandoff}
        onContactSupport={async () => {
          try { await sendHandoff('support'); } catch {}
          try { (await import('react-hot-toast')).toast.success('We notified support. We\'ll be in touch shortly.'); } catch {}
        }}
      />
      <LeadModal
        open={leadOpen}
        onClose={() => setLeadOpen(false)}
        onSubmit={async (payload) => {
          await sendLead(payload);
          setSalesCtaOverride(true);
        }}
      />
    </div>
  );
};

export default RexWidget;



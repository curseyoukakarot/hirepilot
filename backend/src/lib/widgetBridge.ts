import axios from 'axios';
import { supabase } from '../lib/supabase';

export interface WidgetHumanMessagePayload {
  from: 'human';
  name?: string | null;
  message: string;
  timestamp: string;
}

// TODO: Replace with actual internal event bus or websocket push to the widget service.
export async function sendMessageToWidget(sessionId: string, payload: WidgetHumanMessagePayload): Promise<void> {
  const relayUrl = process.env.WIDGET_RELAY_URL; // Optional HTTP relay for dev
  if (relayUrl) {
    try {
      await axios.post(relayUrl, { sessionId, payload });
      return;
    } catch (err) {
      console.warn('[sendMessageToWidget] relay failed, ignoring in dev mode', err);
    }
  }
  // Broadcast via Supabase Realtime channel
  try {
    const channel = supabase.channel(`rex_widget:${sessionId}`);
    // Send as broadcast event
    await channel.send({
      type: 'broadcast',
      event: 'human_reply',
      payload,
    } as any);
  } catch (e) {
    console.error('[sendMessageToWidget] realtime send failed', e);
  }
}



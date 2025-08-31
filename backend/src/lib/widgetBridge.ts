import axios from 'axios';

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
  // No-op stub. Integrate with your actual widget transport.
}



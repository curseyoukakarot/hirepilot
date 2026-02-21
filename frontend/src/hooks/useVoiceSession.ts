import { useCallback, useRef, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

type VoiceSessionOptions = {
  onUserSpeechStart?: () => void;
  onUserSpeechEnd?: () => void;
  onRexAudioStart?: () => void;
  onRexAudioEnd?: () => void;
  onRexThinkStart?: () => void;
  onRexThinkEnd?: () => void;
  onUserTranscriptPartial?: (text: string) => void;
  onUserTranscriptFinal?: (text: string) => void;
  onRexTranscriptPartial?: (text: string) => void;
  onRexTranscriptFinal?: (text: string) => void;
  sessionId?: string | null;
};

const API_BASE =
  import.meta.env.VITE_BACKEND_URL ||
  (typeof window !== 'undefined' && window.location.host.endsWith('thehirepilot.com')
    ? 'https://api.thehirepilot.com'
    : 'http://localhost:8080');

export function useVoiceSession(options: VoiceSessionOptions = {}) {
  const [connected, setConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rexStream, setRexStream] = useState<MediaStream | null>(null);

  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const rexSpeakingRef = useRef(false);
  const rexThinkingRef = useRef(false);
  const rexTranscriptPartialRef = useRef('');
  const userTranscriptPartialRef = useRef('');
  const currentModelRef = useRef('gpt-4o-realtime-preview');

  const ensureRemoteAudio = useCallback(() => {
    if (remoteAudioRef.current) return remoteAudioRef.current;
    const audioEl = new Audio();
    audioEl.autoplay = true;
    audioEl.setAttribute('playsinline', 'true');
    remoteAudioRef.current = audioEl;
    return audioEl;
  }, []);

  const disconnect = useCallback(() => {
    const dc = dataChannelRef.current;
    if (dc) {
      try {
        dc.close();
      } catch {}
      dataChannelRef.current = null;
    }
    const pc = peerConnectionRef.current;
    if (pc) {
      try {
        pc.getSenders().forEach((sender) => sender.track?.stop());
        pc.close();
      } catch {}
      peerConnectionRef.current = null;
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }
    if (remoteAudioRef.current) {
      remoteAudioRef.current.pause();
      remoteAudioRef.current.srcObject = null;
    }
    rexSpeakingRef.current = false;
    rexThinkingRef.current = false;
    rexTranscriptPartialRef.current = '';
    userTranscriptPartialRef.current = '';
    options.onRexThinkEnd?.();
    options.onRexAudioEnd?.();
    setRexStream(null);
    setConnected(false);
  }, [options]);

  const handleRealtimeEvent = useCallback(
    (event: any) => {
      const eventType = String(event?.type || '');

      if (eventType === 'input_audio_buffer.speech_started') {
        options.onUserSpeechStart?.();
      }
      if (eventType === 'input_audio_buffer.speech_stopped') {
        options.onUserSpeechEnd?.();
        if (!rexThinkingRef.current) {
          rexThinkingRef.current = true;
          options.onRexThinkStart?.();
        }
      }
      if (eventType === 'response.created') {
        if (!rexThinkingRef.current) {
          rexThinkingRef.current = true;
          options.onRexThinkStart?.();
        }
      }
      if (eventType === 'response.audio.delta') {
        if (rexThinkingRef.current) {
          rexThinkingRef.current = false;
          options.onRexThinkEnd?.();
        }
        if (!rexSpeakingRef.current) {
          rexSpeakingRef.current = true;
          options.onRexAudioStart?.();
        }
      }
      if (eventType === 'response.audio.done') {
        if (rexSpeakingRef.current) {
          rexSpeakingRef.current = false;
          options.onRexAudioEnd?.();
        }
      }
      if (eventType === 'response.done') {
        if (rexThinkingRef.current) {
          rexThinkingRef.current = false;
          options.onRexThinkEnd?.();
        }
        if (rexSpeakingRef.current) {
          rexSpeakingRef.current = false;
          options.onRexAudioEnd?.();
        }
      }

      if (eventType === 'conversation.item.input_audio_transcription.delta') {
        userTranscriptPartialRef.current += String(event?.delta || '');
        options.onUserTranscriptPartial?.(userTranscriptPartialRef.current);
      }
      if (eventType === 'conversation.item.input_audio_transcription.completed') {
        const text = String(event?.transcript || userTranscriptPartialRef.current || '').trim();
        if (text) options.onUserTranscriptFinal?.(text);
        userTranscriptPartialRef.current = '';
        options.onUserTranscriptPartial?.('');
      }

      if (eventType === 'response.audio_transcript.delta') {
        rexTranscriptPartialRef.current += String(event?.delta || '');
        options.onRexTranscriptPartial?.(rexTranscriptPartialRef.current);
      }
      if (eventType === 'response.audio_transcript.done') {
        const text = String(event?.transcript || rexTranscriptPartialRef.current || '').trim();
        if (text) options.onRexTranscriptFinal?.(text);
        rexTranscriptPartialRef.current = '';
        options.onRexTranscriptPartial?.('');
      }
      if (eventType === 'response.output_text.delta' || eventType === 'response.text.delta') {
        rexTranscriptPartialRef.current += String(event?.delta || '');
        options.onRexTranscriptPartial?.(rexTranscriptPartialRef.current);
      }
      if (eventType === 'response.output_text.done' || eventType === 'response.text.done') {
        const text = String(event?.text || rexTranscriptPartialRef.current || '').trim();
        if (text) options.onRexTranscriptFinal?.(text);
        rexTranscriptPartialRef.current = '';
        options.onRexTranscriptPartial?.('');
      }
    },
    [options]
  );

  const connect = useCallback(async (inputStream?: MediaStream | null) => {
    setIsConnecting(true);
    setError(null);
    try {
      const tokenUrl = new URL(`${API_BASE.replace(/\/$/, '')}/api/interview/token`);
      if (options.sessionId) tokenUrl.searchParams.set('session_id', options.sessionId);
      const auth = await supabase.auth.getSession().catch(() => null);
      const accessToken = auth?.data?.session?.access_token || '';
      const response = await fetch(tokenUrl.toString(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error('Failed to fetch interview token');
      }
      const sessionPayload = await response.json();
      const token = sessionPayload?.token;
      const model = String(sessionPayload?.model || 'gpt-4o-realtime-preview');
      if (!token) throw new Error('Interview token missing from backend response');

      currentModelRef.current = model;
      const localStream =
        inputStream ||
        (await navigator.mediaDevices.getUserMedia({
          audio: true,
        }));
      localStreamRef.current = localStream;

      const pc = new RTCPeerConnection();
      peerConnectionRef.current = pc;
      const remoteStream = new MediaStream();
      const remoteAudioEl = ensureRemoteAudio();
      remoteAudioEl.srcObject = remoteStream;

      pc.ontrack = (event) => {
        event.streams.forEach((stream) => {
          stream.getTracks().forEach((track) => remoteStream.addTrack(track));
        });
        setRexStream(remoteStream);
        void remoteAudioEl.play().catch(() => {});
      };

      localStream.getAudioTracks().forEach((track) => pc.addTrack(track, localStream));

      const dataChannel = pc.createDataChannel('oai-events');
      dataChannelRef.current = dataChannel;
      dataChannel.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          handleRealtimeEvent(payload);
        } catch {
          // Ignore malformed events.
        }
      };
      dataChannel.onopen = () => {
        const sessionUpdate = {
          type: 'session.update',
          session: {
            modalities: ['audio', 'text'],
            input_audio_transcription: { model: 'gpt-4o-mini-transcribe' },
          },
        };
        dataChannel.send(JSON.stringify(sessionUpdate));
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      const sdpResponse = await fetch(`https://api.openai.com/v1/realtime?model=${encodeURIComponent(model)}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/sdp',
        },
        body: offer.sdp || '',
      });
      const answerSdp = await sdpResponse.text();
      if (!sdpResponse.ok) {
        throw new Error(answerSdp || 'Failed to establish realtime SDP session');
      }
      await pc.setRemoteDescription({
        type: 'answer',
        sdp: answerSdp,
      });
      setConnected(true);
    } catch (err: any) {
      disconnect();
      setConnected(false);
      setError(err?.message || 'Unable to connect voice session');
      throw err;
    } finally {
      setIsConnecting(false);
    }
  }, [disconnect, ensureRemoteAudio, handleRealtimeEvent, options.sessionId]);

  return {
    connected,
    isConnecting,
    error,
    rexStream,
    connect,
    disconnect,
    model: currentModelRef.current,
  };
}

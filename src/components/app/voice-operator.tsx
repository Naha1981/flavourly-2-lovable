import { useEffect, useRef, useState } from "react";
import { Mic, Phone, Square } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";

import { Button } from "@/components/ui/button";
import {
  createGeminiLiveToken,
  runGeminiLiveTool,
} from "@/lib/gemini-live.functions";
import { FLAVOURLY_LIVE_TOOLS } from "@/lib/gemini-live.tools";

type Props = {
  tenantId: string;
  restaurantName: string;
};

type TranscriptLine = {
  speaker: "You" | "Flavourly";
  text: string;
};

const MODEL = "gemini-3.8-live";
const OUTPUT_RATE = 24000;

function base64ToBytes(base64: string) {
  const binary = window.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, Math.min(i + chunkSize, bytes.length)));
  }
  return window.btoa(binary);
}

function floatTo16BitPCM(input: Float32Array) {
  const output = new Int16Array(input.length);
  for (let i = 0; i < input.length; i += 1) {
    const sample = Math.max(-1, Math.min(1, input[i] ?? 0));
    output[i] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
  }
  return new Uint8Array(output.buffer);
}

export function VoiceOperator({ tenantId, restaurantName }: Props) {
  const getToken = useServerFn(createGeminiLiveToken);
  const runTool = useServerFn(runGeminiLiveTool);

  const socketRef = useRef<WebSocket | null>(null);
  const inputContextRef = useRef<AudioContext | null>(null);
  const outputContextRef = useRef<AudioContext | null>(null);
  const inputSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const silenceGainRef = useRef<GainNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const nextPlayTimeRef = useRef(0);

  const [status, setStatus] = useState("Ready");
  const [error, setError] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<TranscriptLine[]>([]);
  const [connected, setConnected] = useState(false);
  const [busy, setBusy] = useState(false);

  const appendTranscript = (speaker: TranscriptLine["speaker"], text: string) => {
    const clean = text.trim();
    if (!clean) return;
    setTranscript((current) => {
      const last = current.at(-1);
      if (last?.speaker === speaker) {
        return [...current.slice(0, -1), { speaker, text: `${last.text} ${clean}` }];
      }
      return [...current, { speaker, text: clean }].slice(-8);
    });
  };

  const cleanupAudio = () => {
    processorRef.current?.disconnect();
    silenceGainRef.current?.disconnect();
    inputSourceRef.current?.disconnect();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    void inputContextRef.current?.close();
    void outputContextRef.current?.close();
    processorRef.current = null;
    silenceGainRef.current = null;
    inputSourceRef.current = null;
    streamRef.current = null;
    inputContextRef.current = null;
    outputContextRef.current = null;
    nextPlayTimeRef.current = 0;
  };

  const stop = () => {
    socketRef.current?.close();
    socketRef.current = null;
    cleanupAudio();
    setConnected(false);
    setBusy(false);
    setStatus("Ready");
  };

  const playAudio = async (base64: string) => {
    const context = outputContextRef.current;
    if (!context) return;
    if (context.state === "suspended") await context.resume();

    const bytes = base64ToBytes(base64);
    const samples = new Int16Array(
      bytes.buffer,
      bytes.byteOffset,
      Math.floor(bytes.byteLength / 2),
    );
    const buffer = context.createBuffer(1, samples.length, OUTPUT_RATE);
    const channel = buffer.getChannelData(0);
    for (let i = 0; i < samples.length; i += 1) channel[i] = (samples[i] ?? 0) / 32768;

    const source = context.createBufferSource();
    source.buffer = buffer;
    source.connect(context.destination);

    const now = context.currentTime;
    nextPlayTimeRef.current = Math.max(nextPlayTimeRef.current, now);
    source.start(nextPlayTimeRef.current);
    nextPlayTimeRef.current += buffer.duration;
  };

  const handleToolCall = async (toolCall: {
    functionCalls?: Array<{ id: string; name: string; args?: Record<string, unknown> }>;
  }) => {
    const responses = await Promise.all(
      (toolCall.functionCalls ?? []).map(async (call) => {
        setStatus(`Checking ${call.name.replaceAll("_", " ")}…`);
        const result = await runTool({
          data: {
            tenantId,
            name: call.name,
            args: call.args ?? {},
          },
        });
        return {
          id: call.id,
          name: call.name,
          response: {
            result: result.ok ? result.result : { error: result.error },
          },
        };
      }),
    );

    const socket = socketRef.current;
    if (socket?.readyState !== WebSocket.OPEN) return;

    socket.send(
      JSON.stringify({
        toolResponse: {
          functionResponses: responses,
        },
      }),
    );
  };

  const start = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    setTranscript([]);
    setStatus("Requesting microphone…");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      streamRef.current = stream;

      const outputContext = new AudioContext({ sampleRate: OUTPUT_RATE });
      await outputContext.resume();
      outputContextRef.current = outputContext;

      const inputContext = new AudioContext({ sampleRate: 16000 });
      await inputContext.resume();
      inputContextRef.current = inputContext;

      const tokenResult = await getToken({ data: { tenantId } });
      if (!tokenResult.ok) throw new Error(tokenResult.error);

      setStatus("Connecting to Gemini…");

      const ws = new WebSocket(
        `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContentConstrained?access_token=${encodeURIComponent(tokenResult.token)}`,
      );
      socketRef.current = ws;

      ws.onopen = () => {
        ws.send(
          JSON.stringify({
            setup: {
              model: `models/${MODEL}`,
              generationConfig: {
                responseModalities: ["AUDIO"],
              },
              systemInstruction: {
                parts: [
                  {
                    text: `You are helping the restaurant team at ${restaurantName}. Use Flavourly tools before making factual claims.`,
                  },
                ],
              },
              inputAudioTranscription: {},
              outputAudioTranscription: {},
              tools: [{ functionDeclarations: FLAVOURLY_LIVE_TOOLS }],
              sessionResumption: {},
              contextWindowCompression: {},
            },
          }),
        );
      };

      ws.onmessage = async (event) => {
        const message = JSON.parse(event.data) as {
          serverContent?: {
            modelTurn?: { parts?: Array<{ inlineData?: { data?: string } }> };
            inputTranscription?: { text?: string };
            outputTranscription?: { text?: string };
            turnComplete?: boolean;
          };
          toolCall?: {
            functionCalls?: Array<{ id: string; name: string; args?: Record<string, unknown> }>;
          };
          setupComplete?: unknown;
          toolCallCancellation?: { ids?: string[] };
          error?: { message?: string };
        };

        if (message.error?.message) {
          setError(message.error.message);
          setStatus("Gemini error");
          return;
        }

        if (message.setupComplete) {
          const source = inputContext.createMediaStreamSource(stream);
          const processor = inputContext.createScriptProcessor(4096, 1, 1);
          processor.onaudioprocess = (event) => {
            if (ws.readyState !== WebSocket.OPEN) return;
            const pcmBytes = floatTo16BitPCM(event.inputBuffer.getChannelData(0));
            ws.send(
              JSON.stringify({
                realtimeInput: {
                  audio: {
                    data: bytesToBase64(pcmBytes),
                    mimeType: "audio/pcm;rate=16000",
                  },
                },
              }),
            );
          };
          const silenceGain = inputContext.createGain();
          silenceGain.gain.value = 0;
          source.connect(processor);
          processor.connect(silenceGain);
          silenceGain.connect(inputContext.destination);
          silenceGainRef.current = silenceGain;
          inputSourceRef.current = source;
          processorRef.current = processor;

          setConnected(true);
          setBusy(false);
          setStatus("Live — speak now");
        }

        if (message.serverContent?.inputTranscription?.text) {
          appendTranscript("You", message.serverContent.inputTranscription.text);
        }

        if (message.serverContent?.outputTranscription?.text) {
          appendTranscript("Flavourly", message.serverContent.outputTranscription.text);
        }

        for (const part of message.serverContent?.modelTurn?.parts ?? []) {
          if (part.inlineData?.data) await playAudio(part.inlineData.data);
        }

        if (message.toolCallCancellation?.ids?.length) {
          setStatus("Live — pending tool cancelled");
        }

        if (message.toolCall) {
          const cancelled = new Set(message.toolCallCancellation?.ids ?? []);
          const filtered = {
            functionCalls: (message.toolCall.functionCalls ?? []).filter((call) => !cancelled.has(call.id)),
          };
          if (filtered.functionCalls.length) {
            await handleToolCall(filtered);
            setStatus("Live — speak now");
          }
        }

        if (message.serverContent?.turnComplete) {
          setStatus("Live — speak now");
        }
      };

      ws.onerror = () => {
        setError("Could not connect to Gemini Live.");
        setStatus("Connection error");
        setBusy(false);
      };

      ws.onclose = () => {
        setConnected(false);
        cleanupAudio();
        setBusy(false);
        setStatus("Ready");
      };
    } catch (err) {
      cleanupAudio();
      socketRef.current?.close();
      socketRef.current = null;
      setBusy(false);
      setConnected(false);
      setError(err instanceof Error ? err.message : "Could not start the voice agent.");
      setStatus("Unable to start");
    }
  };

  // Unmount cleanup always calls the latest stop (it only touches refs and
  // stable setters, but a first-render capture would still be a stale-closure
  // footgun if stop ever gains state reads).
  const stopRef = useRef(stop);
  stopRef.current = stop;
  useEffect(() => () => stopRef.current(), []);

  return (
    <section className="glass-card rounded-2xl border border-border p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-primary">Flavourly Live</p>
          <h2 className="mt-1 font-display text-2xl text-foreground">Talk to your restaurant.</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Ask about bookings, menu performance, VIPs and inbox activity in real time.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs ${connected ? "border-forest/30 bg-forest/10 text-forest" : "border-border bg-card text-muted-foreground"}`}
          >
            <span className={`size-2 rounded-full ${connected ? "bg-forest" : "bg-muted-foreground/40"}`} />
            {status}
          </span>
          {connected ? (
            <Button variant="outline" onClick={stop}>
              <Square className="size-4" /> Stop
            </Button>
          ) : (
            <Button onClick={() => void start()} disabled={busy}>
              <Mic className="size-4" />
              {busy ? "Starting…" : "Start voice"}
            </Button>
          )}
        </div>
      </div>

      <div className="mt-5 min-h-24 rounded-xl bg-card p-4">
        {transcript.length ? (
          <div className="grid gap-2 text-sm">
            {transcript.map((line, index) => (
              <p key={`${line.speaker}-${index}`}>
                <span className="font-medium">{line.speaker}:</span> {line.text}
              </p>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            {connected ? 'Try: “How are we doing today?”' : "Your microphone stays off until you press Start voice."}
          </p>
        )}
      </div>

      {error && (
        <div className="mt-3 rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
        <Phone className="size-3.5" />
        Gemini Live uses a short-lived session token; your long-lived Gemini API key stays on the server.
      </p>
    </section>
  );
}

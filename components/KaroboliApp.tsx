"use client";

import { useEffect, useRef, useState } from "react";
import type {
  BuyerRequirement,
  Decision,
  EvidenceRecord,
  Language,
  PurchaseOrder,
  SpeechLanguage,
  SupplierOffer,
} from "@/lib/domain";
import type { CallRecord } from "@/lib/telephony";
import {
  fallbackBuyerTranscript,
  fallbackBuyerEnglishTranscript,
  fallbackOffer,
  fallbackRequirement,
  fallbackSupplierTranscript,
  fallbackSupplierEnglishTranscript,
} from "@/lib/fixtures";
import {
  buildGuardrails,
  createPurchaseOrder,
  evaluateOffer,
} from "@/lib/policy";
import { nextBuyerQuestion, nextSupplierQuestion } from "@/lib/follow-up";
import {
  SamvaadBrowserSession,
  type SamvaadRole,
  type SamvaadStatus,
} from "@/lib/samvaad-browser";
import {
  CASE_MEMORY_SCHEMA_VERSION,
  caseMemorySchema,
  isBuyerRequirementReady,
  safeStageForMemory,
  type StoredCaseMemory,
} from "@/lib/case-memory";
import {
  appendUniqueTranscript,
  normalizeTranscript,
  replaceStreamingTranscript,
} from "@/lib/transcript";
import { DealRoom } from "./DealRoom";

type Stage = "brief" | "supplier" | "decision";
type RecordingTarget = "buyer" | "supplier";
type CapabilityStatus = "checking" | "live" | "offline";
type BuyerLanguage = Language | "unknown";
type VoiceMode = "realtime" | "composed";
type BriefPlayback = "idle" | "loading" | "playing";
type MemoryStatus =
  | "loading"
  | "new"
  | "restored"
  | "saving"
  | "saved"
  | "unavailable";

const CASE_ID_STORAGE_KEY = "karoboli.case-id.v1";

export type SupplierInfo = {
  name: string;
  area: string;
  score: string;
  detail: string;
  languages: string[];
  materials: string[];
  deliveryRadius: string;
};

const suppliers: SupplierInfo[] = [
  {
    name: "Sri Balaji Building Supplies",
    area: "KR Puram",
    score: "96%",
    detail: "213 completed orders",
    languages: ["Telugu", "Hindi", "English"],
    materials: ["Cement", "Steel", "Bricks"],
    deliveryRadius: "30 km",
  },
  {
    name: "Metro Cement Depot",
    area: "Mahadevapura",
    score: "91%",
    detail: "148 completed orders",
    languages: ["Tamil", "English"],
    materials: ["Cement", "Ready-Mix Concrete"],
    deliveryRadius: "15 km",
  },
  {
    name: "Sree Lakshmi Traders",
    area: "Hoskote",
    score: "89%",
    detail: "92 completed orders",
    languages: ["Telugu", "Kannada", "Hindi"],
    materials: ["Aggregates", "Sand", "Cement"],
    deliveryRadius: "45 km",
  },
  {
    name: "Om Sai Steels",
    area: "Peenya",
    score: "98%",
    detail: "340 completed orders",
    languages: ["Kannada", "Hindi", "English"],
    materials: ["TMT Bars", "Structural Steel"],
    deliveryRadius: "50 km",
  },
  {
    name: "Maruti Hardwares",
    area: "Electronic City",
    score: "94%",
    detail: "185 completed orders",
    languages: ["Hindi", "English", "Bengali"],
    materials: ["Paints", "Plumbing", "Electricals"],
    deliveryRadius: "20 km",
  },
  {
    name: "Kaveri Enterprises",
    area: "Yelahanka",
    score: "87%",
    detail: "64 completed orders",
    languages: ["Kannada", "Telugu"],
    materials: ["Cement", "Bricks"],
    deliveryRadius: "25 km",
  },
];

const languageLabels: Record<BuyerLanguage, string> = {
  unknown: "Auto-detect language",
  "te-IN": "Telugu",
  "ta-IN": "Tamil",
  "hi-IN": "Hindi / Hinglish",
  "en-IN": "English",
};

const speechLanguageLabels: Record<SpeechLanguage, string> = {
  "bn-IN": "Bengali",
  "en-IN": "English",
  "gu-IN": "Gujarati",
  "hi-IN": "Hindi",
  "kn-IN": "Kannada",
  "ml-IN": "Malayalam",
  "mr-IN": "Marathi",
  "od-IN": "Odia",
  "pa-IN": "Punjabi",
  "ta-IN": "Tamil",
  "te-IN": "Telugu",
};

function TranscriptPair({
  original,
  english,
  originalLabel,
}: {
  original: string;
  english: string;
  originalLabel: string;
}) {
  const showEnglish =
    Boolean(english.trim()) &&
    normalizeTranscript(english) !== normalizeTranscript(original);

  return (
    <div className={`transcript-pair ${showEnglish ? "" : "single"}`}>
      <div className="transcript-block">
        <span>{originalLabel}</span>
        <blockquote>“{original}”</blockquote>
      </div>
      {showEnglish && (
        <div className="transcript-block translation">
          <span>ENGLISH TRANSLATION</span>
          <blockquote>“{english}”</blockquote>
        </div>
      )}
    </div>
  );
}

function money(value: number) {
  return `₹${value.toLocaleString("en-IN")}`;
}

function formatDate(value: string) {
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
}

async function digestEvidence(value: unknown) {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function readError(response: Response) {
  const data = (await response.json().catch(() => null)) as { error?: string } | null;
  return data?.error || `Request failed (${response.status})`;
}

async function browserAudioToWav(blob: Blob): Promise<Blob> {
  const audioContext = new AudioContext();
  try {
    const decoded = await audioContext.decodeAudioData(await blob.arrayBuffer());
    const targetSampleRate = 16_000;
    const sampleCount = Math.max(
      1,
      Math.floor(decoded.duration * targetSampleRate),
    );
    const pcm = new Float32Array(sampleCount);
    const channels = Array.from({ length: decoded.numberOfChannels }, (_, index) =>
      decoded.getChannelData(index),
    );

    for (let index = 0; index < sampleCount; index += 1) {
      const sourcePosition = (index * decoded.sampleRate) / targetSampleRate;
      const lower = Math.min(Math.floor(sourcePosition), decoded.length - 1);
      const upper = Math.min(lower + 1, decoded.length - 1);
      const fraction = sourcePosition - lower;
      let mixed = 0;
      for (const channel of channels) {
        mixed += channel[lower] + (channel[upper] - channel[lower]) * fraction;
      }
      pcm[index] = mixed / channels.length;
    }

    const wav = new ArrayBuffer(44 + pcm.length * 2);
    const view = new DataView(wav);
    const writeText = (offset: number, value: string) => {
      for (let index = 0; index < value.length; index += 1) {
        view.setUint8(offset + index, value.charCodeAt(index));
      }
    };

    writeText(0, "RIFF");
    view.setUint32(4, 36 + pcm.length * 2, true);
    writeText(8, "WAVE");
    writeText(12, "fmt ");
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, targetSampleRate, true);
    view.setUint32(28, targetSampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeText(36, "data");
    view.setUint32(40, pcm.length * 2, true);

    let offset = 44;
    for (const sample of pcm) {
      const clamped = Math.max(-1, Math.min(1, sample));
      view.setInt16(
        offset,
        clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff,
        true,
      );
      offset += 2;
    }

    return new Blob([wav], { type: "audio/wav" });
  } finally {
    await audioContext.close();
  }
}

export function KaroboliApp() {
  const [stage, setStage] = useState<Stage>("brief");
  const [capability, setCapability] = useState<CapabilityStatus>("checking");
  const [realtimeAvailable, setRealtimeAvailable] = useState(false);
  const [voiceMode, setVoiceMode] = useState<VoiceMode>("composed");
  const [liveRole, setLiveRole] = useState<SamvaadRole | null>(null);
  const [agentStatus, setAgentStatus] = useState<SamvaadStatus>("idle");
  const [agentText, setAgentText] = useState("");
  const [language, setLanguage] = useState<BuyerLanguage>("unknown");
  const [sellerBriefLanguage, setSellerBriefLanguage] =
    useState<SpeechLanguage>("en-IN");
  const [briefPlayback, setBriefPlayback] =
    useState<BriefPlayback>("idle");
  const [recording, setRecording] = useState<RecordingTarget | null>(null);
  const [busy, setBusy] = useState<RecordingTarget | null>(null);
  const [buyerTranscript, setBuyerTranscript] = useState("");
  const [buyerEnglishTranscript, setBuyerEnglishTranscript] = useState("");
  const [supplierTranscript, setSupplierTranscript] = useState("");
  const [supplierEnglishTranscript, setSupplierEnglishTranscript] = useState("");
  const [requirement, setRequirement] = useState<BuyerRequirement | null>(null);
  const [offer, setOffer] = useState<SupplierOffer | null>(null);
  const [decision, setDecision] = useState<Decision | null>(null);
  const [purchaseOrder, setPurchaseOrder] = useState<PurchaseOrder | null>(null);
  const [evidence, setEvidence] = useState<EvidenceRecord | null>(null);
  const [selectedSupplier, setSelectedSupplier] = useState(suppliers[0].name);
  const [error, setError] = useState("");
  const [fallbackUsed, setFallbackUsed] = useState(false);
  const [telephonyConfigured, setTelephonyConfigured] = useState(false);
  const [callRecord, setCallRecord] = useState<CallRecord | null>(null);
  const [callBusy, setCallBusy] = useState(false);
  const callPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [caseId, setCaseId] = useState<string | null>(null);
  const [memoryReady, setMemoryReady] = useState(false);
  const [memoryStatus, setMemoryStatus] = useState<MemoryStatus>("loading");
  const [handoffPending, setHandoffPending] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const discardRecordingRef = useRef(false);
  const targetRef = useRef<RecordingTarget>("buyer");
  const briefAudioRef = useRef<HTMLAudioElement | null>(null);
  const briefAudioUrlRef = useRef<string | null>(null);
  const briefAbortRef = useRef<AbortController | null>(null);
  const liveSessionRef = useRef<SamvaadBrowserSession | null>(null);
  const requirementRef = useRef<BuyerRequirement | null>(null);
  const offerRef = useRef<SupplierOffer | null>(null);
  const buyerUnderstandQueueRef = useRef<Promise<void>>(Promise.resolve());
  const supplierUnderstandQueueRef = useRef<Promise<void>>(Promise.resolve());
  const liveTranscriptSegmentRef = useRef<Record<RecordingTarget, string>>({
    buyer: "",
    supplier: "",
  });
  const liveEnglishSegmentRef = useRef<Record<RecordingTarget, string>>({
    buyer: "",
    supplier: "",
  });
  const liveTranscriptAtRef = useRef<Record<RecordingTarget, number>>({
    buyer: 0,
    supplier: 0,
  });
  const liveTranslationGenerationRef = useRef<Record<RecordingTarget, number>>({
    buyer: 0,
    supplier: 0,
  });
  const liveTranslationTimerRef = useRef<
    Record<RecordingTarget, ReturnType<typeof setTimeout> | null>
  >({
    buyer: null,
    supplier: null,
  });
  const liveUnderstandTimerRef = useRef<
    Record<RecordingTarget, ReturnType<typeof setTimeout> | null>
  >({
    buyer: null,
    supplier: null,
  });

  useEffect(() => {
    const translationTimers = liveTranslationTimerRef.current;
    const understandTimers = liveUnderstandTimerRef.current;
    fetch("/api/capabilities")
      .then((response) => response.json())
      .then((data: { sarvam?: boolean; samvaadRealtime?: boolean; telephonyConfigured?: boolean }) => {
        setCapability(data.sarvam || data.samvaadRealtime ? "live" : "offline");
        setRealtimeAvailable(Boolean(data.samvaadRealtime));
        if (data.samvaadRealtime) setVoiceMode("realtime");
        setTelephonyConfigured(Boolean(data.telephonyConfigured));
      })
      .catch(() => setCapability("offline"));

    return () => {
      void liveSessionRef.current?.stop();
      stopAgentBrief();
      for (const timer of Object.values(translationTimers)) {
        if (timer) clearTimeout(timer);
      }
      for (const timer of Object.values(understandTimers)) {
        if (timer) clearTimeout(timer);
      }
      if (callPollRef.current) clearInterval(callPollRef.current);
    };
  }, []);

  useEffect(() => {
    if (stage !== "supplier") stopAgentBrief();
  }, [stage]);

  useEffect(() => {
    const controller = new AbortController();
    let nextCaseId = window.localStorage.getItem(CASE_ID_STORAGE_KEY);
    if (!nextCaseId) {
      nextCaseId = crypto.randomUUID();
      window.localStorage.setItem(CASE_ID_STORAGE_KEY, nextCaseId);
    }
    fetch(`/api/case-memory?id=${encodeURIComponent(nextCaseId)}`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (response.status === 404) return null;
        if (!response.ok) throw new Error(await readError(response));
        const data = (await response.json()) as { memory?: unknown };
        const parsed = caseMemorySchema.safeParse(data.memory);
        const stored = data.memory as Partial<StoredCaseMemory> | null;
        return parsed.success &&
          stored?.id &&
          stored.createdAt &&
          stored.updatedAt
          ? ({
              id: stored.id,
              createdAt: stored.createdAt,
              updatedAt: stored.updatedAt,
              ...parsed.data,
            } as StoredCaseMemory)
          : null;
      })
      .then((memory) => {
        if (controller.signal.aborted) return;
        setCaseId(nextCaseId);
        if (memory) {
          setLanguage(memory.language);
          setSelectedSupplier(memory.selectedSupplier);
          setSellerBriefLanguage(memory.sellerBriefLanguage);
          setBuyerTranscript(memory.buyerTranscript);
          setBuyerEnglishTranscript(memory.buyerEnglishTranscript);
          setSupplierTranscript(memory.supplierTranscript);
          setSupplierEnglishTranscript(memory.supplierEnglishTranscript);
          setRequirement(memory.requirement);
          setOffer(memory.offer);
          setDecision(memory.decision);
          setPurchaseOrder(memory.purchaseOrder);
          setEvidence(memory.evidence);
          setFallbackUsed(memory.fallbackUsed);
          requirementRef.current = memory.requirement;
          offerRef.current = memory.offer;
          setStage(safeStageForMemory(memory));
          setMemoryStatus("restored");
        } else {
          setMemoryStatus("new");
        }
        setMemoryReady(true);
      })
      .catch((caught) => {
        if (controller.signal.aborted) return;
        console.error("case-memory-hydrate", caught);
        setMemoryStatus("unavailable");
        setMemoryReady(true);
      });

    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!memoryReady || !caseId) return;
    const timer = window.setTimeout(() => {
      setMemoryStatus("saving");
      fetch("/api/case-memory", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: caseId,
          memory: {
            schemaVersion: CASE_MEMORY_SCHEMA_VERSION,
            stage,
            language,
            selectedSupplier,
            buyerTranscript,
            buyerEnglishTranscript,
            supplierTranscript,
            supplierEnglishTranscript,
            sellerBriefLanguage,
            requirement,
            offer,
            decision,
            purchaseOrder,
            evidence,
            fallbackUsed,
          },
        }),
      })
        .then(async (response) => {
          if (!response.ok) throw new Error(await readError(response));
          setMemoryStatus("saved");
        })
        .catch((caught) => {
          console.error("case-memory-save", caught);
          setMemoryStatus("unavailable");
        });
    }, 700);

    return () => window.clearTimeout(timer);
  }, [
    buyerTranscript,
    buyerEnglishTranscript,
    caseId,
    decision,
    evidence,
    fallbackUsed,
    language,
    memoryReady,
    offer,
    purchaseOrder,
    requirement,
    selectedSupplier,
    sellerBriefLanguage,
    stage,
    supplierTranscript,
    supplierEnglishTranscript,
  ]);

  async function startRecording(target: RecordingTarget) {
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      chunksRef.current = [];
      targetRef.current = target;
      const preferredMimeType = [
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/mp4",
      ].find((type) => MediaRecorder.isTypeSupported(type));
      const recorder = preferredMimeType
        ? new MediaRecorder(stream, { mimeType: preferredMimeType })
        : new MediaRecorder(stream);
      recorderRef.current = recorder;
      discardRecordingRef.current = false;
      recorder.ondataavailable = (event) => {
        if (event.data.size) chunksRef.current.push(event.data);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        recorderRef.current = null;
        if (discardRecordingRef.current) {
          discardRecordingRef.current = false;
          chunksRef.current = [];
          setBusy(null);
          return;
        }
        try {
          const recordedAudio = new Blob(chunksRef.current, {
            type: recorder.mimeType || "audio/webm",
          });
          const wavAudio = await browserAudioToWav(recordedAudio);
          await transcribeAndUnderstand(wavAudio, targetRef.current);
        } catch {
          setBusy(null);
          setError(
            "The browser could not prepare this recording. Reload and try again.",
          );
        }
      };
      recorder.start();
      setRecording(target);
    } catch {
      setError("Microphone access was not granted. Enable it and retry.");
    }
  }

  function stopRecording() {
    recorderRef.current?.stop();
    setRecording(null);
  }

  async function transcribeAndUnderstand(
    audio: Blob,
    target: RecordingTarget,
  ) {
    setBusy(target);
    setError("");
    try {
      const form = new FormData();
      form.set("audio", audio, `karoboli-${target}.wav`);
      form.set("mode", "codemix");
      form.set("language", target === "buyer" ? language : "unknown");
      form.set("purpose", target);
      const transcriptResponse = await fetch("/api/speech/transcribe", {
        method: "POST",
        body: form,
      });
      if (!transcriptResponse.ok) throw new Error(await readError(transcriptResponse));
      const transcriptData = (await transcriptResponse.json()) as {
        transcript: string;
        english_transcript?: string;
        normalized_transcript?: string;
      };
      const englishTranscript =
        transcriptData.english_transcript ||
        (transcriptData.normalized_transcript !== transcriptData.transcript
          ? transcriptData.normalized_transcript
          : "");

      if (target === "buyer") {
        setBuyerTranscript((current) =>
          appendUniqueTranscript(current, transcriptData.transcript),
        );
        if (englishTranscript) {
          setBuyerEnglishTranscript((current) =>
            appendUniqueTranscript(current, englishTranscript),
          );
        }
        await understandBuyer(
          transcriptData.normalized_transcript || transcriptData.transcript,
        );
      } else {
        setSupplierTranscript((current) =>
          appendUniqueTranscript(current, transcriptData.transcript),
        );
        if (englishTranscript) {
          setSupplierEnglishTranscript((current) =>
            appendUniqueTranscript(current, englishTranscript),
          );
        }
        await understandSupplier(transcriptData.normalized_transcript || transcriptData.transcript);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Voice processing failed.");
    } finally {
      setBusy(null);
    }
  }

  async function understandBuyer(
    transcript: string,
    autoAdvance = false,
  ) {
    const response = await fetch("/api/understand", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind: "buyer",
        transcript,
        language,
        ...(requirementRef.current
          ? { existingRequirement: requirementRef.current }
          : {}),
      }),
    });
    if (!response.ok) throw new Error(await readError(response));
    const data = (await response.json()) as { requirement: BuyerRequirement };
    requirementRef.current = data.requirement;
    setRequirement(data.requirement);
    if (autoAdvance && isBuyerRequirementReady(data.requirement)) {
      setHandoffPending(true);
      try {
        await stopLiveAgent();
      } finally {
        setStage("supplier");
        setHandoffPending(false);
      }
    }
  }

  async function understandSupplier(transcript: string) {
    const activeRequirement = requirementRef.current;
    if (!activeRequirement) throw new Error("Capture the buyer brief first.");
    const response = await fetch("/api/understand", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind: "supplier",
        transcript,
        language: "hi-IN",
        supplierName: selectedSupplier,
        buyerRequirement: activeRequirement,
        ...(offerRef.current ? { existingOffer: offerRef.current } : {}),
      }),
    });
    if (!response.ok) throw new Error(await readError(response));
    const data = (await response.json()) as { offer: SupplierOffer };
    offerRef.current = data.offer;
    setOffer(data.offer);
  }

  function queueBuyerUnderstanding(transcript: string) {
    buyerUnderstandQueueRef.current = buyerUnderstandQueueRef.current
      .then(() => understandBuyer(transcript, true))
      .catch((caught) => {
        setError(
          caught instanceof Error
            ? caught.message
            : "The live buyer brief could not be structured.",
        );
      });
  }

  function queueSupplierUnderstanding(transcript: string) {
    supplierUnderstandQueueRef.current = supplierUnderstandQueueRef.current
      .then(() => understandSupplier(transcript))
      .catch((caught) => {
        setError(
          caught instanceof Error
            ? caught.message
            : "The live supplier offer could not be structured.",
        );
      });
  }

  async function appendEnglishTranslation(
    transcript: string,
    target: RecordingTarget,
  ) {
    const generation = ++liveTranslationGenerationRef.current[target];
    try {
      const sourceLanguage =
        target === "buyer"
          ? language === "unknown"
            ? "auto"
            : language
          : sellerBriefLanguage;
      const response = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: transcript, sourceLanguage }),
      });
      if (!response.ok) return;
      const data = (await response.json()) as { translation?: string };
      if (generation !== liveTranslationGenerationRef.current[target]) return;
      if (
        !data.translation ||
        normalizeTranscript(data.translation) === normalizeTranscript(transcript)
      ) {
        return;
      }
      const previousEnglish = liveEnglishSegmentRef.current[target];
      if (target === "buyer") {
        setBuyerEnglishTranscript((current) =>
          replaceStreamingTranscript(
            current,
            previousEnglish,
            data.translation || "",
          ),
        );
      } else {
        setSupplierEnglishTranscript((current) =>
          replaceStreamingTranscript(
            current,
            previousEnglish,
            data.translation || "",
          ),
        );
      }
      liveEnglishSegmentRef.current[target] = data.translation;
    } catch {
      // The original transcript remains usable when translation is unavailable.
    }
  }

  function beginLiveTranscriptTurn(target: RecordingTarget) {
    liveTranscriptSegmentRef.current[target] = "";
    liveEnglishSegmentRef.current[target] = "";
    liveTranscriptAtRef.current[target] = 0;
    liveTranslationGenerationRef.current[target] += 1;
    const translationTimer = liveTranslationTimerRef.current[target];
    if (translationTimer) clearTimeout(translationTimer);
    liveTranslationTimerRef.current[target] = null;
    const understandTimer = liveUnderstandTimerRef.current[target];
    if (understandTimer) clearTimeout(understandTimer);
    liveUnderstandTimerRef.current[target] = null;
  }

  function updateLiveTranscript(target: RecordingTarget, content: string) {
    const cleanContent = content.trim();
    if (!cleanContent) return;

    const now = Date.now();
    if (now - liveTranscriptAtRef.current[target] > 8_000) {
      beginLiveTranscriptTurn(target);
    }
    const previousHypothesis = liveTranscriptSegmentRef.current[target];
    if (target === "buyer") {
      setBuyerTranscript((current) =>
        replaceStreamingTranscript(current, previousHypothesis, cleanContent),
      );
    } else {
      setSupplierTranscript((current) =>
        replaceStreamingTranscript(current, previousHypothesis, cleanContent),
      );
    }
    liveTranscriptSegmentRef.current[target] = cleanContent;
    liveTranscriptAtRef.current[target] = now;

    const translationTimer = liveTranslationTimerRef.current[target];
    if (translationTimer) clearTimeout(translationTimer);
    liveTranslationTimerRef.current[target] = setTimeout(() => {
      void appendEnglishTranslation(cleanContent, target);
    }, 450);

    const understandTimer = liveUnderstandTimerRef.current[target];
    if (understandTimer) clearTimeout(understandTimer);
    liveUnderstandTimerRef.current[target] = setTimeout(() => {
      if (target === "buyer") {
        queueBuyerUnderstanding(cleanContent);
      } else {
        queueSupplierUnderstanding(cleanContent);
      }
    }, 650);
  }

  async function stopLiveAgent() {
    const session = liveSessionRef.current;
    liveSessionRef.current = null;
    setLiveRole(null);
    setAgentStatus("ended");
    if (session) await session.stop();
  }

  async function startLiveAgent(role: SamvaadRole) {
    setError("");
    setAgentText("");
    if (liveSessionRef.current) await stopLiveAgent();

    const activeSupplier = suppliers.find((s) => s.name === selectedSupplier);
    beginLiveTranscriptTurn(role);

    const session = new SamvaadBrowserSession(
      {
        role,
        language: role === "buyer" ? language : sellerBriefLanguage,
        requirement: requirementRef.current,
        supplierName: role === "supplier" ? selectedSupplier : undefined,
        supplierSupportedLanguages: role === "supplier" && activeSupplier ? activeSupplier.languages.join(", ") : undefined,
      },
      {
        onStatus: setAgentStatus,
        onAgentText: (text) =>
          setAgentText((current) =>
            !current || text.startsWith(current) ? text : `${current}${text}`,
          ),
        onEvent: (event) => {
          if (event.includes("user_speech_start")) {
            beginLiveTranscriptTurn(role);
          }
          if (
            event.includes("interaction_end") ||
            event === "gateway.session_closed"
          ) {
            setLiveRole(null);
            liveSessionRef.current = null;
          }
        },
        onError: (message) => setError(message),
        onTranscript: ({ role: speaker, content }) => {
          if (!speaker.toLowerCase().includes("user") || !content.trim()) return;
          updateLiveTranscript(role, content);
        },
      },
    );
    liveSessionRef.current = session;
    setLiveRole(role);
    try {
      await session.start();
    } catch (caught) {
      await session.stop();
      liveSessionRef.current = null;
      setLiveRole(null);
      setError(
        caught instanceof Error
          ? `${caught.message} Switch to composed mode to continue.`
          : "Samvaad streaming failed. Switch to composed mode to continue.",
      );
    }
  }

  async function runDecision(nextRequirement = requirement, nextOffer = offer) {
    if (!nextRequirement || !nextOffer) return;
    const nextDecision = evaluateOffer(
      nextOffer,
      buildGuardrails(nextRequirement),
    );
    const order = createPurchaseOrder(nextRequirement, nextOffer, nextDecision);
    const evidenceCore = {
      buyerTranscript,
      supplierTranscript,
      corrections: nextOffer.corrections,
      commitments: nextOffer.commitments,
      decision: nextDecision,
      purchaseOrder: order,
    };
    const digest = await digestEvidence(evidenceCore);
    setDecision(nextDecision);
    setPurchaseOrder(order);
    setEvidence({
      id: `EVD-${Date.now().toString(36).toUpperCase()}`,
      createdAt: new Date().toISOString(),
      ...evidenceCore,
      digest,
    });
    setStage("decision");
  }

  function loadFallback() {
    setFallbackUsed(true);
    setError("");
    setBuyerTranscript(fallbackBuyerTranscript);
    setBuyerEnglishTranscript(fallbackBuyerEnglishTranscript);
    setSupplierTranscript(fallbackSupplierTranscript);
    setSupplierEnglishTranscript(fallbackSupplierEnglishTranscript);
    requirementRef.current = fallbackRequirement;
    offerRef.current = fallbackOffer;
    setRequirement(fallbackRequirement);
    setOffer(fallbackOffer);
    setSelectedSupplier(fallbackOffer.supplierName);
    setStage("decision");
    const nextDecision = evaluateOffer(
      fallbackOffer,
      buildGuardrails(fallbackRequirement),
    );
    const order = createPurchaseOrder(
      fallbackRequirement,
      fallbackOffer,
      nextDecision,
    );
    setDecision(nextDecision);
    setPurchaseOrder(order);
    void digestEvidence({
      buyerTranscript: fallbackBuyerTranscript,
      supplierTranscript: fallbackSupplierTranscript,
      corrections: fallbackOffer.corrections,
      commitments: fallbackOffer.commitments,
      decision: nextDecision,
      purchaseOrder: order,
    }).then((digest) =>
      setEvidence({
        id: `EVD-${Date.now().toString(36).toUpperCase()}`,
        createdAt: new Date().toISOString(),
        buyerTranscript: fallbackBuyerTranscript,
        supplierTranscript: fallbackSupplierTranscript,
        corrections: fallbackOffer.corrections,
        commitments: fallbackOffer.commitments,
        decision: nextDecision,
        purchaseOrder: order,
        digest,
      }),
    );
  }

  function stopAgentBrief() {
    briefAbortRef.current?.abort();
    briefAbortRef.current = null;
    const audio = briefAudioRef.current;
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
      briefAudioRef.current = null;
    }
    if (briefAudioUrlRef.current) {
      URL.revokeObjectURL(briefAudioUrlRef.current);
      briefAudioUrlRef.current = null;
    }
    setBriefPlayback("idle");
  }

  async function playAgentBrief() {
    if (!requirement || briefPlayback !== "idle") {
      stopAgentBrief();
      return;
    }
    const controller = new AbortController();
    briefAbortRef.current = controller;
    setBriefPlayback("loading");
    setError("");
    try {
      const text = `Hello. This is Karoboli, an AI procurement assistant. The buyer needs ${requirement.quantity} ${requirement.unit} of ${requirement.product}, ${requirement.specification}, delivered to ${requirement.deliveryLocation} by ${formatDate(requirement.requiredBy)}. Please share your best all-inclusive offer, including tax, freight, unloading, delivery date, and payment terms.`;
      const response = await fetch("/api/speech/synthesize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          language: sellerBriefLanguage,
          translateFromEnglish: true,
          telephony: false,
        }),
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(await readError(response));
      const blob = await response.blob();
      if (controller.signal.aborted) return;
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      briefAudioRef.current = audio;
      briefAudioUrlRef.current = url;
      audio.onended = stopAgentBrief;
      audio.onerror = () => {
        stopAgentBrief();
        setError("Speech playback failed.");
      };
      setBriefPlayback("playing");
      await audio.play();
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === "AbortError") return;
      stopAgentBrief();
      setError(caught instanceof Error ? caught.message : "Speech playback failed.");
    }
  }

  function reset() {
    const previousCaseId = caseId;
    const nextCaseId = crypto.randomUUID();
    stopAgentBrief();
    beginLiveTranscriptTurn("buyer");
    beginLiveTranscriptTurn("supplier");
    if (recorderRef.current?.state !== "inactive") {
      discardRecordingRef.current = true;
      recorderRef.current?.stop();
    }
    recorderRef.current = null;
    chunksRef.current = [];
    setRecording(null);
    window.localStorage.setItem(CASE_ID_STORAGE_KEY, nextCaseId);
    setCaseId(nextCaseId);
    setMemoryStatus("new");
    if (previousCaseId) {
      void fetch(`/api/case-memory?id=${encodeURIComponent(previousCaseId)}`, {
        method: "DELETE",
      }).catch(() => undefined);
    }
    void stopLiveAgent();
    setStage("brief");
    setLanguage("unknown");
    setBuyerTranscript("");
    setBuyerEnglishTranscript("");
    setSupplierTranscript("");
    setSupplierEnglishTranscript("");
    setSellerBriefLanguage("en-IN");
    setSelectedSupplier(suppliers[0].name);
    setRequirement(null);
    setOffer(null);
    setDecision(null);
    setPurchaseOrder(null);
    setEvidence(null);
    requirementRef.current = null;
    offerRef.current = null;
    setAgentText("");
    setAgentStatus("idle");
    setError("");
    setFallbackUsed(false);
    setCallRecord(null);
    if (callPollRef.current) {
      clearInterval(callPollRef.current);
      callPollRef.current = null;
    }
    setHandoffPending(false);
  }

  async function callSupplier() {
    if (!requirement || callBusy) return;
    setCallBusy(true);
    setError("");
    const supplierInfo = suppliers.find((s) => s.name === selectedSupplier);
    try {
      const response = await fetch("/api/telephony/outbound", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supplierName: selectedSupplier,
          supplierPhone: supplierInfo ? "91-DEMO-9999" : "91-DEMO-9999",
          requirement,
        }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error || `Call failed (${response.status})`);
      }
      const data = (await response.json()) as { callId: string; record: CallRecord };
      setCallRecord(data.record);

      // Poll for call status updates
      if (callPollRef.current) clearInterval(callPollRef.current);
      callPollRef.current = setInterval(async () => {
        try {
          const pollResponse = await fetch(`/api/telephony/calls/${data.callId}`);
          if (pollResponse.ok) {
            const pollData = (await pollResponse.json()) as { call: CallRecord };
            setCallRecord(pollData.call);
            if (
              pollData.call.status === "completed" ||
              pollData.call.status === "failed"
            ) {
              clearInterval(callPollRef.current!);
              callPollRef.current = null;
            }
          }
        } catch {
          // polling failure is non-fatal
        }
      }, 3000);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Call failed.");
    } finally {
      setCallBusy(false);
    }
  }

  const requirementReady = isBuyerRequirementReady(requirement);
  const guardrails = requirementReady ? buildGuardrails(requirement) : null;
  const stepNumber = stage === "brief" ? 1 : stage === "supplier" ? 2 : 3;
  const buyerQuestion = nextBuyerQuestion(requirement);
  const supplierQuestion = nextSupplierQuestion(offer);

  return (
    <main>
      <nav className="topbar">
        <a className="brand" href="#top" aria-label="Karoboli home">
          <span className="brand-mark">क</span>
          <span>karoboli</span>
        </a>
        <div className="topbar-right">
          <span className={`status-pill ${capability}`}>
            <i />
            {capability === "checking"
              ? "Checking Sarvam"
              : liveRole
                ? `Samvaad ${agentStatus}`
                : realtimeAvailable && voiceMode === "realtime"
                  ? "Samvaad ready"
                  : capability === "live"
                    ? "Sarvam live"
                : "Fallback ready"}
          </span>
          <span className="build-label">EPOCH BUILD · BLR</span>
        </div>
      </nav>

      <section className="hero" id="top">
        <div className="eyebrow">VOICE-NATIVE PROCUREMENT FOR INDIA</div>
        <h1>
          A buyer speaks.
          <br />
          <em>Karoboli closes the loop.</em>
        </h1>
        <p className="hero-copy">
          Turn a multilingual requirement and a supplier&apos;s code-mixed
          counteroffer into an auditable decision and purchase order—in one live
          conversation.
        </p>
        <div className="hero-proof">
          <span>
            {realtimeAvailable && voiceMode === "realtime"
              ? "Samvaad Agent"
              : "Saaras v3"}
          </span>
          <b>→</b>
          <span>Policy engine</span>
          <b>→</b>
          <span>
            {realtimeAvailable && voiceMode === "realtime"
              ? "Streaming voice"
              : "Sarvam-30B + Bulbul v3"}
          </span>
        </div>
      </section>

      <section className="workspace">
        <aside className="steps" aria-label="Demo steps">
          {[
            ["01", "Buyer brief", "Speak in any supported language"],
            ["02", "Supplier offer", "Capture Hinglish corrections"],
            ["03", "Decision", "Guardrails, PO and evidence"],
          ].map(([number, label, detail], index) => {
            const state =
              index + 1 === stepNumber
                ? "active"
                : index + 1 < stepNumber
                  ? "done"
                  : "";
            return (
              <button
                key={number}
                className={`step ${state}`}
                onClick={() => {
                  if (index === 0) setStage("brief");
                  if (index === 1 && requirement) setStage("supplier");
                  if (index === 2 && decision) setStage("decision");
                }}
              >
                <span className="step-number">{state === "done" ? "✓" : number}</span>
                <span>
                  <strong>{label}</strong>
                  <small>{detail}</small>
                </span>
              </button>
            );
          })}

          <div className="principle-card">
            <span>DESIGN PRINCIPLE</span>
            <strong>Never hide uncertainty.</strong>
            <p>
              Missing facts trigger confirmation or escalation—not hallucination.
            </p>
          </div>
        </aside>

        <div className="stage-card">
          <div className={`case-memory-bar ${memoryStatus}`}>
            <span>
              <i />
              CLOUDFLARE D1 CASE MEMORY
            </span>
            <div className="case-memory-actions">
              <small>
                {memoryStatus === "loading"
                  ? "Finding your active case…"
                  : memoryStatus === "restored"
                    ? "Case restored across sessions"
                    : memoryStatus === "saving"
                      ? "Saving buyer and supplier context…"
                      : memoryStatus === "saved"
                        ? "Buyer brief, offer and commitments saved"
                        : memoryStatus === "unavailable"
                          ? "Memory unavailable · live workflow still works"
                          : "New private case"}
                {caseId ? ` · ${caseId.slice(0, 8).toUpperCase()}` : ""}
              </small>
              <button
                type="button"
                onClick={reset}
                disabled={!memoryReady}
                title="Delete this saved case and return to an empty buyer brief"
              >
                Start new case
              </button>
            </div>
          </div>
          {realtimeAvailable && (
            <div className="provider-switch" aria-label="Voice provider">
              <span>VOICE PATH</span>
              <button
                className={voiceMode === "realtime" ? "active" : ""}
                onClick={() => {
                  setVoiceMode("realtime");
                  setFallbackUsed(false);
                }}
                disabled={liveRole !== null}
              >
                Samvaad streaming
              </button>
              <button
                className={voiceMode === "composed" ? "active" : ""}
                onClick={() => {
                  void stopLiveAgent();
                  setVoiceMode("composed");
                }}
              >
                Composed fallback
              </button>
            </div>
          )}
          {fallbackUsed && (
            <div className="fallback-banner">
              <strong>Disclosed fallback case</strong>
              <span>
                This is a deterministic backup, not a live Sarvam result.
              </span>
            </div>
          )}
          {handoffPending && (
            <div className="handoff-banner" role="status">
              <strong>Buyer requirement complete</strong>
              <span>Saving the case and opening supplier matches…</span>
            </div>
          )}
          {error && (
            <div className="error-banner" role="alert">
              <span>{error}</span>
              <button onClick={() => setError("")}>Dismiss</button>
            </div>
          )}

          {stage === "brief" && (
            <section className="stage-content">
              <header className="stage-heading">
                <div>
                  <span className="section-kicker">STEP 1 · BUYER</span>
                  <h2>What do you need?</h2>
                  <p>
                    Speak naturally in your language. Mix languages, revise
                    yourself, and include product, quantity, location, deadline
                    and budget.
                  </p>
                </div>
                <select
                  value={language}
                  onChange={(event) =>
                    setLanguage(event.target.value as BuyerLanguage)
                  }
                  aria-label="Buyer language"
                >
                  {(Object.keys(languageLabels) as BuyerLanguage[]).map((code) => (
                    <option key={code} value={code}>
                      {languageLabels[code]}
                    </option>
                  ))}
                </select>
              </header>

              <div
                className={`voice-pad ${
                  recording === "buyer" || liveRole === "buyer" ? "recording" : ""
                }`}
              >
                <div className="wave" aria-hidden="true">
                  {Array.from({ length: 23 }).map((_, index) => (
                    <i key={index} style={{ animationDelay: `${index * 40}ms` }} />
                  ))}
                </div>
                <button
                  className="record-button"
                  onClick={() => {
                    if (voiceMode === "realtime") {
                      void (liveRole === "buyer"
                        ? stopLiveAgent()
                        : startLiveAgent("buyer"));
                    } else if (recording === "buyer") {
                      stopRecording();
                    } else {
                      void startRecording("buyer");
                    }
                  }}
                  disabled={
                    busy !== null ||
                    recording === "supplier" ||
                    (liveRole !== null && liveRole !== "buyer")
                  }
                >
                  <span>
                    {recording === "buyer" || liveRole === "buyer" ? "■" : "●"}
                  </span>
                  {voiceMode === "realtime"
                    ? liveRole === "buyer"
                      ? "End live conversation"
                      : agentStatus === "connecting"
                        ? "Connecting Samvaad…"
                        : "Start live buyer agent"
                    : recording === "buyer"
                      ? "Stop & process"
                      : busy === "buyer"
                        ? "Sarvam is listening…"
                        : "Record buyer brief"}
                </button>
                <p>
                  {voiceMode === "realtime"
                    ? "Streaming 16 kHz speech · interruptions enabled"
                    : "Best under 30 seconds · microphone only leaves for transcription"}
                </p>
              </div>

              {(agentText || liveRole === "buyer") && (
                <div className="agent-turn" aria-live="polite">
                  <span>LIVE SAMVAAD AGENT · {agentStatus.toUpperCase()}</span>
                  <p>{agentText || "Listening for the buyer brief…"}</p>
                </div>
              )}

              {buyerTranscript && (
                <TranscriptPair
                  original={buyerTranscript}
                  english={buyerEnglishTranscript}
                  originalLabel="ORIGINAL LANGUAGE"
                />
              )}

              {requirement && (
                <>
                  <div className="facts-grid">
                    <Fact label="ITEM" value={`${requirement.product} · ${requirement.specification}`} />
                    <Fact
                      label="QUANTITY"
                      value={
                        requirement.quantity > 0
                          ? `${requirement.quantity} ${requirement.unit}`
                          : "Needs confirmation"
                      }
                    />
                    <Fact label="DELIVER TO" value={requirement.deliveryLocation} />
                    <Fact
                      label="REQUIRED BY"
                      value={
                        requirement.requiredBy === "unknown"
                          ? "Needs confirmation"
                          : formatDate(requirement.requiredBy)
                      }
                    />
                    <Fact
                      label="MAXIMUM BUDGET"
                      value={
                        requirement.maximumBudget > 0
                          ? money(requirement.maximumBudget)
                          : "Needs confirmation"
                      }
                    />
                    <Fact label="PAYMENT" value={requirement.preferredPaymentTerm} />
                  </div>
                  {requirement.needsConfirmation ? (
                    <>
                      <div className="confirm-box">
                        <strong>Confirmation required</strong>
                        <span>
                          Missing or uncertain: {requirement.missingFields.join(", ")}
                        </span>
                      </div>
                      {buyerQuestion && (
                        <div className="follow-up-card">
                          <span>ONE TARGETED FOLLOW-UP</span>
                          <strong>{buyerQuestion}</strong>
                          <small>
                            Answer naturally; existing confirmed facts will be preserved.
                          </small>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="confirmed-box">
                      <span>✓</span>
                      <p>
                        <strong>Structured without translation loss</strong>
                        All required commercial facts were captured.
                      </p>
                    </div>
                  )}
                </>
              )}

              <div className="stage-actions">
                <button className="secondary-button" onClick={loadFallback}>
                  Use disclosed fallback
                </button>
                <button
                  className="primary-button"
                  disabled={!requirement || requirement.needsConfirmation}
                  onClick={() => setStage("supplier")}
                >
                  Match supplier <span>→</span>
                </button>
              </div>
            </section>
          )}

          {stage === "supplier" && requirement && (
            <section className="stage-content">
              <header className="stage-heading">
                <div>
                  <span className="section-kicker">STEP 2 · SUPPLIER</span>
                  <h2>Negotiate the offer.</h2>
                  <p>
                    Choose the seller&apos;s preferred language, hear the buyer
                    requirement, then answer naturally and self-correct the
                    price once.
                  </p>
                </div>
                <div className="brief-controls">
                  <label>
                    <span>SELLER BRIEF LANGUAGE</span>
                    <select
                      value={sellerBriefLanguage}
                      onChange={(event) => {
                        stopAgentBrief();
                        setSellerBriefLanguage(
                          event.target.value as SpeechLanguage,
                        );
                      }}
                      aria-label="Seller brief language"
                    >
                      {(Object.keys(speechLanguageLabels) as SpeechLanguage[]).map(
                        (code) => (
                          <option key={code} value={code}>
                            {speechLanguageLabels[code]}
                          </option>
                        ),
                      )}
                    </select>
                  </label>
                  <button
                    className={`voice-button ${
                      briefPlayback !== "idle" ? "playing" : ""
                    }`}
                    onClick={() => void playAgentBrief()}
                    disabled={busy !== null}
                    aria-pressed={briefPlayback !== "idle"}
                  >
                    {briefPlayback === "loading"
                      ? "■ Cancel brief"
                      : briefPlayback === "playing"
                        ? "■ Stop agent brief"
                        : "▶ Hear agent brief"}
                  </button>
                </div>
              </header>

              <div className="supplier-list">
                {suppliers.map((supplier) => (
                  <button
                    key={supplier.name}
                    className={selectedSupplier === supplier.name ? "selected" : ""}
                    onClick={() => setSelectedSupplier(supplier.name)}
                  >
                    <span className="supplier-avatar">
                      {supplier.name
                        .split(" ")
                        .slice(0, 2)
                        .map((word) => word[0])
                        .join("")}
                    </span>
                    <span className="supplier-copy">
                      <strong>{supplier.name}</strong>
                      <small>{supplier.area} · {supplier.detail}</small>
                      <small style={{ marginTop: '2px', color: '#0d9488' }}>
                        {supplier.languages.join(", ")} · {supplier.deliveryRadius}
                      </small>
                    </span>
                    <b>{supplier.score}</b>
                  </button>
                ))}
              </div>

              <div className="prompt-card">
                <span>TRY THIS LIVE</span>
                <p>
                  “Total ₹40,800—nahi, correction ₹40,200. Freight, unloading
                  aur GST included. July 28 delivery, payment on delivery.”
                </p>
              </div>

              <div
                className={`voice-pad compact ${
                  recording === "supplier" || liveRole === "supplier"
                    ? "recording"
                    : ""
                }`}
              >
                <div className="wave" aria-hidden="true">
                  {Array.from({ length: 23 }).map((_, index) => (
                    <i key={index} style={{ animationDelay: `${index * 40}ms` }} />
                  ))}
                </div>
                <button
                  className="record-button"
                  onClick={() => {
                    if (voiceMode === "realtime") {
                      void (liveRole === "supplier"
                        ? stopLiveAgent()
                        : startLiveAgent("supplier"));
                    } else if (recording === "supplier") {
                      stopRecording();
                    } else {
                      void startRecording("supplier");
                    }
                  }}
                  disabled={
                    busy !== null ||
                    recording === "buyer" ||
                    (liveRole !== null && liveRole !== "supplier")
                  }
                >
                  <span>
                    {recording === "supplier" || liveRole === "supplier"
                      ? "■"
                      : "●"}
                  </span>
                  {voiceMode === "realtime"
                    ? liveRole === "supplier"
                      ? "End live negotiation"
                      : agentStatus === "connecting"
                        ? "Connecting Samvaad…"
                        : "Start live supplier agent"
                    : recording === "supplier"
                      ? "Stop & process"
                      : busy === "supplier"
                        ? "Resolving corrections…"
                        : "Record supplier reply"}
                </button>
              </div>

              {(agentText || liveRole === "supplier") && (
                <div className="agent-turn" aria-live="polite">
                  <span>LIVE SAMVAAD AGENT · {agentStatus.toUpperCase()}</span>
                  <p>{agentText || "Opening the supplier negotiation…"}</p>
                </div>
              )}

              {supplierTranscript && (
                <TranscriptPair
                  original={supplierTranscript}
                  english={supplierEnglishTranscript}
                  originalLabel="ORIGINAL-LANGUAGE OFFER"
                />
              )}

              {offer && (
                <>
                  <div className="offer-result">
                    <div className="offer-price">
                      <span>FINAL LANDED TOTAL</span>
                      <strong>
                        {offer.totalPrice > 0
                          ? money(offer.totalPrice)
                          : "Needs confirmation"}
                      </strong>
                      <small>
                        {offer.unitPrice
                          ? `${money(offer.unitPrice)} / ${requirement.unit.replace(/s$/, "")}`
                          : "Unit price not stated"}
                      </small>
                    </div>
                    <div className="commitment-list">
                      {offer.corrections.map((correction) => (
                        <div className="correction" key={correction.evidence}>
                          <span>SELF-CORRECTION RESOLVED</span>
                          <strong>
                            <s>{money(correction.before)}</s> → {money(correction.after)}
                          </strong>
                        </div>
                      ))}
                      {offer.commitments.slice(0, 4).map((commitment) => (
                        <p key={commitment}>
                          <i>✓</i> {commitment}
                        </p>
                      ))}
                    </div>
                  </div>
                  {offer.needsConfirmation && supplierQuestion && (
                    <div className="follow-up-card">
                      <span>ONE TARGETED FOLLOW-UP</span>
                      <strong>{supplierQuestion}</strong>
                      <small>
                        The offer will not reach policy evaluation until this is clear.
                      </small>
                    </div>
                  )}
                </>
              )}

              <DealRoom
                requirement={requirement}
                offer={offer}
                decision={null}
                evidence={null}
                supplierName={selectedSupplier}
              />

              <div className="stage-actions">
                <button className="secondary-button" onClick={() => setStage("brief")}>
                  ← Back
                </button>
                {telephonyConfigured && (
                  <button
                    className="secondary-button"
                    disabled={!requirement || callBusy}
                    onClick={() => void callSupplier()}
                    title="Trigger a live outbound call to the supplier via Sarvam telephony"
                  >
                    {callBusy ? "Dialling…" : "📞 Call supplier"}
                  </button>
                )}
                <button
                  className="primary-button"
                  disabled={!offer || offer.needsConfirmation}
                  onClick={() => runDecision()}
                >
                  Apply guardrails <span>→</span>
                </button>
              </div>
              {callRecord && (
                <div className={`call-status-badge ${callRecord.status}`} aria-live="polite">
                  <span>TELEPHONY</span>
                  <strong>
                    {callRecord.supplierName} ·{" "}
                    {callRecord.status === "dialing"
                      ? "Dialling…"
                      : callRecord.status === "connected"
                        ? "Connected"
                        : callRecord.status === "completed"
                          ? "✓ Call completed"
                          : "✗ Call failed"}
                  </strong>
                  {callRecord.decision?.action === "human-approval" && (
                    <span className="escalation-flag">
                      ⬆ Escalated for human approval
                    </span>
                  )}
                </div>
              )}
            </section>
          )}

          {stage === "decision" && requirement && offer && decision && guardrails && (
            <section className="stage-content">
              <header className="stage-heading decision-heading">
                <div>
                  <span className="section-kicker">STEP 3 · DECISION</span>
                  <h2>Decision, with receipts.</h2>
                  <p>
                    Language models extract facts. Deterministic policy decides
                    what Karoboli is allowed to do.
                  </p>
                </div>
                <span className={`decision-badge ${decision.action}`}>
                  {decision.action === "auto-accept"
                    ? "✓ AUTO-ACCEPTED"
                    : decision.action === "human-approval"
                      ? "↗ HUMAN APPROVAL"
                      : "× REJECTED"}
                </span>
              </header>

              {decision.action === "human-approval" && (
                <div className="human-approval-banner" role="alert">
                  <strong>⬆ Human approval required</strong>
                  <span>
                    This offer exceeds the autonomous ceiling or has unresolved conditions. A
                    procurement manager must review and approve before an order is placed.
                  </span>
                  <small>
                    Reasons: {decision.reasons.join(" · ")}
                  </small>
                </div>
              )}

              <div className="decision-grid">
                <div className="policy-panel">
                  <header>
                    <span>GUARDRAIL TRACE</span>
                    <small>Deterministic · no LLM authority</small>
                  </header>
                  {decision.checks.map((check) => (
                    <div className="policy-row" key={check.label}>
                      <i className={check.passed ? "pass" : "fail"}>
                        {check.passed ? "✓" : "×"}
                      </i>
                      <span>
                        <strong>{check.label}</strong>
                        <small>{check.detail}</small>
                      </span>
                    </div>
                  ))}
                </div>

                <div className="memory-panel">
                  <header>
                    <span>VERBAL MEMORY</span>
                    <small>{offer.commitments.length} commitments</small>
                  </header>
                  {offer.corrections.map((correction) => (
                    <div className="memory-event correction-event" key={correction.evidence}>
                      <i />
                      <span>
                        <small>PRICE CORRECTION</small>
                        <strong>
                          {money(correction.before)} → {money(correction.after)}
                        </strong>
                        <em>“{correction.evidence}”</em>
                      </span>
                    </div>
                  ))}
                  {offer.commitments.slice(0, 4).map((commitment) => (
                    <div className="memory-event" key={commitment}>
                      <i />
                      <span>
                        <small>COMMITMENT</small>
                        <strong>{commitment}</strong>
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {purchaseOrder ? (
                <article className="purchase-order">
                  <header>
                    <div>
                      <span>PURCHASE ORDER</span>
                      <strong>{purchaseOrder.id}</strong>
                    </div>
                    <div className="po-status">
                      {purchaseOrder.status === "draft-approved"
                        ? "DRAFT APPROVED"
                        : "AWAITING APPROVAL"}
                    </div>
                  </header>
                  <div className="po-parties">
                    <div>
                      <span>SUPPLIER</span>
                      <strong>{purchaseOrder.supplierName}</strong>
                    </div>
                    <div>
                      <span>DELIVER TO</span>
                      <strong>{purchaseOrder.deliveryLocation}</strong>
                    </div>
                    <div>
                      <span>DELIVERY DATE</span>
                      <strong>{formatDate(purchaseOrder.deliveryDate)}</strong>
                    </div>
                  </div>
                  <div className="po-line">
                    <div>
                      <strong>{purchaseOrder.product}</strong>
                      <small>{purchaseOrder.specification}</small>
                    </div>
                    <span>{purchaseOrder.quantity} {purchaseOrder.unit}</span>
                    <strong>{money(purchaseOrder.totalPrice)}</strong>
                  </div>
                  <footer>
                    <span>
                      Freight {purchaseOrder.freightIncluded ? "included" : "excluded"} ·
                      Unloading {purchaseOrder.unloadingIncluded ? " included" : " excluded"} ·
                      GST {purchaseOrder.gstIncluded ? " included" : " excluded"}
                    </span>
                    <strong>Total {money(purchaseOrder.totalPrice)}</strong>
                  </footer>
                </article>
              ) : (
                <div className="rejected-order">
                  <strong>No purchase order generated.</strong>
                  <span>The offer failed a hard commercial guardrail.</span>
                </div>
              )}

              {evidence && (
                <div className="evidence-strip">
                  <span className="hash-icon">#</span>
                  <div>
                    <small>TAMPER-EVIDENT RUN · {evidence.id}</small>
                    <code>sha256:{evidence.digest.slice(0, 20)}…</code>
                  </div>
                  <p>
                    Transcript, corrections, commitments, policy trace and PO are
                    bound into one evidence record.
                  </p>
                </div>
              )}

              <DealRoom
                requirement={requirement}
                offer={offer}
                decision={decision}
                evidence={evidence}
                supplierName={selectedSupplier}
              />

              <div className="stage-actions final-actions">
                <button className="secondary-button" onClick={reset}>
                  Run another live case
                </button>
                <button className="secondary-button" onClick={() => window.open(`/room/buyer/${caseId}`, '_blank')}>
                  Open Buyer Workspace <span>↗</span>
                </button>
                <button className="secondary-button" onClick={() => window.open(`/room/supplier/${caseId}`, '_blank')}>
                  Preview Supplier Workspace <span>↗</span>
                </button>
                <button className="primary-button" onClick={() => window.print()}>
                  Export decision <span>↗</span>
                </button>
              </div>
            </section>
          )}
        </div>
      </section>

      <section className="score-strip">
          <div>
            <span>01</span>
            <strong>Native input</strong>
            <small>Auto-detected multilingual speech</small>
          </div>
        <div>
          <span>02</span>
          <strong>Real code-mixing</strong>
          <small>Hinglish corrections preserved</small>
        </div>
        <div>
          <span>03</span>
          <strong>Safe autonomy</strong>
          <small>Policy controls every action</small>
        </div>
        <div>
          <span>04</span>
          <strong>Verifiable output</strong>
          <small>PO + evidence digest</small>
        </div>
      </section>

      <footer className="site-footer">
        <span>Karoboli · Built at Sarvam Epoch Buildathon, Bengaluru</span>
        <span>Prototype · No order is sent without configured authority</span>
      </footer>
    </main>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="fact">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

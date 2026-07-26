"use client";

import { useEffect, useRef, useState } from "react";
import type {
  BuyerRequirement,
  Decision,
  EvidenceRecord,
  Language,
  PurchaseOrder,
  SupplierOffer,
} from "@/lib/domain";
import {
  fallbackBuyerTranscript,
  fallbackOffer,
  fallbackRequirement,
  fallbackSupplierTranscript,
} from "@/lib/fixtures";
import {
  buildGuardrails,
  createPurchaseOrder,
  evaluateOffer,
} from "@/lib/policy";

type Stage = "brief" | "supplier" | "decision";
type RecordingTarget = "buyer" | "supplier";
type CapabilityStatus = "checking" | "live" | "offline";

const suppliers = [
  {
    name: "Sri Balaji Building Supplies",
    area: "KR Puram",
    score: "96%",
    detail: "213 completed orders · Telugu / Hindi",
  },
  {
    name: "Metro Cement Depot",
    area: "Mahadevapura",
    score: "91%",
    detail: "148 completed orders · Tamil / English",
  },
  {
    name: "Sree Lakshmi Traders",
    area: "Hoskote",
    score: "89%",
    detail: "92 completed orders · Telugu / Hindi",
  },
];

const languageLabels: Record<Language, string> = {
  "te-IN": "Telugu",
  "ta-IN": "Tamil",
  "hi-IN": "Hindi / Hinglish",
  "en-IN": "English",
};

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
  const [language, setLanguage] = useState<Language>("te-IN");
  const [recording, setRecording] = useState<RecordingTarget | null>(null);
  const [busy, setBusy] = useState<RecordingTarget | "voice" | null>(null);
  const [buyerTranscript, setBuyerTranscript] = useState("");
  const [supplierTranscript, setSupplierTranscript] = useState("");
  const [requirement, setRequirement] = useState<BuyerRequirement | null>(null);
  const [offer, setOffer] = useState<SupplierOffer | null>(null);
  const [decision, setDecision] = useState<Decision | null>(null);
  const [purchaseOrder, setPurchaseOrder] = useState<PurchaseOrder | null>(null);
  const [evidence, setEvidence] = useState<EvidenceRecord | null>(null);
  const [selectedSupplier, setSelectedSupplier] = useState(suppliers[0].name);
  const [error, setError] = useState("");
  const [fallbackUsed, setFallbackUsed] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const targetRef = useRef<RecordingTarget>("buyer");

  useEffect(() => {
    fetch("/api/capabilities")
      .then((response) => response.json())
      .then((data: { sarvam?: boolean }) =>
        setCapability(data.sarvam ? "live" : "offline"),
      )
      .catch(() => setCapability("offline"));
  }, []);

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
      recorder.ondataavailable = (event) => {
        if (event.data.size) chunksRef.current.push(event.data);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
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
        normalized_transcript?: string;
      };

      if (target === "buyer") {
        setBuyerTranscript(transcriptData.transcript);
        await understandBuyer(
          transcriptData.normalized_transcript || transcriptData.transcript,
        );
      } else {
        setSupplierTranscript(transcriptData.transcript);
        await understandSupplier(transcriptData.transcript);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Voice processing failed.");
    } finally {
      setBusy(null);
    }
  }

  async function understandBuyer(transcript: string) {
    const response = await fetch("/api/understand", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "buyer", transcript, language }),
    });
    if (!response.ok) throw new Error(await readError(response));
    const data = (await response.json()) as { requirement: BuyerRequirement };
    setRequirement(data.requirement);
  }

  async function understandSupplier(transcript: string) {
    if (!requirement) throw new Error("Capture the buyer brief first.");
    const response = await fetch("/api/understand", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind: "supplier",
        transcript,
        language: "hi-IN",
        supplierName: selectedSupplier,
        buyerRequirement: requirement,
      }),
    });
    if (!response.ok) throw new Error(await readError(response));
    const data = (await response.json()) as { offer: SupplierOffer };
    setOffer(data.offer);
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
    setSupplierTranscript(fallbackSupplierTranscript);
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

  async function playAgentBrief() {
    if (!requirement) return;
    setBusy("voice");
    setError("");
    try {
      const text = `Namaste. Requirement hai ${requirement.quantity} ${requirement.unit}, ${requirement.product}, ${requirement.specification}. Delivery ${requirement.deliveryLocation} mein ${formatDate(requirement.requiredBy)} tak chahiye. Maximum budget ${money(requirement.maximumBudget)} hai. Apna best all-inclusive offer batayiye.`;
      const response = await fetch("/api/speech/synthesize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, language: "hi-IN", telephony: false }),
      });
      if (!response.ok) throw new Error(await readError(response));
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.onended = () => URL.revokeObjectURL(url);
      await audio.play();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Speech playback failed.");
    } finally {
      setBusy(null);
    }
  }

  function reset() {
    setStage("brief");
    setBuyerTranscript("");
    setSupplierTranscript("");
    setRequirement(null);
    setOffer(null);
    setDecision(null);
    setPurchaseOrder(null);
    setEvidence(null);
    setError("");
    setFallbackUsed(false);
  }

  const requirementReady =
    requirement !== null &&
    !requirement.needsConfirmation &&
    requirement.quantity > 0 &&
    requirement.maximumBudget > 0 &&
    requirement.requiredBy !== "unknown" &&
    requirement.preferredPaymentTerm !== "unknown";
  const guardrails = requirementReady ? buildGuardrails(requirement) : null;
  const stepNumber = stage === "brief" ? 1 : stage === "supplier" ? 2 : 3;

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
          <span>Saaras v3</span>
          <b>→</b>
          <span>Sarvam-30B</span>
          <b>→</b>
          <span>Policy engine</span>
          <b>→</b>
          <span>Bulbul v3</span>
        </div>
      </section>

      <section className="workspace">
        <aside className="steps" aria-label="Demo steps">
          {[
            ["01", "Buyer brief", "Speak in Telugu, Tamil or English"],
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
          {fallbackUsed && (
            <div className="fallback-banner">
              <strong>Disclosed fallback case</strong>
              <span>
                This is a deterministic backup, not a live Sarvam result.
              </span>
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
                    Speak naturally. Mix languages, revise yourself, and include
                    product, quantity, location, deadline and budget.
                  </p>
                </div>
                <select
                  value={language}
                  onChange={(event) => setLanguage(event.target.value as Language)}
                  aria-label="Buyer language"
                >
                  {(Object.keys(languageLabels) as Language[]).map((code) => (
                    <option key={code} value={code}>
                      {languageLabels[code]}
                    </option>
                  ))}
                </select>
              </header>

              <div className={`voice-pad ${recording === "buyer" ? "recording" : ""}`}>
                <div className="wave" aria-hidden="true">
                  {Array.from({ length: 23 }).map((_, index) => (
                    <i key={index} style={{ animationDelay: `${index * 40}ms` }} />
                  ))}
                </div>
                <button
                  className="record-button"
                  onClick={() =>
                    recording === "buyer" ? stopRecording() : startRecording("buyer")
                  }
                  disabled={busy !== null || recording === "supplier"}
                >
                  <span>{recording === "buyer" ? "■" : "●"}</span>
                  {recording === "buyer"
                    ? "Stop & process"
                    : busy === "buyer"
                      ? "Sarvam is listening…"
                      : `Record in ${languageLabels[language]}`}
                </button>
                <p>Best under 30 seconds · microphone only leaves for transcription</p>
              </div>

              {buyerTranscript && (
                <div className="transcript-block">
                  <span>ORIGINAL TRANSCRIPT</span>
                  <blockquote>“{buyerTranscript}”</blockquote>
                </div>
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
                    <div className="confirm-box">
                      <strong>Confirmation required</strong>
                      <span>
                        Missing or uncertain: {requirement.missingFields.join(", ")}
                      </span>
                    </div>
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
                    Play Karoboli&apos;s brief, then answer as the supplier in
                    natural Hindi or Hinglish. Self-correct the price once.
                  </p>
                </div>
                <button
                  className="voice-button"
                  onClick={playAgentBrief}
                  disabled={busy !== null}
                >
                  {busy === "voice" ? "Generating…" : "▶ Hear agent brief"}
                </button>
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

              <div className={`voice-pad compact ${recording === "supplier" ? "recording" : ""}`}>
                <div className="wave" aria-hidden="true">
                  {Array.from({ length: 23 }).map((_, index) => (
                    <i key={index} style={{ animationDelay: `${index * 40}ms` }} />
                  ))}
                </div>
                <button
                  className="record-button"
                  onClick={() =>
                    recording === "supplier"
                      ? stopRecording()
                      : startRecording("supplier")
                  }
                  disabled={busy !== null || recording === "buyer"}
                >
                  <span>{recording === "supplier" ? "■" : "●"}</span>
                  {recording === "supplier"
                    ? "Stop & process"
                    : busy === "supplier"
                      ? "Resolving corrections…"
                      : "Record supplier reply"}
                </button>
              </div>

              {supplierTranscript && (
                <div className="transcript-block">
                  <span>VERBATIM OFFER</span>
                  <blockquote>“{supplierTranscript}”</blockquote>
                </div>
              )}

              {offer && (
                <div className="offer-result">
                  <div className="offer-price">
                    <span>FINAL LANDED TOTAL</span>
                    <strong>{money(offer.totalPrice)}</strong>
                    <small>
                      {offer.unitPrice ? `${money(offer.unitPrice)} / ${requirement.unit.replace(/s$/, "")}` : "Unit price not stated"}
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
              )}

              <div className="stage-actions">
                <button className="secondary-button" onClick={() => setStage("brief")}>
                  ← Back
                </button>
                <button
                  className="primary-button"
                  disabled={!offer}
                  onClick={() => runDecision()}
                >
                  Apply guardrails <span>→</span>
                </button>
              </div>
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

              <div className="stage-actions final-actions">
                <button className="secondary-button" onClick={reset}>
                  Run another live case
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
          <small>Telugu · Tamil · English</small>
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

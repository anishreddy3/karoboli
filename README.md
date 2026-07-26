# Karoboli

**A voice-native procurement agent for India.**

Karoboli turns a multilingual buyer requirement and a supplier's code-mixed
counteroffer into a deterministic commercial decision, an auditable commitment
trail, and a purchase-order draft.

Built as a new, event-day prototype for the Sarvam Epoch Buildathon in
Bengaluru.

## The live proof

1. A buyer speaks in any supported language.
2. When provisioned, a Samvaad agent streams speech, text, and interruption
   events through Karoboli's credential-safe gateway.
3. The composed Saaras v3 + Sarvam-30B path remains available as a disclosed
   provider fallback.
4. A supplier replies in Hindi/Hinglish and self-corrects a commercial term.
5. Karoboli preserves the correction and verbal commitments.
6. A deterministic policy engine—not an LLM—accepts, escalates, or rejects.
7. The app generates a PO draft and a SHA-256 evidence record.
8. Bulbul v3 gives the supplier-facing agent a natural Indian voice.

The disclosed fallback case is always labeled. It never masquerades as live
Sarvam output.

## Local setup

Requires Node.js 22.13 or newer.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Add your Sarvam key to `.env.local`:

```dotenv
SARVAM_API_KEY=your_key_here
```

Open [http://localhost:3000](http://localhost:3000). If that port is occupied,
the terminal will show the next available port.

### Optional Samvaad streaming

The streaming path requires a committed Samvaad app plus organization and
workspace IDs. Follow [the gateway setup](./gateway/README.md), run it on port
8788, and add the gateway URL and matching session secret to `.env.local`.
Use `SARVAM_AGENT_API_KEY` when the Agents runtime key differs from the public
speech API key.
Karoboli automatically enables the streaming/composed provider switch when the
gateway is configured.

## Commands

```bash
npm run dev
npm run lint
npm run build
npm test
```

## Architecture

```text
Browser microphone
  ├─ Samvaad streaming gateway → committed agent app
  └─ composed fallback → Saaras v3 → Sarvam-30B → Bulbul v3
  → deterministic policy engine
  → PO + tamper-evident evidence record
```

Sarvam Voice Experience is the primary buildathon parameter. Content and Doc
Agents are deliberately supporting capabilities; adding more APIs is not the
goal unless they make the live procurement loop more convincing.

See [IDEA_SCOPE.md](./IDEA_SCOPE.md), [the demo script](./docs/demo-script.md),
[the Milestone 2 implementation notes](./docs/milestone-2.md), and
[the implementation roadmap](./docs/roadmap.md).

## Safety and prototype status

- No live order is sent from this prototype.
- Missing commercial facts require confirmation.
- Hard budget, deadline, payment, and freight rules are deterministic.
- Human approval is required above the autonomy ceiling.
- Secrets stay in ignored `.env*` files.

import assert from "node:assert/strict";
import test from "node:test";
import {
  appendUniqueTranscript,
  replaceStreamingTranscript,
} from "../lib/transcript";

test("successive Samvaad hypotheses replace one live utterance", () => {
  const first =
    "200 bags, 53 grade cement Kawali, Whitefield site ki July 29 low ko delivery.";
  const second =
    "200 bags, 53 grade cement kaavali, Whitefield site ki July 29 low ku delivery, maximum budget";
  const final =
    "నాకు 200 బ్యాగ్స్, 53 గ్రేడ్ సిమెంట్ కావాలి వైట్ ఫీల్డ్ సైట్ కి జులై 29 లోపు డెలివరీ. మాక్సిమం బడ్జెట్ 41,000 రూపీస్, పేమెంట్ డెలివరీ అప్పుడు.";

  let transcript = replaceStreamingTranscript("", "", first);
  transcript = replaceStreamingTranscript(transcript, first, second);
  transcript = replaceStreamingTranscript(transcript, second, final);

  assert.equal(transcript, final);
  assert.doesNotMatch(transcript, /Kawali|kaavali/);
});

test("a new speech turn appends while exact duplicates are ignored", () => {
  const first = "I need 200 bags of cement.";
  const followUp = "Delivery must be by July 29.";

  const combined = replaceStreamingTranscript(first, "", followUp);
  assert.equal(combined, `${first}\n${followUp}`);
  assert.equal(appendUniqueTranscript(combined, followUp), combined);
});

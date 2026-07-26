from __future__ import annotations

import json
import os
from typing import Any, Literal

import httpx
from pydantic import Field
from sarvam_conv_ai_sdk import (
    SarvamOnEndTool,
    SarvamOnEndToolContext,
    SarvamOnStartTool,
    SarvamOnStartToolContext,
    SarvamTool,
    SarvamToolContext,
    SarvamToolOutput,
)


def _tool_settings(context: Any) -> tuple[str, str]:
    base_url = os.getenv("KAROBOLI_TOOL_BASE_URL", "").rstrip("/")
    secret = os.getenv("AGENT_TOOL_SHARED_SECRET", "")
    try:
        base_url = context.get_secret("KAROBOLI_TOOL_BASE_URL") or base_url
        secret = context.get_secret("AGENT_TOOL_SHARED_SECRET") or secret
    except Exception:
        pass
    if not base_url or not secret:
        raise RuntimeError("Karoboli tool endpoint is not configured.")
    return base_url, secret


async def _post_tool(
    context: Any,
    path: str,
    payload: dict[str, Any],
) -> dict[str, Any]:
    base_url, secret = _tool_settings(context)
    async with httpx.AsyncClient(timeout=15) as client:
        response = await client.post(
            f"{base_url}{path}",
            headers={"Authorization": f"Bearer {secret}"},
            json=payload,
        )
        response.raise_for_status()
        return response.json()


class EvaluateOffer(SarvamTool):
    """Apply Karoboli's deterministic commercial guardrails."""

    requirement: dict[str, Any] = Field(description="Complete buyer requirement")
    offer: dict[str, Any] = Field(description="Supplier's latest complete offer")

    async def run(self, context: SarvamToolContext) -> SarvamToolOutput:
        result = await _post_tool(
            context,
            "/api/agent-tools/evaluate-offer",
            {"requirement": self.requirement, "offer": self.offer},
        )
        action = result["decision"]["action"]
        context.set_agent_variable("karoboli_decision", action)
        context.set_agent_variable(
            "karoboli_decision_json", json.dumps(result, separators=(",", ":"))
        )
        return SarvamToolOutput(
            message_to_llm=(
                "Karoboli's deterministic policy returned: "
                + json.dumps(result, separators=(",", ":"))
            ),
            message_to_user=(
                "I have checked the offer against the buyer's approved guardrails."
            ),
            context=context,
        )


class GetNextQuestion(SarvamTool):
    """Request exactly one deterministic follow-up question."""

    kind: Literal["buyer", "supplier"]
    record: dict[str, Any] = Field(description="Current requirement or offer")

    async def run(self, context: SarvamToolContext) -> SarvamToolOutput:
        key = "requirement" if self.kind == "buyer" else "offer"
        result = await _post_tool(
            context,
            "/api/agent-tools/next-question",
            {"kind": self.kind, key: self.record},
        )
        question = result.get("question")
        return SarvamToolOutput(
            message_to_llm=f"Ask only this follow-up question: {question}",
            message_to_user=question,
            context=context,
        )


class OnStart(SarvamOnStartTool):
    async def run(
        self,
        context: SarvamOnStartToolContext,
    ) -> SarvamOnStartToolContext:
        role = context.get_agent_variable("karoboli_role")
        context.set_agent_variable("policy_authority", "karoboli_deterministic_engine")
        if role == "supplier":
            context.set_initial_bot_message(
                "Namaste. I am Karoboli, calling about a buyer requirement. "
                "I will confirm commercial terms before any human-approved order."
            )
        else:
            context.set_initial_bot_message(
                "Namaste. Tell me what you need in the language you prefer."
            )
        return context


class OnEnd(SarvamOnEndTool):
    async def run(
        self,
        context: SarvamOnEndToolContext,
    ) -> SarvamOnEndToolContext:
        decision_json = context.get_agent_variable("karoboli_decision_json") or "{}"
        try:
            decision_record = json.loads(decision_json)
        except json.JSONDecodeError:
            decision_record = {}
        transcript = context.get_interaction_transcript().model_dump(mode="json")
        await _post_tool(
            context,
            "/api/agent-tools/finalize-evidence",
            {
                "interactionId": context.get_engagement_metadata().interaction_id,
                "buyerTranscript": json.dumps(
                    transcript if context.get_agent_variable("karoboli_role") == "buyer" else {}
                ),
                "supplierTranscript": json.dumps(
                    transcript
                    if context.get_agent_variable("karoboli_role") == "supplier"
                    else {}
                ),
                "corrections": [],
                "commitments": [],
                "decision": decision_record.get("decision"),
                "purchaseOrder": decision_record.get("purchaseOrder"),
            },
        )
        return context

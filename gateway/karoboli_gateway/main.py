from __future__ import annotations

import asyncio
import base64
import json
from typing import Any

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from pydantic import SecretStr
from sarvam_conv_ai_sdk import (
    AsyncSamvaadAgent,
    InteractionConfig,
    InteractionType,
    SarvamToolLanguageName,
)
from sarvam_conv_ai_sdk.messages.types import UserIdentifierType

from .auth import SessionTokenError, verify_session_token
from .config import Settings

app = FastAPI(title="Karoboli Samvaad Gateway", version="0.2.0")

LANGUAGES = {
    "as-IN": SarvamToolLanguageName.ASSAMESE,
    "bn-IN": SarvamToolLanguageName.BENGALI,
    "en-IN": SarvamToolLanguageName.ENGLISH,
    "gu-IN": SarvamToolLanguageName.GUJARATI,
    "hi-IN": SarvamToolLanguageName.HINDI,
    "kn-IN": SarvamToolLanguageName.KANNADA,
    "kok-IN": SarvamToolLanguageName.KONKANI,
    "ml-IN": SarvamToolLanguageName.MALAYALAM,
    "mr-IN": SarvamToolLanguageName.MARATHI,
    "or-IN": SarvamToolLanguageName.ODIA,
    "pa-IN": SarvamToolLanguageName.PUNJABI,
    "ta-IN": SarvamToolLanguageName.TAMIL,
    "te-IN": SarvamToolLanguageName.TELUGU,
}


def _message_payload(message: Any) -> dict[str, Any]:
    if hasattr(message, "model_dump"):
        return message.model_dump(mode="json")
    return {"value": str(message)}


def _hotwords(requirement: dict[str, Any] | None) -> list[str]:
    if not requirement:
        return ["Karoboli"]
    values = [
        "Karoboli",
        requirement.get("product"),
        requirement.get("specification"),
        requirement.get("deliveryLocation"),
    ]
    return [str(value) for value in values if value and value != "unknown"]


@app.get("/health")
async def health() -> dict[str, Any]:
    try:
        settings = Settings.from_environment()
    except RuntimeError as error:
        return {"ready": False, "detail": str(error)}
    return {
        "ready": True,
        "appConfigured": bool(settings.app_id),
        "allowedOrigins": len(settings.allowed_origins),
    }


@app.websocket("/ws/agent")
async def agent_socket(websocket: WebSocket) -> None:
    try:
        settings = Settings.from_environment()
    except RuntimeError:
        await websocket.close(code=1013, reason="Gateway is not configured.")
        return

    origin = websocket.headers.get("origin")
    if origin and origin not in settings.allowed_origins:
        await websocket.close(code=4403, reason="Origin is not allowed.")
        return

    await websocket.accept()
    agent: AsyncSamvaadAgent | None = None
    try:
        init = await websocket.receive_json()
        try:
            claims = verify_session_token(
                str(init.get("token", "")),
                settings.gateway_shared_secret,
            )
        except SessionTokenError:
            await websocket.send_json(
                {"type": "error", "message": "Invalid session token."}
            )
            await websocket.close(code=4401, reason="Invalid session token.")
            return

        if init.get("type") != "init" or init.get("role") not in {
            "buyer",
            "supplier",
        }:
            await websocket.send_json(
                {"type": "error", "message": "A valid init message is required."}
            )
            await websocket.close(code=4400)
            return

        role = str(init["role"])
        requirement = (
            init.get("requirement")
            if isinstance(init.get("requirement"), dict)
            else None
        )
        language = LANGUAGES.get(str(init.get("language", "")))
        initial_state = (
            settings.buyer_state if role == "buyer" else settings.supplier_state
        )
        agent_variables = {
            "karoboli_role": role,
            "buyer_requirement_json": json.dumps(requirement or {}),
            "supplier_name": str(init.get("supplierName") or ""),
            "supplier_supported_languages": str(init.get("supplierSupportedLanguages") or "Any Indian language"),
            "policy_authority": "karoboli_deterministic_engine",
        }
        config = InteractionConfig(
            user_identifier_type=UserIdentifierType.CUSTOM,
            user_identifier=claims.subject,
            org_id=settings.org_id,
            workspace_id=settings.workspace_id,
            app_id=settings.app_id,
            version=settings.app_version,
            interaction_type=InteractionType.CALL,
            sample_rate=16_000,
            agent_variables=agent_variables,
            initial_language_name=language,
            initial_state_name=initial_state,
            speech_hotwords=_hotwords(requirement),
        )

        async def send_to_client(payload: dict[str, Any]) -> bool:
            try:
                await websocket.send_json(payload)
                return True
            except (WebSocketDisconnect, RuntimeError):
                return False

        async def on_text(message: Any) -> None:
            await send_to_client(
                {
                    "type": "agent_text",
                    "text": getattr(message, "text", ""),
                    "payload": _message_payload(message),
                }
            )

        async def on_audio(message: Any) -> None:
            await send_to_client(
                {
                    "type": "agent_audio",
                    "audio": getattr(message, "audio_base64", ""),
                    "sampleRate": getattr(message, "sample_rate", 16_000),
                }
            )

        upstream_ended = asyncio.Event()

        async def on_event(message: Any) -> None:
            payload = _message_payload(message)
            if payload.get("type") == "server.action.interaction_end":
                upstream_ended.set()
            await send_to_client(
                {
                    "type": "agent_event",
                    "event": payload.get("type", "unknown"),
                    "payload": payload,
                }
            )

        async def on_transcript(message: Any) -> None:
            role_value = getattr(getattr(message, "role", None), "value", "")
            await send_to_client(
                {
                    "type": "transcript",
                    "role": role_value,
                    "content": getattr(message, "content", ""),
                }
            )

        agent = AsyncSamvaadAgent(
            api_key=SecretStr(settings.sarvam_api_key),
            config=config,
            text_callback=on_text,
            audio_callback=on_audio,
            event_callback=on_event,
            transcript_callback=on_transcript,
            base_url=settings.sarvam_runtime_base_url,
        )
        await agent.start()
        if not await agent.wait_for_connect(timeout=10):
            raise RuntimeError("Sarvam agent did not connect in time.")
        await send_to_client(
            {
                "type": "ready",
                "interactionId": agent.get_interaction_id(),
                "sampleRate": 16_000,
            }
        )

        async def receive_client_messages() -> str:
            while True:
                message = await websocket.receive_json()
                message_type = message.get("type")
                if message_type == "audio":
                    encoded = str(message.get("data", ""))
                    if len(encoded) > 350_000:
                        raise ValueError("Audio chunk is too large.")
                    if not agent.is_connected():
                        return "upstream-disconnected"
                    try:
                        await agent.send_audio(
                            base64.b64decode(encoded, validate=True)
                        )
                    except Exception:
                        if not agent.is_connected():
                            return "upstream-disconnected"
                        raise
                elif message_type == "text":
                    if not agent.is_connected():
                        return "upstream-disconnected"
                    try:
                        await agent.send_text(str(message.get("data", ""))[:4000])
                    except Exception:
                        if not agent.is_connected():
                            return "upstream-disconnected"
                        raise
                elif message_type == "stop":
                    return "client-stop"
                else:
                    await websocket.send_json(
                        {
                            "type": "warning",
                            "message": "Unsupported client message.",
                        }
                    )

        receiver_task = asyncio.create_task(receive_client_messages())
        disconnect_task = asyncio.create_task(agent.wait_for_disconnect())
        done, pending = await asyncio.wait(
            {receiver_task, disconnect_task},
            return_when=asyncio.FIRST_COMPLETED,
        )
        receiver_result = (
            await receiver_task if receiver_task in done else "upstream-disconnected"
        )
        for task in pending:
            task.cancel()
        await asyncio.gather(*pending, return_exceptions=True)

        if receiver_result == "upstream-disconnected" and not upstream_ended.is_set():
            await send_to_client(
                {
                    "type": "agent_event",
                    "event": "server.action.interaction_end",
                    "payload": {
                        "type": "server.action.interaction_end",
                        "reason": "upstream_disconnected",
                    },
                }
            )
    except WebSocketDisconnect:
        pass
    except Exception as error:
        try:
            await websocket.send_json(
                {"type": "error", "message": f"Agent session failed: {error}"}
            )
        except Exception:
            pass
    finally:
        if agent is not None:
            await agent.stop()
        try:
            await websocket.close()
        except Exception:
            pass

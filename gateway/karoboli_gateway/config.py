from __future__ import annotations

import os
from dataclasses import dataclass


@dataclass(frozen=True)
class Settings:
    sarvam_api_key: str
    org_id: str
    workspace_id: str
    app_id: str
    app_version: int | None
    gateway_shared_secret: str
    allowed_origins: tuple[str, ...]
    buyer_state: str | None
    supplier_state: str | None
    karoboli_tool_base_url: str | None
    agent_tool_shared_secret: str | None
    sarvam_runtime_base_url: str

    @classmethod
    def from_environment(cls) -> "Settings":
        agent_api_key = (
            os.getenv("SARVAM_AGENT_API_KEY", "").strip()
            or os.getenv("SARVAM_API_KEY", "").strip()
        )
        required = {
            "SARVAM_AGENT_API_KEY": agent_api_key,
            "SARVAM_AGENT_ORG_ID": os.getenv("SARVAM_AGENT_ORG_ID", "").strip(),
            "SARVAM_AGENT_WORKSPACE_ID": os.getenv(
                "SARVAM_AGENT_WORKSPACE_ID", ""
            ).strip(),
            "SARVAM_AGENT_APP_ID": os.getenv("SARVAM_AGENT_APP_ID", "").strip(),
            "SAMVAAD_GATEWAY_SHARED_SECRET": os.getenv(
                "SAMVAAD_GATEWAY_SHARED_SECRET", ""
            ).strip(),
        }
        missing = [key for key, value in required.items() if not value]
        if missing:
            raise RuntimeError(
                "Missing required gateway settings: " + ", ".join(sorted(missing))
            )

        version_text = os.getenv("SARVAM_AGENT_VERSION", "").strip()
        origins = tuple(
            origin.strip()
            for origin in os.getenv(
                "SAMVAAD_ALLOWED_ORIGINS", "http://localhost:3000"
            ).split(",")
            if origin.strip()
        )
        return cls(
            sarvam_api_key=required["SARVAM_AGENT_API_KEY"],
            org_id=required["SARVAM_AGENT_ORG_ID"],
            workspace_id=required["SARVAM_AGENT_WORKSPACE_ID"],
            app_id=required["SARVAM_AGENT_APP_ID"],
            app_version=int(version_text) if version_text else None,
            gateway_shared_secret=required["SAMVAAD_GATEWAY_SHARED_SECRET"],
            allowed_origins=origins,
            buyer_state=os.getenv("SARVAM_AGENT_BUYER_STATE") or None,
            supplier_state=os.getenv("SARVAM_AGENT_SUPPLIER_STATE") or None,
            karoboli_tool_base_url=os.getenv("KAROBOLI_TOOL_BASE_URL") or None,
            agent_tool_shared_secret=os.getenv("AGENT_TOOL_SHARED_SECRET") or None,
            sarvam_runtime_base_url=os.getenv(
                "SARVAM_AGENT_RUNTIME_BASE_URL",
                "https://apps.sarvam.ai/api/app-runtime/",
            ),
        )

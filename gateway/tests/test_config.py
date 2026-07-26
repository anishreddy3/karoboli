import os
import unittest
from unittest.mock import patch

from karoboli_gateway.config import Settings


BASE_ENV = {
    "SARVAM_AGENT_ORG_ID": "org",
    "SARVAM_AGENT_WORKSPACE_ID": "workspace",
    "SARVAM_AGENT_APP_ID": "app",
    "SAMVAAD_GATEWAY_SHARED_SECRET": "gateway-secret",
}


class SettingsTests(unittest.TestCase):
    def test_prefers_agent_specific_api_key(self):
        with patch.dict(
            os.environ,
            {
                **BASE_ENV,
                "SARVAM_API_KEY": "speech-key",
                "SARVAM_AGENT_API_KEY": "agent-key",
            },
            clear=True,
        ):
            self.assertEqual(Settings.from_environment().sarvam_api_key, "agent-key")

    def test_falls_back_to_shared_sarvam_api_key(self):
        with patch.dict(
            os.environ,
            {**BASE_ENV, "SARVAM_API_KEY": "shared-key"},
            clear=True,
        ):
            self.assertEqual(Settings.from_environment().sarvam_api_key, "shared-key")


if __name__ == "__main__":
    unittest.main()

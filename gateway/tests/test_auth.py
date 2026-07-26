import base64
import hashlib
import hmac
import json
import unittest

from karoboli_gateway.auth import SessionTokenError, verify_session_token


def token(payload: dict, secret: str) -> str:
    encoded = base64.urlsafe_b64encode(
        json.dumps(payload, separators=(",", ":")).encode()
    ).decode().rstrip("=")
    signature = base64.urlsafe_b64encode(
        hmac.new(secret.encode(), encoded.encode(), hashlib.sha256).digest()
    ).decode().rstrip("=")
    return f"{encoded}.{signature}"


class SessionTokenTests(unittest.TestCase):
    def test_accepts_valid_short_lived_token(self):
        claims = verify_session_token(
            token({"sub": "demo", "exp": 200, "nonce": "abc"}, "secret"),
            "secret",
            now=100,
        )
        self.assertEqual(claims.subject, "demo")
        self.assertEqual(claims.expires_at, 200)

    def test_rejects_expired_token(self):
        with self.assertRaises(SessionTokenError):
            verify_session_token(
                token({"sub": "demo", "exp": 100, "nonce": "abc"}, "secret"),
                "secret",
                now=100,
            )

    def test_rejects_tampered_token(self):
        with self.assertRaises(SessionTokenError):
            verify_session_token(
                token({"sub": "demo", "exp": 200, "nonce": "abc"}, "wrong"),
                "secret",
                now=100,
            )


if __name__ == "__main__":
    unittest.main()

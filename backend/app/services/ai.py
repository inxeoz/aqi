"""Adaption AI gateway (ADPAPI) for analyst + writer calls.

Auth: ADAPTION_API_KEY (or ADPAPI) in the backend environment.
Optional override: ADAPTION_BASE_URL (default https://api.prod.adaptionlabs.ai).
Models: ANALYST_MODEL / WRITER_MODEL / AI_MODEL env, else ADAPTION_MODEL, else default.
"""
import os

DEFAULT_MODEL = os.getenv("ADAPTION_MODEL") or "glm-5.3-flash"

def model_for(kind: str = "analyst") -> str:
    if kind == "writer":
        return os.getenv("WRITER_MODEL") or os.getenv("AI_MODEL") or DEFAULT_MODEL
    return os.getenv("ANALYST_MODEL") or os.getenv("AI_MODEL") or DEFAULT_MODEL

def complete(prompt: str, *, kind: str = "analyst",
             temperature: float | None = None, max_tokens: int | None = None) -> str:
    """Call POST /api/v1/responses via the official SDK. Returns plain text."""
    from adaption import Adaption
    key = os.getenv("ADAPTION_API_KEY") or os.getenv("ADPAPI")
    if not key:
        raise RuntimeError("ADAPTION_API_KEY is not set")
    kw: dict = {"api_key": key}
    base = os.getenv("ADAPTION_BASE_URL")
    if base:
        kw["base_url"] = base
    client = Adaption(**kw)
    if temperature is None:
        temperature = 0.1 if kind == "analyst" else 0.5
    if max_tokens is None:
        max_tokens = 1200 if kind == "analyst" else 500
    resp = client.responses.create(
        model=model_for(kind),
        input=prompt,
        temperature=temperature,
        max_output_tokens=max_tokens,
    )
    text = (resp.output_text or "").strip()
    if not text:
        raise RuntimeError("empty Adaption reply")
    return text

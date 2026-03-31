#!/usr/bin/env python3
"""Civic AI decision engine.

Reads JSON from stdin with:
- prompt: str
- stats: dict

Returns JSON with:
- reply: str
- decision: dict
"""

from __future__ import annotations

import json
import re
import sys
from dataclasses import dataclass
from typing import Dict, List

STOP_WORDS = {
    "the",
    "a",
    "an",
    "is",
    "are",
    "was",
    "were",
    "for",
    "to",
    "of",
    "and",
    "or",
    "in",
    "on",
    "at",
    "it",
    "this",
    "that",
    "with",
    "from",
    "my",
    "i",
    "we",
    "you",
    "our",
    "your",
    "be",
    "can",
    "could",
    "should",
    "would",
    "how",
    "what",
    "when",
    "where",
    "why",
    "please",
    "about",
    "me",
}

INTENT_KEYWORDS = {
    "emergency": {
        "sos",
        "emergency",
        "urgent",
        "danger",
        "fire",
        "attack",
        "accident",
        "rescue",
        "help",
        "bleeding",
        "collapsed",
    },
    "complaint": {"complaint", "issue", "problem", "broken", "garbage", "drainage", "streetlight", "pothole"},
    "query": {"query", "question", "clarify", "information", "details", "update"},
    "stats": {"stats", "status", "reports", "dashboard", "summary", "count"},
    "guidance": {"guide", "steps", "process", "file", "submit"},
    "smalltalk": {"hello", "hi", "hey", "thanks", "thank", "yo", "hola", "good", "morning", "evening"},
    "general": {
        "explain",
        "write",
        "create",
        "story",
        "poem",
        "code",
        "debug",
        "email",
        "plan",
        "ideas",
        "brainstorm",
        "translate",
        "summarize",
        "anything",
    },
}


@dataclass
class Decision:
    intent: str
    confidence: float
    next_actions: List[str]



def tokenize(message: str) -> List[str]:
    normalized = re.sub(r"[^a-z0-9\s]", " ", message.lower())
    return [token for token in normalized.split() if token and token not in STOP_WORDS]



def decide_intent(tokens: List[str]) -> Decision:
    if not tokens:
        return Decision(intent="guidance", confidence=0.25, next_actions=["ask_for_context"])

    scores: Dict[str, float] = {intent: 0.0 for intent in INTENT_KEYWORDS}
    token_set = set(tokens)

    for intent, words in INTENT_KEYWORDS.items():
        overlap = token_set.intersection(words)
        if overlap:
            base = 1.6 if intent == "emergency" else 1.0
            scores[intent] += base * len(overlap)

    top_intent = max(scores, key=scores.get)
    top_score = scores[top_intent]

    if top_score <= 0:
        if len(tokens) >= 3:
            return Decision(intent="general", confidence=0.55, next_actions=["clarify_goal", "provide_general_help"])
        return Decision(intent="smalltalk", confidence=0.35, next_actions=["friendly_greeting"])

    total = sum(scores.values()) + 1e-9
    confidence = min(0.98, max(0.4, top_score / total + 0.3))

    if top_intent == "emergency":
        actions = ["escalate_sos", "request_location", "safety_instructions"]
    elif top_intent == "complaint":
        actions = ["collect_evidence", "route_department", "set_case_priority"]
    elif top_intent == "stats":
        actions = ["summarize_metrics", "evaluate_backlog"]
    elif top_intent == "query":
        actions = ["collect_case_id", "clarify_question"]
    elif top_intent == "smalltalk":
        actions = ["friendly_greeting", "offer_capabilities"]
    elif top_intent == "general":
        actions = ["clarify_goal", "provide_general_help"]
    else:
        actions = ["provide_menu", "suggest_next_step"]

    return Decision(intent=top_intent, confidence=round(confidence, 2), next_actions=actions)



def summarize_backlog(stats: dict) -> str:
    total = int(stats.get("total", 0))
    pending = int(stats.get("pending", 0))
    if total <= 0:
        return "No reports have been logged yet."
    pending_rate = round((pending / max(total, 1)) * 100)
    if pending_rate > 70:
        return "Backlog is high and most reports are pending."
    if pending_rate > 40:
        return "Backlog is moderate with a mix of pending and resolved cases."
    return "Resolution velocity looks healthy with most reports resolved."



def build_reply(prompt: str, stats: dict, decision: Decision) -> str:
    if not prompt.strip():
        return (
            "Hey friend — tell me what you need help with. I can triage emergencies, help draft complaints, "
            "answer civic questions, and summarize live report trends."
        )

    if decision.intent == "emergency":
        return (
            "Hey, this sounds urgent. Please use SOS right away and share your exact location, nearby landmark, "
            "any injuries/damage, and a callback number. If there's immediate danger to life, call 112 now."
        )

    if decision.intent == "complaint":
        return (
            "Got you. For a strong complaint, include: (1) exact location, (2) issue type, (3) impact on people, "
            "and (4) photo/reference details. Share those and I’ll help prioritize routing."
        )

    if decision.intent == "query":
        return "Sure thing — share the context, your exact question, and any case ID so I can help you get a faster response."

    if decision.intent == "stats":
        return (
            f"Live summary: total {int(stats.get('total', 0))}, pending {int(stats.get('pending', 0))}, "
            f"resolved {int(stats.get('resolved', 0))}, SOS {int(stats.get('sos', 0))}, "
            f"complaints {int(stats.get('complaint', 0))}, queries {int(stats.get('query', 0))}. "
            f"Insight: {summarize_backlog(stats)}"
        )

    if decision.intent == "smalltalk":
        return (
            "Hey! I’m here and ready to help. You can ask me almost anything — writing, coding, planning, "
            "explanations, or civic support."
        )

    if decision.intent == "general":
        return (
            "Absolutely — I can chat like a general assistant too. Tell me your goal and preferred format "
            "(quick answer, step-by-step, bullet points, code, email draft, etc.), and I’ll tailor the response."
        )

    return (
        "I can help with SOS escalation, complaint drafting, and civic query handling. "
        "I can also support general tasks like writing, coding, brainstorming, summaries, and explanations."
    )



def main() -> int:
    try:
        payload = json.loads(sys.stdin.read() or "{}")
    except json.JSONDecodeError:
        print(json.dumps({"reply": "Invalid AI payload", "decision": {"intent": "guidance", "confidence": 0.0, "next_actions": []}}))
        return 0

    prompt = str(payload.get("prompt", ""))
    stats = payload.get("stats", {}) if isinstance(payload.get("stats", {}), dict) else {}

    tokens = tokenize(prompt)
    decision = decide_intent(tokens)
    reply = build_reply(prompt, stats, decision)

    out = {
        "reply": reply,
        "decision": {
            "intent": decision.intent,
            "confidence": decision.confidence,
            "next_actions": decision.next_actions,
        },
    }
    print(json.dumps(out))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

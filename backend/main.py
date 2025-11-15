from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import httpx
import json
import re
import os

#########################################
# CONFIG
#########################################

OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434")
MODEL_NAME = os.getenv("OLLAMA_MODEL", "phi3.5")  # pulled phi3.5:latest

#########################################
# FASTAPI SETUP
#########################################

app = FastAPI(
    title="Brain Booster Flashcard API",
    description="Generates flashcards from selected text using phi3.5 via Ollama",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "*",  # extension needs this
        "chrome-extension://*"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


#########################################
# MODELS
#########################################

class FlashcardRequest(BaseModel):
    text: str = Field(..., min_length=10, max_length=10000)


class FlashcardResponse(BaseModel):
    question: str
    answer: str
    hint: str
    difficulty: str
    topic: str


#########################################
# PROMPT TEMPLATES
#########################################

SYSTEM_PROMPT = """
You are an expert at converting academic, technical, and research-heavy text into high-quality flashcards.

Generate ONE flashcard from the text below.
Output ONLY valid JSON with the following keys:

{
  "question": "",
  "answer": "",
  "hint": "",
  "difficulty": "",
  "topic": ""
}

Rules:
- Create a precise, exam-style question.
- The answer must be concise but correct.
- Keep JSON strictly valid (no trailing commas, no quotes missing).
- Difficulty must be: easy, medium, or hard.
- Topic is a short label (NLP, ML, algebra, physics).
"""

USER_PROMPT_TEMPLATE = """
Text:
\"\"\"{text}\"\"\"
"""


#########################################
# UTILS — JSON REPAIR SYSTEM
#########################################

def extract_json_block(raw: str) -> str:
    """
    Extract JSON from LLM output even if inside ```json fences.
    """
    raw = raw.strip()

    # Strip code fences like ```json ... ```
    if raw.startswith("```"):
        raw = re.sub(r"^```[a-zA-Z]*", "", raw).strip()
        raw = raw.rstrip("`").strip()

    return raw


def try_parse_json(raw: str):
    try:
        return json.loads(raw), True
    except:
        return None, False


def repair_json(raw: str) -> str:
    """
    Attempts to auto-fix invalid JSON created by the model.
    Fixes:
    - missing commas between fields
    - stray quotes
    - trailing commas
    """

    raw = raw.replace("\n", "\n")

    # Fix missing commas between JSON fields
    raw = re.sub(r'"\s*([a-zA-Z_]+)"\s*:', r'", "\1":', raw)
    raw = raw.replace("{,", "{")
    raw = raw.replace(",}", "}")

    # Remove accidental double commas
    raw = raw.replace(", ,", ",")

    # Fix missing comma between lines e.g. "\"hint\": \"...\" \"difficulty\": \"hard\""
    raw = re.sub(r'"\s*"\s*([a-zA-Z_]+)"', r'", "\1"', raw)

    return raw


def parse_flashcard(raw: str) -> FlashcardResponse:
    """
    Convert raw model output → valid FlashcardResponse.
    Includes auto-repair for invalid JSON.
    """

    raw = extract_json_block(raw)

    # 1) try direct parse
    parsed, ok = try_parse_json(raw)
    if ok:
        return FlashcardResponse(**parsed)

    # 2) try repair
    fixed = repair_json(raw)
    parsed, ok = try_parse_json(fixed)
    if ok:
        return FlashcardResponse(**parsed)

    # 3) still invalid
    raise HTTPException(
        status_code=500,
        detail=f"Model output is not valid JSON even after repair.\nOutput:\n{raw}"
    )


#########################################
# OLLAMA CHAT REQUEST
#########################################

async def call_ollama(text: str) -> str:
    payload = {
        "model": MODEL_NAME,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": USER_PROMPT_TEMPLATE.format(text=text)},
        ],
        "stream": False,
    }

    async with httpx.AsyncClient(timeout=45.0) as client:
        resp = await client.post(f"{OLLAMA_URL}/api/chat", json=payload)

    if resp.status_code != 200:
        raise HTTPException(
            status_code=500,
            detail=f"Ollama error: {resp.status_code} {resp.text}"
        )

    try:
        return resp.json()["message"]["content"]
    except:
        raise HTTPException(
            status_code=500,
            detail=f"Unexpected Ollama format: {resp.text}"
        )


#########################################
# ROUTES
#########################################

@app.post("/flashcard", response_model=FlashcardResponse)
async def generate_flashcard(req: FlashcardRequest):
    raw = await call_ollama(req.text)
    flashcard = parse_flashcard(raw)
    return flashcard


#########################################
# LOCAL DEV ENTRY
#########################################

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)

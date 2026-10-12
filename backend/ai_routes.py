import os
import json
import asyncio
from fastapi import APIRouter, Request, Response
from fastapi.responses import StreamingResponse
import httpx
import google.generativeai as genai
from config import GEMINI_API_KEY, GROQ_API_KEY
import numpy as np

# We'll import the embedding and similarity functions locally to avoid circular import

router = APIRouter(prefix="/api/ai", tags=["ai"])

GEMINI_MODEL_FAST = "models/gemini-2.5-flash" 
GROQ_MODEL_FAST = "qwen/qwen3.8-27b"

@router.get("/status")
async def get_ai_status():
    if GROQ_API_KEY:
        return {"configured": True, "activeProvider": "groq"}
    elif GEMINI_API_KEY:
        return {"configured": True, "activeProvider": "gemini"}
    return {"configured": False, "activeProvider": None}

@router.post("/describe")
async def generate_description(request: Request):
    try:
        body = await request.json()
        title = body.get("title", "")
        date = body.get("date", "")
        location = body.get("location", "")

        prompt = f"""
        You are an expert event planner. Write a compelling, professional, and exciting description for an event.
        
        Event Details:
        Title: {title}
        Date: {date}
        Location: {location}

        Requirements:
        1. Two concise paragraphs engaging the potential attendee.
        2. A suggested simplified agenda (3-4 bullet points) formatted cleanly.
        3. Tone: Professional yet enthusiastic.
        4. Return ONLY the text, no markdown code blocks.
        """

        # 1. Try Groq First (Ultra-fast LPU inference, < 1 second response)
        if GROQ_API_KEY:
            try:
                async with httpx.AsyncClient(timeout=8.0) as client:
                    resp = await client.post(
                        "https://api.groq.com/openai/v1/chat/completions",
                        headers={
                            "Authorization": f"Bearer {GROQ_API_KEY}",
                            "Content-Type": "application/json",
                        },
                        json={
                            "model": GROQ_MODEL_FAST,
                            "messages": [{"role": "user", "content": prompt}],
                            "max_tokens": 400,
                            "temperature": 0.7,
                        },
                    )
                    if resp.status_code == 200:
                        data = resp.json()
                        content = data["choices"][0]["message"]["content"].strip()
                        if content:
                            return {"description": content}
                    else:
                        print(f"Groq description returned status {resp.status_code}: {resp.text}")
            except Exception as e:
                print(f"Groq description generation failed: {e}")

        # 2. Try Gemini Fallback
        if GEMINI_API_KEY:
            try:
                genai.configure(api_key=GEMINI_API_KEY)
                model = genai.GenerativeModel(GEMINI_MODEL_FAST)
                result = await asyncio.wait_for(
                    asyncio.to_thread(
                        model.generate_content,
                        prompt,
                        generation_config={"max_output_tokens": 400, "temperature": 0.7}
                    ),
                    timeout=10.0
                )
                if result and result.text:
                    return {"description": result.text.strip()}
            except Exception as e:
                print(f"Gemini description generation failed: {e}")

        return Response(content=json.dumps({"error": "AI Services unavailable"}), status_code=503)

    except Exception as e:
        print(f"Describe API Error: {e}")
        return Response(content=json.dumps({"error": str(e)}), status_code=500)


@router.post("/chat")
async def chat_stream(request: Request):
    try:
        body = await request.json()
        query = body.get("query", "")
        context = body.get("context", [])

        from datetime import datetime, timedelta
        current_time = datetime.now()
        current_date_time = current_time.strftime("%Y-%m-%d %H:%M:%S")

        def check_is_past(e):
            if e.get("isPast") is not None:
                return bool(e.get("isPast"))
            end_str = e.get("endDate") or e.get("date")
            if not end_str:
                return False
            try:
                clean_str = end_str.replace("Z", "").split("+")[0]
                if "T" in clean_str:
                    dt = datetime.fromisoformat(clean_str)
                elif len(clean_str) == 10:
                    dt = datetime.strptime(clean_str, "%Y-%m-%d")
                else:
                    dt = datetime.fromisoformat(clean_str)
                if not e.get("endDate"):
                    dt = dt + timedelta(hours=1)
                return dt < current_time
            except Exception:
                return False

        all_upcoming = [e for e in context if not check_is_past(e)]
        all_past = [e for e in context if check_is_past(e)]

        query_lower = query.lower()
        is_asking_past = any(w in query_lower for w in [
            "past", "previous", "concluded", "ended", "history", "held", "last year", "last month", "what was", "who won", "prior"
        ])
        has_specific_past_title = any(
            p.get("title") and len(p.get("title", "")) > 3 and p.get("title", "").lower() in query_lower
            for p in all_past
        )
        should_include_past = is_asking_past or has_specific_past_title

        # 1. Vector Similarity Search (RAG)
        from main import get_embedding, cosine_similarity
        query_vector = await get_embedding(query)

        if query_vector:
            async def get_event_score(e):
                text = f"{e.get('title', '')} {e.get('description', '')} {e.get('type', '')}"
                vec = await get_embedding(text)
                if vec:
                    score = cosine_similarity(query_vector, vec)
                    return {"event": e, "score": score}
                return {"event": e, "score": -1}

            if not should_include_past and all_upcoming:
                # Strictly evaluate upcoming events ONLY
                upcoming_tasks = [get_event_score(e) for e in all_upcoming[:15]]
                upcoming_results = await asyncio.gather(*upcoming_tasks)
                upcoming_scored = sorted(upcoming_results, key=lambda x: x["score"], reverse=True)
                top_upcoming = [r["event"] for r in upcoming_scored[:5]]
                top_past = []
            else:
                # User asked about past events
                tasks = [get_event_score(e) for e in context[:20]]
                results = await asyncio.gather(*tasks)
                scored = sorted(results, key=lambda x: x["score"], reverse=True)
                top_upcoming = [r["event"] for r in scored if not check_is_past(r["event"])][:4]
                top_past = [r["event"] for r in scored if check_is_past(r["event"])][:4] if should_include_past else []
        else:
            top_upcoming = all_upcoming[:5]
            top_past = all_past[:2] if should_include_past else []

        upcoming_summary = "\n".join([
            f"- Title: {e.get('title')}\n  Type: {e.get('type')}\n  Date: {e.get('date')} (End: {e.get('endDate', e.get('date'))})\n  Location: {e.get('location')}\n  Price: {('₹' + str(e.get('price'))) if e.get('isPaid') else 'Free'}\n  Capacity: {e.get('capacity')}\n  Details: {e.get('description', '')}"
            for e in top_upcoming
        ]) or "No upcoming events currently scheduled."

        past_summary = "\n".join([
            f"- Title: {e.get('title')} [STATUS: CONCLUDED / EXPIRED]\n  Concluded On: {e.get('endDate', e.get('date'))}\n  Location: {e.get('location')}\n  Details: {e.get('description', '')}"
            for e in top_past
        ]) if top_past else "None"

        prompt = f"""
You are an intelligent virtual assistant for an event management platform called "Eventron".
Your role is to help users discover and learn about events on the platform.

Current Date & Time: {current_date_time}

=== ACTIVE & UPCOMING EVENTS (Available for registration) ===
{upcoming_summary}

=== PAST / CONCLUDED EVENTS (Expired - Registration closed) ===
{past_summary}

User Query: "{query}"

Strict Instructions:
1. When recommending, highlighting, or suggesting events (e.g. for greetings, "what events do you have?", "suggest an event", or general browsing), you MUST ONLY suggest events from the "ACTIVE & UPCOMING EVENTS" section.
2. NEVER suggest or present expired/concluded events as "available" or open for participation.
3. If the user explicitly asks about past events or event history (e.g. "what events were held?", "did event X happen?"), you may refer to the "PAST / CONCLUDED EVENTS" section, but you MUST explicitly clarify that the event has already concluded and is no longer open for registration.
4. If there are no upcoming events matching the user's question, state politely that there are currently no upcoming events matching their inquiry.
5. All prices should be formatted in INR (₹).
6. Be concise, engaging, and professional.
"""

        # We will define a generator for the stream
        async def stream_generator():
            # Try Gemini first
            if GEMINI_API_KEY:
                try:
                    model = genai.GenerativeModel(GEMINI_MODEL_FAST)
                    response = await asyncio.to_thread(
                        model.generate_content,
                        prompt,
                        stream=True,
                        generation_config={"max_output_tokens": 600, "temperature": 0.1}
                    )
                    has_yielded = False
                    for chunk in response:
                        if chunk.text:
                            has_yielded = True
                            # SSE format
                            yield f"data: {json.dumps({'text': chunk.text})}\n\n"
                    if has_yielded:
                        return
                except Exception as e:
                    print(f"Gemini streaming failed: {e}")
            
            # Fallback to Groq
            if GROQ_API_KEY:
                try:
                    async with httpx.AsyncClient(timeout=15.0) as client:
                        async with client.stream(
                            "POST",
                            "https://api.groq.com/openai/v1/chat/completions",
                            headers={
                                "Authorization": f"Bearer {GROQ_API_KEY}",
                                "Content-Type": "application/json",
                            },
                            json={
                                "model": GROQ_MODEL_FAST,
                                "messages": [{"role": "user", "content": prompt}],
                                "max_tokens": 600,
                                "temperature": 0.1,
                                "stream": True,
                            },
                        ) as resp:
                            resp.raise_for_status()
                            async for line in resp.aiter_lines():
                                if line.startswith("data: "):
                                    data_str = line[6:].strip()
                                    if data_str == "[DONE]":
                                        break
                                    try:
                                        data = json.loads(data_str)
                                        delta = data.get("choices", [{}])[0].get("delta", {}).get("content", "")
                                        if delta:
                                            yield f"data: {json.dumps({'text': delta})}\n\n"
                                    except:
                                        pass
                    return
                except Exception as e:
                    print(f"Groq streaming failed: {e}")
            
            yield f"data: {json.dumps({'text': '⚠️ AI Assistant Offline. Both providers failed.'})}\n\n"

        return StreamingResponse(stream_generator(), media_type="text/event-stream")

    except Exception as e:
        print(f"Chat API Error: {e}")
        return Response(content=json.dumps({"error": str(e)}), status_code=500)

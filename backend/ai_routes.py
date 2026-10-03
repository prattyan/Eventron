import os
import json
import asyncio
from fastapi import APIRouter, Request, Response
from fastapi.responses import StreamingResponse
import httpx
import google.generativeai as genai
from config import GEMINI_API_KEY, GROQ_API_KEY

router = APIRouter(prefix="/api/ai", tags=["ai"])

GEMINI_MODEL_FAST = "models/gemini-2.5-flash" 
GROQ_MODEL_FAST = "allam-2-7b"

@router.get("/status")
async def get_ai_status():
    if GEMINI_API_KEY:
        return {"configured": True, "activeProvider": "gemini"}
    elif GROQ_API_KEY:
        return {"configured": True, "activeProvider": "groq"}
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

        # Try Gemini First
        if GEMINI_API_KEY:
            try:
                model = genai.GenerativeModel(GEMINI_MODEL_FAST)
                result = await asyncio.to_thread(
                    model.generate_content,
                    prompt,
                    generation_config={"max_output_tokens": 400, "temperature": 0.7}
                )
                if result and result.text:
                    return {"description": result.text.strip()}
            except Exception as e:
                print(f"Gemini description generation failed: {e}")
        
        # Try Groq Fallback
        if GROQ_API_KEY:
            try:
                async with httpx.AsyncClient(timeout=15.0) as client:
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
                    resp.raise_for_status()
                    data = resp.json()
                    content = data["choices"][0]["message"]["content"].strip()
                    return {"description": content}
            except Exception as e:
                print(f"Groq description generation failed: {e}")

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

        events_summary = "\n".join([
            f"- {e.get('title')} ({e.get('type')}) on {e.get('date')} at {e.get('location')}. "
            f"Price: {('₹' + str(e.get('price'))) if e.get('isPaid') else 'Free'}. "
            f"Capacity: {e.get('capacity')}. "
            f"Details: {e.get('description', '')[:100]}"
            for e in context[:20]
        ])

        from datetime import datetime
        current_date_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

        prompt = f"""
        You are an intelligent virtual assistant for an event management platform called "Eventron".
        Your role is to help users find information about events based on the provided list.

        Current Date: {current_date_time}

        Context - Available Events:
        {events_summary}

        User Query: "{query}"

        Instructions:
        1. Answer the user's question accurately based ONLY on the provided event context.
        2. If the user asks for "upcoming" events, strictly ONLY list events scheduled AFTER the Current Date provided above. Do not list events that have already passed.
        3. If the user asks about something not in the list, politely say you don't have information on that.
        4. Be helpful, concise, and professional.
        5. If recommending an event, mention its title and date.
        6. Do not invent facts.
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
                        generation_config={"max_output_tokens": 600, "temperature": 0.6}
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
                                "temperature": 0.6,
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

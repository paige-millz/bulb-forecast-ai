

# Add Recommendation Explanation + AI Grower Assistant

## Overview

Two features will be added:

1. **Recommendation Explanation Card** -- A plain-English summary below each recommendation explaining *why* the date was chosen, referencing the data points (median DBE, number of records, confidence, weather context).

2. **AI Grower Chat** -- A chat interface where the grower can ask questions about their data and recommendations. It uses Lovable AI (Gemini) with the recommendation results and bulb records as context, so the AI can give personalized answers like "Should I pull earlier this year given the warm temps?" or "What does IQR mean for my tulips?"

## Changes

### 1. New Edge Function: `grower-chat`

Creates a new backend function that:
- Receives the user's message + conversation history + current recommendation data
- Builds a system prompt that includes the recommendation results, weather context, and bulb record summary
- Calls Lovable AI (google/gemini-3-flash-preview) with streaming
- Returns an SSE stream for token-by-token rendering

The system prompt will instruct the AI to act as a knowledgeable agricultural advisor who understands Easter bulb forcing, degree hours, DBE timing, and can explain recommendations in plain language.

### 2. New Component: `RecommendationExplanation.tsx`

A card that auto-generates a plain-English explanation from the recommendation data. For example:

> "Based on 5 years of historical data, your Tulip bulbs are typically removed **22 days before Easter**. With Easter on April 5, 2026, the recommended removal date is **March 14**. The removal window spans March 11-17 (IQR: 3 days), giving you High confidence in this timing. Historical weather shows an average of 48.2 deg F during this window."

This is generated client-side from the existing data -- no AI call needed.

### 3. New Component: `GrowerChat.tsx`

A collapsible chat panel that appears after recommendations are generated:
- Text input for the grower to ask questions
- Streams AI responses token-by-token
- Passes the current recommendation results as context to the AI
- Handles rate limiting (429) and payment (402) errors gracefully
- Shows conversation history within the session

### 4. Update `Index.tsx`

- Add `RecommendationExplanation` below the KPI panel / recommendations table
- Add `GrowerChat` below the results section, only visible when results exist

### 5. Update `supabase/config.toml`

Add the new `grower-chat` function entry with `verify_jwt = false`.

## Technical Details

### Edge Function (`supabase/functions/grower-chat/index.ts`)

```typescript
// System prompt includes:
// - Role: agricultural advisor for Easter bulb forcing
// - Current recommendation data (bulb type, dates, DBE stats, confidence)
// - Weather context if available
// - Instructions to explain in plain, practical grower language

// Calls: https://ai.gateway.lovable.dev/v1/chat/completions
// Model: google/gemini-3-flash-preview
// Streaming: true
// Auth: LOVABLE_API_KEY (already configured)
```

### RecommendationExplanation Component

Generates text from `EdgeFunctionResponse` fields:
- Sentence about data basis (nRecords, bulbType)
- Sentence about median DBE and recommended date
- Sentence about the window (P25-P75) and confidence
- Sentence about weather if `weatherContext` exists

### GrowerChat Component

- Uses SSE streaming pattern from Lovable AI docs
- Sends `results` array as context in each request body
- Renders responses with basic markdown support
- Collapsible so it doesn't dominate the page

### File Summary
- **New**: `supabase/functions/grower-chat/index.ts`
- **New**: `src/components/RecommendationExplanation.tsx`
- **New**: `src/components/GrowerChat.tsx`
- **Modified**: `src/pages/Index.tsx` (add the two new components)
- **Modified**: `supabase/config.toml` (add grower-chat function)


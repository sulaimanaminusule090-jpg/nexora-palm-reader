
module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({
      error: "Method not allowed"
    });
  }

  try {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        error: "Gemini API key is not configured."
      });
    }

    const body =
      typeof req.body === "string"
        ? JSON.parse(req.body)
        : req.body || {};

    let { imageBase64, mimeType, language } = body;

    if (!imageBase64 || typeof imageBase64 !== "string") {
      return res.status(400).json({
        error: "Please provide a palm image."
      });
    }

    mimeType = mimeType || "image/jpeg";

    if (!["image/jpeg", "image/png", "image/webp"].includes(mimeType)) {
      return res.status(400).json({
        error: "Use a JPG, PNG, or WebP image."
      });
    }

    imageBase64 = imageBase64.replace(
      /^data:image\/[a-zA-Z0-9.+-]+;base64,/,
      ""
    );

    if (
      imageBase64.length > 3500000 ||
      !/^[A-Za-z0-9+/]*={0,2}$/.test(imageBase64)
    ) {
      return res.status(400).json({
        error: "Image is too large or invalid."
      });
    }

    const outputLanguage =
      language === "ha" ? "Hausa" : "English";

    
const prompt = `
You are Nexora Palm Reader, an AI palm image analysis assistant.

Analyze the uploaded palm image and write the report in ${outputLanguage}.

Return ONLY valid JSON. Do not use Markdown fences or add text outside the JSON.

IMPORTANT RULES:
- Examine the actual uploaded palm image carefully.
- Identify only lines that are genuinely visible.
- Never invent line positions or features.
- If a line is unclear, mark it as not visible.
- Palmistry interpretations are traditional entertainment, not scientific facts.
- Never predict lifespan, death, health, fertility, or guaranteed wealth.
- Do not guarantee marriage, success, or future events.
- Use clear, friendly language in ${outputLanguage}.

Analyze these four traditional palm lines:
1. Heart Line: the upper major crease below the fingers.
2. Head Line: the major crease crossing the middle of the palm.
3. Life Line: the curved crease around the base of the thumb.
4. Fate Line: a vertical crease toward the middle of the palm, if visible.

Return JSON in exactly this structure:
{
  "report": "Write the complete report in ${outputLanguage}. Include sections called LOVE AND RELATIONSHIPS, CAREER AND MONEY, PERSONALITY AND INNER STRENGTH, MAIN PALM LINES, and IMPORTANT NOTE. Describe visible features first. Explain traditional interpretations as entertainment, not facts. State clearly when a line cannot be identified.",
  "lines": [
    {
      "id": "heart",
      "label": "Heart Line",
      "visible": false,
      "confidence": 0,
      "points": []
    },
    {
      "id": "head",
      "label": "Head Line",
      "visible": false,
      "confidence": 0,
      "points": []
    },
    {
      "id": "life",
      "label": "Life Line",
      "visible": false,
      "confidence": 0,
      "points": []
    },
    {
      "id": "fate",
      "label": "Fate Line",
      "visible": false,
      "confidence": 0,
      "points": []
    }
  ]
}

COORDINATE RULES:
- Image coordinates range from 0 to 1.
- x = 0 is the left edge; x = 1 is the right edge.
- y = 0 is the top edge; y = 1 is the bottom edge.
- For each clearly visible line, provide 5 to 12 ordered points following its actual path.
- Each point must have numeric x and y values.
- Points must follow the actual crease in this photo, not a generic palm diagram.
- If you cannot confidently trace a line, keep visible false and points empty.
- Set confidence to a number between 0 and 1.
- Only use the ids heart, head, life, and fate.
- Return all four line objects, even when some lines are not visible.

IMPORTANT NOTE:
Palmistry cannot scientifically prove personality or predict the future.
`;
    

    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey
        },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: prompt },
              {
                inline_data: {
                  mime_type: mimeType,
                  data: imageBase64
                }
              }
            ]
          }]
        })
      }
    );

    const data = await response.json();

    
if (!response.ok) {
  console.error("Gemini API error:", data);

  const geminiMessage =
    data?.error?.message || "Unknown Gemini API error.";

  return res.status(502).json({
    error: `Gemini API request failed (HTTP ${response.status}): ${geminiMessage}`
  });
}
    

    const result = data.candidates?.[0]?.content?.parts
      ?.map(part => part.text || "")
      .join("\n")
      .trim();

    if (!result) {
      return res.status(502).json({
        error: "Gemini returned no analysis."
      });
    }

    return res.status(200).json({ result });

  } catch (error) {
    console.error("Palm analysis error:", error);
    return res.status(500).json({
      error: "An unexpected error occurred."
    });
  }
};

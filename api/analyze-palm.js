
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
    

   
    const requestUrl =
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent";

    const requestOptions = {
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
        }],
        generationConfig: {
          responseMimeType: "application/json"
        }
      })
    };

    let response;
    let data;

    for (let attempt = 0; attempt < 3; attempt++) {
      response = await fetch(requestUrl, requestOptions);

      if (response.ok) {
        data = await response.json();
        break;
      }

      const errorText = await response.text();
      let errorData = {};

      try {
        errorData = JSON.parse(errorText);
      } catch (error) {
        errorData = { error: { message: errorText } };
      }

      
      console.error("Gemini API error:", errorData);

      if (response.status === 429) {
        return res.status(429).json({
          error: "Palm Reader has reached its Gemini API quota. Please try again later or check your Gemini API quota and billing settings."
        });
      }

      const retryableStatuses = [500, 502, 503, 504];

      if (
        !retryableStatuses.includes(response.status) ||
        attempt === 2
      ) {
        const geminiMessage =
          errorData?.error?.message ||
          "Unknown Gemini API error.";

        return res.status(502).json({
          error: `Gemini API request failed (HTTP ${response.status}): ${geminiMessage}`
        });
      }

      const waitMs = 1000 * (2 ** attempt);
      await new Promise(resolve => setTimeout(resolve, waitMs));
    }  
    
    

        const rawResult = data.candidates?.[0]?.content?.parts
      ?.map(part => part.text || "")
      .join("\n")
      .trim();

    if (!rawResult) {
      return res.status(502).json({
        error: "Gemini returned no analysis."
      });
    }

    let analysis;

    try {
      analysis = JSON.parse(rawResult);
    } catch (error) {
      console.error("Invalid Gemini JSON:", rawResult);
      return res.status(502).json({
        error: "Gemini returned invalid JSON. Please try again."
      });
    }

    if (
      typeof analysis.report !== "string" ||
      !Array.isArray(analysis.lines)
    ) {
      return res.status(502).json({
        error: "Gemini returned incomplete palm analysis."
      });
    }

    const allowedIds = ["heart", "head", "life", "fate"];

    const lines = analysis.lines
      .filter(line => line && allowedIds.includes(line.id))
      .map(line => {
        const points = Array.isArray(line.points)
          ? line.points.filter(point =>
              point &&
              Number.isFinite(point.x) &&
              Number.isFinite(point.y) &&
              point.x >= 0 &&
              point.x <= 1 &&
              point.y >= 0 &&
              point.y <= 1
            )
          : [];

        const visible =
          line.visible === true && points.length >= 2;

        return {
          id: line.id,
          label: String(line.label || line.id),
          visible,
          confidence: Number.isFinite(line.confidence)
            ? Math.max(0, Math.min(1, line.confidence))
            : 0,
          points: visible ? points.slice(0, 20) : []
        };
      });

    return res.status(200).json({
      result: analysis.report,
      lines
    });

  } catch (error) {
    console.error("Palm analysis error:", error);
    return res.status(500).json({
      error: "An unexpected error occurred."
    });
  }
};

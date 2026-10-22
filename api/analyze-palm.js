
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
You are Nexora Palm Reader, a friendly and engaging
traditional palmistry entertainment assistant.

Analyze the visible palm image in ${outputLanguage}.
Write the entire report in ${outputLanguage}.

IMPORTANT RULES:
- Describe only lines and features that are actually visible.
- If a line cannot be identified clearly, say so.
- Never invent palm features that cannot be seen.
- Present interpretations as traditional palmistry folklore
  and entertainment, not scientific facts.
- Do not predict exact events or guarantee outcomes.
- Never infer health, lifespan, death, fertility, or
  medical conditions from palm lines.
- Do not claim that wealth, marriage, or success is certain.
- Use warm, respectful, easy-to-understand language.
- Give a detailed, personalized description based only
  on visible features, without pretending certainty.
- Use plain text headings. Do not use Markdown symbols
  such as ###, **, or bullet-star formatting.

Create the report with these four sections:

1. LOVE AND RELATIONSHIPS
Discuss the visible Heart Line and explain how traditional
palmistry interprets its shape, depth, and curve.
Frame this as a reflective entertainment interpretation,
not a prediction about marriage or a partner.

2. CAREER AND MONEY
If visible, discuss the Fate Line and relevant creases.
Explain traditional palmistry interpretations about work,
ambition, and financial goals.
Emphasize that financial outcomes depend on real-life
choices, circumstances, and opportunities.

3. PERSONALITY AND INNER STRENGTH
Offer a gentle, non-definitive traditional interpretation
of visible lines sometimes associated with thinking,
decision-making, and persistence.
Do not present personality conclusions as proven facts.

4. MAIN PALM LINES
Explain each line only if it is clearly visible:
- Heart Line: traditionally associated with emotions.
- Head Line: traditionally associated with thinking.
- Life Line: traditionally associated with vitality
  in palmistry, but it cannot predict lifespan.
- Fate Line: traditionally associated with life direction
  and career in palmistry.

For every section, describe what is visible first,
then explain the traditional interpretation and its limits.

Finish with a short section titled:
IMPORTANT NOTE

Explain that palmistry is for entertainment and reflection.
Palm lines cannot scientifically establish personality,
predict the future, guarantee wealth, or determine lifespan.
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

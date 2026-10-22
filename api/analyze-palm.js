
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
Analyze this palm photograph in ${outputLanguage}.

Describe only visible creases and image quality.
Do not claim that palm lines can reliably reveal a
person's personality, health, lifespan, or future.
Do not make medical diagnoses or certain predictions.
If the image is unclear, explain that.
Present the result with these sections:
1. Image quality
2. Visible creases
3. Limitations

Respond in ${outputLanguage}.
Clearly explain that this is an informational demo,
not a scientifically validated palm-reading method.
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

const OpenAI = require("openai");

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  try {
    const { image, mimeType } = req.body;
    if (!image || !mimeType) {
      return res.status(400).json({ error: "Image data and mimeType are required." });
    }

    const timetablePrompt = `
      You are an AI expert at parsing weekly class schedule images and converting them to a structured JSON format.
      Your task is to create a JSON object representing the timetable.
      The keys of the object must be the days of the week in English (e.g., 'Monday', 'Tuesday').
      The value for each key must be an array of strings, where each string is a subject name.
      IMPORTANT RULES:
      1. Extract only the subject name and ignore any subject codes below it (e.g., from 'ADVANCED PYTHON\\nBCA303-5', extract only 'ADVANCED PYTHON').
      2. List a subject for every period it appears. If 'CLOUD COMPUTING' appears twice on Wednesday, add 'CLOUD COMPUTING' to the Wednesday array twice.
      3. Ensure all subject names are returned in ALL CAPS to maintain consistency.
      4. Ignore any columns or cells that are empty or designated as 'LUNCH'.
      5. The final output must be only the raw JSON object, with no other text, explanations, or markdown formatting like \`\`\`json.
    `;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: timetablePrompt },
            {
              type: "image_url",
              image_url: {
                "url": `data:${mimeType};base64,${image}`
              },
            },
          ],
        },
      ],
      max_tokens: 2048,
    });

    const jsonResponse = response.choices[0].message.content;
    const cleanedText = jsonResponse.replace(/```json/g, '').replace(/```/g, '').trim();
    const jsonData = JSON.parse(cleanedText);
    
    res.status(200).json(jsonData);

  } catch (error) {
    console.error("Error processing timetable with OpenAI:", error);
    res.status(500).json({ error: "Failed to analyze timetable.", details: error.message });
  }
};

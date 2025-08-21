const OpenAI = require("openai");

// Initialize the OpenAI client with the key from Vercel's environment variables
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

    const attendancePrompt = `
      You are an expert at analyzing and consolidating data from a student's attendance portal screenshot.
      For each distinct "Subject Name", you must combine its "Theory" and "Practical" rows into a single entry.
      Your task is to:
      1. Identify each unique subject.
      2. For each subject, find its "Theory" and "Practical" rows.
      3. Sum the values from the "Conducted" column for both rows to get the total classes held.
      4. Sum the values from the "Present" column for both rows to get the total classes attended.
      5. Create a single JSON object for that subject with the combined totals.
      The final output must be a clean JSON array. Each object must have three keys: "name", "attended", and "total".
      For example, for 'ADVANCED PYTHON', sum Conducted (28.0 + 17.0 = 45) and Present (23.0 + 13.0 = 36). The result is {"name": "ADVANCED PYTHON", "attended": 36, "total": 45}.
      Process all subjects. Do not output any text, explanations, or markdown formatting. Only output the final JSON array.
    `;

    // Make the API call to OpenAI
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: attendancePrompt },
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
    console.error("Error processing request with OpenAI:", error);
    res.status(500).json({ error: "Failed to analyze attendance image.", details: error.message });
  }
};

const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

function fileToGenerativePart(buffer, mimeType) {
  return {
    inlineData: {
      data: buffer.toString("base64"),
      mimeType,
    },
  };
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  try {
    const { image, mimeType } = req.body;
    if (!image || !mimeType) {
      return res.status(400).json({ error: "Image data and mimeType are required." });
    }

    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const prompt = `
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
    
    const imageBuffer = Buffer.from(image, 'base64');
    const imagePart = fileToGenerativePart(imageBuffer, mimeType);

    const result = await model.generateContent([prompt, imagePart]);
    const response = await result.response;
    const text = response.text();

    const cleanedText = text.replace(/```json/g, '').replace(/```/g, '').trim();
    const jsonData = JSON.parse(cleanedText);
    
    res.status(200).json(jsonData);

  } catch (error) {
    console.error("Error processing timetable:", error);
    res.status(500).json({ error: "Failed to analyze timetable.", details: error.message });
  }
};

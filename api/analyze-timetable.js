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
      You are an AI expert at parsing weekly class schedule images.
      Your task is to create a JSON object representing the timetable.
      The keys must be the days of the week ('Monday', 'Tuesday', etc.).
      The value for each key must be an array of strings, where each string is a subject name.
      RULES:
      1. Extract only the subject name and ignore subject codes (e.g., from 'ADVANCED PYTHON\\nBCA303-5', extract 'ADVANCED PYTHON').
      2. List a subject for every period it appears. If 'CLOUD COMPUTING' appears twice, add it to the array twice.
      3. Return all subject names in ALL CAPS.
      4. Ignore empty slots or 'LUNCH'.
      5. Output only the raw JSON object, with no other text or markdown.
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

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
      You are an expert at analyzing a student's attendance summary screenshot.
      For each "Subject Name", combine its "Theory" and "Practical" rows.
      Your task is to:
      1. Identify each unique subject.
      2. For each subject, sum the "Conducted" values for its Theory and Practical rows.
      3. For each subject, sum the "Present" values for its Theory and Practical rows.
      4. Create a single JSON object for that subject.
      The final output must be a clean JSON array. Each object must have three keys: "name" (in ALL CAPS), "attended" (integer), and "total" (integer).
      Do not output any text, explanations, or markdown. Only output the final JSON array.
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
    console.error("Error processing attendance summary:", error);
    res.status(500).json({ error: "Failed to analyze attendance image.", details: error.message });
  }
};

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
      You are an expert at analyzing and consolidating data from a student's attendance portal screenshot.
      For each distinct "Subject Name", you must combine its "Theory" and "Practical" rows into a single entry.
      Your task is to:
      1. Identify each unique subject.
      2. For each subject, find its "Theory" and "Practical" rows.
      3. Sum the values from the "Conducted" column for both rows to get the total classes held.
      4. Sum the values from the "Present" column for both rows to get the total classes attended.
      5. Create a single JSON object for that subject with the combined totals.
      The final output must be a clean JSON array. Each object must have three keys: "name", "attended", and "total".
      Process all subjects. Do not output any text, explanations, or markdown formatting. Only output the final JSON array.
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
    console.error("Error processing request:", error);
    res.status(500).json({ error: "Failed to analyze attendance image.", details: error.message });
  }
};

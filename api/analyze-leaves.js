const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

function fileToGenerativePart(buffer, mimeType) {
  return {
    inlineData: { data: buffer.toString("base64"), mimeType },
  };
}

async function processImage(imagePart) {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const prompt = `
      You are an AI assistant that extracts leave data from a student's "Absence Details" screenshot.
      Your task is to identify subjects by their subject code (e.g., BCA301-5) and count the number of leave hours associated with them based on color coding. The legend indicates "Co-curricular Leave" is green and "Medical Leave" is orange.

      RULES:
      1. Scan the image for subject codes that are colored green or orange.
      2. For each colored subject code, find its corresponding row and extract the number from the "Total" column on the far right.
      3. Return a JSON object where keys are the subject codes. Each value should be an object containing 'cc_leaves' (for green) and 'medical_leaves' (for orange) hours.
      4. If a subject has no leaves of a certain type, set its value to 0. Example: {"BCA301-5": {"cc_leaves": 4, "medical_leaves": 0}, "BCA304C-5": {"cc_leaves": 0, "medical_leaves": 2}}.
      5. Only output the raw JSON object. Do not include any other text or markdown formatting.
    `;

    const result = await model.generateContent([prompt, imagePart]);
    const response = await result.response;
    const text = response.text();
    const cleanedText = text.replace(/```json/g, "").replace(/```/g, "").trim();
    return JSON.parse(cleanedText);
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  try {
    const { images } = req.body;
    if (!images || !Array.isArray(images) || images.length === 0) {
      return res.status(400).json({ error: "Image data array is required." });
    }

    let aggregatedLeaves = {};

    for (const imageData of images) {
        const imageBuffer = Buffer.from(imageData.image, 'base64');
        const imagePart = fileToGenerativePart(imageBuffer, imageData.mimeType);
        const leavesData = await processImage(imagePart);

        for (const subjectCode in leavesData) {
            if (!aggregatedLeaves[subjectCode]) {
                aggregatedLeaves[subjectCode] = { cc_leaves: 0, medical_leaves: 0 };
            }
            aggregatedLeaves[subjectCode].cc_leaves += leavesData[subjectCode].cc_leaves || 0;
            aggregatedLeaves[subjectCode].medical_leaves += leavesData[subjectCode].medical_leaves || 0;
        }
    }
    
    res.status(200).json(aggregatedLeaves);

  } catch (error) {
    console.error("Error processing leave images:", error);
    res.status(500).json({ error: "Failed to analyze leave images.", details: error.message });
  }
};

// Import the Google Generative AI SDK
const { GoogleGenerativeAI } = require("@google/generative-ai");

// Access your API key as an environment variable
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Function to convert a file buffer to a Gemini-compatible part
function fileToGenerativePart(buffer, mimeType) {
  return {
    inlineData: {
      data: buffer.toString("base64"),
      mimeType,
    },
  };
}

// This is the main serverless function handler
module.exports = async (req, res) => {
  // Ensure the request is a POST request
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  try {
    const { image, mimeType } = req.body;

    // Check if image data is present
    if (!image || !mimeType) {
      return res.status(400).json({ error: "Image data and mimeType are required." });
    }

    // Get the Gemini Pro Vision model
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    // THIS IS THE NEW, IMPROVED CODE
const prompt = `
  You are an expert at analyzing and consolidating data from a student's attendance portal screenshot.
  For each distinct "Subject Name", you must combine its "Theory" and "Practical" rows into a single entry.

  Your task is to:
  1.  Identify each unique subject (e.g., "MINI PROJECT", "ARTIFICIAL INTELLIGENCE & MACHINE LEARNING", etc.).
  2.  For each subject, find its "Theory" and "Practical" rows.
  3.  Sum the values from the "Conducted" column for both rows to get the total classes held.
  4.  Sum the values from the "Present" column for both rows to get the total classes attended.
  5.  Create a single JSON object for that subject with the combined totals.

  The final output must be a clean JSON array. Each object in the array must have exactly three keys:
  - "name" (string): The subject's full name.
  - "attended" (integer): The SUM of "Present" for Theory and Practical.
  - "total" (integer): The SUM of "Conducted" for Theory and Practical.

  For example, for the subject 'ADVANCED PYTHON', you should sum the 'Conducted' values (28.0 + 17.0 = 45) and the 'Present' values (23.0 + 13.0 = 36). The resulting JSON object would be {"name": "ADVANCED PYTHON", "attended": 36, "total": 45}.

  Process all subjects in the image this way. Do not output any text, explanations, or markdown formatting like \`\`\`json. Only output the final JSON array.
`;
    
    const imageBuffer = Buffer.from(image, 'base64');
    const imagePart = fileToGenerativePart(imageBuffer, mimeType);

    // Send the prompt and image to the model
    const result = await model.generateContent([prompt, imagePart]);
    const response = await result.response;
    const text = response.text();

    // Clean up the response to ensure it's valid JSON
    const cleanedText = text.replace(/```json/g, '').replace(/```/g, '').trim();
    
    // Parse the JSON and send it back to the frontend
    const jsonData = JSON.parse(cleanedText);
    res.status(200).json(jsonData);

  } catch (error) {
    console.error("Error processing request:", error);
    res.status(500).json({ error: "Failed to analyze image.", details: error.message });
  }
};


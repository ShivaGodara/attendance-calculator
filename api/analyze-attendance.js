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

    const prompt = `
      You are an expert at extracting structured data from images of a student's attendance portal.
      Analyze this screenshot. Extract the data into a JSON array.
      Each object in the array should represent one subject and have three keys:
      1. "name" (string): The subject's name, which might include a code.
      2. "attended" (integer): The number of classes attended. This is the first number in the "Attended/Total" column.
      3. "total" (integer): The total number of classes held. This is the second number in the "Attended/Total" column.
      Ignore any summary rows or rows that are not subjects. The final output must only be the JSON array, with no other text or markdown formatting.
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
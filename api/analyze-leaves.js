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

// Function to merge results from multiple AI analyses
function mergeLeaveCounts(results) {
  const finalCounts = {
    "co-curricular": {},
    "medical": {}
  };

  results.forEach(result => {
    for (const subjectCode in result['co-curricular']) {
      finalCounts['co-curricular'][subjectCode] = (finalCounts['co-curricular'][subjectCode] || 0) + result['co-curricular'][subjectCode];
    }
    for (const subjectCode in result.medical) {
      finalCounts.medical[subjectCode] = (finalCounts.medical[subjectCode] || 0) + result.medical[subjectCode];
    }
  });

  return finalCounts;
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  try {
    const { images } = req.body; // Expect an array of { image, mimeType }
    if (!images || !Array.isArray(images) || images.length === 0) {
      return res.status(400).json({ error: "An array of images is required." });
    }

    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const prompt = `
      You are an expert at analyzing student attendance reports from screenshots.
      Your task is to identify and count subject codes based on specific visual cues in the provided image.

      1.  Find every subject code located inside a cell with a GREEN BACKGROUND. Count each occurrence. These are 'co-curricular' leaves.
      2.  Find every subject code written in RED or ORANGE TEXT. Count each occurrence. These are 'medical' leaves.

      The final output must be a single, clean JSON object with two keys: "co-curricular" and "medical".
      The value for each key must be another object, where the keys are the unique subject codes (e.g., "BCA301-5") and the values are the number of times they were found with that specific visual cue in this image.

      Example Output:
      {
        "co-curricular": {
          "BCA481-5": 2,
          "BCA305-5": 1
        },
        "medical": {
          "BCA302-5": 1
        }
      }

      If no leaves of a certain type are found, return an empty object for that key. Do not output any text, explanations, or markdown formatting.
    `;

    const analysisPromises = images.map(imgData => {
      const imageBuffer = Buffer.from(imgData.image, 'base64');
      const imagePart = fileToGenerativePart(imageBuffer, imgData.mimeType);
      return model.generateContent([prompt, imagePart]);
    });

    const responses = await Promise.all(analysisPromises);
    
    const allJsonResults = responses.map(result => {
        const text = result.response.text();
        const cleanedText = text.replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(cleanedText);
    });

    const finalResult = mergeLeaveCounts(allJsonResults);
    
    res.status(200).json(finalResult);

  } catch (error) {
    console.error("Error processing leave images:", error);
    res.status(500).json({ error: "Failed to analyze leave images.", details: error.message });
  }
};

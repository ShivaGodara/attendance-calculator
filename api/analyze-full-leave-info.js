const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

function fileToGenerativePart(buffer, mimeType) {
  return {
    inlineData: { data: buffer.toString("base64"), mimeType },
  };
}

// Analyzes the subject list image to map codes to names
async function analyzeSubjectInfo(image, model) {
  const prompt = `
    You are an expert at parsing student information screenshots.
    From the provided image, extract every subject name and its corresponding subject code.
    The final output must be a single, clean JSON object where the keys are the subject codes (e.g., "BCA303-5") and the values are the full subject names (e.g., "ADVANCED PYTHON").
    Ensure subject names are in ALL CAPS. Do not output any other text or markdown.
  `;
  const imagePart = fileToGenerativePart(Buffer.from(image.image, 'base64'), image.mimeType);
  const result = await model.generateContent([prompt, imagePart]);
  const text = result.response.text();
  const cleanedText = text.replace(/```json/g, '').replace(/```/g, '').trim();
  return JSON.parse(cleanedText);
}

// Analyzes a single absence detail image for leaves
async function analyzeAbsenceImage(image, model) {
  const prompt = `
    From the provided image of an absence report, identify and count subject codes based on visual cues.
    1.  Find every subject code inside a cell with a GREEN BACKGROUND. These are 'co-curricular' leaves.
    2.  Find every subject code written in RED or ORANGE TEXT. These are 'medical' leaves.
    The final output must be a single JSON object with two keys: "co-curricular" and "medical".
    The value for each key must be an object where keys are subject codes and values are their counts in this image.
    Example: {"co-curricular": {"BCA481-5": 2}, "medical": {"BCA301-5": 1}}
    If no leaves are found, return empty objects for the keys. Do not output any other text or markdown.
  `;
  const imagePart = fileToGenerativePart(Buffer.from(image.image, 'base64'), image.mimeType);
  const result = await model.generateContent([prompt, imagePart]);
  const text = result.response.text();
  const cleanedText = text.replace(/```json/g, '').replace(/```/g, '').trim();
  return JSON.parse(cleanedText);
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).end('Method Not Allowed');
  }

  try {
    const { absenceImages, subjectInfoImage } = req.body;
    if (!absenceImages || !subjectInfoImage) {
      return res.status(400).json({ error: "Required image data is missing." });
    }

    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    // Concurrently analyze subject info and all absence images
    const subjectMapPromise = analyzeSubjectInfo(subjectInfoImage, model);
    const absencePromises = absenceImages.map(img => analyzeAbsenceImage(img, model));

    const [subjectMap, absenceResults] = await Promise.all([subjectMapPromise, Promise.all(absencePromises)]);

    // Merge leave counts from all absence images
    const totalLeaveCounts = { "co-curricular": {}, "medical": {} };
    absenceResults.forEach(result => {
      for (const code in result["co-curricular"]) {
        totalLeaveCounts["co-curricular"][code] = (totalLeaveCounts["co-curricular"][code] || 0) + result["co-curricular"][code];
      }
      for (const code in result.medical) {
        totalLeaveCounts.medical[code] = (totalLeaveCounts.medical[code] || 0) + result.medical[code];
      }
    });
    
    // Combine map and counts into a final structure
    const finalResult = { subjects: [], totals: { co_curricular: 0, medical: 0 } };
    const processedCodes = new Set();

    Object.entries(subjectMap).forEach(([code, name]) => {
        const coCurricularLeaves = totalLeaveCounts["co-curricular"][code] || 0;
        const medicalLeaves = totalLeaveCounts.medical[code] || 0;
        if(coCurricularLeaves > 0 || medicalLeaves > 0) {
             finalResult.subjects.push({ name, code, co_curricular_leaves: coCurricularLeaves, medical_leaves: medicalLeaves });
             finalResult.totals.co_curricular += coCurricularLeaves;
             finalResult.totals.medical += medicalLeaves;
             processedCodes.add(code);
        }
    });

    res.status(200).json(finalResult);

  } catch (error) {
    console.error("Error in full leave analysis:", error);
    res.status(500).json({ error: "Failed to analyze leave information.", details: error.message });
  }
};

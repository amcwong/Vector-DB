const fs = require("fs");
const path = require("path");
const pdfParse = require("pdf-parse");
const { get: levenshtein } = require("fast-levenshtein"); //Metrics: text comparison

// Function to read a PDF and extract text
async function extractTextFromPDF(pdfPath) {
  const pdfBuffer = fs.readFileSync(pdfPath);
  const pdfData = await pdfParse(pdfBuffer);
  return pdfData.text;
}

// Function to calculate Levenshtein distance-based accuracy
function calculateAccuracy(extractedText, targetText) {
  const distance = levenshtein(extractedText, targetText);
  const maxLength = Math.max(extractedText.length, targetText.length);
  const accuracy = (1 - distance / maxLength) * 100;
  return accuracy;
}

// Main evaluation function
async function evaluatePDFReaders() {
  const pdfDir = path.join(__dirname, "pdf-dataset");
  const transcriptionDir = path.join(__dirname, "transcription");
  const pdfFiles = fs.readdirSync(pdfDir).filter((file) => file.endsWith(".pdf"));
  let totalAccuracy = 0;
  let fileCount = 0;

  for (const pdfFile of pdfFiles) {
    const pdfPath = path.join(pdfDir, pdfFile);
    const transcriptionFileName = `${path.basename(pdfFile, ".pdf")} TARGET.txt`;
    const transcriptionPath = path.join(transcriptionDir, transcriptionFileName);

    if (!fs.existsSync(transcriptionPath)) {
      console.warn(`Transcription file not found for ${pdfFile}`);
      continue;
    }

    try {
      const extractedText = await extractTextFromPDF(pdfPath);
      const targetText = fs.readFileSync(transcriptionPath, "utf8");
      const accuracy = calculateAccuracy(extractedText, targetText);
      totalAccuracy += accuracy;
      fileCount++;
      console.log(`Accuracy for ${pdfFile}: ${accuracy.toFixed(2)}%`);
    } catch (error) {
      console.error(`Error processing ${pdfFile}:`, error);
    }
  }

  const averageAccuracy = totalAccuracy / fileCount;
  console.log(`\nAverage Accuracy: ${averageAccuracy.toFixed(2)}%`);
}

evaluatePDFReaders();
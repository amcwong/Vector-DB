const fs = require("fs");
const path = require("path");
const pdfjsLib = require("pdfjs-dist/legacy/build/pdf.js");
const { get: levenshtein } = require("fast-levenshtein");

// Function to read a PDF and extract text using pdf.js
async function extractTextFromPDFJs(pdfPath) {
  const pdfBuffer = fs.readFileSync(pdfPath);
  const pdfData = new Uint8Array(pdfBuffer);
  const pdf = await pdfjsLib.getDocument({ data: pdfData }).promise;
  const maxPages = pdf.numPages;
  const pageTextPromises = [];

  for (let pageNo = 1; pageNo <= maxPages; pageNo++) {
    pageTextPromises.push(
      pdf.getPage(pageNo).then(async (page) => {
        const textContent = await page.getTextContent();
        return textContent.items.map((token) => token.str).join(" ");
      })
    );
  }

  const pageTexts = await Promise.all(pageTextPromises);
  return pageTexts.join(" ");
}

// Function to calculate Levenshtein distance-based accuracy
function calculateAccuracy(extractedText, targetText) {
  const distance = levenshtein(extractedText, targetText);
  const maxLength = Math.max(extractedText.length, targetText.length);
  const accuracy = (1 - distance / maxLength) * 100;
  return accuracy;
}

// Function to calculate Precision
function calculatePrecision(extractedText, targetText) {
  const truePositives = extractedText.split(' ').filter(word => targetText.includes(word)).length;
  const predictedPositives = extractedText.split(' ').length;
  return (truePositives / predictedPositives) * 100;
}

// Function to calculate Recall
function calculateRecall(extractedText, targetText) {
  const truePositives = extractedText.split(' ').filter(word => targetText.includes(word)).length;
  const actualPositives = targetText.split(' ').length;
  return (truePositives / actualPositives) * 100;
}

// Function to calculate F1 Score
function calculateF1Score(precision, recall) {
  if (precision + recall === 0) {
    return 0;
  }
  return (2 * precision * recall) / (precision + recall);
}

// Function to calculate Word Error Rate
function calculateWER(extractedText, targetText) {
  const distance = levenshtein(extractedText, targetText);
  const numWords = targetText.split(' ').length;
  return (distance / numWords) * 100;
}

// Function to recursively read PDF and transcription directories
function getPdfAndTranscriptionFiles(pdfDir, transcriptionDir) {
  let files = [];
  const pdfSubDirs = fs.readdirSync(pdfDir).filter((file) => fs.lstatSync(path.join(pdfDir, file)).isDirectory());

  for (const subDir of pdfSubDirs) {
    const pdfSubDirPath = path.join(pdfDir, subDir);
    const transcriptionSubDirPath = path.join(transcriptionDir, `${subDir} Target`);

    if (fs.existsSync(transcriptionSubDirPath)) {
      const pdfFiles = fs.readdirSync(pdfSubDirPath).filter((file) => file.endsWith(".pdf"));

      for (const pdfFile of pdfFiles) {
        const pdfFilePath = path.join(pdfSubDirPath, pdfFile);
        const transcriptionFileName = `${path.basename(pdfFile, ".pdf")} TARGET.txt`;
        const transcriptionFilePath = path.join(transcriptionSubDirPath, transcriptionFileName);

        files.push({
          pdfFilePath,
          transcriptionFilePath,
          pdfFileName: pdfFile,
          transcriptionFileName
        });
      }
    } else {
      console.warn(`Transcription directory not found for ${subDir}`);
    }
  }
  return files;
}

// Main evaluation function
async function evaluatePDFReaders() {
  const pdfDir = path.join(__dirname, "pdf-dataset");
  const transcriptionDir = path.join(__dirname, "transcription");
  const files = getPdfAndTranscriptionFiles(pdfDir, transcriptionDir);
  let totalMetrics = {
    accuracy: 0,
    precision: 0,
    recall: 0,
    f1Score: 0,
    wer: 0
  };
  let fileCount = 0;

  for (const file of files) {
    const { pdfFilePath, transcriptionFilePath, pdfFileName } = file;

    if (!fs.existsSync(transcriptionFilePath)) {
      console.warn(`Transcription file not found for ${pdfFileName}`);
      continue;
    }

    try {
      const extractedText = await extractTextFromPDFJs(pdfFilePath);
      const targetText = fs.readFileSync(transcriptionFilePath, "utf8");

      const accuracy = calculateAccuracy(extractedText, targetText);
      const precision = calculatePrecision(extractedText, targetText);
      const recall = calculateRecall(extractedText, targetText);
      const f1Score = calculateF1Score(precision, recall);
      const wer = calculateWER(extractedText, targetText);

      totalMetrics.accuracy += accuracy;
      totalMetrics.precision += precision;
      totalMetrics.recall += recall;
      totalMetrics.f1Score += f1Score;
      totalMetrics.wer += wer;
      fileCount++;
      
      console.log(`Metrics for ${pdfFileName}:`);
      console.log(`Accuracy: ${accuracy.toFixed(2)}%`);
      console.log(`Precision: ${precision.toFixed(2)}%`);
      console.log(`Recall: ${recall.toFixed(2)}%`);
      console.log(`F1 Score: ${f1Score.toFixed(2)}%`);
      console.log(`Word Error Rate: ${wer.toFixed(2)}%\n`);
    } catch (error) {
      console.error(`Error processing ${pdfFileName}:`, error);
    }
  }

  if (fileCount === 0) {
    console.log("No PDF files were processed. Please check if the transcription files exist and are correctly named.");
  } else {
    const averageMetrics = {
      accuracy: totalMetrics.accuracy / fileCount,
      precision: totalMetrics.precision / fileCount,
      recall: totalMetrics.recall / fileCount,
      f1Score: totalMetrics.f1Score / fileCount,
      wer: totalMetrics.wer / fileCount
    };
    console.log("Conclusion\nAverage Metrics:");
    console.log(`Accuracy: ${averageMetrics.accuracy.toFixed(2)}%`);
    console.log(`Precision: ${averageMetrics.precision.toFixed(2)}%`);
    console.log(`Recall: ${averageMetrics.recall.toFixed(2)}%`);
    console.log(`F1 Score: ${averageMetrics.f1Score.toFixed(2)}%`);
    console.log(`Word Error Rate: ${averageMetrics.wer.toFixed(2)}%`);
  }
}

evaluatePDFReaders();

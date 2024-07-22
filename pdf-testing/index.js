/**
 * @file index.js is the main file for evaluating PDF readers using a dataset of PDF files and their transcriptions.
 * @example
 * // Example description of how to use this file in terminal
 * node index.js
 */

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
  let totalAccuracy = 0;
  let fileCount = 0;

  for (const file of files) {
    const { pdfFilePath, transcriptionFilePath, pdfFileName } = file;

    if (!fs.existsSync(transcriptionFilePath)) {
      console.warn(`Transcription file not found for ${pdfFileName}`);
      continue;
    }

    try {
      const extractedText = await extractTextFromPDF(pdfFilePath);
      const targetText = fs.readFileSync(transcriptionFilePath, "utf8");
      const accuracy = calculateAccuracy(extractedText, targetText);
      totalAccuracy += accuracy;
      fileCount++;
      console.log(`Accuracy for ${pdfFileName}: ${accuracy.toFixed(2)}%`);
    } catch (error) {
      console.error(`Error processing ${pdfFileName}:`, error);
    }
  }

  if (fileCount === 0) {
    console.log("No PDF files were processed. Please check if the transcription files exist and are correctly named.");
  } else {
    const averageAccuracy = totalAccuracy / fileCount;
    console.log(`\nAverage Accuracy: ${averageAccuracy.toFixed(2)}%`);
  }
}

evaluatePDFReaders();

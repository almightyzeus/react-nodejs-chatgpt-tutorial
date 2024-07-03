import OpenAI from "openai";
import express from "express";
import bodyParser from "body-parser";
import cors from "cors";
import multer from "multer";
const pdfreader = await import('pdfreader');
import ExcelJS from 'exceljs';
import path from 'path';
import fs from 'fs'; // Import the fs module for file system operations
import { COMPLETIONS_MODEL, EMBEDDING_MODEL, API_KEY, ORG_ID } from './Constants.js';

const app = express();
const port = 8000;
app.use(bodyParser.json());
app.use(cors());

// Initialize OpenAI API configuration
const openai = new OpenAI({
  organization: ORG_ID,
  apiKey: API_KEY,
});

// Set up Multer for handling file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = './uploads/';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir);
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    cb(null, file.originalname);
  },
});

const upload = multer({ storage: storage });

// Handle file uploads
app.post("/upload", upload.array("files"), async (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: "No files were uploaded" });
  }

  try {
    // Initialize an array to store the accumulated data
    const allPdfTexts = [];

    await Promise.all(
      req.files.map(async (file) => {
        const data = await readPdfFile(file.path);
        allPdfTexts.push(...data);
      })
    );

    // Generate embeddings for the text using OpenAI API
    const embeddings = await generateEmbeddings(allPdfTexts);

    // Add headers to the embeddings
    const columnHeader = ["Text", "Text embedding"];
    embeddings.unshift(columnHeader);

    const filePath = await writeExcel(embeddings);
    console.log(`Excel file created at: ${filePath}`);

    res.json({ success: true, filePath });
  } catch (error) {
    console.error("Error processing request:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

async function readPdfFile(filePath) {
  return new Promise((resolve, reject) => {
    const rows = [];

    new pdfreader.PdfReader().parseFileItems(filePath, (err, item) => {
      if (err) {
        reject(err);
      } else if (!item) {
        resolve(rows);
      } else if (item.text) {
        rows.push(item.text);
      }
    });
  });
}

const generateEmbeddings = async (texts) => {
  try {
    const embeddings = [];

    for (const text of texts) {
      console.log("Text length:", text.length, text);

      const response = await openai.embeddings.create({
        model: EMBEDDING_MODEL,
        input: text,
      });

      const embedding = response.data.data[0].embedding;
      embeddings.push([text, embedding]);
    }

    return embeddings;
  } catch (error) {
    console.error("Error generating embeddings:", error);
    throw new Error("Error generating embeddings");
  }
};

const writeExcel = async (data) => {
  return new Promise(async (resolve, reject) => {
    try {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Sheet 1');

      // Add data to the worksheet
      worksheet.addRows(data);

      // Ensure the directory exists
      const dirPath = './embedding';
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath);
      }

      const filePath = path.join(dirPath, 'embedding.xlsx');
      await workbook.xlsx.writeFile(filePath);

      console.log(`Excel file created at: ${filePath}`);
      resolve(filePath);
    } catch (error) {
      console.error('Error writing Excel file:', error.message);
      reject(error);
    }
  });
};

function cosineSimilarity(A, B) {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < A.length; i++) {
    dotProduct += A[i] * B[i];
    normA += A[i] * A[i];
    normB += B[i] * B[i];
  }
  normA = Math.sqrt(normA);
  normB = Math.sqrt(normB);
  return dotProduct / (normA * normB);
}

function getSimilarityScore(embeddingsHash, promptEmbedding) {
  const similarityScoreHash = {};
  Object.keys(embeddingsHash).forEach((text) => {
    similarityScoreHash[text] = cosineSimilarity(
      promptEmbedding,
      JSON.parse(embeddingsHash[text])
    );
  });
  return similarityScoreHash;
}

app.post("/", async (req, res) => {
  try {
    const { chats } = req.body;

    if (!chats || !Array.isArray(chats)) {
      return res.status(400).json({ error: "Invalid input format" });
    }

    const filePath = path.join('./embedding', 'embedding.xlsx');
    const embeddingsHash = await getExcelData(filePath);
    const lastMessage = chats[chats.length - 1].content;

    const promptEmbeddingsResponse = await openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input: lastMessage,
    });
    const promptEmbedding = promptEmbeddingsResponse.data[0].embedding;
    console.log(promptEmbeddingsResponse);
    const similarityScoreHash = getSimilarityScore(
      embeddingsHash,
      promptEmbedding
    );

    const top3Texts = Object.keys(similarityScoreHash).sort((a, b) => similarityScoreHash[b] - similarityScoreHash[a]).slice(0, 3);
    const textWithHighestScore = top3Texts.join('. ');

    const finalPrompt = `
      Info: ${textWithHighestScore}
      Question: ${lastMessage}
      Answer:
    `;

    const result = await openai.completions.create({
      model: COMPLETIONS_MODEL,
      prompt: finalPrompt,
      max_tokens: 64,
    });

    const output = { content: result.choices[0].text.trim(), role: "assistant" };

    res.json({
      output,
    });
  } catch (error) {
    console.error("Error processing request:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

async function readExcelData(filePath) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  const worksheet = workbook.getWorksheet(1); // Assuming data is in the first sheet
  const data = [];

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber !== 1) {
      // Skip header row
      data.push({
        Text: row.getCell(1).text,
        Embedding: row.getCell(2).text,
      });
    }
  });

  return data;
}

async function getExcelData(filePath) {
  try {
    const data = await readExcelData(filePath);
    const recordsHash = {};
    data.forEach((record) => {
      recordsHash[record.Text] = record.Embedding;
    });

    return recordsHash;
  } catch (error) {
    console.error(error);
    throw error;
  }
}

app.listen(port, () => {
  console.log(`Listening on port ${port}`);
});

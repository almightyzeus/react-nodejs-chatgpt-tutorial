import { Configuration, OpenAIApi } from "openai";
import express from "express";
import bodyParser from "body-parser";
import cors from "cors";
import multer from "multer";
const pdfreader = await import('pdfreader');
import ExcelJS from 'exceljs';
import path from 'path';
import {COMPLETIONS_MODEL,EMBEDDING_MODEL,API_KEY,ORG_ID} from './Constants.js';

const app = express();
const port = 8000;
app.use(bodyParser.json());
app.use(cors());

const configuration = new Configuration({
  organization: ORG_ID,
  apiKey: API_KEY,
});
const openai = new OpenAIApi(configuration);

// Set up Multer for handling file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    // Set the destination directory where files will be stored
    cb(null, './uploads/');
  },
  filename: function (req, file, cb) {
    // Set the filename of the stored file
    cb(null, file.originalname);
  },
});

const upload = multer({ storage: storage });



// Handle file uploads
app.post("/upload", upload.array("files"), async (req, res) => {
  // Change from req.body to req.files
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: "No files were uploaded" });
  }

  try {
   // Initialize an array to store the accumulated data
const allPdfTexts = [];

await Promise.all(
  req.files.map(async (file) => {
    const data = await readPdfFile(file.path);
    // console.log("data", data, data.length);

     // Append all elements from 'data' to the accumulated array
     allPdfTexts.push(...data);
  })
);

    // console.log("PDF Texts:", allPdfTexts,allPdfTexts.length);

    // Generate embeddings for the text using OpenAI Codex API
    const embeddings = await generateEmbeddings(allPdfTexts);

    let columnHeader = ["Text","Text embedding"];

    embeddings.unshift(columnHeader);

    // console.log("Embeddings:", embeddings, embeddings.length);

    try {
      const filePath = await writeExcel(embeddings);
      console.log(`Excel file created at: ${filePath}`);
    } catch (error) {
      console.error('Error:', error);
    }
    

    res.json({ success: true });
  } catch (error) {
    console.error("Error processing request:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

async function readPdfFile(path) {
  return new Promise((resolve, reject) => {
      const rows = [];

      new pdfreader.PdfReader().parseFileItems(path, (err, item) => {
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

      // Make an API call to OpenAI Codex for each individual text
      const promptEmbeddingsResponse = await openai.createEmbedding({
        model: EMBEDDING_MODEL,
        input: text,
        max_tokens: 64,
      });

      const promptEmbedding = promptEmbeddingsResponse.data.data[0].embedding;

      embeddings.push([text, promptEmbedding]);
      // console.log("Array value:", embeddings);
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
      // Create a workbook and add a worksheet
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Sheet 1');

      // Add data to the worksheet
      worksheet.addRows(data);

      // Save the workbook to a file
      const filePath = path.join('./embedding', 'embedding.xlsx');
      await workbook.xlsx.writeFile(filePath);

      console.log(`Excel file created at: ${filePath}`);

      resolve(filePath); // Resolve with the file path
    } catch (error) {
      console.error('Error writing Excel file:', error.message);
      reject(error); // Reject with the error
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




app.post("/", async (request, response) => {
  try {
    const { chats } = request.body;

    if (!chats || !Array.isArray(chats)) {
      return response.status(400).json({ error: "Invalid input format" });
    }

    const filePath = path.join('./embedding', 'embedding.xlsx');
    const embeddingsHash = await getExcelData(filePath);
    const lastMessage = chats[chats.length - 1].content;
    // const lastMessage = chats.map(item => item.content).join(' ');

    // get embeddings value for prompt question
    const promptEmbeddingsResponse = await openai.createEmbedding({
      model: EMBEDDING_MODEL,
      input: lastMessage,
      max_tokens: 64,
    });
    const promptEmbedding = promptEmbeddingsResponse.data.data[0].embedding;

    // const result = await openai.createChatCompletion({
    //   model: "gpt-3.5-turbo",
    //   messages: [
    //     {
    //       role: "system",
    //       content: "You are a simple chat bot",
    //     },
    //     ...chats,
    //   ],
    // });

    // if (!result.data.choices || result.data.choices.length === 0) {
    //   return response.status(500).json({ error: "Unexpected response from OpenAI" });
    // }

     // create map of text against similarity score
     const similarityScoreHash = getSimilarityScore(
      embeddingsHash,
      promptEmbedding
    );

    // get text (i.e. key) from score map that has highest similarity score
    const top3Texts = Object.keys(similarityScoreHash).sort((a, b) => similarityScoreHash[b] - similarityScoreHash[a]).slice(0, 3);
    const textWithHighestScore = top3Texts.join('. ')


    // build final prompt
    const finalPrompt = `
      Info: ${textWithHighestScore}
      Question: ${lastMessage}
      Answer:
    `;

    const result = await openai.createCompletion({
      model: COMPLETIONS_MODEL,
      prompt: finalPrompt,
      max_tokens: 64,
    });

    const output = {content:result.data.choices[0].text, role:"assistant"};


    // const output = result.data.choices[0].message;

    response.json({
      output,
    });
  } catch (error) {
    console.error("Error processing request:", error);
    response.status(500).json({ error: "Internal server error" });
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
  console.log(`listening on port ${port}`);
});

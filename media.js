const multer = require('multer');
const mongoose = require('mongoose');
const { GoogleAIFileManager } = require("@google/generative-ai/server");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const path = require('path');
const fs = require('fs');
const express = require('express');

const router = express.Router();

// Connect to MongoDB
mongoose.connect('mongodb+srv://admin:AJj6aEVKqGrMs70u@cluster0.zht4cn6.mongodb.net/test')
    .then(() => console.log('Connected to MongoDB'))
    .catch(err => console.error('Failed to connect to MongoDB', err));

// File schema with filePath
const fileSchema = new mongoose.Schema({
    fileName: String,
    fileUri: String,
    mimeType: String,
    uploadedAt: { type: Date, default: Date.now },
    filePath: String,
});

const File = mongoose.model('File', fileSchema);

// Ensure 'uploads' directory exists
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}

// Configure multer to accept any file type
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/');
    },
    filename: function (req, file, cb) {
        cb(null, `${Date.now()}-${file.originalname}`);
    }
});

const upload = multer({ storage: storage });

// Middleware to parse JSON bodies
router.use(express.json());

// Initialize GoogleAIFileManager with API_KEY
const fileManager = new GoogleAIFileManager('AIzaSyDu6OUpOG7gNq1F9hh2XlbTtD0Ub1krtbI');
const genAI = new GoogleGenerativeAI('AIzaSyDu6OUpOG7gNq1F9hh2XlbTtD0Ub1krtbI');

// File upload endpoint
router.post('/upload', upload.single('file'), async (req, res) => {
    const filePath = req.file.path;
    const mimeType = req.file.mimetype;

    try {
        console.log('Uploading file:', filePath);

        // Upload the file to GoogleAIFileManager
        const uploadResult = await fileManager.uploadFile(filePath, {
            mimeType: mimeType,
            displayName: req.file.originalname,
        });

        console.log('File uploaded to GoogleAIFileManager:', uploadResult);

        // Save file metadata to MongoDB with the local path
        const file = new File({
            fileName: req.file.originalname,
            fileUri: uploadResult.file.uri,
            mimeType: mimeType,
            filePath: filePath
        });

        await file.save();

        console.log('File metadata saved to MongoDB:', file);

        // Respond with file metadata
        res.json({
            fileName: file.fileName,
            fileUri: file.fileUri,
            fileId: file._id
        });

        // Optionally delete the local file after upload (if desired)
        fs.unlink(filePath, (err) => {
            if (err) {
                console.error(`Failed to delete local file: ${filePath}`, err);
            } else {
                console.log(`Local file deleted: ${filePath}`);
            }
        });
    } catch (error) {
        console.error('Error during file upload process:', error);
        res.status(500).json({ error: 'Failed to upload file' });
    }
});

// Generate content based on uploaded file and question
router.post('/ask', async (req, res) => {
    const { question } = req.body;

    if (!question) {
        return res.status(400).json({ error: 'Question is required' });
    }

    try {
        // Fetch the latest uploaded file
        const latestFile = await File.findOne().sort({ uploadedAt: -1 });
        if (!latestFile) {
            return res.status(404).json({ error: 'No file found' });
        }

        const model = genAI.getGenerativeModel({
            model: "gemini-1.5-pro",
        });

        const result = await model.generateContent([
            {
                fileData: {
                    mimeType: latestFile.mimeType,
                    fileUri: latestFile.fileUri
                }
            },
            {
                text: `${question}`
            },
        ]);

        const response = await result.response;
        const text = await response.text();
        console.log(text);
        res.json({ text });
    } catch (error) {
        console.error('Error generating content:', error);
        res.status(500).json({ error: 'Failed to generate content' });
    }
});

module.exports = router;

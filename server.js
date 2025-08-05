import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import multer from "multer";
import path from "path";
import fs from 'fs'
import { fileURLToPath } from "url";
import connect from "./utils/connectDB.js"; // DB-Verbindung
import Submission from "./models/Submission.js";

dotenv.config();

const app = express();
app.use(express.json());
app.use(cors({
  origin: "http://localhost:5173", // Adjust this to match the Vite dev server port
}));

// Pfad-Ermittlung für ES-Module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Stelle sicher, dass der uploads-Ordner existiert (einmalig erstellen, falls nötig)
// Optional: fs.mkdirSync(path.join(__dirname, "uploads"), { recursive: true });

// Multer Setup
const storage = multer.diskStorage({
  // destination: (req, file, cb) => cb(null, "uploads"),
  destination: (req, file, cb) => cb(null, path.join(__dirname, "uploads")),

  filename: (req, file, cb) =>
    // cb(null, Date.now() + "-" + file.originalname),
    cb(null, file.originalname),  // no timestamp prefix
});
const upload = multer({ storage });

// Statische Route für Uploads, damit man Bilder abrufen kann
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.use('/beispiele', express.static(path.join(__dirname, 'beispiele')));
/*Dann funktionieren Zugriffe wie:
http://localhost:3000/beispiele/anschreiben-beispiel-text.md
http://localhost:3000/beispiele/CV-canva-beispiel-natur.pdf*/

// MongoDB verbinden
connect();

// Simple Test-Route
app.get("/", (req, res) => {
  res.send("Hello co-creator! Let's start building something great 🤓");
});
// ---------------------------------------------------------------
// ✅ Upload-Route
app.post("/upload", upload.single("file"), (req, res) => {
  console.log("📤 POST /upload hit");
  console.log("📤 /upload received", req.file);


  if (!req.file) {
    return res.status(400).json({ error: "Keine Datei empfangen" });
  }

  res.json({
    message: "Datei erfolgreich hochgeladen!",
    filename: req.file.filename,
    url: `/uploads/${req.file.filename}`, // nützlich für Frontend
  });
});
// -----------------------------------------------------------------
// ##### new routes for searchable metadata in MongoDB #############

app.post("/submit", upload.fields([
  {name: "cvFile", maxCount: 1}, // Optional CV file
  {name: "coverFile", maxCount: 1}, // Optional cover letter file
]), async (req, res) => {
  console.log("📩 POST /submit hit");
  console.log('"📩 /submit received; req.body:', req.body); 
  // console.log("req.files:", req.files); // undefined .... no files sent here anymore; upload is done in the other route POST /upload
  
  try {
    const submissionData = {
      company: req.body.company,
      position: req.body.position,
      city: req.body.city,
      arbeitsort: req.body.arbeitsort,
      date: req.body.date,
      method: req.body.method,
      notes: req.body.notes,
      status: req.body.status,
      replyMessage: req.body.replyMessage,
      coverLetterText: req.body.coverLetterText || "",

      cvFile: req.body.cvFile || "",
      coverFile: req.body.coverFile || "",

    };
    
    // Save file path if a file was uploaded
      /*    simple for ONE file: 
      if (req.file) {
      submissionData.coverFile = `/uploads/${req.file.filename}`;
    } */
    // For multiple files (cvFile and coverFile)
    // Attach file URLs if files were uploaded
    if (req.files?.cvFile?.[0]) {
      submissionData.cvFile = `/uploads/${req.files.cvFile[0].originalname}`;
    }
    if (req.files?.coverFile?.[0]) {
      submissionData.coverFile = `/uploads/${req.files.coverFile[0].originalname}`;
    }


    const newSubmission = new Submission(submissionData);
    const savedSubmission = await newSubmission.save();

    res.status(201).json(savedSubmission);
  } catch (err) {
    console.error("❌ Error in /submit:", err);
    res.status(500).json({ error: "Fehler beim Speichern des Eintrags" });
  }
});
// ##########################################################

// ########### get filenames (of already uploaded files) for selection as option
// ✅ GET /files — list all uploaded files (filenames only)
app.get("/files", (req, res) => {
  console.log("📁 GET /files hit");
  // Ensure the uploads directory exists
  if (!fs.existsSync("uploads")) {
    console.error("❌ Uploads directory does not exist");
    return res.status(500).json({ error: "Uploads directory does not exist" });
  }
  // Use path.join to ensure correct path resolution
  // Use __dirname to get the current directory of this file
  const uploadsDir = path.join(__dirname, "uploads");

  fs.readdir(uploadsDir, (err, files) => {
    if (err) {
      console.error("❌ Fehler beim Lesen des Upload-Ordners:", err);
      return res.status(500).json({ error: "Fehler beim Abrufen der Dateien" });
    }

    const fileList = files
      .map((filename) => {
        const filePath = path.join(uploadsDir, filename);
        const stats = fs.statSync(filePath);
        return {
          filename,
          url: `/uploads/${filename}`,
          uploadedAt: new Date(stats.mtime).toLocaleString("de-DE", {
            dateStyle: "short",
            timeStyle: "short"
          }),
        };
      })
      .sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt)); // Neueste oben

    res.json(fileList);
    console.log("🧾 File list sent from /files route:", fileList);

  });
});
// ############## GET /bewerbungen #############################
// ------------- MongoDB Metadata -----------------------
// ✅ GET /bewerbungen — fetch all submissions from MongoDB
app.get("/bewerbungen", async (req, res) => {
  console.log("📥 GET /bewerbungen hit");

  try {
    const submissions = await Submission.find().sort({ createdAt: -1 }); // newest first
    res.json(submissions);
  } catch (err) {
    console.error("❌ Error in GET /bewerbungen:", err);
    res.status(500).json({ error: "Fehler beim Abrufen der Bewerbungen" });
  }
});
// ##########################################

// Fehler-Middleware
app.use((err, req, res, next) => {
  console.error("❌ Error found:", err);
  res.sendStatus(500);
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});

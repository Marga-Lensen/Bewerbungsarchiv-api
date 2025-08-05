// models/Submission.js
import mongoose from "mongoose";

const SubmissionSchema = new mongoose.Schema(
  {
    company: { type: String, required: true },
    position: { type: String }, // optional
    city: String,

    arbeitsort: { type: String, default: "" }, // no enum
    date: { type: Date, default: Date.now },

    method: { type: String, default: "" }, // no enum
    notes: String,

    status: { type: String, default: "" }, // no enum
    replyMessage: String,

    cvFile: String,
    coverFile: String,
    coverLetterText: String, // textarea support
  },
  { timestamps: true }
);

const Submission = mongoose.models.Submission || mongoose.model("Submission", SubmissionSchema);
export default Submission;

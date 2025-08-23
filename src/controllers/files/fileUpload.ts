import { Response } from "express";
import { uploadFile } from "../../utils/uploadFile";
import { AuthenticatedRequest } from "@/types/express";
import fs from "fs/promises";

const acceptedFileTypes = [
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/png",
  "application/pdf",
];

export const fileUpload = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  if (!req.user) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  if (!req.file) {
    res.status(500).json({ message: "File missing" });
    return;
  }

  if (!acceptedFileTypes.includes(req.file.mimetype)) {
    res.status(500).json({ message: "Invalid file" });
    return;
  }

  try {
    const { email } = req.user;

    const uploadResult = await uploadFile(req.file, email);

    const s3FileUrl = uploadResult.s3FileUrl;

    await fs.unlink(req.file.path);

    res.status(200).json({
      message: "File uploaded",
      s3FileUrl: s3FileUrl,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "An unexpected error occurred",
    });
  }
};

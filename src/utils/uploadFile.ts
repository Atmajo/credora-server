import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { hashFile } from "./hashFile";
import fs from "fs/promises";
import path from "path";

export const uploadFile = async (
  file: any,
  email: string
): Promise<{ s3FileUrl: string }> => {
  try {
    const key = await hashFile(file.path, "sha256");

    const s3Client = new S3Client({
      region: process.env.AWS_REGION!,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY!,
        secretAccessKey: process.env.AWS_SECRET_KEY!,
      },
    });

    const fileContent = await fs.readFile(file.path);

    const folderName = email.replace(/[^\w.-]/g, "_").toLowerCase();

    const fileName = `${Date.now()}-${path.basename(key)}`
      .trim()
      .replace(/\s+/g, "_");

    const fileKey = `${folderName}/${fileName}`;

    const uploadParams = {
      Bucket: process.env.AWS_BUCKET_NAME,
      Key: fileKey,
      Body: fileContent,
      ContentType: file.mimetype,
      ACL: "public-read" as any,
    };

    await s3Client.send(new PutObjectCommand(uploadParams));

    return {
      s3FileUrl: `https://${uploadParams.Bucket}.s3.${process.env.AWS_REGION}.amazonaws.com/${fileKey}`,
    };
  } catch (error) {
    throw error;
  }
};

import crypto from "crypto";
import fs from "fs";

export const hashFile = async (
  filePath: any,
  algorithm = "sha256"
): Promise<string> => {
  const hash = crypto.createHash(algorithm);
  const fileStream = fs.createReadStream(filePath);

  return new Promise((resolve, reject) => {
    fileStream.on("data", (chunk) => {
      hash.update(chunk);
    });

    fileStream.on("end", () => {
      const fileHash = hash.digest("hex");
      resolve(fileHash);
    });

    fileStream.on("error", (error) => {
      reject(error);
    });
  });
};

import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export const downloadFile = async (fileUrl: string, expirationTime = 300) => {
  try {
    const s3Client = new S3Client({
      region: process.env.AWS_REGION!,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY!,
        secretAccessKey: process.env.AWS_SECRET_KEY!,
      },
    });

    const url = new URL(fileUrl);
    const s3Key = url.pathname.substring(1);

    // Create S3 GetObjectCommand
    const getParams = {
      Bucket: process.env.AWS_BUCKET_NAME,
      Key: s3Key,
    };

    // Generate a signed URL (valid for 5 minutes)
    const command = new GetObjectCommand(getParams);

    const signedUrl = await getSignedUrl(s3Client, command, {
      expiresIn: expirationTime,
    });

    return {
      success: true,
      downloadUrl: signedUrl,
      message: 'File download link generated successfully',
    };
  } catch (error) {
    throw error;
  }
};

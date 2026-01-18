// src/services/s3Upload.ts
import {
  DeleteObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  type GetObjectCommandInput,
  type HeadObjectCommandInput,
  type PutObjectCommandInput,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import multer from "multer";
import s3 from "../config/s3";
import { env } from "../config/env";
import { sanitizeSegment, ts } from "../utils/file";
import { MulterFile, SignedUrlResult } from "../types/types";
import { Upload } from "@aws-sdk/lib-storage";

// async function uploadStreamToS3({
//   stream,
//   key,
//   contentType,
// }: {
//   stream: NodeJS.ReadableStream;
//   key: string;
//   contentType: string;
// }) {
//   const upload = new Upload({
//     client: s3,
//     params: {
//       Bucket: process.env.S3_BUCKET!,
//       Key: key,
//       Body: stream,
//       ContentType: contentType,
//     },
//   });

//   await upload.done();
//   return key;
// }


// Multer memory storage
export const upload = multer({ storage: multer.memoryStorage() });

export const generateSignedUrl = async (key: string): Promise<string> => {
  const input: GetObjectCommandInput = {
    Bucket: env.AWS_S3_BUCKET_NAME,
    Key: key,
  };

  const getCommand = new GetObjectCommand(input);

  // 604800 sec = 7 days
  return getSignedUrl(s3, getCommand, { expiresIn: 604800 });
};

export const uploadFileToS3 = async (
  file: Buffer | Uint8Array | string,
  key: string,
  contentType?: string
): Promise<string> => {
  const input: PutObjectCommandInput = {
    Bucket: env.AWS_S3_BUCKET_NAME,
    Key: key,
    Body: file,
    ...(contentType ? { ContentType: contentType } : {}),
  };

  const command = new PutObjectCommand(input);

  // Let errors bubble up so caller can handle properly
  await s3.send(command);
  return key;
};

export const handleUpload = async ({
  file,
  prefix,
}: {
  file: MulterFile;
  prefix: string;
}): Promise<SignedUrlResult> => {
  const safeName = sanitizeSegment(file.originalname || "upload");
  const key = `${prefix}/${ts()}-${safeName}`;

  await uploadFileToS3(file.buffer, key, file.mimetype);

  const url = await generateSignedUrl(key);
  return { key, url };
};

export const validateImageExistsInS3 = async (
  key?: string
): Promise<boolean> => {
  if (!key) return false;

  try {
    const input: HeadObjectCommandInput = {
      Bucket: env.AWS_S3_BUCKET_NAME,
      Key: key,
    };

    await s3.send(new HeadObjectCommand(input));
    return true;
  } catch (err: any) {
    // Not found
    if (err?.name === "NotFound" || err?.$metadata?.httpStatusCode === 404) {
      return false;
    }
    throw err;
  }
};

export const deleteFileFromS3 = async (key: string): Promise<void> => {
  const deleteCommand = new DeleteObjectCommand({
    Bucket: env.AWS_S3_BUCKET_NAME,
    Key: key,
  });
  await s3.send(deleteCommand);
};


export const deleteFilesFromS3 = async (keys: string[]): Promise<void> => {
  const deleteCommand = new DeleteObjectsCommand({
    Bucket: env.AWS_S3_BUCKET_NAME,
    Delete: { Objects: keys.map((key) => ({ Key: key })) },
  });
  await s3.send(deleteCommand);
};
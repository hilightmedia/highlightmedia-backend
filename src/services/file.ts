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
import { Upload } from "@aws-sdk/lib-storage";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { Readable } from "node:stream";
import multer from "multer";
import s3 from "../config/s3";
import { env } from "../config/env";
import { sanitizeSegment, ts } from "../utils/file";
import {  SignedUrlResult } from "../types/types";


export const generateSignedUrl = async (key: string): Promise<string> => {
  const input: GetObjectCommandInput = {
    Bucket: env.AWS_S3_BUCKET_NAME,
    Key: key,
  };
  const getCommand = new GetObjectCommand(input);
  return getSignedUrl(s3, getCommand, { expiresIn: 604800 });
};

export const uploadFileToS3 = async (
  file: Buffer | Uint8Array | string | Readable,
  key: string,
  contentType?: string,
): Promise<string> => {
  const params = {
    Bucket: env.AWS_S3_BUCKET_NAME,
    Key: key,
    Body: file,
    ...(contentType ? { ContentType: contentType } : {}),
  };

  if (typeof file === "string" || file instanceof Uint8Array || Buffer.isBuffer(file)) {
    const command = new PutObjectCommand(params as PutObjectCommandInput);
    await s3.send(command);
    return key;
  }

  const uploader = new Upload({
    client: s3,
    params,
  });

  await uploader.done();
  return key;
};

export const handleUpload = async ({
  fileStream,
  originalname,
  mimetype,
  prefix,
}: {
  fileStream: Readable;
  originalname: string;
  mimetype: string;
  prefix: string;
}): Promise<SignedUrlResult> => {
  const safeName = sanitizeSegment(originalname || "upload");
  const key = `${prefix}/${ts()}-${safeName}`;

  await uploadFileToS3(fileStream, key, mimetype);

  const url = await generateSignedUrl(key);

  return {
    key,
    url,
  };
};

export const validateImageExistsInS3 = async (key?: string): Promise<boolean> => {
  if (!key) return false;

  try {
    const input: HeadObjectCommandInput = {
      Bucket: env.AWS_S3_BUCKET_NAME,
      Key: key,
    };

    await s3.send(new HeadObjectCommand(input));
    return true;
  } catch (err: any) {
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

import { z } from "zod";
import { MAX_UPLOAD_BYTES } from "./constants";

export const RequestUploadInputSchema = z.object({
  filename: z.string().trim().min(1, "Choose a file").max(255, "Filename is too long"),
  sizeBytes: z.coerce
    .number()
    .int()
    .min(1, "File is empty")
    .max(MAX_UPLOAD_BYTES, "File is larger than the 25MB limit"),
  courseId: z.string(),
});

export type RequestUploadInput = z.infer<typeof RequestUploadInputSchema>;

export const ConfirmUploadInputSchema = z.object({
  storageKey: z.string().trim().min(1),
  originalFilename: z.string().trim().min(1).max(255),
  courseId: z.string(),
});

export type ConfirmUploadInput = z.infer<typeof ConfirmUploadInputSchema>;

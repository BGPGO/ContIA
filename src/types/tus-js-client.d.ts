// Minimal ambient declarations for tus-js-client v4.
// Replace with real types after `npm install tus-js-client`.
declare module "tus-js-client" {
  export interface UploadOptions {
    endpoint?: string;
    retryDelays?: number[];
    chunkSize?: number;
    headers?: Record<string, string>;
    metadata?: Record<string, string>;
    onProgress?: (bytesUploaded: number, bytesTotal: number) => void;
    onSuccess?: () => void;
    onError?: (error: Error) => void;
    onShouldRetry?: (error: Error, retryAttempt: number, options: UploadOptions) => boolean;
  }

  export class Upload {
    constructor(file: File | Blob, options: UploadOptions);
    start(): void;
    abort(): void;
  }
}

"use client";

import { useState, useRef, useCallback, type DragEvent, type ChangeEvent } from "react";
import { Upload, X, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatFileSize } from "@/lib/utils";

interface FileUploadProps {
  projectId: string;
  onUploadComplete?: (asset: UploadedAsset) => void;
  accept?: string;
  maxSizeMB?: number;
  className?: string;
}

interface UploadedAsset {
  id: string;
  name: string;
  type: string;
  url: string;
  size: number;
}

type UploadStatus = "idle" | "uploading" | "success" | "error";

export function FileUpload({
  projectId,
  onUploadComplete,
  accept,
  maxSizeMB = 100,
  className,
}: FileUploadProps) {
  const [dragOver, setDragOver] = useState(false);
  const [status, setStatus] = useState<UploadStatus>("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    async (file: File) => {
      // 检查文件大小
      if (file.size > maxSizeMB * 1024 * 1024) {
        setError(`File too large. Maximum size is ${maxSizeMB}MB.`);
        setStatus("error");
        return;
      }

      setFileName(file.name);
      setStatus("uploading");
      setProgress(0);
      setError(null);

      const formData = new FormData();
      formData.append("file", file);
      formData.append("projectId", projectId);

      try {
        // 使用 XMLHttpRequest 获取上传进度
        const asset = await new Promise<UploadedAsset>((resolve, reject) => {
          const xhr = new XMLHttpRequest();

          xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) {
              setProgress(Math.round((e.loaded / e.total) * 100));
            }
          };

          xhr.onload = () => {
            if (xhr.status === 201) {
              resolve(JSON.parse(xhr.responseText));
            } else {
              const errBody = JSON.parse(xhr.responseText);
              reject(new Error(errBody.error || "Upload failed"));
            }
          };

          xhr.onerror = () => reject(new Error("Network error"));

          xhr.open("POST", "/api/assets");
          xhr.send(formData);
        });

        setStatus("success");
        onUploadComplete?.(asset);

        // 2秒后重置
        setTimeout(() => {
          setStatus("idle");
          setFileName(null);
          setProgress(0);
        }, 2000);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Upload failed");
        setStatus("error");
      }
    },
    [projectId, maxSizeMB, onUploadComplete]
  );

  const handleDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handleChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
      // 清除 input，允许重复上传同一文件
      e.target.value = "";
    },
    [handleFile]
  );

  return (
    <div
      className={cn(
        "relative rounded-xl border-2 border-dashed transition-all duration-200 cursor-pointer",
        {
          "border-gray-300 bg-gray-50/50 hover:border-brand-400 hover:bg-brand-50/30":
            status === "idle" && !dragOver,
          "border-brand-500 bg-brand-50/50 scale-[1.01]": dragOver,
          "border-brand-400 bg-brand-50/30": status === "uploading",
          "border-green-400 bg-green-50/50": status === "success",
          "border-red-400 bg-red-50/50": status === "error",
        },
        className
      )}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      onClick={() => status !== "uploading" && inputRef.current?.click()}
    >
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        accept={accept}
        onChange={handleChange}
      />

      <div className="flex flex-col items-center justify-center py-8 px-4">
        {status === "idle" && (
          <>
            <Upload className="w-8 h-8 text-gray-400 mb-3" />
            <p className="text-sm font-medium text-gray-600">
              Drag & drop a file, or{" "}
              <span className="text-brand-500">click to browse</span>
            </p>
            <p className="text-xs text-gray-400 mt-1">
              Audio, video, images, or documents · Max {maxSizeMB}MB
            </p>
          </>
        )}

        {status === "uploading" && (
          <>
            <Loader2 className="w-8 h-8 text-brand-500 mb-3 animate-spin" />
            <p className="text-sm font-medium text-gray-600">
              Uploading {fileName}...
            </p>
            <div className="w-48 h-1.5 rounded-full bg-gray-200 mt-3 overflow-hidden">
              <div
                className="h-full rounded-full bg-brand-500 transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-xs text-gray-400 mt-1">{progress}%</p>
          </>
        )}

        {status === "success" && (
          <>
            <CheckCircle className="w-8 h-8 text-green-500 mb-3" />
            <p className="text-sm font-medium text-green-700">
              {fileName} uploaded successfully!
            </p>
          </>
        )}

        {status === "error" && (
          <>
            <AlertCircle className="w-8 h-8 text-red-500 mb-3" />
            <p className="text-sm font-medium text-red-700">{error}</p>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setStatus("idle");
                setError(null);
              }}
              className="text-xs text-red-500 hover:text-red-700 mt-2 underline"
            >
              Try again
            </button>
          </>
        )}
      </div>
    </div>
  );
}

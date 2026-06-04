"use client";
import { useState } from "react";

interface Props {
  src: string;
  alt?: string;
  className?: string;
}

// Reusable product image: click to expand full-screen, click again to close.
export default function ZoomableImage({ src, alt = "", className = "" }: Props) {
  const [zoom, setZoom] = useState(false);
  if (!src) return null;
  return (
    <>
      <img
        src={src}
        alt={alt}
        onClick={(e) => { e.stopPropagation(); setZoom(true); }}
        className={`cursor-zoom-in hover:opacity-90 transition-opacity ${className}`}
      />
      {zoom && (
        <div
          className="fixed inset-0 z-[70] bg-black/90 flex items-center justify-center p-4"
          onClick={(e) => { e.stopPropagation(); setZoom(false); }}
        >
          <img src={src} alt={alt} className="max-w-full max-h-full object-contain rounded-lg cursor-zoom-out" />
        </div>
      )}
    </>
  );
}
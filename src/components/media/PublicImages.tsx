"use client";
/* eslint-disable @next/next/no-img-element */

import { useState } from "react";

function initial(value: string): string {
  return value.trim().charAt(0).toLocaleUpperCase("es") || "D";
}

export function BrandLogo({
  src,
  name,
  className = "h-8 w-8",
}: {
  src: string | null;
  name: string;
  className?: string;
}) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  if (!src || failedSrc === src) {
    return (
      <span
        aria-hidden="true"
        className={`${className} flex shrink-0 items-center justify-center rounded-full bg-accent text-xs font-bold text-accent-foreground`}
      >
        {initial(name)}
      </span>
    );
  }

  return (
    <img
      src={src}
      alt=""
      className={`${className} shrink-0 rounded-full object-cover`}
      onError={() => setFailedSrc(src)}
    />
  );
}

export function CourseImage({
  src,
  title,
  className = "",
}: {
  src: string | null;
  title: string;
  className?: string;
}) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  if (!src || failedSrc === src) {
    return (
      <div
        className={`flex items-center justify-center bg-muted ${className}`.trim()}
      >
        <span className="px-4 text-center text-sm font-medium text-foreground">
          {title}
        </span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={title}
      className={`w-full bg-muted object-cover ${className}`.trim()}
      loading="lazy"
      onError={() => setFailedSrc(src)}
    />
  );
}

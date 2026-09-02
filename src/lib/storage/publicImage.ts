export const MAX_PUBLIC_IMAGE_BYTES = 10 * 1024 * 1024;

export type PublicImageType = {
  mime: "image/png" | "image/jpeg" | "image/webp" | "image/gif";
  extension: "png" | "jpg" | "webp" | "gif";
};

function startsWith(bytes: Uint8Array, signature: number[]): boolean {
  return signature.every((value, index) => bytes[index] === value);
}

export function detectPublicImageType(bytes: Uint8Array): PublicImageType | null {
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return { mime: "image/png", extension: "png" };
  }
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) {
    return { mime: "image/jpeg", extension: "jpg" };
  }
  const ascii = new TextDecoder("ascii").decode(bytes.slice(0, 12));
  if (ascii.startsWith("GIF87a") || ascii.startsWith("GIF89a")) {
    return { mime: "image/gif", extension: "gif" };
  }
  if (ascii.startsWith("RIFF") && ascii.slice(8, 12) === "WEBP") {
    return { mime: "image/webp", extension: "webp" };
  }
  return null;
}

export function declaredTypeMatches(
  declared: string,
  detected: PublicImageType
): boolean {
  if (!declared) return true;
  if (declared === "image/jpg" && detected.mime === "image/jpeg") return true;
  return declared === detected.mime;
}

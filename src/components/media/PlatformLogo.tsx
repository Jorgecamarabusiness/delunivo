import Image from "next/image";

const SIZES = {
  sm: {
    pixels: 28,
    src: "/branding/delunivo-favicon-64.png",
    className: "h-7 w-7 rounded-lg",
  },
  md: {
    pixels: 32,
    src: "/branding/delunivo-favicon-64.png",
    className: "h-8 w-8 rounded-lg",
  },
  lg: {
    pixels: 80,
    src: "/branding/delunivo-icon-512.png",
    className: "h-20 w-20 rounded-2xl",
  },
} as const;

export function PlatformLogo({
  size = "md",
  className = "",
  priority = false,
}: {
  size?: keyof typeof SIZES;
  className?: string;
  priority?: boolean;
}) {
  const logoSize = SIZES[size];

  return (
    <Image
      src={logoSize.src}
      alt=""
      width={logoSize.pixels}
      height={logoSize.pixels}
      priority={priority}
      className={`${logoSize.className} shrink-0 ${className}`.trim()}
    />
  );
}

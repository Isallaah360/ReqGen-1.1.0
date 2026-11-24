import type { ImgHTMLAttributes } from "react";
/** 3.0.2: plain image (the logos are packed in the app). */
export default function Image({ src, alt, width, height, priority: _p, fill: _f, ...rest }: Omit<ImgHTMLAttributes<HTMLImageElement>, "src"> & { src: string | { src: string }; priority?: boolean; fill?: boolean }) {
  const s = typeof src === "string" ? src : src.src;
  return <img src={s.startsWith("/") ? `.${s}` : s} alt={alt} width={width} height={height} {...rest} />;
}

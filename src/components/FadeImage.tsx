import { useState } from "react";

interface Props extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  alt: string;
}

export default function FadeImage({ src, alt, style, ...props }: Props) {
  const [loaded, setLoaded] = useState(false);

  return (
    <img
      src={src}
      alt={alt}
      style={{ ...style, opacity: loaded ? 1 : 0, transition: "opacity 0.4s ease" }}
      onLoad={() => setLoaded(true)}
      {...props}
    />
  );
}

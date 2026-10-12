import { Image, type ImageProps } from "expo-image";
import { useState } from "react";
import { type PhotoSize } from "@/domain/photo-uri";
import { displayPhotoSources } from "@/lib/photo-uri";

/**
 * A stored plant photo at `size`, trying the copy saved beside it at upload
 * first and the bucket's resizer if that copy isn't there -- an older photo,
 * or one uploaded by an app that hadn't updated. See "Copies saved at upload"
 * in `src/domain/photo-uri.ts`.
 */
export function BucketImage({ uri, size, ...props }: Omit<ImageProps, "source"> & { uri: string; size: PhotoSize }) {
  const sources = displayPhotoSources(uri, size);
  return <Fallbacks key={sources.join(" ")} sources={sources} {...props} />;
}

function Fallbacks({ sources, onError, ...props }: Omit<ImageProps, "source"> & { sources: string[] }) {
  const [i, setI] = useState(0);
  return (
    <Image
      {...props}
      source={{ uri: sources[i] }}
      onError={(e) => {
        if (i < sources.length - 1) setI(i + 1);
        else onError?.(e);
      }}
    />
  );
}

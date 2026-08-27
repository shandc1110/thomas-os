"use client";

import { useState } from "react";

type ProductGalleryProps = {
  name: string;
  images: string[];
};

export function ProductGallery({ name, images }: ProductGalleryProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const active = images[activeIndex] ?? images[0];

  if (images.length === 0) {
    return (
      <div className="aspect-[4/5] w-full bg-sand/30 flex items-center justify-center">
        <span className="text-xs uppercase tracking-widest text-muted">No image</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="aspect-[4/5] overflow-hidden bg-white">
        {active ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={active}
            alt={name}
            className="h-full w-full object-cover"
            loading="eager"
          />
        ) : null}
      </div>
      {images.length > 1 ? (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {images.map((src, index) => (
            <button
              key={`${src}-${index}`}
              type="button"
              onClick={() => setActiveIndex(index)}
              className={`h-16 w-16 shrink-0 overflow-hidden border bg-white transition ${
                index === activeIndex ? "border-charcoal" : "border-sand hover:border-sage"
              }`}
              aria-label={`View image ${index + 1} of ${images.length}`}
              aria-pressed={index === activeIndex}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" className="h-full w-full object-cover" loading="lazy" />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

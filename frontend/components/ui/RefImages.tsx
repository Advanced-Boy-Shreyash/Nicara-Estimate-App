"use client";

import { useState } from "react";
import { dlFile } from "@/lib/utils";

interface RefImage {
  id: number | string;
  name: string;
  url?: string;
}

interface RefImagesProps {
  label?: string;
  images?: RefImage[];
  addable?: boolean;
}

export default function RefImages({
  label = "Reference Images",
  images = [],
  addable = true,
}: RefImagesProps) {
  const [imgs, setImgs] = useState<RefImage[]>(images);

  const addMock = () =>
    setImgs((p) => [
      ...p,
      { id: Date.now(), name: "Reference " + (p.length + 1), url: "" },
    ]);

  return (
    <div>
      <div className="flex justify-between items-center mb-2.5">
        <div className="text-[11px] font-bold text-stone-400 uppercase tracking-wider">
          {label} ({imgs.length})
        </div>
        {addable && (
          <button
            onClick={addMock}
            className="px-3 py-1 bg-purple-50 border border-purple-200 rounded-lg text-[11px] text-purple-700 cursor-pointer font-semibold hover:bg-purple-100 transition-colors"
          >
            + Add Image
          </button>
        )}
      </div>
      <div className="flex gap-2.5 flex-wrap">
        {imgs.map((img, i) => (
          <div
            key={img.id || i}
            className="w-[90px] bg-gradient-to-br from-stone-200 to-stone-300 rounded-lg border border-nicara-light overflow-hidden relative group hover:border-nicara-gold transition-colors"
          >
            <div className="h-16 flex flex-col items-center justify-center gap-1">
              <span className="text-xl">🖼</span>
              <span className="text-[9px] text-stone-500 text-center px-1">
                {img.name}
              </span>
            </div>
            <div className="border-t border-nicara-light p-1 flex justify-center bg-white/60">
              <button
                onClick={() => dlFile(img.name + ".jpg")}
                className="bg-transparent border-none text-[13px] cursor-pointer text-stone-600 p-0 leading-none hover:text-nicara-gold transition-colors"
                title={"Download " + img.name}
              >
                ⬇
              </button>
            </div>
            {addable && (
              <button
                onClick={() => setImgs((p) => p.filter((_, j) => j !== i))}
                className="absolute top-1 right-1 bg-black/40 border-none rounded-full w-4 h-4 text-white text-[10px] cursor-pointer leading-4 text-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                ×
              </button>
            )}
          </div>
        ))}
        {addable && (
          <div
            onClick={addMock}
            className="w-[90px] h-20 border-2 border-dashed border-nicara-light rounded-lg flex flex-col items-center justify-center gap-1 cursor-pointer hover:border-nicara-gold transition-colors"
          >
            <span className="text-[22px] text-stone-400">+</span>
            <span className="text-[9px] text-stone-400">Upload</span>
          </div>
        )}
      </div>
    </div>
  );
}

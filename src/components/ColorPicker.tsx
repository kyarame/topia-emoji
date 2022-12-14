import { useDrag, useGesture } from "@use-gesture/react";
import classNames from "classnames";
import { convertOkhsvToOklab, convertOklabToRgb } from "culori";
import { useEffect, useMemo, useRef, useState } from "react";
import { Rect, useRect } from "react-use-rect";

export class Color {
  h: number;
  s: number;
  v: number;
  a: number;

  constructor(h: number, s: number, v: number, a: number = 1) {
    this.h = h;
    this.s = Math.max(0, Math.min(1, s));
    this.v = Math.max(0, Math.min(1, v));
    this.a = Math.max(0, Math.min(1, a));
  }

  clone() {
    return new Color(this.h, this.s, this.v, this.a);
  }

  toRgba(): { r: number; g: number; b: number; a: number } {
    const { r, g, b } = convertOklabToRgb(
      convertOkhsvToOklab({
        h: this.h,
        s: this.s,
        v: this.v,
      })
    );

    return {
      r: Math.max(0, Math.min(255, Math.round(r * 255))),
      g: Math.max(0, Math.min(255, Math.round(g * 255))),
      b: Math.max(0, Math.min(255, Math.round(b * 255))),
      a: this.a,
    };
  }

  toString() {
    const { r, g, b, a } = this.toRgba();
    return `rgba(${r}, ${g}, ${b}, ${a})`;
  }

  toHex(minify: boolean = false) {
    const { r, g, b, a } = this.toRgba();
    if (minify) {
      const rr = Math.max(0, Math.min(15, Math.round(r / 17))).toString(16);
      const gg = Math.max(0, Math.min(15, Math.round(g / 17))).toString(16);
      const bb = Math.max(0, Math.min(15, Math.round(b / 17))).toString(16);
      const aa = Math.max(0, Math.min(15, Math.round(a * 15))).toString(16);
      return `#${rr}${gg}${bb}${aa === "f" ? "" : aa}`;
    }

    return `#${r.toString(16).padStart(2, "0")}${g
      .toString(16)
      .padStart(2, "0")}${b.toString(16).padStart(2, "0")}${
      a === 1
        ? ""
        : Math.max(0, Math.min(255, Math.round(a * 255)))
            .toString(16)
            .padStart(2, "0")
    }`;
  }
}

interface ColorPickerProps {
  color: Color | null;
  setColor: (color: Color) => void;
}

const ColorPicker = ({ color, setColor }: ColorPickerProps) => {
  const [wrapperRect, setWrapperRect] = useState<Rect>();
  const [wrapperRef, invalidate] = useRect(setWrapperRect);
  const hueCanvasRef = useRef<HTMLCanvasElement>(null);
  const svCanvasRef = useRef<HTMLCanvasElement>(null);

  const size = Math.min(256, Math.max(64, (wrapperRect?.width ?? 0) - 80));
  const [open, setOpen] = useState(false);
  const colorWithDefault = color ?? new Color(0, 0.5, 0.5);

  const renderCanvas = () => {
    const svCanvas = svCanvasRef.current;
    const hueCanvas = hueCanvasRef.current;
    if (!svCanvas || !hueCanvas) return;

    const hueCtx = hueCanvas.getContext("2d");
    const svCtx = svCanvas.getContext("2d");
    if (!hueCtx || !svCtx) return;

    const RESOLUTION = 1 / 4;
    const newSize = Math.floor(size * RESOLUTION + 1);

    const svPixelData = svCtx.createImageData(newSize, newSize);
    for (let i = 0; i < newSize; i++) {
      for (let j = 0; j < newSize; j++) {
        const index = (i + j * newSize) * 4;
        const h = colorWithDefault.h;
        const s = i / newSize;
        const v = (newSize - 1 - j) / newSize;
        const { r, g, b } = new Color(h, s, v).toRgba();
        svPixelData.data[index] = r;
        svPixelData.data[index + 1] = g;
        svPixelData.data[index + 2] = b;
        svPixelData.data[index + 3] = 255;
      }
    }
    svCtx.putImageData(svPixelData, 0, 0);
    svCtx.setTransform(1 / RESOLUTION, 0, 0, 1 / RESOLUTION, 0, 0);
    svCtx.drawImage(svCanvas, 0, 0);

    const huePixelData = hueCtx.createImageData(20, size);
    for (let i = 0; i < size; i++) {
      const h = (i / size) * 360;
      const s = 0.8;
      const v = 0.9;
      const { r, g, b } = new Color(h, s, v).toRgba();

      for (let j = 0; j < 20; j++) {
        const index = (i * 20 + j) * 4;
        huePixelData.data[index] = r;
        huePixelData.data[index + 1] = g;
        huePixelData.data[index + 2] = b;
        huePixelData.data[index + 3] = 255;
      }
    }
    hueCtx.putImageData(huePixelData, 0, 0);
  };

  useEffect(() => {
    if (!wrapperRect) return;
    const hueCanvas = hueCanvasRef.current;
    const svCanvas = svCanvasRef.current;
    if (!hueCanvas || !svCanvas) return;

    svCanvas.width = size;
    svCanvas.height = size;

    hueCanvas.width = 20;
    hueCanvas.height = size;

    renderCanvas();
  }, [wrapperRect]);

  useEffect(() => {
    renderCanvas();
  }, [colorWithDefault.h]);

  useEffect(() => {
    const handler = () => invalidate();
    window.addEventListener("resize", handler);

    return () => {
      window.removeEventListener("resize", handler);
    };
  });

  const bindSV = useDrag(({ xy }) => {
    const bounds = {
      left: (wrapperRect?.left ?? 0) + 12,
      right: (wrapperRect?.right ?? 80) - 68,
      top: (wrapperRect?.top ?? 0) + 12,
      bottom: (wrapperRect?.bottom ?? 24) - 12,
    };
    const s =
      (Math.max(bounds.left, Math.min(bounds.right, xy[0])) - bounds.left) /
      size;
    const v =
      1 -
      (Math.max(bounds.top, Math.min(bounds.bottom, xy[1])) - bounds.top) /
        size;

    setColor(new Color(colorWithDefault.h, s, v, colorWithDefault.a));
  });

  const bindHue = useDrag(({ xy }) => {
    const bounds = {
      top: (wrapperRect?.top ?? 0) + 12,
      bottom: (wrapperRect?.bottom ?? 24) - 12,
    };
    const h =
      ((Math.max(bounds.top, Math.min(bounds.bottom, xy[1])) - bounds.top) /
        size) *
      360;

    setColor(
      new Color(h, colorWithDefault.s, colorWithDefault.v, colorWithDefault.a)
    );
  });

  const bindAlpha = useDrag(({ xy }) => {
    const bounds = {
      top: (wrapperRect?.top ?? 0) + 12,
      bottom: (wrapperRect?.bottom ?? 24) - 12,
    };
    const alpha =
      1 -
      (Math.max(bounds.top, Math.min(bounds.bottom, xy[1])) - bounds.top) /
        size;

    setColor(
      new Color(
        colorWithDefault.h,
        colorWithDefault.s,
        colorWithDefault.v,
        alpha
      )
    );
  });

  const hexColor = useMemo(() => color?.toHex(), [color]);
  const stringifiedColor = useMemo(() => color?.toString(), [color]);
  const stringifiedHueColor = useMemo(
    () => new Color(colorWithDefault.h, 0.8, 0.9).toString(),
    [colorWithDefault.h]
  );
  const stringifiedColorAlpha1 = useMemo(
    () =>
      new Color(
        colorWithDefault.h,
        colorWithDefault.s,
        colorWithDefault.v
      ).toString(),
    [colorWithDefault.h, colorWithDefault.s, colorWithDefault.v]
  );
  const stringifiedColorAlpha0 = useMemo(
    () =>
      new Color(
        colorWithDefault.h,
        colorWithDefault.s,
        colorWithDefault.v,
        0
      ).toString(),
    [colorWithDefault.h, colorWithDefault.s, colorWithDefault.v]
  );

  return (
    <>
      <button
        className="w-full border border-gray-500 rounded-md h-8 absolute top-0 left-0 z-10 overflow-clip"
        style={{
          backgroundPosition: "0px 0px, 10px 10px",
          backgroundSize: "20px 20px",
          backgroundImage: color
            ? "linear-gradient(45deg, #eee 25%, transparent 25%, transparent 75%, #eee 75%, #eee 100%),linear-gradient(45deg, #eee 25%, white 25%, white 75%, #eee 75%, #eee 100%)"
            : undefined,
        }}
        onClick={() => {
          setOpen((open) => !open);
        }}
      >
        <div
          className="w-full h-full font-mono leading-8"
          style={{
            backgroundColor: stringifiedColor,
            color: !color || color.v < 0.65 ? "white" : "black",
          }}
        >
          {hexColor}
        </div>
      </button>
      <div
        ref={wrapperRef}
        className={classNames(
          "flex gap-x-2 items-stretch absolute right-0 bg-gray-700 rounded-lg shadow-lg bottom-10 z-10 p-3 transition-opacity",
          open ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        style={{
          width: "min(100% + 64px, 336px)",
          maxWidth: "min(100% + 64px, 336px)",
          minWidth: "min(100% + 64px, 336px)",
        }}
      >
        <canvas
          ref={svCanvasRef}
          className="touch-none"
          {...bindSV()}
          width={1}
          height={1}
        />
        <canvas
          ref={hueCanvasRef}
          className="touch-none"
          {...bindHue()}
          width={1}
          height={1}
        />
        <div
          className="w-5 touch-none"
          {...bindAlpha()}
          style={{
            height: size,
            backgroundPosition: "0px 0px, 10px 10px",
            backgroundSize: "20px 20px",
            backgroundImage:
              "linear-gradient(45deg, #eee 25%, transparent 25%, transparent 75%, #eee 75%, #eee 100%),linear-gradient(45deg, #eee 25%, white 25%, white 75%, #eee 75%, #eee 100%)",
          }}
        >
          <div
            className="w-full h-full"
            style={{
              backgroundImage: `linear-gradient(${stringifiedColorAlpha1}, ${stringifiedColorAlpha0})`,
            }}
          />
        </div>
        <div
          className="shadow border-2 border-white w-4 h-4 rounded-full absolute pointer-events-none"
          style={{
            backgroundColor: stringifiedColor,
            top: (1 - colorWithDefault.v) * size + 4,
            left: colorWithDefault.s * size + 4,
          }}
        />
        <div
          className="shadow border-2 border-white w-4 h-4 rounded-full absolute pointer-events-none"
          style={{
            backgroundColor: stringifiedHueColor,
            right: 42,
            bottom: (1 - colorWithDefault.h / 360) * size + 4,
          }}
        />
        <div
          className="shadow border-2 border-white w-4 h-4 rounded-full absolute pointer-events-none bg-transparent"
          style={{
            backgroundColor: stringifiedColorAlpha1,
            right: 14,
            bottom: colorWithDefault.a * size + 4,
          }}
        />
      </div>
      <div
        className={classNames(
          "bg-gray-900/50 fixed w-full h-full top-0 left-0 transition-opacity",
          open ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onPointerDown={(e) => {
          if (e.target === e.currentTarget) setOpen(false);
        }}
      />
    </>
  );
};

export default ColorPicker;

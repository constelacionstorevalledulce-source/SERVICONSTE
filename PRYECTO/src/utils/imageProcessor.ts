import { ImageFilters } from "../types";

export function processImageFilters(
  src: string,
  filters: ImageFilters
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      // 1. Create temporary canvas to apply rotation to raw image
      const rotateCanvas = document.createElement("canvas");
      const rCtx = rotateCanvas.getContext("2d");
      if (!rCtx) {
        resolve(src);
        return;
      }

      const rotate = filters.rotate || 0;
      const isRotated90or270 = rotate === 90 || rotate === 270;
      const rWidth = isRotated90or270 ? img.height : img.width;
      const rHeight = isRotated90or270 ? img.width : img.height;

      rotateCanvas.width = rWidth;
      rotateCanvas.height = rHeight;

      rCtx.translate(rotateCanvas.width / 2, rotateCanvas.height / 2);
      rCtx.rotate((rotate * Math.PI) / 180);
      rCtx.drawImage(img, -img.width / 2, -img.height / 2);
      rCtx.setTransform(1, 0, 0, 1, 0, 0); // Reset transform

      const sourceWidth = rotateCanvas.width;
      const sourceHeight = rotateCanvas.height;

      // 2. Define crop bounds (0 to 100 percent of source size)
      const cropTop = filters.cropTop !== undefined ? filters.cropTop : 0;
      const cropLeft = filters.cropLeft !== undefined ? filters.cropLeft : 0;
      const cropWidth = filters.cropWidth !== undefined ? filters.cropWidth : 100;
      const cropHeight = filters.cropHeight !== undefined ? filters.cropHeight : 100;

      const sx = (cropLeft / 100) * sourceWidth;
      const sy = (cropTop / 100) * sourceHeight;
      const sw = (cropWidth / 100) * sourceWidth;
      const sh = (cropHeight / 100) * sourceHeight;

      // 3. Create target canvas with exact DUI standard ratio (85.6 x 53.98)
      // We use 1200 x 756 pixels for high resolution output
      const targetCanvas = document.createElement("canvas");
      const ctx = targetCanvas.getContext("2d");
      if (!ctx) {
        resolve(src);
        return;
      }

      targetCanvas.width = 1200;
      targetCanvas.height = 756;

      // Emulate object-cover behavior of cropped region on the standard DUI canvas
      const scale = Math.max(targetCanvas.width / sw, targetCanvas.height / sh);
      const drawWidth = sw * scale;
      const drawHeight = sh * scale;

      const dx = (targetCanvas.width - drawWidth) / 2;
      const dy = (targetCanvas.height - drawHeight) / 2;

      // Shift vertically while keeping image inside the target frame bounds (no blank background leaks)
      const shiftY = filters.shiftY !== undefined ? filters.shiftY : 0;
      const maxVerticalOffset = Math.max(0, (drawHeight - targetCanvas.height) / 2);
      // shiftY ranges from -100 to 100 (shifting up or down)
      const verticalOffset = (shiftY / 100) * maxVerticalOffset;
      const finalDy = dy + verticalOffset;

      // Shift horizontally while keeping image inside target frame bounds
      const shiftX = filters.shiftX !== undefined ? filters.shiftX : 0;
      const maxHorizontalOffset = Math.max(0, (drawWidth - targetCanvas.width) / 2);
      const horizontalOffset = (shiftX / 100) * maxHorizontalOffset;
      const finalDx = dx + horizontalOffset;

      // Clear with solid white background (in case of tiny edge math, but shouldn't leak)
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, targetCanvas.width, targetCanvas.height);

      // Draw cropped and aligned image onto standard landscape layout
      ctx.drawImage(
        rotateCanvas,
        sx, sy, sw, sh,
        finalDx, finalDy, drawWidth, drawHeight
      );

      // 4. Apply visual filtering (brightness, contrast, grayscale, binarization)
      try {
        const imgData = ctx.getImageData(0, 0, targetCanvas.width, targetCanvas.height);
        const data = imgData.data;

        // Brightness
        const b = (filters.brightness / 100) * 255;
        // Contrast
        const c = filters.contrast;
        const contrastFactor = (259 * (c + 255)) / (255 * (259 - c));

        for (let i = 0; i < data.length; i += 4) {
          let r = data[i];
          let g = data[i + 1];
          let b_val = data[i + 2];

          // Brightness
          if (b !== 0) {
            r += b;
            g += b;
            b_val += b;
          }

          // Contrast
          if (c !== 0) {
            r = contrastFactor * (r - 128) + 128;
            g = contrastFactor * (g - 128) + 128;
            b_val = contrastFactor * (b_val - 128) + 128;
          }

          // Grayscale / Binarize
          if (filters.grayscale || filters.binarize) {
            const gray = 0.299 * r + 0.587 * g + 0.114 * b_val;
            
            if (filters.binarize) {
              const threshold = filters.binarizeThreshold !== undefined ? filters.binarizeThreshold : 128;
              const binaryVal = gray >= threshold ? 255 : 0;
              // Soft binarization: blend 58% pure black & white with 42% grayscale 
              // to keep edge anti-aliasing and prevent photo faces from becoming completely dark or flat.
              const blend = 0.58;
              const val = binaryVal * blend + gray * (1 - blend);
              r = val;
              g = val;
              b_val = val;
            } else {
              r = gray;
              g = gray;
              b_val = gray;
            }
          }

          // Clamp RGB channels
          data[i] = Math.max(0, Math.min(255, r));
          data[i + 1] = Math.max(0, Math.min(255, g));
          data[i + 2] = Math.max(0, Math.min(255, b_val));
        }

        ctx.putImageData(imgData, 0, 0);
      } catch (err) {
        console.error("Filtros de canvas fallaron:", err);
      }

      resolve(targetCanvas.toDataURL("image/jpeg", 0.9));
    };
    img.onerror = (e) => reject(e);
    img.src = src;
  });
}

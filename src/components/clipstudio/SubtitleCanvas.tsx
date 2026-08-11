import { useEffect, useRef, type RefObject } from 'react';
import type { WordTimestamp } from '@/types';
import { DEFAULT_SUBTITLE_STYLE, type SubtitleStyle } from '@/types/clipstudio';

interface SubtitleCanvasProps {
  videoRef: RefObject<HTMLVideoElement>;
  words: WordTimestamp[];
  wordsPerLine?: number;
  style?: SubtitleStyle;
}

function verticalPositionY(position: SubtitleStyle['position'], height: number, fontSize: number): number {
  switch (position) {
    case 'top':
      return fontSize * 1.8;
    case 'middle':
      return height / 2;
    case 'bottom':
    default:
      return height - fontSize * 1.8;
  }
}

/**
 * Renderiza subtitulos dinamicos estilo CapCut sobre un <canvas> superpuesto
 * al video, resaltando la palabra activa segun el tiempo de reproduccion.
 */
export function SubtitleCanvas({ videoRef, words, wordsPerLine = 4, style = DEFAULT_SUBTITLE_STYLE }: SubtitleCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let frameId: number;

    const resize = () => {
      canvas.width = video.clientWidth;
      canvas.height = video.clientHeight;
    };

    const draw = () => {
      resize();
      const { width, height } = canvas;
      ctx.clearRect(0, 0, width, height);

      const t = video.currentTime;
      const activeIndex = words.findIndex((w) => t >= w.start && t <= w.end);

      if (activeIndex !== -1) {
        const lineStart = Math.floor(activeIndex / wordsPerLine) * wordsPerLine;
        const lineWords = words.slice(lineStart, lineStart + wordsPerLine);

        const fontSize = Math.max(16, Math.round(width * 0.055));
        ctx.font = `800 ${fontSize}px ${style.fontFamily}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        const y = verticalPositionY(style.position, height, fontSize);
        const totalWidth = lineWords.reduce((sum, w) => sum + ctx.measureText(w.word + ' ').width, 0);
        let x = width / 2 - totalWidth / 2;

        lineWords.forEach((w, i) => {
          const wordWidth = ctx.measureText(w.word + ' ').width;
          const globalIndex = lineStart + i;
          const isActive = globalIndex === activeIndex;

          ctx.lineWidth = fontSize * 0.14;
          ctx.strokeStyle = 'rgba(2, 6, 23, 0.85)';
          ctx.fillStyle = isActive ? style.highlightColor : '#f8fafc';

          const centerX = x + wordWidth / 2;
          ctx.strokeText(w.word, centerX, y);
          ctx.fillText(w.word, centerX, y);

          x += wordWidth;
        });
      }

      frameId = requestAnimationFrame(draw);
    };

    frameId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frameId);
  }, [videoRef, words, wordsPerLine, style]);

  return <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full" />;
}

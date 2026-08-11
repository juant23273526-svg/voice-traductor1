import { useEffect, useRef } from 'react';

interface WaveformVisualizerProps {
  volume: number;
  active: boolean;
  barColor?: string;
  className?: string;
}

const BAR_COUNT = 28;

/**
 * Visualizador de ondas estilo nota de voz de WhatsApp.
 * Dibuja barras en <canvas> reaccionando al volumen del microfono en tiempo real.
 */
export function WaveformVisualizer({
  volume,
  active,
  barColor = '#6366f1',
  className,
}: WaveformVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const historyRef = useRef<number[]>(new Array(BAR_COUNT).fill(0.05));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let frameId: number;

    const draw = () => {
      const history = historyRef.current;
      const target = active ? Math.max(0.08, Math.min(1, volume * 1.6)) : 0.05;
      history.push(target + (Math.random() - 0.5) * 0.05);
      history.shift();

      const { width, height } = canvas;
      ctx.clearRect(0, 0, width, height);

      const barWidth = width / BAR_COUNT;
      history.forEach((level, i) => {
        const barHeight = Math.max(3, level * height);
        const x = i * barWidth;
        const y = (height - barHeight) / 2;
        ctx.fillStyle = barColor;
        ctx.globalAlpha = active ? 1 : 0.35;
        const radius = Math.min(barWidth * 0.35, 3);
        roundRect(ctx, x + barWidth * 0.2, y, barWidth * 0.6, barHeight, radius);
        ctx.fill();
      });

      frameId = requestAnimationFrame(draw);
    };

    frameId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frameId);
  }, [volume, active, barColor]);

  return <canvas ref={canvasRef} width={280} height={64} className={className} />;
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + width, y, x + width, y + height, radius);
  ctx.arcTo(x + width, y + height, x, y + height, radius);
  ctx.arcTo(x, y + height, x, y, radius);
  ctx.arcTo(x, y, x + width, y, radius);
  ctx.closePath();
}

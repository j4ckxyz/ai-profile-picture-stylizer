import React, { useEffect, useMemo, useRef, useState } from 'react';

interface Point { x: number; y: number }
interface Stroke {
  id: string;
  points: Point[];
  color: string;
  width: number;
  note: string;
}

interface CropRect { x: number; y: number; w: number; h: number }

interface ImageEditorModalProps {
  imageSrc: string;
  onClose: () => void;
  onApply: (dataUrl: string) => void;
}

const defaultColor = '#ff3b3b';

export const ImageEditorModal: React.FC<ImageEditorModalProps> = ({ imageSrc, onClose, onApply }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const overlayRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);

  const [mode, setMode] = useState<'draw' | 'crop'>('draw');
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [activeStroke, setActiveStroke] = useState<Stroke | null>(null);
  const [brushSize, setBrushSize] = useState<number>(6);
  const [brushColor, setBrushColor] = useState<string>(defaultColor);
  const [crop, setCrop] = useState<CropRect | null>(null);
  const [draggingCrop, setDraggingCrop] = useState<boolean>(false);
  const [startDrag, setStartDrag] = useState<Point | null>(null);

  const [renderSize, setRenderSize] = useState<{ w: number; h: number }>({ w: 512, h: 512 });

  // Load image
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      imgRef.current = img;
      // Fit image into container max 720px square, preserving aspect
      const maxSide = 720;
      const ratio = Math.min(maxSide / img.width, maxSide / img.height, 1);
      setRenderSize({ w: Math.round(img.width * ratio), h: Math.round(img.height * ratio) });
      drawBase();
    };
    img.src = imageSrc;
  }, [imageSrc]);

  // Redraw when strokes or crop change
  useEffect(() => {
    drawBase();
  }, [strokes, crop, renderSize.w, renderSize.h]);

  const scale = useMemo(() => {
    const iw = imgRef.current?.width || 1;
    const ih = imgRef.current?.height || 1;
    return { sx: renderSize.w / iw, sy: renderSize.h / ih };
  }, [renderSize.w, renderSize.h]);

  const invScale = useMemo(() => {
    return { ix: 1 / (scale.sx || 1), iy: 1 / (scale.sy || 1) };
  }, [scale]);

  const toCanvasPoint = (e: React.MouseEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    // Store in canvas coordinates (display space)
    return { x, y };
  };

  const drawBase = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx || !imgRef.current) return;
    canvas.width = renderSize.w;
    canvas.height = renderSize.h;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(imgRef.current, 0, 0, canvas.width, canvas.height);

    // Draw strokes
    for (const s of strokes) {
      if (s.points.length < 2) continue;
      ctx.strokeStyle = s.color;
      ctx.lineWidth = s.width;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(s.points[0].x, s.points[0].y);
      for (let i = 1; i < s.points.length; i++) {
        ctx.lineTo(s.points[i].x, s.points[i].y);
      }
      ctx.stroke();
      // Label near first point
      if (s.note.trim()) {
        ctx.font = '14px ui-sans-serif, system-ui, -apple-system';
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = 'rgba(0,0,0,0.6)';
        ctx.lineWidth = 3;
        ctx.strokeText(s.note, s.points[0].x + 8, s.points[0].y + 8);
        ctx.fillText(s.note, s.points[0].x + 8, s.points[0].y + 8);
      }
    }

    // Draw crop overlay (as guide only)
    if (crop) {
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.clearRect(crop.x, crop.y, crop.w, crop.h);
      ctx.strokeStyle = '#60a5fa';
      ctx.lineWidth = 2;
      ctx.strokeRect(crop.x, crop.y, crop.w, crop.h);
      ctx.restore();
    }
  };

  const onMouseDown = (e: React.MouseEvent) => {
    if (mode === 'draw') {
      const p = toCanvasPoint(e);
      const stroke: Stroke = {
        id: Math.random().toString(36).slice(2),
        points: [p],
        color: brushColor,
        width: brushSize,
        note: '',
      };
      setActiveStroke(stroke);
    } else if (mode === 'crop') {
      const p = toCanvasPoint(e);
      setDraggingCrop(true);
      setStartDrag(p);
      setCrop({ x: p.x, y: p.y, w: 1, h: 1 });
    }
  };

  const onMouseMove = (e: React.MouseEvent) => {
    if (mode === 'draw' && activeStroke) {
      const p = toCanvasPoint(e);
      setActiveStroke({ ...activeStroke, points: [...activeStroke.points, p] });
    } else if (mode === 'crop' && draggingCrop && startDrag) {
      const p = toCanvasPoint(e);
      const x = Math.min(startDrag.x, p.x);
      const y = Math.min(startDrag.y, p.y);
      const w = Math.abs(p.x - startDrag.x);
      const h = Math.abs(p.y - startDrag.y);
      setCrop({ x, y, w, h });
    }
  };

  const onMouseUp = () => {
    if (mode === 'draw' && activeStroke) {
      // Add with empty note; user edits in side list
      setStrokes(prev => [...prev, activeStroke]);
      setActiveStroke(null);
    }
    if (mode === 'crop') {
      setDraggingCrop(false);
      setStartDrag(null);
    }
  };

  // Also draw active stroke live
  useEffect(() => {
    if (!activeStroke) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    drawBase();
    const ctx = canvas.getContext('2d');
    if (!ctx || activeStroke.points.length < 2) return;
    ctx.strokeStyle = activeStroke.color;
    ctx.lineWidth = activeStroke.width;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(activeStroke.points[0].x, activeStroke.points[0].y);
    for (let i = 1; i < activeStroke.points.length; i++) {
      ctx.lineTo(activeStroke.points[i].x, activeStroke.points[i].y);
    }
    ctx.stroke();
  }, [activeStroke]);

  const applyEdits = async () => {
    if (!imgRef.current) return;
    // Compose at original image resolution, apply crop if any, then scale notes accordingly
    const srcW = imgRef.current.width;
    const srcH = imgRef.current.height;
    const tmp = document.createElement('canvas');
    const tctx = tmp.getContext('2d')!;

    // Determine crop in source pixels
    let cropSrc: CropRect | null = null;
    if (crop) {
      cropSrc = {
        x: Math.max(0, Math.round(crop.x * invScale.ix)),
        y: Math.max(0, Math.round(crop.y * invScale.iy)),
        w: Math.max(1, Math.round(crop.w * invScale.ix)),
        h: Math.max(1, Math.round(crop.h * invScale.iy)),
      };
    }

    const outW = cropSrc ? cropSrc.w : srcW;
    const outH = cropSrc ? cropSrc.h : srcH;
    tmp.width = outW;
    tmp.height = outH;

    if (cropSrc) {
      tctx.drawImage(
        imgRef.current,
        cropSrc.x,
        cropSrc.y,
        cropSrc.w,
        cropSrc.h,
        0,
        0,
        outW,
        outH
      );
    } else {
      tctx.drawImage(imgRef.current, 0, 0, outW, outH);
    }

    // Draw strokes and text scaled to output
    const scaleToOut = {
      x: (val: number) => {
        const offset = crop ? crop.x : 0;
        return Math.round((val - offset) * invScale.ix);
      },
      y: (val: number) => {
        const offset = crop ? crop.y : 0;
        return Math.round((val - offset) * invScale.iy);
      }
    };

    for (const s of strokes) {
      if (s.points.length < 2) continue;
      tctx.strokeStyle = s.color;
      tctx.lineWidth = Math.max(1, Math.round(s.width * invScale.ix));
      tctx.lineJoin = 'round';
      tctx.lineCap = 'round';
      tctx.beginPath();
      const p0 = s.points[0];
      tctx.moveTo(scaleToOut.x(p0.x), scaleToOut.y(p0.y));
      for (let i = 1; i < s.points.length; i++) {
        const p = s.points[i];
        tctx.lineTo(scaleToOut.x(p.x), scaleToOut.y(p.y));
      }
      tctx.stroke();
      if (s.note.trim()) {
        tctx.font = `${Math.max(12, Math.round(14 * invScale.ix))}px ui-sans-serif, system-ui, -apple-system`;
        tctx.fillStyle = '#ffffff';
        tctx.strokeStyle = 'rgba(0,0,0,0.6)';
        tctx.lineWidth = 3;
        const base = s.points[0];
        const tx = scaleToOut.x(base.x) + 8;
        const ty = scaleToOut.y(base.y) + 8;
        tctx.strokeText(s.note, tx, ty);
        tctx.fillText(s.note, tx, ty);
      }
    }

    const url = tmp.toDataURL('image/png');
    onApply(url);
  };

  const resetCrop = () => setCrop(null);
  const clearStrokes = () => setStrokes([]);

  const updateNote = (id: string, note: string) => {
    setStrokes(prev => prev.map(s => (s.id === id ? { ...s, note } : s)));
  };
  const deleteStroke = (id: string) => {
    setStrokes(prev => prev.filter(s => s.id !== id));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full max-w-6xl bg-white/10 backdrop-blur-2xl border border-white/15 rounded-2xl p-4 sm:p-6 shadow-2xl">
        <div className="flex items-start gap-4">
          <div className="flex-1">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <button
                  className={`px-3 py-1.5 rounded-lg text-sm ${mode === 'draw' ? 'bg-indigo-600' : 'bg-white/10 border border-white/10'}`}
                  onClick={() => setMode('draw')}
                >Draw</button>
                <button
                  className={`px-3 py-1.5 rounded-lg text-sm ${mode === 'crop' ? 'bg-indigo-600' : 'bg-white/10 border border-white/10'}`}
                  onClick={() => setMode('crop')}
                >Crop</button>
                {mode === 'draw' && (
                  <div className="ml-3 flex items-center gap-2">
                    <label className="text-xs text-gray-300">Brush</label>
                    <input type="range" min={2} max={24} value={brushSize} onChange={e => setBrushSize(parseInt(e.target.value))} />
                    <input type="color" value={brushColor} onChange={e => setBrushColor(e.target.value)} className="w-6 h-6 rounded" />
                    <button className="px-2 py-1 text-xs bg-white/10 rounded border border-white/10" onClick={clearStrokes}>Clear Annotations</button>
                  </div>
                )}
                {mode === 'crop' && (
                  <div className="ml-3">
                    <button className="px-2 py-1 text-xs bg-white/10 rounded border border-white/10" onClick={resetCrop}>Reset Crop</button>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button className="px-3 py-1.5 rounded-lg bg-white/10 border border-white/10" onClick={onClose}>Cancel</button>
                <button className="px-3 py-1.5 rounded-lg bg-green-600" onClick={applyEdits}>Apply</button>
              </div>
            </div>

            <div ref={containerRef} className="relative w-full overflow-auto bg-black/30 rounded-xl border border-white/10" style={{ maxHeight: '75vh' }}>
              <canvas
                ref={canvasRef}
                width={renderSize.w}
                height={renderSize.h}
                className="block mx-auto touch-none cursor-crosshair"
                onMouseDown={onMouseDown}
                onMouseMove={onMouseMove}
                onMouseUp={onMouseUp}
                onMouseLeave={onMouseUp}
              />
            </div>
          </div>

          <div className="w-full sm:w-80 flex-shrink-0">
            <h3 className="text-sm font-semibold mb-2">Region Notes</h3>
            <p className="text-xs text-gray-400 mb-3">Draw on the image to mark a region, then type what you want changed there. Add multiple notes.</p>
            <div className="space-y-3 max-h-[60vh] overflow-auto pr-1">
              {strokes.length === 0 && (
                <div className="text-xs text-gray-400 bg-white/5 border border-white/10 rounded p-3">No annotations yet.</div>
              )}
              {strokes.map((s, idx) => (
                <div key={s.id} className="bg-white/5 border border-white/10 rounded-lg p-2">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-gray-300">Region {idx + 1}</span>
                    <button className="text-xs text-red-300 hover:text-red-200" onClick={() => deleteStroke(s.id)}>Remove</button>
                  </div>
                  <textarea
                    className="w-full bg-black/30 border border-white/10 rounded p-2 text-sm"
                    placeholder="e.g., brighten eyes, smooth skin..."
                    value={s.note}
                    onChange={e => updateNote(s.id, e.target.value)}
                    rows={3}
                  />
                  <div className="flex items-center gap-2 mt-2">
                    <span className="w-4 h-4 rounded" style={{ backgroundColor: s.color }} />
                    <span className="text-[11px] text-gray-400">Brush {s.width}px</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ImageEditorModal;


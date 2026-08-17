export function buildDynamicCropFilter(tracks, inputWidth, inputHeight, outputWidth = 1080, outputHeight = 1920) {
  const cropWidth = Math.max(2, Math.floor(inputHeight * outputWidth / outputHeight));
  const maxX = Math.max(0, inputWidth - cropWidth);
  if (!Array.isArray(tracks) || !tracks.length || !inputWidth || !inputHeight) {
    return `crop=${cropWidth}:${inputHeight}:(iw-${cropWidth})/2:0`;
  }
  const points = tracks
    .filter((p) => Number.isFinite(p.time) && Number.isFinite(p.x))
    .map((p) => ({ t: Math.max(0, p.time), x: Math.min(1, Math.max(0, p.x)) }));
  if (!points.length) return `crop=${cropWidth}:${inputHeight}:(iw-${cropWidth})/2:0`;
  const initial = Math.round(points[0].x * inputWidth - cropWidth / 2);
  const start = Math.min(maxX, Math.max(0, initial));
  const expr = points.reduce((acc, p, i) => {
    const x = Math.min(maxX, Math.max(0, Math.round(p.x * inputWidth - cropWidth / 2)));
    return i === 0 ? `${x}` : `if(gte(t\,${p.t.toFixed(3)})\,${x}\,${acc})`;
  }, String(start));
  return `crop=${cropWidth}:${inputHeight}:min(max(0\,${expr})\,iw-${cropWidth})`:;
}

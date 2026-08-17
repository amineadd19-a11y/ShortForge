export function buildDynamicCropFilter(tracks, inputWidth, inputHeight, outputWidth = 1080, outputHeight = 1920) {
  const cropWidth = Math.max(2, Math.floor(inputHeight * outputWidth / outputHeight));
  const maxX = Math.max(0, inputWidth - cropWidth);
  const fallback = `crop=${cropWidth}:${inputHeight}:(iw-${cropWidth})/2:0`;
  if (!Array.isArray(tracks) || !tracks.length || !inputWidth || !inputHeight) return fallback;

  const points = tracks
    .filter((p) => Number.isFinite(p.time) && Number.isFinite(p.x))
    .sort((a, b) => a.time - b.time)
    .map((p) => ({
      t: Math.max(0, p.time),
      x: Math.min(maxX, Math.max(0, Math.round(p.x * inputWidth - cropWidth / 2)))
    }));
  if (!points.length) return fallback;

  const smooth = (a, b, t0, t1) => {
    const span = Math.max(0.001, t1 - t0);
    const u = `clip((t-${t0.toFixed(3)})/${span.toFixed(3)},0,1)`;
    const eased = `(${u}*${u}*(3-2*${u}))`;
    return `(${a}+(${b}-${a})*${eased})`;
  };

  let expr = String(points[points.length - 1].x);
  for (let i = points.length - 2; i >= 0; i--) {
    expr = `if(lt(t,${points[i + 1].t.toFixed(3)}),${smooth(points[i].x, points[i + 1].x, points[i].t, points[i + 1].t)},${expr})`;
  }
  expr = `if(lt(t,${points[0].t.toFixed(3)}),${points[0].x},${expr})`;
  return `crop=${cropWidth}:${inputHeight}:min(max(0,${expr}),iw-${cropWidth}):0`;
}

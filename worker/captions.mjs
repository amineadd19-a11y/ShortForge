export function buildCaptionFilter(words = []) {
  if (!Array.isArray(words) || words.length === 0) return null;
  const lines = words.map((word) => String(word.text ?? '').replace(/[\\:'\n]/g, ' ').trim()).filter(Boolean);
  if (!lines.length) return null;
  const text = lines.join(' ').replace(/'/g, "\\'");
  return `drawtext=text='${text}':x=(w-text_w)/2:y=h*0.68:fontsize=58:fontcolor=white:borderw=4:bordercolor=black`;
}

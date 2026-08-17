import type { RenderPlan } from './plan';

export type FfmpegSpec = {
  inputArgs: string[];
  filterComplex: string;
  outputArgs: string[];
};

/** Produces a deterministic FFmpeg command specification for a worker.
 * Execution intentionally stays outside the Next.js request process.
 */
export function buildFfmpegSpec(plan: RenderPlan): FfmpegSpec {
  const duration = Math.max(0.1, plan.maxDurationSeconds);
  const crop = 'crop=ih*9/16:ih:(iw-ih*9/16)/2:0';

  return {
    inputArgs: ['-ss', 'START', '-i', 'INPUT'],
    filterComplex: `[0:v]${crop},scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2,setsar=1[v]`,
    outputArgs: ['-map', '[v]', '-map', '0:a?', '-t', String(duration), '-r', '30', '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-c:a', 'aac', '-movflags', '+faststart', 'OUTPUT.mp4'],
  };
}

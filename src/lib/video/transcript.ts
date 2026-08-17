export type TranscriptSegment = { start: number; end: number; text: string };

export interface TranscriptProvider {
  getTranscript(videoId: string): Promise<TranscriptSegment[]>;
}

export class MissingTranscriptProvider implements TranscriptProvider {
  async getTranscript(_videoId: string): Promise<TranscriptSegment[]> {
    throw new Error('TRANSCRIPT_PROVIDER is not configured. No transcript was fabricated.');
  }
}

export function createTranscriptProvider(): TranscriptProvider {
  return new MissingTranscriptProvider();
}

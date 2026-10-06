/* Types for the shared citation streamer (citation-stream.js), which is a
   byte-for-byte copy of frontend/citation_stream.js kept in sync by
   scripts/sync-shared.mjs and checked by tests/test_web.py. */
declare const citationStream: {
  createStreamer(): {
    push(chunk: string): unknown[];
    finish(): unknown[];
    hasOpenBlock(): boolean;
    state(): string;
  };
  unescapeMarkers(text: string): string;
  OPEN_MARKER: string;
  CLOSE_MARKER: string;
};
export default citationStream;

/**
 * Side-by-side packing for overlapping timed entries (5.4: "nothing is ever
 * hidden behind something else"). Pure geometry — the hour grid positions
 * each span at `lane / lanes` of its column width. Ready for timed events
 * (Phase 6); until then it packs whatever it's given.
 */
export interface SpanBox {
  id: string;
  /** Start/end in any consistent unit (minutes into the day, say). */
  start: number;
  end: number;
}

export interface PackedSpan extends SpanBox {
  /** 0-based column within the overlap cluster. */
  lane: number;
  /** Total columns in this span's cluster — the divisor for widths. */
  lanes: number;
}

/**
 * Greedy interval packing: sort by start, give each span the first free lane,
 * and size every cluster (a maximal run of transitively-overlapping spans) by
 * its own lane count. An inverted/zero-length span is treated as minimal
 * duration — rendered, never dropped (L5).
 */
export function packSpans(spans: ReadonlyArray<SpanBox>): PackedSpan[] {
  const sorted = spans
    .map((s) => ({ ...s, end: s.end > s.start ? s.end : s.start + 1 }))
    .sort((a, b) => a.start - b.start || a.end - b.end);

  const packed: PackedSpan[] = [];
  /** End position per lane, within the current cluster. */
  let laneEnds: number[] = [];
  let cluster: PackedSpan[] = [];

  const closeCluster = () => {
    for (const span of cluster) span.lanes = laneEnds.length;
    packed.push(...cluster);
    cluster = [];
    laneEnds = [];
  };

  for (const span of sorted) {
    // No overlap with any open lane ⇒ the previous cluster is complete.
    if (laneEnds.length > 0 && laneEnds.every((end) => end <= span.start)) closeCluster();

    let lane = laneEnds.findIndex((end) => end <= span.start);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(span.end);
    } else {
      laneEnds[lane] = span.end;
    }
    cluster.push({ ...span, lane, lanes: 0 });
  }
  closeCluster();
  return packed;
}

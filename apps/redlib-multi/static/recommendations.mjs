// RedSim packs a negative source marker, then destination IDs and ranks.
export function relatedSubreddits(labels, links, subreddits, limit = 8) {
  const existing = new Set(subreddits);
  const sources = new Set();
  labels.forEach((label, index) => {
    if (existing.has(label.toLowerCase())) sources.add(index);
  });
  const scores = new Map();
  function add(index, rank) {
    const name = labels[index]?.toLowerCase();
    if (!name || existing.has(name) || !/^[a-z0-9_]{2,21}$/.test(name)) return;
    scores.set(name, (scores.get(name) || 0) + 1 / (rank + 1));
  }
  let source = -1;
  for (const value of links) {
    if (value < 0) source = -value - 1;
    else {
      const destination = (value >>> 8) - 1;
      const rank = value & 255;
      if (sources.has(source)) add(destination, rank);
      if (sources.has(destination)) add(source, rank);
    }
  }
  return [...scores]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([name]) => name);
}

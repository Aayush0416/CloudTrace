# Algorithm benchmark

Synthetic layered graphs (5 forward edges per node, random confidence), source n0 to the last node. Node v22.22.2, single run.

| Nodes | Edges | Build adjacency (ms) | BFS (ms) | Dijkstra (ms) | Yen K=5 (ms) |
|---:|---:|---:|---:|---:|---:|
| 1000 | 4995 | 19.5 | 1.3 | 8.8 | 154.3 |
| 5000 | 24995 | 79.1 | 6.5 | 11.1 | 3033.6 |
| 10000 | 49995 | 138.5 | 13.9 | 36.4 | 16137.1 |

Dijkstra uses a binary heap: O((V + E) log V). Yen's runs up to K x path-length Dijkstra calls.
DFS path enumeration is exponential in the worst case, so CloudTrace bounds it (depth 8, 500 paths shared between entry points, 200,000 node expansions per entry point) and reports when it truncates.

Note: the Yen's column is slow on these synthetic graphs because their shortest routes are hundreds of hops long, and Yen's re-runs Dijkstra once per hop. Real cloud attack paths are short (CloudTrace bounds search depth at 8), so the practical cost is far lower. Dijkstra alone stays under 40 ms at 10,000 nodes.

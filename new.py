import sys, heapq
from collections import defaultdict

def main():
    lines = sys.stdin.read().split('\n')
    lines = [l.strip() for l in lines]
    # drop empty lines
    lines = [l for l in lines if l != '']
    n = int(lines[0])
    tree_lines = lines[1:1 + n]
    start, dest = map(int, lines[1 + n].split())

    trees = [[]]
    for l in tree_lines:
        if l.lower() == 'break':
            trees.append([])
        else:
            trees[-1].append(list(map(int, l.split())))
    if not trees[-1]:
        trees.pop()

    adj = defaultdict(list)          # (node, tree) -> [(node, tree, cost)]
    where = defaultdict(set)         # node -> set of trees
    for t, tr in enumerate(trees):
        for row in tr:
            a = row[0]
            where[a].add(t)
            for b in row[1:]:
                where[b].add(t)
                adj[(a, t)].append(((b, t), 1))   # climb up
                adj[(b, t)].append(((a, t), 0))   # climb down

    dist = {}
    pq = []
    for t in where[start]:
        dist[(start, t)] = 0
        heapq.heappush(pq, (0, start, t))

    while pq:
        d, u, t = heapq.heappop(pq)
        if dist.get((u, t), float('inf')) < d:
            continue
        nxt = list(adj[(u, t)])
        for t2 in where[u]:
            if t2 != t:
                nxt.append(((u, t2), 1))          # switch trees
        for (v, t2), c in nxt:
            nd = d + c
            if nd < dist.get((v, t2), float('inf')):
                dist[(v, t2)] = nd
                heapq.heappush(pq, (nd, v, t2))

    ans = min((dist[(dest, t)] for t in where[dest] if (dest, t) in dist),
              default=-1)
    print(ans)

main()
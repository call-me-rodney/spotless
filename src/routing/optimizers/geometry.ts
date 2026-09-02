import type { Coordinates } from '../types/int.type';

const EARTH_RADIUS_METERS = 6_371_000;

const toRadians = (degrees: number): number => (degrees * Math.PI) / 180;

// Great-circle distance. Straight-line, so it ignores roads, rivers and
// one-way systems — good enough to rank candidates, not to promise an ETA.
export function haversineMeters(a: Coordinates, b: Coordinates): number {
    const dLat = toRadians(b.latitude - a.latitude);
    const dLon = toRadians(b.longitude - a.longitude);
    const lat1 = toRadians(a.latitude);
    const lat2 = toRadians(b.latitude);

    const h =
        Math.sin(dLat / 2) ** 2 +
        Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);

    return Math.round(2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(h)));
}

// Index 0 is the depot; 1..n are the stops. cost[i][j] is the cost of going
// from i to j, which lets the same solver run over haversine metres or over
// Google's road durations without caring which it was given.
export type CostMatrix = number[][];

export function buildHaversineMatrix(origin: Coordinates, stops: Coordinates[]): CostMatrix {
    const nodes = [origin, ...stops];
    return nodes.map((from) => nodes.map((to) => haversineMeters(from, to)));
}

// Nearest neighbour from the depot: repeatedly hop to the closest unvisited
// node. Fast and decent, but it can strand a far node until the end.
export function nearestNeighbourOrder(cost: CostMatrix): number[] {
    const count = cost.length - 1;
    const unvisited = new Set<number>();
    for (let i = 1; i <= count; i++) {
        unvisited.add(i);
    }

    const order: number[] = [];
    let current = 0;

    while (unvisited.size > 0) {
        let best = -1;
        let bestCost = Number.POSITIVE_INFINITY;
        for (const candidate of unvisited) {
            if (cost[current][candidate] < bestCost) {
                bestCost = cost[current][candidate];
                best = candidate;
            }
        }
        order.push(best);
        unvisited.delete(best);
        current = best;
    }

    return order;
}

// 2-opt: repeatedly reverse a segment where doing so shortens the tour. This
// is what removes the crossed-over legs nearest neighbour leaves behind.
export function twoOptImprove(order: number[], cost: CostMatrix): number[] {
    if (order.length < 3) {
        return order;
    }

    const tour = [...order];
    let improved = true;
    let guard = 0;

    while (improved && guard < 50) {
        improved = false;
        guard++;

        for (let i = 0; i < tour.length - 1; i++) {
            for (let k = i + 1; k < tour.length; k++) {
                const beforeI = i === 0 ? 0 : tour[i - 1];
                const afterK = k === tour.length - 1 ? null : tour[k + 1];

                const current =
                    cost[beforeI][tour[i]] + (afterK === null ? 0 : cost[tour[k]][afterK]);
                const swapped =
                    cost[beforeI][tour[k]] + (afterK === null ? 0 : cost[tour[i]][afterK]);

                if (swapped < current) {
                    const segment = tour.slice(i, k + 1).reverse();
                    tour.splice(i, segment.length, ...segment);
                    improved = true;
                }
            }
        }
    }

    return tour;
}

// Total cost of a tour that starts at the depot and does not return to it.
export function tourCost(order: number[], cost: CostMatrix): number {
    let total = 0;
    let previous = 0;
    for (const node of order) {
        total += cost[previous][node];
        previous = node;
    }
    return total;
}

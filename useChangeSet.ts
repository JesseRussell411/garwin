import { useRef } from "react";

/**
 * Updates the output array of items when the input changes as a set (contains new items or is missing old ones, disregarding order and quantity).
 */
export default function useChangeAsSet(
    items: any[],
    { detectInPlaceChanges = false }: { detectInPlaceChanges?: boolean } = {}
) {
    const currentItems = useRef(items);

    if (!equalAsSets(items, currentItems.current)) {
        if (detectInPlaceChanges) {
            currentItems.current = [...items];
        } else {
            currentItems.current = items;
        }
    }

    return currentItems;
}

/** Whether the two iterables contain the same items, disregarding order and quantity. */
function equalAsSets<T>(a: Iterable<T>, b: Iterable<T>): boolean {
    if (a === b) return true; // same instance. must be equal
    // TODO yeah, this is probably not the most optimal way of doing this. But pre-optimization is the root of all evil so that's why I'm not fixing it now.
    const aSet = a instanceof Set ? a : new Set(a);
    const bSet = b instanceof Set ? b : new Set(b);

    // a contains all of b's items
    for (const item of bSet) {
        if (!aSet.has(item)) return false;
    }

    // b contains all of a's items
    for (const item of aSet) {
        if (!bSet.has(item)) return false;
    }

    return true;
}

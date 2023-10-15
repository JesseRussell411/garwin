import { returns } from "../functional/functions";
import {
    Comparator,
    Order,
    asComparator,
    autoComparator,
    cmpGE,
    cmpGT,
    cmpLE,
    cmpLT,
    cmpNQ,
    reverseComparator,
} from "../sorting";
import MapEntry from "../types/MapEntry";
import Collection from "./Collection";

// TODO? red-black tree, this is an avl tree because avl trees are easy
// TODO? get rid of backlink (node.map)
// design note: If they ever add a sorted map to the ecmascript standard,
// I will be very happy to switch to that and make this a deprecated wrapper around it,
// or even a child class of it.

// I'm sure whatever the V8 team can put together in C would be much more efficient than my undergrad level, intro to data structures avl tree.

export interface SortedMapEntry<K, V> extends MapEntry<K, V> {
    readonly key: K;
    readonly value: V;
}

class Node<K, V> extends Array<K | V> implements SortedMapEntry<K, V> {
    public [0]: K;
    public [1]: V;
    public sortedMap?: SortedMap<K, V>;
    public depth: number;
    public nodeCount: number;
    public balanceFactor: number;
    private _left?: Node<K, V>;
    private _right?: Node<K, V>;

    public get key(): K {
        return this[0];
    }
    public set key(value: K) {
        this[0] = value;
    }

    public get value(): V {
        return this[1];
    }
    public set value(value: V) {
        this[1] = value;
    }

    public get left(): Node<K, V> | undefined {
        return this._left;
    }
    public set left(value: Node<K, V> | undefined) {
        // TODO do some benchmarks and find out if this actually helps memory usage
        if (value === undefined) {
            delete this._left;
        } else {
            this._left = value;
        }
    }

    public get right(): Node<K, V> | undefined {
        return this._right;
    }
    public set right(value: Node<K, V> | undefined) {
        if (value === undefined) {
            delete this._right;
        } else {
            this._right = value;
        }
    }

    public constructor(
        key: K,
        value: V,
        sortedMap: SortedMap<K, V>,
        left?: Node<K, V>,
        right?: Node<K, V>
    ) {
        super(2);
        this[0] = key;
        this[1] = value;
        this.sortedMap = sortedMap;
        this.left = left;
        this.right = right;

        this.depth = this.calcDepth();
        this.nodeCount = this.calcNodeCount();
        this.balanceFactor = this.calcBalanceFactor();
    }

    public *[Symbol.iterator]() {
        yield this.key;
        yield this.value;
    }

    public update() {
        this.depth = this.calcDepth();
        this.nodeCount = this.calcNodeCount();
        this.balanceFactor = this.calcBalanceFactor();
    }

    private calcDepth(): number {
        return Math.max(this.left?.depth ?? 0, this.right?.depth ?? 0) + 1;
    }
    private calcNodeCount(): number {
        return (this.left?.nodeCount ?? 0) + (this.right?.nodeCount ?? 0) + 1;
    }
    private calcBalanceFactor(): number {
        return (this.right?.depth ?? 0) - (this.left?.depth ?? 0);
    }

    public updateBalanceFactor(): void {
        this.balanceFactor = this.calcBalanceFactor();
    }

    /**
     * Performs a left rotation. Assumes that {@link right} is not undefined.
     * @returns The node to replace this one with.
     * @throws If {@link right} is undefined.
     */
    public rotateLeft(): Node<K, V> {
        const right = this.right;
        this.right = right!.left;
        right!.left = this;
        right!.update();
        this.update();
        return right!;
    }

    /**
     * Performs a right rotation. Assumes that {@link left} is not undefined.
     * @returns The node to replace this one with.
     * @throws If {@link left} is undefined.
     */
    public rotateRight(): Node<K, V> {
        const left = this.left;
        this.left = left!.right;
        left!.right = this;
        left!.update();
        this.update();
        return left!;
    }

    /**
     * Balances the node.
     * @returns The node to replace this one with.
     */
    public balance(): Node<K, V> {
        if (this.balanceFactor < -1) {
            return this.rotateRight();
        } else if (this.balanceFactor > 1) {
            return this.rotateLeft();
        } else {
            return this;
        }
    }

    /**
     * Cuts all ties to the parent map.
     */
    public emancipate(): void {
        delete this.sortedMap;
        delete this.left;
        delete this.right;
    }
}

/**
 * A map that stores key-value pairs in the order specified.
 */
export default class SortedMap<K, V> extends Collection<SortedMapEntry<K, V>> {
    private root?: Node<K, V>;
    private comparator: Comparator<K>;

    /**
     * @param order How to sort the keys. Defaults to {@link autoComparator}.
     */
    public constructor(order: Order<K> = autoComparator) {
        super();
        this.comparator = asComparator(order);
    }

    public get size(): number {
        return this.root?.nodeCount ?? 0;
    }

    public [Symbol.iterator](): Iterator<SortedMapEntry<K, V>> {
        return this._iterator(this.root);
    }

    /**
     * @returns An {@link Iterable} over the entries in reverse order.
     */
    public reversed(): Iterable<SortedMapEntry<K, V>> {
        return {
            [Symbol.iterator]: () => this._iteratorReversed(this.root),
        };
    }

    private *_iterator(node: Node<K, V> | undefined): Generator<Node<K, V>> {
        if (node === undefined) return;
        yield* this._iterator(node.left);
        yield node;
        yield* this._iterator(node.right);
    }

    private *_iteratorReversed(
        node: Node<K, V> | undefined
    ): Generator<Node<K, V>> {
        if (node === undefined) return;
        yield* this._iteratorReversed(node.right);
        yield node;
        yield* this._iteratorReversed(node.left);
    }

    /**
     * @returns The entry with the given key or undefined if it could not be found.
     */
    public getEntry(key: K): SortedMapEntry<K, V> | undefined {
        return this.getNode(key);
    }

    /**
     * @returns The value mapped to the given key or undefined if it could not be found.
     */
    public get(key: K): V | undefined {
        return this.getEntry(key)?.value;
    }

    /**
     * @return The entry with the largest key or undefined if the map is empty.
     */
    public getLargestEntry(): SortedMapEntry<K, V> | undefined {
        return this.getLargestNode();
    }

    /**
     * @return The entry with the smallest key or undefined if the map is empty.
     */
    public getSmallestEntry(): SortedMapEntry<K, V> | undefined {
        return this.getSmallestNode();
    }

    /**
     * Sets the given key to be mapped to the given value.
     *
     * @param replace Whether to replace an existing mapping if it exists.
     *
     * @returns The entry containing the mapping.
     */
    public set(
        key: K,
        value: V,
        replace: boolean = true
    ): SortedMapEntry<K, V> {
        let computed = false;
        const node = this.getNodeOrCompute(key, () => {
            computed = true;
            return value;
        });

        if (!computed && replace) {
            node.key = key;
            node.value = value;
        }

        return node;
    }

    /**
     * Deletes the entry with the given key from the map.
     *
     * @param condition Optional condition. If provided: gets called once before deletion; entry is only deleted if this function returns true.
     *
     * @returns The entry that was delete or undefined if an entry with the given key could not be found.
     */
    public delete(
        key: K,
        condition?: (entry: SortedMapEntry<K, V>) => boolean
    ): SortedMapEntry<K, V> | undefined {
        return this.deleteNode(key, condition);
    }

    /**
     * Deletes the entry with the largest key from the map.
     *
     * @param condition Optional condition. If provided: gets called once before deletion; entry is only deleted if this function returns true.
     *
     * @returns The entry that was deleted or undefined if not entry was deleted.
     */
    public deleteLargest(
        condition?: (entry: SortedMapEntry<K, V>) => boolean
    ): SortedMapEntry<K, V> | undefined {
        return this.deleteLargestNode(condition);
    }

    /**
     * Deletes the entry with the smallest key from the map.
     *
     * @param condition Optional condition. If provided: gets called once before deletion; entry is only deleted if this function returns true.
     *
     * @returns The entry that was deleted or undefined if not entry was deleted.
     */
    public deleteSmallest(
        condition?: (entry: SortedMapEntry<K, V>) => boolean
    ): SortedMapEntry<K, V> | undefined {
        return this.deleteSmallestNode(condition);
    }

    /**
     * Replaces the key in the given entry with the given new key as long as two conditions are met: the entry belongs to this map; and the new key is equal to the entry's current key according to this map's {@link Order}.
     *
     * @returns Whether the key was replaced.
     */
    public reKey(entry: SortedMapEntry<K, V>, newKey: K): boolean {
        const node = entry as Node<K, V>;

        // does the entry belong to this map?
        if (node.sortedMap !== this) return false;
        // do the keys match?
        if (cmpNQ(this.comparator(newKey, node.key))) return false;

        // conditions are met
        node.key = newKey;
        return true;
    }

    /**
     * Replaces the value in the given entry with the given new value as long as the entry belongs to this map.
     *
     * @returns Whether the value was replaced.
     */
    public reValue(entry: SortedMapEntry<K, V>, newValue: V): boolean {
        const node = entry as Node<K, V>;

        // does the entry belong to this map?
        if (node.sortedMap !== this) return false;

        // conditions are met
        node.value = newValue;
        return true;
    }

    /**
     * Gets the entry with the given key or creates a new one using the value returned by the given function.
     *
     * @param compute Returns the value to be used if the entry isn't found. Is called once in that case.
     */
    public getEntryOrCompute(key: K, compute: () => V): SortedMapEntry<K, V> {
        return this.getNodeOrCompute(key, compute);
    }

    /**
     * Gets the value mapped to the given key or creates a new mapping to the value returned by the given function.
     *
     * @param compute Returns the value to be used if the key isn't found. Is called once in that case.
     */
    public getOrCompute(key: K, compute: () => V): V {
        return this.getNodeOrCompute(key, compute).value;
    }

    /**
     * @returns An {@link Iterable} over the entries between the given min and max values.
     *
     * @param min The minimum value or Parameters for minimum value. If undefined, the range will start at the entry with the smallest key (inclusive). If a function, whether the key is not too small.
     * @param max The maximum value or Parameters for maximum value. If undefined, the range will end at the entry with the largest key (inclusive). If a function, whether the key is not to big.
     */
    public getRange(
        min?:
            | [
                  /** The value to use as the min. */
                  key: K,
                  /** Whether the max value is inclusive or exclusive. Defaults to inclusive. */
                  type?: "inclusive" | "exclusive"
              ]
            | ((key: K) => boolean)
            | K,
        max?:
            | [
                  /** The value to use as the max. */
                  key: K,
                  /** Whether the min value is inclusive or exclusive. Defaults to inclusive. */
                  type?: "inclusive" | "exclusive"
              ]
            | ((key: K) => boolean)
            | K,
        {
            reversed = false,
        }: {
            /** Whether to iterate in reverse order. Defaults to false. */
            reversed?: boolean;
        } = {}
    ): Iterable<SortedMapEntry<K, V>> {
        const self = this;
        function* recur(node: Node<K, V> | undefined): Generator<Node<K, V>> {
            if (node === undefined) return;
            let tooBig = false;
            let tooSmall = false;

            if (min !== undefined) {
                if (min instanceof Function) {
                    if (!min(node.key)) tooSmall = true;
                } else if (Array.isArray(min)) {
                    const cmp = self.comparator(node.key, min[0]);
                    if ((min[1] === "exclusive" ? cmpLE : cmpLT)(cmp)) {
                        tooSmall = true;
                    }
                } else {
                    const cmp = self.comparator(node.key, min);
                    if (cmpLT(cmp)) tooSmall = true;
                }
            }

            if (max !== undefined) {
                if (max instanceof Function) {
                    if (!max(node.key)) tooBig = true;
                } else if (Array.isArray(max)) {
                    const cmp = self.comparator(node.key, max[0]);
                    if ((max[1] === "exclusive" ? cmpGE : cmpGT)(cmp)) {
                        tooBig = true;
                    }
                } else {
                    const cmp = self.comparator(node.key, max);
                    if (cmpGT(cmp)) tooBig = true;
                }
            }

            if (reversed) {
                if (!tooBig) yield* recur(node.right);
                if (!tooBig && !tooSmall) yield node;
                if (!tooSmall) yield* recur(node.left);
            } else {
                if (!tooSmall) yield* recur(node.left);
                if (!tooBig && !tooSmall) yield node;
                if (!tooBig) yield* recur(node.right);
            }
        }

        return {
            [Symbol.iterator]() {
                return recur(self.root);
            },
        };
    }

    /**
     * Deletes all entries from the map.
     */
    public clear() {
        this.emancipateAllNodes();
        this.root = undefined;
    }

    /**
     * Reverses the order of the map.
     */
    public reverse(): void {
        this.invert();
        this.comparator = reverseComparator(this.comparator);
    }

    public keys(): Iterable<K> {
        const self = this;
        return {
            *[Symbol.iterator]() {
                for (const entry of self) {
                    yield entry.key;
                }
            },
        };
    }

    public values(): Iterable<V> {
        const self = this;
        return {
            *[Symbol.iterator]() {
                for (const entry of self) {
                    yield entry.value;
                }
            },
        };
    }

    public entries(): Iterable<[key: K, value: V]> {
        const self = this;
        return {
            *[Symbol.iterator]() {
                for (const entry of self) {
                    yield [entry.key, entry.value];
                }
            },
        };
    }

    private emancipateAllNodes(): void {
        return this._emancipateAllNodes(this.root);
    }
    private _emancipateAllNodes(node: Node<K, V> | undefined): void {
        if (node === undefined) return;
        this._emancipateAllNodes(node.left);
        this._emancipateAllNodes(node.right);
        node.emancipate();
    }

    private invert(): void {
        return this._invert(this.root);
    }
    private _invert(node: Node<K, V> | undefined): void {
        if (node === undefined) return;

        const left = node.left;
        node.left = node.right;
        node.right = left;
        node.updateBalanceFactor();

        this._invert(node.left);
        this._invert(node.right);
    }

    private getNode(key: K): Node<K, V> | undefined {
        let current = this.root;
        while (current !== undefined) {
            const cmp = this.comparator(key, current.key);

            if (cmpLT(cmp)) {
                current = current.left;
            } else if (cmpGT(cmp)) {
                current = current?.right;
            } else {
                break;
            }
        }
        return current;
    }

    private getNodeOrCompute(key: K, compute: () => V): Node<K, V> {
        if (this.root === undefined) {
            const value = compute();
            this.root = new Node(key, value, this);
            return this.root;
        } else {
            let node: Node<K, V>;
            this.root = this._getNodeOrCompute(
                this.root,
                key,
                compute,
                (n) => (node = n)
            );
            return node!;
        }
    }

    private _getNodeOrCompute(
        node: Node<K, V> | undefined,
        key: K,
        compute: () => V,
        getNode: (node: Node<K, V>) => void
    ): Node<K, V> {
        if (node === undefined) {
            const node = new Node(key, compute(), this);
            getNode(node);
            return node;
        }

        const cmp = this.comparator(key, node.key);
        if (cmpLT(cmp)) {
            node.left = this._getNodeOrCompute(
                node.left,
                key,
                compute,
                getNode
            );
            node.update();
            return node.balance();
        } else if (cmpGT(cmp)) {
            node.right = this._getNodeOrCompute(
                node.right,
                key,
                compute,
                getNode
            );
            node.update();
            return node.balance();
        } else {
            getNode(node);
            return node;
        }
    }

    private getLargestNode(): Node<K, V> | undefined {
        let current = this.root;
        if (current === undefined) return undefined;
        while (current?.right !== undefined) {
            current = current.right;
        }
        return current;
    }

    private getSmallestNode(): Node<K, V> | undefined {
        let current = this.root;
        if (current === undefined) return undefined;
        while (current.left !== undefined) {
            current = current.left;
        }
        return current;
    }

    private deleteNode(
        key: K,
        condition: (node: Node<K, V>) => boolean = returns(true)
    ): Node<K, V> | undefined {
        let node = undefined as Node<K, V> | undefined;
        this.root = this._deleteNode(this.root, key, (n) => {
            if (condition(n)) {
                node = n;
                return true;
            } else {
                return false;
            }
        });
        return node;
    }

    private _deleteNode(
        node: Node<K, V> | undefined,
        key: K,
        condition: (node: Node<K, V>) => boolean
    ): Node<K, V> | undefined {
        if (node === undefined) return undefined;
        const cmp = this.comparator(key, node.key);
        if (cmpLT(cmp)) {
            node.left = this._deleteNode(node.left, key, condition);
            node.update();
            return node.balance();
        } else if (cmpGT(cmp)) {
            node.right = this._deleteNode(node.right, key, condition);
            node.update();
            return node.balance();
        } else {
            if (!condition(node)) return node;
            let successor = undefined as Node<K, V> | undefined;

            if (node.left !== undefined && node.right !== undefined) {
                node.right = this._deleteSmallestNode(node.right, (n) => {
                    successor = n;
                    return true;
                });
                successor!.right = node.right;
                successor!.left = node.left;
                successor!.update();
            } else if (node.right !== undefined) {
                successor = node.right;
            } else if (node.left !== undefined) {
                successor = node.left;
            }

            node.emancipate();

            return successor?.balance();
        }
    }

    private deleteLargestNode(
        condition: (node: Node<K, V>) => boolean = returns(true)
    ): Node<K, V> | undefined {
        let node = undefined as Node<K, V> | undefined;
        this.root = this._deleteLargestNode(this.root, (n) => {
            if (condition(n)) {
                node = n;
                return true;
            } else {
                return false;
            }
        });
        return node;
    }

    private _deleteLargestNode(
        node: Node<K, V> | undefined,
        condition: (node: Node<K, V>) => boolean
    ): Node<K, V> | undefined {
        if (node === undefined) return undefined;
        if (node.right !== undefined) {
            node.right = this._deleteLargestNode(node.right, condition);
            node.update();
            return node.balance();
        } else {
            if (!condition(node)) return node;
            const successor = node.left;
            node.emancipate();
            return successor;
        }
    }

    private deleteSmallestNode(
        condition: (node: Node<K, V>) => boolean = returns(true)
    ): Node<K, V> | undefined {
        let node = undefined as Node<K, V> | undefined;
        this.root = this._deleteSmallestNode(this.root, (n) => {
            if (condition(n)) {
                node = n;
                return true;
            } else {
                return false;
            }
        });
        return node;
    }

    private _deleteSmallestNode(
        node: Node<K, V> | undefined,
        condition: (node: Node<K, V>) => boolean
    ): Node<K, V> | undefined {
        if (node === undefined) return undefined;
        if (node.left !== undefined) {
            node.left = this._deleteSmallestNode(node.left, condition);
            node.update();
            return node.balance();
        } else {
            if (!condition(node)) return node;
            const successor = node.right;
            node.emancipate();
            return successor;
        }
    }
}

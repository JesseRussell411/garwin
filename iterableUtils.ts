export function defined<T>(iterable: Iterable<T>): Iterable<T & ({} | null)> {
    return {
        *[Symbol.iterator]() {
            for (const item of iterable) {
                if (item !== undefined) {
                    yield item;
                }
            }
        },
    };
}

export function notNull<T>(
    iterable: Iterable<T>
): Iterable<T & ({} | undefined)> {
    return {
        *[Symbol.iterator]() {
            for (const item of iterable) {
                if (item !== null) {
                    yield item;
                }
            }
        },
    };
}

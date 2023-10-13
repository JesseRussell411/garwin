import { MutableRefObject, useRef, useState } from "react";

/**
 * Version of {@link useRef} that triggers an update the first time current is set.
 */
export default function useInitRef<T>(initialValue: T): MutableRefObject<T>;

/**
 * Version of {@link useRef} that triggers an update the first time current is set.
 */
export default function useInitRef<T>(
    initialValue?: T
): MutableRefObject<T | undefined>;
export default function useInitRef<T>(
    initialValue?: T
): MutableRefObject<T | undefined> {
    const [initialized, setInitialized] = useState(false);
    const valueRef = useRef<T | undefined>(initialValue);

    const refObject = useRef({
        get current(): T | undefined {
            return valueRef.current;
        },
        set current(value: T | undefined) {
            valueRef.current = value;
            if (!initialized) {
                setInitialized(true);
            }
        },
    }).current;

    return refObject;
}

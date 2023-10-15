import { MutableRefObject, useRef, useState, ForwardedRef } from "react";

/**
 * Version of {@link useRef} that triggers an update the first time current is set.
 * @param shadowRefs Refs that will be given the same value as the initRef and that will be updated when the initRef's value changes.
 */
export default function useInitRef<T>(
    initialValue: T,
    ...shadowRefs: ForwardedRef<T>[]
): MutableRefObject<T>;

/**
 * Version of {@link useRef} that triggers an update the first time current is set.
 * @param shadowRefs Refs that will be given the same value as the initRef and that will be updated when the initRef's value changes.
 */
export default function useInitRef<T>(
    initialValue?: T,
    ...shadowRefs: ForwardedRef<T | undefined>[]
): MutableRefObject<T | undefined>;
export default function useInitRef<T>(
    initialValue?: T,
    ...shadowRefs: ForwardedRef<T | undefined>[]
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
            for (const shadowRef of shadowRefs ?? []) {
                if (shadowRef == null) continue;
                if (shadowRef instanceof Function) {
                    shadowRef(value);
                } else {
                    shadowRef.current = value;
                }
            }
        },
    }).current;

    return refObject;
}

import { useRef } from "react";

export default function useConst<T>(valueOrGetter: T | (() => T)): T {
    const valueRef = useRef<{ value: T }>();

    if (valueRef.current === undefined) {
        if (valueOrGetter instanceof Function) {
            valueRef.current = { value: valueOrGetter() };
        } else {
            valueRef.current = { value: valueOrGetter };
        }
    }

    return valueRef.current.value;
}

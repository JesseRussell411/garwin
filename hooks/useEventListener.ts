import { useEffect, useRef } from "react";
import { defined, notNull } from "../iterableUtils";

/**
 * Adds an event listener to the given target and automatically removes it.
 * @param target The target or a list of multiple targets.
 * @returns The target's {@link EventTarget.addEventListener} function.
 */
export default function useEventListener<
    Target extends EventTarget | null | undefined
>(
    target: Target | Target[],
    { enabled = true }: { enabled?: boolean } = {}
): (Target & {})["addEventListener"] {
    /** The currently added event listener, its type, and the targets its added to. */
    const addedListener = useRef<{
        listener: EventListenerOrEventListenerObject;
        type: string;
        targets: EventTarget[];
    }>();

    /** The current arguments. */
    const argsRef = useRef({ target, enabled });
    argsRef.current = { target, enabled };

    /** Removes the currently added listener from its target. */
    const removeListener = useRef(() => {
        if (addedListener.current === undefined) return;
        const { listener, type, targets } = addedListener.current;

        for (const target of targets) {
            target.removeEventListener(type, listener);
        }
        addedListener.current = undefined;
    }).current;

    /** Updates the currently added listener. */
    const addEventListener = useRef(
        (
            type: string,
            listener: EventListenerOrEventListenerObject,
            ...rest: any
        ) => {
            const { target, enabled } = argsRef.current;
            // remove currently added event listener
            removeListener();

            // then add it back on as long as enabled is raised and the target is defined
            if (enabled) {
                const targets = [
                    ...notNull(
                        defined(Array.isArray(target) ? target : [target])
                    ),
                ];

                targets.forEach((target) => {
                    target?.addEventListener(type, listener, ...rest);
                });
                // TODO add support for options somehow

                addedListener.current = { listener, type, targets };
            }
        }
    ).current;

    // return removeListener as a cleanup function so that the listener is removed when the component de-renders
    useEffect(() => removeListener, []);

    return addEventListener;
}

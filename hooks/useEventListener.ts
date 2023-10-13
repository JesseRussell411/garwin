import { useEffect, useRef } from "react";

/**
 * Adds an event listener to the given target and automatically removes it.
 * @returns The target's {@link EventTarget.addEventListener} function.
 */
export default function useEventListener<
    Target extends EventTarget | null | undefined
>(
    target: Target,
    { enabled = true }: { enabled?: boolean } = {}
): (Target & {})["addEventListener"] {
    /** The currently added event listener, its type, and the target its added to. */
    const addedListener = useRef<{
        listener: EventListenerOrEventListenerObject;
        type: string;
        target: EventTarget;
    }>();

    /** The current arguments. */
    const argsRef = useRef({ target, enabled });
    argsRef.current = { target, enabled };

    /** Removes the currently added listener from its target. */
    const removeListener = useRef(() => {
        if (addedListener.current === undefined) return;
        const { listener, type, target } = addedListener.current;
        target.removeEventListener(type, listener);
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

            // then added it back on as long as enabled is raised and the target is defined
            if (enabled && target != null) {
                // TODO work with once somehow
                target.addEventListener(type, listener, ...rest);

                addedListener.current = { listener, type, target };
            }
        }
    ).current;

    // return removeListener as a cleanup function so that the listener is removed when the component de-renders
    useEffect(() => removeListener, []);

    return addEventListener;
}

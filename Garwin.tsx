import { ComponentProps, ReactNode } from "react";
import { Unpick } from "../types/object";
import useConst from "./useConst";
import useForceRedraw from "./useForceRedraw";
import Resizable from "./Resizable";
import React from "react";

export interface WindowConfig {
    /** Unique identifier for the window. Can be a string, number, bigint, symbol, object instance, pretty much anything as long as it's unique and doesn't change. */
    readonly key: any;
    /** What to put in the window. */
    readonly contents: ReactNode;
}
export interface GarwinProps extends Unpick<ComponentProps<"div">, "ref"> {
    /** The windows to render. */
    windows: Iterable<WindowConfig>;
    /** Experimental option. Just leave on default. */
    occlusionMode?: "renderOrder" | "zIndex";
}

/**
 * The (Gar)bage (Window) System.
 *
 * Place this somewhere in your app and give it some windows to render with the "windows" prop.
 */
export default function Garwin({
    windows: windowConfigsIterable,
    occlusionMode = "zIndex",
}: GarwinProps) {
    const redraw = useForceRedraw();
    const windowConfigs = [...windowConfigsIterable];
    type Key = any;
    type Window = {
        readonly Key: Key;
        contents: ReactNode;
        readonly location: [x: number, y: number];
        zIndex: number;
    };

    // I am committing the react sin of using mutable state.
    // And there isn't a single thing you can do about it.
    const windows = useConst(() => new Map<Key, Window>());

    // update old window contents and add new windows
    for (const windowConfig of windowConfigs) {
        const window = windows.get(windowConfig.key);
        let nextZIndex: number | undefined = undefined;

        if (window !== undefined) {
            window.contents = windowConfig.contents;
        } else {
            if (nextZIndex === undefined) {
                nextZIndex =
                    windows.size === 0
                        ? 0
                        : [...windows.values()]
                              .map((w) => w.zIndex)
                              .reduce((max, zIndex) => Math.max(max, zIndex)) +
                          1;
            } else {
                nextZIndex++;
            }
            windows.set(windowConfig.key, {
                contents: windowConfig.contents,
                Key: windowConfig.key,
                location: getInitialLocation(windowConfig),
                zIndex: nextZIndex,
            });
        }
    }

    // remove windows that are no longer in the config
    {
        const windowConfigKeys = new Set(windowConfigs.map((w) => w.key));
        for (const key of windows.keys()) {
            if (!windowConfigKeys.has(key)) {
                windows.delete(key);
            }
        }
    }

    function moveWindowToFront(key: Key) {
        const window = windows.get(key);
        if (window === undefined) return;

        let newZindex = window.zIndex;
        for (const w of windows.values()) {
            if (w !== window && w.zIndex > window.zIndex) {
                newZindex = Math.max(newZindex, w.zIndex);
                w.zIndex--;
            }
        }

        if (newZindex !== window.zIndex) {
            window.zIndex = newZindex;
            redraw();
        }
    }

    function getInitialLocation(
        _windowConfig: WindowConfig
    ): [x: number, y: number] {
        return [0, 0];
    }
    const fancyBlur = {
        backdropFilter: "blur(1px)",
        backgroundColor: "rgba(0,0,0,0.7)",
        borderRadius: "5px",
    };

    return (
        <div style={{ position: "relative", zIndex: 0 }}>
            {(() => {
                const windowArray = [...windows.values()];
                if (occlusionMode === "renderOrder") {
                    windowArray.sort((a, b) => a.zIndex - b.zIndex);
                }
                return windowArray;
            })().map((window) => {
                return (
                    <Resizable
                        style={{
                            zIndex:
                                occlusionMode === "zIndex"
                                    ? window.zIndex
                                    : undefined,
                            position: "absolute",
                            left: window.location[0],
                            top: window.location[1],
                            border: "1px solid black",
                            ...fancyBlur,
                        }}
                        key={window.Key}
                        onMouseDown={() => moveWindowToFront(window.Key)}
                        showLeftHandle
                        showTopHandle
                        onWidthChange={(value, edge, startingClientRect) => {
                            if (edge === "left") {
                                const delta = value - startingClientRect.width;
                                window.location[0] =
                                    startingClientRect.left - delta;
                                redraw();
                            }
                        }}
                        onHeightChange={(value, edge, startingClientRect) => {
                            if (edge === "top") {
                                const delta = value - startingClientRect.height;
                                window.location[1] =
                                    startingClientRect.top - delta;
                                redraw();
                            }
                        }}
                    >
                        {/* temporary drag handle */}
                        <div
                            style={{
                                height: "50px",
                            }}
                            onMouseDown={(e) => {
                                const startingLocation = [...window.location];
                                const startingMouseLocation = [
                                    e.clientX,
                                    e.clientY,
                                ];

                                function dragListener(e: MouseEvent) {
                                    const currentMouseLocation = [
                                        e.clientX,
                                        e.clientY,
                                    ];

                                    const locationOffset = [
                                        currentMouseLocation[0] -
                                            startingMouseLocation[0],
                                        currentMouseLocation[1] -
                                            startingMouseLocation[1],
                                    ];

                                    window.location[0] =
                                        startingLocation[0] + locationOffset[0];
                                    window.location[1] =
                                        startingLocation[1] + locationOffset[1];

                                    redraw();
                                }
                                // stop stuff from getting selected while dragging window
                                const prevDef = (e: Event) =>
                                    e.preventDefault();
                                document.addEventListener(
                                    "selectstart",
                                    prevDef
                                );
                                document.addEventListener(
                                    "mouseup",
                                    () => {
                                        document.removeEventListener(
                                            "mousemove",
                                            dragListener
                                        );
                                        document.removeEventListener(
                                            "selectstart",
                                            prevDef
                                        );
                                    },
                                    { once: true }
                                );
                                document.addEventListener(
                                    "mousemove",
                                    dragListener
                                );
                            }}
                        ></div>
                        {window.contents}
                    </Resizable>
                );
            })}
        </div>
    );
}

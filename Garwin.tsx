import React, {
    ComponentProps,
    ReactNode,
    forwardRef,
    useImperativeHandle,
    CSSProperties,
} from "react";
import { Unpick } from "../types/object";
import Resizable, { ResizableProps } from "./Resizable";
import useConst from "./hooks/useConst";
import useEventListener from "./hooks/useEventListener";
import useForceRedraw from "./hooks/useForceRedraw";
import useInitRef from "./hooks/useInitRef";
import { defined, notNull } from "./iterableUtils";
import Itmod from "./itmod/Itmod";

const defaults = {
    headerSize: 40,
    resizeHandleSize: 10,
} as const;

function pxIfNum(numOrStr: number | string): string {
    if (typeof numOrStr === "number") {
        return `${numOrStr}px`;
    } else {
        return numOrStr;
    }
}

export interface WindowConfig {
    /** Styles applied to the window's outer div. Styles like overflow should be given to {@link contentStyle} */
    style?: CSSProperties;
    /** CSS class for the window. */
    className?: string;
    /** Styles applies to the div containing the window's contents. Styles for the whole window should be given to {@link style}. */
    contentStyle?: CSSProperties;
    /** CSS class for the div containing the window's contents. */
    contentClassName?: string;
    // TODO docs
    /** Elements to be used as drag handles or query strings for querying elements to be used as drag handles. Query strings follow the format accepted by {@link Element.querySelector}. */
    readonly draggers?: (string | EventTarget)[];
    /** Whether to show the default dragger. Leave undefined for auto, which shows it if no draggers are provided manually. */
    readonly showHeader?: boolean;
    /** Children to give to the header. */
    readonly headerContents?: ReactNode;
    /** Styles for the header. */
    readonly headerStyle?: CSSProperties;
    /** CSS class for the header. */
    readonly headerClassName?: string;
    /**
     * Height of the header in px.
     * @default 40
     */
    readonly headerSize?: number;

    /** Styles for the resize handles. */
    readonly resizeHandleStyle?: CSSProperties;
    /** CSS class for the resize handles. */
    readonly resizeHandleClassName?: string;
    /**
     * Size of the resize handles on windows in px.
     * @default 10
     */
    readonly resizeHandleSize?: number;

    /**
     * Whether the window can be dragged by parts of the content that are not covered by other elements.
     */
    readonly contentDraggable?: boolean;
}

export interface WindowProperties {
    /** Unique identifier for the window. Can be a string, number, bigint, symbol, object instance, pretty much anything as long as it's unique and doesn't change. */
    readonly key: any;
    /** What to put in the window. */
    readonly contents?: ReactNode;
    /** Per-window config. Overrides configuration settings given to {@link GarwinProps.windowConfig}. */
    readonly config?: WindowConfig;
}
export interface GarwinProps {
    /** The windows to render. */
    windows: Iterable<WindowProperties>;
    /**
     * @deprecated
     * Experimental option. Just leave on default.
     */
    occlusionMode?: "renderOrder" | "zIndex";
    /**
     * Window configuration for all windows in the system. Use this to add styling or adjust other settings.
     */
    windowConfig?: WindowConfig;
}

type Key = any;
type Window = {
    readonly key: Key;
    config: WindowProperties;
    readonly location: [x: number, y: number];
    zIndex: number;
};

export interface GarwinRef {
    /**
     * Resets the locations of all windows.
     */
    windowCleanup(): void;
    /**
     * Moves the window with the given key to the front.
     */
    moveWindowToFront(key: any): void;
}

/**
 * The (Gar)bage (Window) System.
 *
 * Place this somewhere in your app and give it some windows to render with the "windows" prop.
 */
const Garwin = forwardRef<GarwinRef, GarwinProps>(
    (
        {
            windows: windowPropertiesIterable,
            occlusionMode = "zIndex",
            windowConfig,
        },
        ref
    ) => {
        const windowProperties = [...windowPropertiesIterable];

        // I am committing the react sin of using mutable state.
        // And there isn't a single thing you can do about it.
        const redraw = useForceRedraw();
        const windows = useConst(() => new Map<Key, Window>());

        function windowCleanup() {
            for (const window of windows.values()) {
                const location = getInitialLocation(window.key);
                window.location[0] = location[0];
                window.location[1] = location[1];
            }
            redraw();
        }

        useImperativeHandle<GarwinRef, GarwinRef>(ref, () => {
            return {
                windowCleanup,
                moveWindowToFront,
            };
        });

        // update old window configs and add new windows
        for (const windowProps of windowProperties) {
            const window = windows.get(windowProps.key);
            let nextZIndex: number | undefined = undefined;

            if (window !== undefined) {
                window.config = windowProps;
            } else {
                if (nextZIndex === undefined) {
                    nextZIndex =
                        Itmod.from(windows.values())
                            .map((w) => w.zIndex)
                            .reduce(Math.max, (result) => result + 1) ?? 0;
                } else {
                    nextZIndex++;
                }
                windows.set(windowProps.key, {
                    config: windowProps,
                    key: windowProps.key,
                    location: getInitialLocation(windowProps),
                    zIndex: nextZIndex,
                });
            }
        }

        // remove windows that are no longer in the config
        {
            const windowConfigKeys = new Set(
                windowProperties.map((w) => w.key)
            );
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
            _windowConfig: WindowProperties
        ): [x: number, y: number] {
            return [0, 0];
        }

        return (
            <div
                style={{
                    position: "relative",
                    zIndex: 0,
                }}
            >
                {(() => {
                    const windowArray = [...windows.values()];
                    if (occlusionMode === "renderOrder") {
                        windowArray.sort((a, b) => a.zIndex - b.zIndex);
                    }
                    return windowArray;
                })().map((window) => {
                    return (
                        <Window
                            key={window.key}
                            window={window}
                            occlusionMode={occlusionMode}
                            moveWindowToFront={moveWindowToFront}
                            redraw={redraw}
                            globalWindowConfig={windowConfig}
                        />
                    );
                })}
            </div>
        );
    }
);

function Window({
    window,
    occlusionMode,
    moveWindowToFront,
    redraw,
    globalWindowConfig,
}: {
    window: Window;
    occlusionMode: "renderOrder" | "zIndex";
    moveWindowToFront: (key: Key) => void;
    redraw: () => void;
    globalWindowConfig: WindowConfig | undefined;
}) {
    const headerRef = useInitRef<HTMLDivElement | null>(null);
    const windowRef = useInitRef<HTMLDivElement | null>(null);
    const contentRef = useInitRef<HTMLDivElement | null>(null);
    console.log({ wc: windowRef.current });

    const localWindowConfig = window.config.config;
    const combinedWindowConfig = {
        ...globalWindowConfig,
        ...localWindowConfig,
    };

    const draggers = [
        ...(globalWindowConfig?.draggers ?? []),
        ...(localWindowConfig?.draggers ?? []),
    ];

    const {
        resizeHandleSize = defaults.resizeHandleSize,
        headerSize = defaults.headerSize,
        showHeader = draggers.length === 0,
        contentDraggable = true,
    } = combinedWindowConfig;

    const dragTargets: EventTarget[] = Itmod.of(
        contentDraggable ? contentRef.current : undefined,
        windowRef.current,
        headerRef.current
    )
        .concat(draggers)
        .map((dragger) => {
            if (typeof dragger === "string") {
                if (windowRef.current !== null) {
                    const dragElements =
                        windowRef.current.querySelectorAll(dragger);
                    return dragElements.values();
                } else return undefined;
            } else {
                return [dragger];
            }
        })
        .flat()
        .notNull()
        .defined()
        .toArray();

    useEventListener(dragTargets)("mousedown", (e) => {
        console.log(e);
        if (!(e instanceof MouseEvent)) return;
        if (e.target !== e.currentTarget) return;

        const startingLocation = [...window.location];
        const startingMouseLocation = [e.clientX, e.clientY];

        function dragListener(e: MouseEvent) {
            const currentMouseLocation = [e.clientX, e.clientY];

            const locationOffset = [
                currentMouseLocation[0] - startingMouseLocation[0],
                currentMouseLocation[1] - startingMouseLocation[1],
            ];

            window.location[0] = startingLocation[0] + locationOffset[0];
            window.location[1] = startingLocation[1] + locationOffset[1];

            redraw();
        }

        // stop stuff from getting selected while dragging window
        const prevDef = (e: Event) => e.preventDefault();
        document.addEventListener(
            "mouseup",
            () => {
                // remove listeners
                document.removeEventListener("mousemove", dragListener);
                document.removeEventListener("selectstart", prevDef);
            },
            { once: true }
        );
        document.addEventListener("selectstart", prevDef);
        document.addEventListener("mousemove", dragListener);
    });

    return (
        <Resizable
            style={{
                position: "absolute",
                left: window.location[0],
                top: window.location[1],
                zIndex: occlusionMode === "zIndex" ? window.zIndex : undefined,
                overflow: "hidden",
                ...(showHeader
                    ? {
                          display: showHeader ? "flex" : undefined,
                          flexDirection: "column",
                          alignContent: "stretch",
                      }
                    : {}),
                ...globalWindowConfig?.style,
                ...localWindowConfig?.style,
            }}
            handleSize={resizeHandleSize}
            divRef={windowRef}
            key={window.key}
            minHeight={
                resizeHandleSize +
                resizeHandleSize +
                (showHeader ? headerSize : 0)
            }
            onMouseDown={(...args) => {
                moveWindowToFront(window.key);
            }}
            handleProps={{
                style: {
                    ...globalWindowConfig?.resizeHandleStyle,
                    ...localWindowConfig?.resizeHandleStyle,
                },
                className: [
                    globalWindowConfig?.resizeHandleClassName,
                    localWindowConfig?.resizeHandleClassName,
                ].join(" "),
            }}
            showLeftHandle
            showTopHandle
            onWidthChange={(value, edge, startingClientRect) => {
                if (edge === "left") {
                    const delta = value - startingClientRect.width;
                    window.location[0] = startingClientRect.left - delta;
                    redraw();
                }
            }}
            onHeightChange={(value, edge, startingClientRect) => {
                if (edge === "top") {
                    const delta = value - startingClientRect.height;
                    window.location[1] = startingClientRect.top - delta;
                    redraw();
                }
            }}
        >
            {/* render default dragger if no draggers where given */}
            {showHeader && (
                <div
                    ref={headerRef}
                    style={{
                        height: `${pxIfNum(headerSize)}`,
                        flexGrow: 0,
                        flexShrink: 0,
                        ...globalWindowConfig?.headerStyle,
                        ...localWindowConfig?.headerStyle,
                    }}
                    className={[
                        globalWindowConfig?.headerClassName,
                        localWindowConfig?.headerClassName,
                    ].join(" ")}
                >
                    {globalWindowConfig?.headerContents}
                    {localWindowConfig?.headerContents}
                </div>
            )}
            <div
                style={{
                    overflow: "auto",
                    ...(showHeader
                        ? {
                              flexGrow: 1,
                              flexShrink: 1,
                          }
                        : {
                              width: "100%",
                              height: "100%",
                          }),
                    ...globalWindowConfig?.contentStyle,
                    ...localWindowConfig?.contentStyle,
                }}
                className={[
                    globalWindowConfig?.contentClassName,
                    localWindowConfig?.contentClassName,
                ].join(" ")}
                ref={contentRef}
            >
                {window.config.contents}
            </div>
        </Resizable>
    );
}

export default Garwin;

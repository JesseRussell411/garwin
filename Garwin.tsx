import Itmod from "iterator-modifier";
import {
    CSSProperties,
    ReactNode,
    forwardRef,
    useImperativeHandle,
    useRef,
    ComponentProps,
} from "react";
import Resizable from "./Resizable";
import useConst from "./hooks/useConst";
import useEventListener from "./hooks/useEventListener";
import useForceRedraw from "./hooks/useForceRedraw";
import useInitRef from "./hooks/useInitRef";
import { Unpick } from "../types/object";

// TODO bound windows on container resize.

function pxIfNum(numOrStr: number | string): string {
    if (typeof numOrStr === "number") {
        return `${numOrStr}px`;
    } else {
        return numOrStr;
    }
}

const defaultWindowConfig = {
    headerSize: 40,
    resizeHandleSize: 10,
    boundPadding: 20,
    boundToContainer: false,
    boundToView: true,
    displayMode: "view",
} as const satisfies WindowConfig;

export type WindowConfig = Readonly<
    Partial<{
        /** Styles applied to the window's outer div. Styles like overflow should be given to {@link contentStyle} */
        style: CSSProperties;
        /** CSS class for the window. */
        className: string;
        /** Styles applies to the div containing the window's contents. Styles for the whole window should be given to {@link style}. */
        contentStyle: CSSProperties;
        /** CSS class for the div containing the window's contents. */
        contentClassName: string;
        /** Elements to be used as drag handles or query strings for querying elements to be used as drag handles. Query strings follow the format accepted by {@link Element.querySelector}. */
        draggers: (string | EventTarget)[];
        /** Whether to show the default dragger. Leave undefined for auto, which shows it if no draggers are provided manually. */
        showHeader: boolean;
        /** Children to give to the header. */
        headerContents: ReactNode;
        /** Styles for the header. */
        headerStyle: CSSProperties;
        /** CSS class for the header. */
        headerClassName: string;
        /**
         * Height of the header in px.
         * @default 40
         */
        headerSize: number;

        /** Styles for the resize handles. */
        resizeHandleStyle: CSSProperties;
        /** CSS class for the resize handles. */
        resizeHandleClassName: string;
        /**
         * Size of the resize handles on windows in px.
         * @default 10
         */
        resizeHandleSize: number;

        /**
         * Whether the window can be dragged by parts of the content that are not covered by other elements.
         */
        contentDraggable: boolean;
        onMove(
            startingLocation: [x: number, y: number],
            newLocation: [x: number, y: number]
        ): [x: number, y: number] | undefined | void;
        onMoveStart(startingLocation: [x: number, y: number]): void;
        onMoveStop(): void;

        boundToContainer: true | false;
        boundToView: true | false;
        boundPadding: number;

        baseZIndex: number;

        displayMode: "view" | "container";
    }>
>;

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
    containerProps?: Unpick<ComponentProps<"div">, "ref">;
}

type Key = any;
type Window = {
    readonly key: Key;
    properties: WindowProperties;
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
            containerProps,
        },
        ref
    ) => {
        const windowProperties = [...windowPropertiesIterable];
        const combinedWindowConfig = {
            ...defaultWindowConfig,
            ...windowConfig,
        };

        // I am committing the ultimate sin of using mutable state in React.
        // And there isn't a single thing you can do about it.
        const windows = useConst(() => new Map<Key, Window>());
        const redraw = useForceRedraw();

        const containerRef = useInitRef<HTMLDivElement | null>(null);

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
                window.properties = windowProps;
            } else {
                if (nextZIndex === undefined) {
                    // set nextZIndex to maximum existing zIndex plus 1, or 0 if there are no current zIndexes (because there are no windows)
                    nextZIndex =
                        Itmod.from(windows.values())
                            .map((w) => w.zIndex)
                            .reduce(Math.max, (max) => max + 1) ?? 0;
                } else {
                    nextZIndex++;
                }
                windows.set(windowProps.key, {
                    properties: windowProps,
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
                {...containerProps}
                style={{
                    ...(combinedWindowConfig.displayMode === "container"
                        ? {
                              overflow: "hidden",
                              position: "relative",
                          }
                        : {}),
                    ...containerProps?.style,
                }}
                ref={containerRef}
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
                            container={containerRef.current}
                        />
                    );
                })}
            </div>
        );
    }
);

function Window({
    window: contentWindow,
    occlusionMode,
    moveWindowToFront,
    redraw,
    globalWindowConfig,
    container,
}: {
    window: Window;
    occlusionMode: "renderOrder" | "zIndex";
    moveWindowToFront: (key: Key) => void;
    redraw: () => void;
    globalWindowConfig: WindowConfig | undefined;
    container: HTMLDivElement | null | undefined;
}) {
    const headerRef = useInitRef<HTMLDivElement | null>(null);
    const windowRef = useInitRef<HTMLDivElement | null>(null);
    const contentRef = useInitRef<HTMLDivElement | null>(null);

    const resizingStartLocation = useRef<readonly [x: number, y: number]>();

    const localWindowConfig = contentWindow.properties.config;
    const combinedWindowConfig = {
        ...defaultWindowConfig,
        ...globalWindowConfig,
        ...localWindowConfig,
    };

    const draggers = [
        ...(globalWindowConfig?.draggers ?? []),
        ...(localWindowConfig?.draggers ?? []),
    ];

    const {
        resizeHandleSize,
        headerSize = defaultWindowConfig.headerSize,
        contentDraggable = true,
        showHeader = draggers.length === 0,
        boundPadding,
        boundToContainer,
        boundToView,
        displayMode,
    } = combinedWindowConfig;

    const dragTargets: EventTarget[] = Itmod.of(
        contentDraggable ? contentRef.current : undefined,
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
        if (!(e instanceof MouseEvent)) return;
        if (e.target !== e.currentTarget) return;

        // e.preventDefault();
        // e.stopPropagation();

        const startingLocation: [x: number, y: number] = [
            ...contentWindow.location,
        ];
        const startingMouseLocation: [x: number, y: number] = [
            e.clientX,
            e.clientY,
        ];

        globalWindowConfig?.onMoveStart?.([...startingLocation]);
        localWindowConfig?.onMoveStart?.([...startingLocation]);

        function dragListener(e: MouseEvent) {
            e.stopPropagation();
            e.preventDefault();
            const currentMouseLocation = [e.clientX, e.clientY];

            if (boundToContainer === true) {
                if (container == null) return;

                const rect = container.getBoundingClientRect();

                currentMouseLocation[0] = Math.max(
                    rect.left + boundPadding,
                    Math.min(rect.right - boundPadding, currentMouseLocation[0])
                );

                currentMouseLocation[1] = Math.max(
                    rect.top + boundPadding,
                    Math.min(
                        rect.bottom - boundPadding,
                        currentMouseLocation[1]
                    )
                );
            }

            if (boundToView === true) {
                const viewHeight = document.documentElement.clientHeight;
                const viewWidth = document.documentElement.clientWidth;

                currentMouseLocation[0] = Math.max(
                    boundPadding,
                    Math.min(viewWidth - boundPadding, currentMouseLocation[0])
                );

                currentMouseLocation[1] = Math.max(
                    boundPadding,
                    Math.min(viewHeight - boundPadding, currentMouseLocation[1])
                );
            }

            const locationOffset = [
                currentMouseLocation[0] - startingMouseLocation[0],
                currentMouseLocation[1] - startingMouseLocation[1],
            ];

            let newLocation: [x: number, y: number] = [
                startingLocation[0] + locationOffset[0],
                startingLocation[1] + locationOffset[1],
            ];

            newLocation =
                globalWindowConfig?.onMove?.(
                    [...startingLocation],
                    [...newLocation]
                ) ?? newLocation;

            newLocation =
                localWindowConfig?.onMove?.(
                    [...startingLocation],
                    [...newLocation]
                ) ?? newLocation;

            contentWindow.location[0] = newLocation[0];
            contentWindow.location[1] = newLocation[1];

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
                window.removeEventListener("DOMMouseScroll", prevDef);
                globalWindowConfig?.onMoveStop?.();
                localWindowConfig?.onMoveStop?.();
            },
            { once: true }
        );
        document.addEventListener("mousemove", dragListener);
        document.addEventListener("selectstart", prevDef);
        // window.addEventListener("DOMMouseScroll", prevDef);
    });

    return (
        <Resizable
            style={{
                position: displayMode === "view" ? "fixed" : "absolute",
                left: contentWindow.location[0],
                top: contentWindow.location[1],
                zIndex:
                    contentWindow.zIndex +
                    (combinedWindowConfig.baseZIndex ?? 0),
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
            resizeHandleSize={resizeHandleSize}
            ref={windowRef}
            key={contentWindow.key}
            onMouseDown={() => {
                moveWindowToFront(contentWindow.key);
            }}
            resizeHandleStyle={{
                ...globalWindowConfig?.resizeHandleStyle,
                ...localWindowConfig?.resizeHandleStyle,
            }}
            resizeHandleClassName={[
                globalWindowConfig?.resizeHandleClassName,
                localWindowConfig?.resizeHandleClassName,
            ].join(" ")}
            showLeftHandle
            showTopHandle
            onResizeStart={() => {
                resizingStartLocation.current = [...contentWindow.location];
            }}
            onSizeChange={(newSize, startingSize, edge) => {
                if (resizingStartLocation.current == undefined) return;
                const [startX, startY] = resizingStartLocation.current;
                const [newWidth, newHeight] = newSize;
                const [startWidth, startHeight] = startingSize;
                if (edge[0] === "left") {
                    const delta = newWidth - startWidth;
                    contentWindow.location[0] = startX - delta;
                    redraw();
                }
                if (edge[1] === "top") {
                    const delta = newHeight - startHeight;
                    contentWindow.location[1] = startY - delta;
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
                {contentWindow.properties.contents}
            </div>
        </Resizable>
    );
}

export default Garwin;

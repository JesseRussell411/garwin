import React, {
    ComponentProps,
    ReactNode,
    useEffect,
    useState,
    MutableRefObject,
    CSSProperties,
    forwardRef,
    useImperativeHandle,
} from "react";
import useEventListener from "./hooks/useEventListener";
import useInitRef from "./hooks/useInitRef";
import { Unpick } from "../types/object";

function pxIfNum(numOrStr: number | string): string {
    if (typeof numOrStr === "number") {
        return `${numOrStr}px`;
    } else {
        return numOrStr;
    }
}

function v2dSub(
    a: readonly [x: number, y: number],
    b: readonly [x: number, y: number]
): [x: number, y: number] {
    return [a[0] - b[0], a[1] - b[1]];
}

function v2dAdd(
    a: readonly [x: number, y: number],
    b: readonly [x: number, y: number]
): [x: number, y: number] {
    return [a[0] + b[0], a[1] + b[1]];
}

export interface ResizableProps extends Unpick<ComponentProps<"div">, "ref"> {
    resizeHandleSize?: number;
    resizeHandleStyle?: CSSProperties;
    resizeHandleClassName?: string;

    width?: number | string;
    height?: number | string;
    setWidth?: (width: number) => void;
    setHeight?: (height: number) => void;
    minWidth?: number;
    minHeight?: number;
    // maxWidth?: number;
    // maxHeight?: number;

    onSizeChange?: (
        newSize: [x: number, y: number],
        startingSize: [x: number, y: number],
        edge: [x?: "left" | "right", y?: "top" | "bottom"]
    ) => readonly [x: number, y: number] | "cancel" | undefined | void;

    onResizeStart?: (
        startingSize: [x: number, y: number],
        edge: [x?: "left" | "right", y?: "top" | "bottom"]
    ) => void;

    onResizeStop?: () => void;

    showLeftHandle?: boolean;
    showRightHandle?: boolean;
    showBottomHandle?: boolean;
    showTopHandle?: boolean;

    children?: ReactNode;
}

const Resizable = forwardRef<HTMLDivElement, ResizableProps>(
    (
        {
            resizeHandleClassName,
            resizeHandleStyle,
            resizeHandleSize = 10,
            width,
            height,
            setWidth: externalSetWidth,
            setHeight: externalSetHeight,
            showLeftHandle = false,
            showRightHandle = true,
            showBottomHandle = true,
            showTopHandle = false,
            minHeight = (showTopHandle ? resizeHandleSize : 0) +
                (showBottomHandle ? resizeHandleSize : 0),
            minWidth = (showLeftHandle ? resizeHandleSize : 0) +
                (showRightHandle ? resizeHandleSize : 0),
            // maxHeight,
            // maxWidth,
            children,
            onSizeChange,
            onResizeStart,
            onResizeStop,
            ...divProps
        },
        ref
    ) => {
        const initialWidth = width;
        const initialHeight = height;
        const [widthState, setWidthState] = useState(initialWidth);
        const [heightState, setHeightState] = useState(initialHeight);
        const divRef = useInitRef<HTMLDivElement | null>(null, ref);

        if (externalSetWidth === undefined) width = widthState;
        if (externalSetHeight === undefined) height = heightState;
        const setWidth = externalSetWidth ?? setWidthState;
        const setHeight = externalSetHeight ?? setHeightState;

        function setSize(
            newSize: [x: number, y: number],
            startingSize: [x: number, y: number],
            edge: [x?: "left" | "right", y?: "top" | "bottom"]
        ) {
            newSize[0] =
                edge[0] === undefined
                    ? startingSize[0]
                    : Math.max(minWidth, newSize[0]);
            newSize[1] =
                edge[1] === undefined
                    ? startingSize[1]
                    : Math.max(minHeight, newSize[1]);
            const result = onSizeChange?.([...newSize], startingSize, edge);
            if (result === "cancel") return;

            if (Array.isArray(result)) {
                newSize = result as [x: number, y: number];
            }
            
            if (edge[0] !== undefined) setWidth(newSize[0]);
            if (edge[1] !== undefined) setHeight(newSize[1]);
        }

        function getStartResize(
            edge: [x?: "left" | "right", y?: "top" | "bottom"]
        ) {
            return function startResize(
                mouseStart: readonly [x: number, y: number]
            ) {
                const startingSize: [x: number, y: number] | undefined =
                    divRef.current != null
                        ? [
                              typeof width === "number"
                                  ? width
                                  : divRef.current.getBoundingClientRect()
                                        .width,
                              typeof height === "number"
                                  ? height
                                  : divRef.current.getBoundingClientRect()
                                        .height,
                          ]
                        : typeof width === "number" &&
                          typeof height === "number"
                        ? [width, height]
                        : undefined;
                if (startingSize === undefined) {
                    return () => {};
                }
                onResizeStart?.(startingSize, edge);
                return (e: MouseEvent) => {
                    const mouseDistance = v2dSub(
                        [e.clientX, e.clientY],
                        mouseStart
                    );
                    setSize(
                        [
                            edge[0] === "left"
                                ? startingSize[0] - mouseDistance[0]
                                : edge[0] === "right"
                                ? startingSize[0] + mouseDistance[0]
                                : startingSize[0],
                            edge[1] === "top"
                                ? startingSize[1] - mouseDistance[1]
                                : edge[1] === "bottom"
                                ? startingSize[1] + mouseDistance[1]
                                : startingSize[1],
                        ],
                        startingSize,
                        edge
                    );
                };
            };
        }

        return (
            <div
                {...divProps}
                ref={divRef}
                style={{
                    width,
                    height,
                    position: "relative",
                    paddingLeft: showLeftHandle ? resizeHandleSize : 0,
                    paddingRight: showRightHandle ? resizeHandleSize : 0,
                    paddingBottom: showBottomHandle ? resizeHandleSize : 0,
                    paddingTop: showTopHandle ? resizeHandleSize : 0,
                    boxSizing: "border-box",
                    ...divProps?.style,
                }}
            >
                {children}
                {showLeftHandle && (
                    <Handle
                        onResizeStop={onResizeStop}
                        getResize={getStartResize(["left"])}
                        handleClassName={resizeHandleClassName}
                        handleSize={resizeHandleSize}
                        handleStyle={resizeHandleStyle}
                        xAxis="left"
                    />
                )}
                {showRightHandle && (
                    <Handle
                        onResizeStop={onResizeStop}
                        getResize={getStartResize(["right"])}
                        handleClassName={resizeHandleClassName}
                        handleSize={resizeHandleSize}
                        handleStyle={resizeHandleStyle}
                        xAxis="right"
                    />
                )}
                {showBottomHandle && (
                    <Handle
                        onResizeStop={onResizeStop}
                        getResize={getStartResize([undefined, "bottom"])}
                        handleClassName={resizeHandleClassName}
                        handleSize={resizeHandleSize}
                        handleStyle={resizeHandleStyle}
                        yAxis="bottom"
                    />
                )}
                {showTopHandle && (
                    <Handle
                        onResizeStop={onResizeStop}
                        getResize={getStartResize([undefined, "top"])}
                        handleClassName={resizeHandleClassName}
                        handleSize={resizeHandleSize}
                        handleStyle={resizeHandleStyle}
                        yAxis="top"
                    />
                )}

                {showBottomHandle && showLeftHandle && (
                    <Handle
                        onResizeStop={onResizeStop}
                        getResize={getStartResize(["left", "bottom"])}
                        handleSize={resizeHandleSize}
                        handleClassName={resizeHandleClassName}
                        handleStyle={resizeHandleStyle}
                        xAxis="left"
                        yAxis="bottom"
                    />
                )}
                {showBottomHandle && showRightHandle && (
                    <Handle
                        onResizeStop={onResizeStop}
                        getResize={getStartResize(["right", "bottom"])}
                        handleSize={resizeHandleSize}
                        handleClassName={resizeHandleClassName}
                        handleStyle={resizeHandleStyle}
                        xAxis="right"
                        yAxis="bottom"
                    />
                )}
                {showTopHandle && showLeftHandle && (
                    <Handle
                        onResizeStop={onResizeStop}
                        getResize={getStartResize(["left", "top"])}
                        handleSize={resizeHandleSize}
                        handleClassName={resizeHandleClassName}
                        handleStyle={resizeHandleStyle}
                        xAxis="left"
                        yAxis="top"
                    />
                )}
                {showTopHandle && showRightHandle && (
                    <Handle
                        onResizeStop={onResizeStop}
                        getResize={getStartResize(["right", "top"])}
                        handleSize={resizeHandleSize}
                        handleClassName={resizeHandleClassName}
                        handleStyle={resizeHandleStyle}
                        xAxis="right"
                        yAxis="top"
                    />
                )}
            </div>
        );
    }
);

interface HandleProps {
    xAxis?: "left" | "right";
    yAxis?: "top" | "bottom";
    handleSize: number | string;
    getResize: (
        mouseStart: readonly [x: number, y: number]
    ) => (e: MouseEvent) => void;
    handleStyle: CSSProperties | undefined;
    handleClassName: string | undefined;
    onResizeStop?: (() => void) | undefined;
}

function Handle({
    xAxis,
    yAxis,
    handleSize,
    getResize,
    handleStyle,
    handleClassName,
    onResizeStop,
}: HandleProps) {
    return (
        <div
            className={handleClassName}
            style={{
                boxSizing: "border-box",
                position: "absolute",
                ...(xAxis === "left"
                    ? { left: 0 }
                    : xAxis === "right"
                    ? { right: 0 }
                    : { left: 0 }),
                ...(yAxis === "top"
                    ? { top: 0 }
                    : yAxis === "bottom"
                    ? { bottom: 0 }
                    : { top: 0 }),
                width: xAxis !== undefined ? handleSize : "100%",
                height: yAxis !== undefined ? handleSize : "100%",
                cursor:
                    xAxis === undefined && yAxis !== undefined
                        ? "ns-resize"
                        : xAxis !== undefined && yAxis === undefined
                        ? "ew-resize"
                        : xAxis === "left"
                        ? yAxis === "top"
                            ? "nwse-resize"
                            : "nesw-resize"
                        : yAxis === "top"
                        ? "nesw-resize"
                        : "nwse-resize",
                ...handleStyle,
            }}
            onMouseDown={(e) => {
                const resizeListener = getResize([e.clientX, e.clientY]);
                const prevDef = (e: Event) => e.preventDefault();

                document.addEventListener(
                    "mouseup",
                    () => {
                        document.removeEventListener(
                            "mousemove",
                            resizeListener
                        );
                        document.removeEventListener("touchmove", prevDef);
                        document.removeEventListener("selectstart", prevDef);
                        onResizeStop?.();
                    },
                    { once: true }
                );
                document.addEventListener("mousemove", resizeListener);
                document.addEventListener("selectstart", prevDef);
                document.addEventListener("touchmove", prevDef);
            }}
        />
    );
}

export default Resizable;

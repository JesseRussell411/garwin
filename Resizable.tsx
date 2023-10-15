import React, {
    ComponentProps,
    ReactNode,
    useEffect,
    useState,
    MutableRefObject,
} from "react";
import useEventListener from "./hooks/useEventListener";
import useInitRef from "./hooks/useInitRef";
import { Unpick } from "../types/object";

export interface ResizableProps extends Unpick<ComponentProps<"div">, "ref"> {
    handleSize?: number;
    handleProps?: Pick<ComponentProps<"div">, "style" | "className">;
    width?: number | string;
    height?: number | string;
    setWidth?: (
        width: number,
        edge: "left" | "right",
        startingClientRect: DOMRect
    ) => void;
    setHeight?: (
        height: number,
        edge: "top" | "bottom",
        startingClientRect: DOMRect
    ) => void;
    onWidthChange?: (
        width: number,
        edge: "left" | "right",
        startingClientRect: DOMRect
    ) => number | "cancel" | undefined | void;
    onHeightChange?: (
        height: number,
        edge: "top" | "bottom",
        startingClientRect: DOMRect
    ) => number | "cancel" | undefined | void;
    minHeight?: number;
    minWidth?: number;
    showLeftHandle?: boolean;
    showRightHandle?: boolean;
    showBottomHandle?: boolean;
    showTopHandle?: boolean;
    divRef?: MutableRefObject<HTMLDivElement | null>;
    children?: ReactNode;
}

export default function Resizable({
    handleSize = 10,
    width,
    height,
    setWidth: externalSetWidth,
    setHeight: externalSetHeight,
    onWidthChange,
    onHeightChange,
    showLeftHandle = false,
    showRightHandle = true,
    showBottomHandle = true,
    showTopHandle = false,
    handleProps,
    minHeight: externalMinHeight,
    minWidth: externalMinWidth,
    children,
    divRef: externalRef,
    ...divProps
}: ResizableProps) {
    const initialWidth = width;
    const initialHeight = height;
    const [widthState, setWidthState] = useState(initialWidth);
    const [heightState, setHeightState] = useState(initialHeight);

    if (externalSetWidth === undefined) width = widthState;
    if (externalSetHeight === undefined) height = heightState;

    const minWidth = Math.max(
        externalMinWidth ?? 0,
        (showLeftHandle ? handleSize : 0) + (showRightHandle ? handleSize : 0)
    );

    const minHeight = Math.max(
        externalMinHeight ?? 0,
        (showTopHandle ? handleSize : 0) + (showBottomHandle ? handleSize : 0)
    );

    function setWidth(
        value: number,
        edge: "left" | "right",
        startingClientRect: DOMRect
    ) {
        if (value < minWidth) {
            value = minWidth;
        }
        const userInput = onWidthChange?.(value, edge, startingClientRect);
        if (userInput === "cancel") return;
        if (typeof userInput === "number") {
            value = userInput;
        }

        setWidthState(value);
        externalSetWidth?.(value, edge, startingClientRect);
    }

    function setHeight(
        value: number,
        edge: "top" | "bottom",
        startingClientRect: DOMRect
    ) {
        if (value < minHeight) {
            value = minHeight;
        }
        const userInput = onHeightChange?.(value, edge, startingClientRect);
        if (userInput === "cancel") return;
        if (typeof userInput === "number") {
            value = userInput;
        }

        setHeightState(value);
        externalSetHeight?.(value, edge, startingClientRect);
    }

    const backupRef = useInitRef<HTMLDivElement | null>(null);
    const ref = externalRef ?? backupRef;

    console.log({ ref, externalRef, backupRef });

    function getLeftResize(
        container: HTMLElement,
        dragPointOffset: [x: number, y: number]
    ) {
        const startingClientRect = container.getBoundingClientRect();
        return (e: MouseEvent) => {
            setWidth(
                startingClientRect.right - e.clientX - dragPointOffset[0],
                "left",
                startingClientRect
            );
        };
    }
    function getRightResize(
        container: HTMLElement,
        dragPointOffset: [x: number, y: number]
    ) {
        const startingClientRect = container.getBoundingClientRect();
        return (e: MouseEvent) => {
            setWidth(
                e.clientX - startingClientRect.left + dragPointOffset[0],
                "right",
                startingClientRect
            );
        };
    }
    function getBottomResize(
        container: HTMLElement,
        dragPointOffset: [x: number, y: number]
    ) {
        const startingClientRect = container.getBoundingClientRect();
        return (e: MouseEvent) => {
            setHeight(
                e.clientY - startingClientRect.top + dragPointOffset[1],
                "bottom",
                startingClientRect
            );
        };
    }
    function getTopResize(
        container: HTMLElement,
        dragPointOffset: [x: number, y: number]
    ) {
        const startingClientRect = container.getBoundingClientRect();
        return (e: MouseEvent) => {
            setHeight(
                startingClientRect.bottom - e.clientY - dragPointOffset[1],
                "top",
                startingClientRect
            );
        };
    }

    return (
        <div
            {...divProps}
            ref={ref}
            style={{
                width,
                height,
                position: "relative",
                paddingLeft: showLeftHandle ? handleSize : 0,
                paddingRight: showRightHandle ? handleSize : 0,
                paddingBottom: showBottomHandle ? handleSize : 0,
                paddingTop: showTopHandle ? handleSize : 0,
                boxSizing: "border-box",
                ...divProps.style,
            }}
        >
            {children}
            {showLeftHandle && (
                <Handle
                    {...handleProps}
                    size={handleSize}
                    div={ref.current}
                    xAxis="left"
                    resizeListeners={[getLeftResize]}
                />
            )}
            {showRightHandle && (
                <Handle
                    {...handleProps}
                    size={handleSize}
                    div={ref.current}
                    xAxis="right"
                    resizeListeners={[getRightResize]}
                />
            )}
            {showBottomHandle && (
                <Handle
                    {...handleProps}
                    size={handleSize}
                    div={ref.current}
                    yAxis="bottom"
                    resizeListeners={[getBottomResize]}
                />
            )}
            {showTopHandle && (
                <Handle
                    {...handleProps}
                    size={handleSize}
                    div={ref.current}
                    yAxis="top"
                    resizeListeners={[getTopResize]}
                />
            )}

            {showBottomHandle && showLeftHandle && (
                <Handle
                    {...handleProps}
                    size={handleSize}
                    div={ref.current}
                    xAxis="left"
                    yAxis="bottom"
                    resizeListeners={[getBottomResize, getLeftResize]}
                />
            )}
            {showBottomHandle && showRightHandle && (
                <Handle
                    {...handleProps}
                    size={handleSize}
                    div={ref.current}
                    xAxis="right"
                    yAxis="bottom"
                    resizeListeners={[getBottomResize, getRightResize]}
                />
            )}
            {showTopHandle && showLeftHandle && (
                <Handle
                    {...handleProps}
                    size={handleSize}
                    div={ref.current}
                    xAxis="left"
                    yAxis="top"
                    resizeListeners={[getTopResize, getLeftResize]}
                />
            )}
            {showTopHandle && showRightHandle && (
                <Handle
                    {...handleProps}
                    size={handleSize}
                    div={ref.current}
                    xAxis="right"
                    yAxis="top"
                    resizeListeners={[getTopResize, getRightResize]}
                />
            )}
        </div>
    );
}

interface HandleProps
    extends Pick<ComponentProps<"div">, "style" | "className"> {
    xAxis?: "left" | "right";
    yAxis?: "top" | "bottom";
    size: number | string;
    div: HTMLDivElement | null;
    resizeListeners: ((
        container: HTMLElement,
        dragPointOffset: [x: number, y: number]
    ) => (e: MouseEvent) => void)[];
}

function Handle({
    xAxis,
    yAxis,
    size,
    resizeListeners,
    ...divProps
}: HandleProps) {
    const [dragging, setDragging] = useState(false);

    // disable selection while dragging
    useEventListener(document, { enabled: dragging })(
        "selectstart",
        (e) => e.preventDefault
    );

    const negativeSize = `-${size}`;

    return (
        <div
            {...divProps}
            style={{
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
                width: xAxis !== undefined ? size : "100%",
                height: yAxis !== undefined ? size : "100%",
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
                ...divProps.style,
            }}
            onMouseDown={(e) => {
                e.preventDefault();
                const container = e.currentTarget.parentElement;
                if (container == null) return;
                setDragging(true);
                resizeListeners.forEach((getResizeListener) => {
                    const dragPointOffset: [x: number, y: number] = [
                        (xAxis === "right"
                            ? e.currentTarget.getBoundingClientRect().right
                            : e.currentTarget.getBoundingClientRect().left) -
                            e.clientX,
                        (yAxis === "bottom"
                            ? e.currentTarget.getBoundingClientRect().bottom
                            : e.currentTarget.getBoundingClientRect().top) -
                            e.clientY,
                    ];
                    const resizeListener = getResizeListener(
                        container,
                        dragPointOffset
                    );

                    document.addEventListener("mousemove", resizeListener);

                    document.addEventListener(
                        "mouseup",
                        () => {
                            setDragging(false);
                            document.removeEventListener(
                                "mousemove",
                                resizeListener
                            );
                        },
                        { once: true }
                    );
                });
            }}
        />
    );
}

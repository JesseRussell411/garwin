import { useState } from "react";

/**
 * Tells react to go away and let you do the redrawing on your own.
 */
export default function useForceRedraw() {
    const [_, setInstanceValue] = useState({});

    return () => {
        setInstanceValue({});
    };
}

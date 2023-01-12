import { MutableRefObject, useEffect } from 'react';
import debounce from 'lodash.debounce';

export type Size = {
    width: number;
    height: number;
};

export function useDOMElementShape(
    domRef: MutableRefObject<HTMLDivElement | null>,
    debounceDelay: number,
    setShape: (size: Size) => void
): void {
    useEffect(() => {
        function handleResize() {
            if (domRef.current) {
                setShape({
                    width: domRef.current.clientWidth,
                    height: domRef.current.clientHeight,
                });
            }
        }
        // Call handler right away so state gets updated with initial window size
        handleResize();

        const handleResizeDebounced = debounce(handleResize, debounceDelay, { maxWait: debounceDelay });
        window.addEventListener('resize', handleResizeDebounced);

        // Remove event listener on cleanup
        return () => window.removeEventListener('resize', handleResizeDebounced);
    });
}

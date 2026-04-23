/**
 * Shared MCP result helpers. Tools should return human-readable text rather
 * than raw JSON dumps — the agent reads the response, the user usually does
 * not.
 */
export declare function textResult(text: string): {
    content: {
        type: "text";
        text: string;
    }[];
};
export declare function errorResult(message: string): {
    content: {
        type: "text";
        text: string;
    }[];
    isError: boolean;
};
/** Format a JS Date / ISO string as a short readable date-time. */
export declare function formatDateTime(value: string | Date | null | undefined): string;
/** Pretty-print an unknown value as a single-line summary. */
export declare function shortJson(value: unknown, max?: number): string;

/** Replace every occurrence of a known secret plus key-shaped values. */
export declare function redactSecrets(text: string, ...secrets: Array<string | undefined>): string;

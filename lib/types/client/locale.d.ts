/**
 * Host-provided locale service, as the settings card consumes it.
 *
 * Carried out of the removed gallery view so the card stays the only browser
 * surface without importing a module whose view no longer exists.
 */
export interface LocaleService {
    getSnapshot(): {
        active?: string;
    };
    subscribe(fn: () => void): () => void;
}

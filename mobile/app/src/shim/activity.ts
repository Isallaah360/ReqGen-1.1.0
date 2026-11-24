/** 3.0.2: the website's tracked fetch is a plain fetch in the app. */
export const trackedFetch = (input: RequestInfo | URL, init?: RequestInit) => fetch(input, init);

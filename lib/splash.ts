// Shared by the splash screen (client), the main layout and the route loading UI (server).
// Kept out of the "use client" module so server components receive the actual values.
export const SPLASH_SEEN_KEY = "atacs:splash-seen";
/** Element rendered by app/(main)/loading.tsx while a page's data is still loading. */
export const ROUTE_LOADING_ID = "atacs-route-loading";
/** Runs during HTML parsing, before the splash is painted: hides it when this session has already seen it. */
export const SPLASH_SEEN_SCRIPT = `try{if(sessionStorage.getItem(${JSON.stringify(SPLASH_SEEN_KEY)})==="1"){var s=document.getElementById("atacs-splash");if(s)s.style.display="none"}}catch(e){}`;

/// <reference types="vite/client" />

/** Injected by vite.config.ts `define` at build time. */
declare const __BUILD_TIME__: string;

declare namespace React {
  // The type parameter is unused here but must match React's own declaration for the merge to apply.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface InputHTMLAttributes<T> {
    /** Turns a file input into a folder picker. Non-standard, but supported everywhere we ship. */
    webkitdirectory?: string;
  }
}

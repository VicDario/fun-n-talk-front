import { provideZonelessChangeDetection } from '@angular/core';

// The test-environment counterpart of app.config.ts. Wired through the
// providersFile option so specs run under the same change detection as the
// application instead of each one opting in.
export default [provideZonelessChangeDetection()];

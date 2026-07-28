import {
  ApplicationConfig,
  inject,
  provideAppInitializer,
  provideZonelessChangeDetection,
} from '@angular/core';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';
import { provideHttpClient, withXhr } from '@angular/common/http';
import { WebRtcService } from '@services/web-rtc/web-rtc.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZonelessChangeDetection(),
    provideRouter(routes),
    provideHttpClient(withXhr()),
    // WebRtcService only ever reacts to mediator events, so nothing injects
    // it. It still has to exist before the first room is joined.
    provideAppInitializer(() => void inject(WebRtcService)),
  ],
};

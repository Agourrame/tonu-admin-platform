import { provideHttpClient, withFetch } from '@angular/common/http';
import { ApplicationConfig } from '@angular/core';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideRouter, withEnabledBlockingInitialNavigation, withInMemoryScrolling } from '@angular/router';
import Aura from '@primeng/themes/aura';
import { definePreset } from '@primeng/themes';
import { providePrimeNG } from 'primeng/config';
import { appRoutes } from './app.routes';

// TOMO primary palette = slate ramp keyed on #242830 at the 500 step.
// All PrimeNG primary buttons / focus rings / selected states use this scale.
// Brand orange (#e27a34) is exposed separately via --tomo-secondary in tokens.scss
// — applied selectively to "verified" badges, eyebrow text, and accent CTAs.
const TomoPreset = definePreset(Aura, {
    semantic: {
        primary: {
            50:  '#f4f5f7',
            100: '#e1e3e8',
            200: '#c0c4cd',
            300: '#9ba1ad',
            400: '#6c727f',
            500: '#242830',
            600: '#1f222a',
            700: '#1a1d24',
            800: '#15171d',
            900: '#0f1116',
            950: '#050608'
        }
    }
});

export const appConfig: ApplicationConfig = {
    providers: [
        provideRouter(
            appRoutes,
            withInMemoryScrolling({ anchorScrolling: 'enabled', scrollPositionRestoration: 'enabled' }),
            withEnabledBlockingInitialNavigation()
        ),
        provideHttpClient(withFetch()),
        provideAnimationsAsync(),
        providePrimeNG({
            theme: {
                preset: TomoPreset,
                options: { darkModeSelector: '.app-dark' }
            },
            ripple: true
        })
    ]
};

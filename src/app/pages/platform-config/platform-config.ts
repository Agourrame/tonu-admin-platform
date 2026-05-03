import { Component } from '@angular/core';
import { ComingSoon } from '../_shared/coming-soon';

@Component({
    selector: 'app-platform-config',
    standalone: true,
    imports: [ComingSoon],
    template: `
        <app-coming-soon
            eyebrow="Configuration"
            title="Platform config"
            description="Key-value editor for platform-wide settings. Non-sensitive values only — no secrets, no API keys."
            icon="pi-cog"
        />
    `
})
export class PlatformConfig {}

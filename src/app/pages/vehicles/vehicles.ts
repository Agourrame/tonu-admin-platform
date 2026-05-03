import { Component } from '@angular/core';
import { ComingSoon } from '../_shared/coming-soon';

@Component({
    selector: 'app-vehicles',
    standalone: true,
    imports: [ComingSoon],
    template: `
        <app-coming-soon
            eyebrow="Marketplace"
            title="Vehicles"
            description="Fleet inventory across all agencies. Moderation, force-block bad listings, photo audit, status overrides."
            icon="pi-car"
        />
    `
})
export class Vehicles {}

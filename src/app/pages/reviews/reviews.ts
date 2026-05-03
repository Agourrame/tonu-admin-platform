import { Component } from '@angular/core';
import { ComingSoon } from '../_shared/coming-soon';

@Component({
    selector: 'app-reviews',
    standalone: true,
    imports: [ComingSoon],
    template: `
        <app-coming-soon
            eyebrow="Marketplace"
            title="Reviews"
            description="Ratings and feedback across both directions (renter → agency/vehicle, agency → renter). Visibility moderation."
            icon="pi-star"
        />
    `
})
export class Reviews {}

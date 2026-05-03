import { Component } from '@angular/core';
import { ComingSoon } from '../_shared/coming-soon';

@Component({
    selector: 'app-plans',
    standalone: true,
    imports: [ComingSoon],
    template: `
        <app-coming-soon
            eyebrow="Finance"
            title="Subscription plans"
            description="Pricing tiers (Starter / Basic / Pro / Enterprise) — commission_pct, max_vehicles, priority_listing."
            icon="pi-credit-card"
        />
    `
})
export class Plans {}

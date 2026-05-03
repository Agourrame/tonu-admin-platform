import { Component } from '@angular/core';
import { ComingSoon } from '../_shared/coming-soon';

@Component({
    selector: 'app-dashboard',
    standalone: true,
    imports: [ComingSoon],
    template: `
        <app-coming-soon
            eyebrow="Overview"
            title="Dashboard"
            description="Live KPIs across the marketplace — bookings, revenue, KYC queue depth, agency health."
            icon="pi-th-large"
        />
    `
})
export class Dashboard {}

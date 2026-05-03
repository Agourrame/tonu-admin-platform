import { Component } from '@angular/core';
import { ComingSoon } from '../_shared/coming-soon';

@Component({
    selector: 'app-reservations',
    standalone: true,
    imports: [ComingSoon],
    template: `
        <app-coming-soon
            eyebrow="Marketplace"
            title="Reservations"
            description="All bookings — pending / confirmed / active / completed / cancelled. Dispute handling, refund triggers."
            icon="pi-calendar"
        />
    `
})
export class Reservations {}

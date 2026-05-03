import { Component } from '@angular/core';
import { ComingSoon } from '../_shared/coming-soon';

@Component({
    selector: 'app-payments',
    standalone: true,
    imports: [ComingSoon],
    template: `
        <app-coming-soon
            eyebrow="Finance"
            title="Payments"
            description="Financial ledger — write-once snapshots per reservation. Revenue, commission, agency payouts."
            icon="pi-wallet"
        />
    `
})
export class Payments {}

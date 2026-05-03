import { Component } from '@angular/core';
import { ComingSoon } from '../_shared/coming-soon';

@Component({
    selector: 'app-agencies',
    standalone: true,
    imports: [ComingSoon],
    template: `
        <app-coming-soon
            eyebrow="People"
            title="Agencies"
            description="Rental companies hosting fleets. Application review (status + verification_status), KYC dossier, plan + commission overrides."
            icon="pi-building"
        />
    `
})
export class Agencies {}

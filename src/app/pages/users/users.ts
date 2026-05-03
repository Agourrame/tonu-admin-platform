import { Component } from '@angular/core';
import { ComingSoon } from '../_shared/coming-soon';

@Component({
    selector: 'app-users',
    standalone: true,
    imports: [ComingSoon],
    template: `
        <app-coming-soon
            eyebrow="People"
            title="Users"
            description="Renters, hosts, and admins. KYC verification queue, identity moderation, role assignment, suspension."
            icon="pi-users"
        />
    `
})
export class Users {}

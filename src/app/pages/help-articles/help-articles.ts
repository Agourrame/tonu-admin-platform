import { Component } from '@angular/core';
import { ComingSoon } from '../_shared/coming-soon';

@Component({
    selector: 'app-help-articles',
    standalone: true,
    imports: [ComingSoon],
    template: `
        <app-coming-soon
            eyebrow="Configuration"
            title="Help articles"
            description="Public help center editor. Plain-text body (max 8KB), category, slug, sort order, publish toggle."
            icon="pi-question-circle"
        />
    `
})
export class HelpArticles {}

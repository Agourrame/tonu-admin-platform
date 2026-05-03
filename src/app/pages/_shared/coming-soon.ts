import { Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * Reusable scaffolding for module pages whose real content isn't built yet.
 * Establishes the editorial header (eyebrow + h1 + sub) and a single
 * "Coming soon" empty-state card so the navigation/routing/auth/RLS
 * plumbing can be exercised end-to-end before we land real CRUD.
 */
@Component({
    selector: 'app-coming-soon',
    standalone: true,
    imports: [CommonModule],
    template: `
        <div class="coming-soon-page">
            <div class="tomo-page-titlebar tomo-anim-item">
                <span class="tomo-eyebrow">{{ eyebrow() }}</span>
                <h1 class="tomo-h1">{{ title() }}</h1>
                @if (description()) {
                    <p class="tomo-sub">{{ description() }}</p>
                }
            </div>

            <div class="empty-card tomo-anim-item">
                <div class="tomo-icon-badge is-orange is-lg">
                    <i [class]="'pi ' + (icon() || 'pi-sparkles')"></i>
                </div>
                <h3>Coming soon</h3>
                <p>This module's shell, routing, and design system are wired. Real content lands next.</p>
            </div>
        </div>
    `,
    styles: [
        `
            .coming-soon-page {
                padding: 32px 28px;
                max-width: 1200px;
            }
            .empty-card {
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 12px;
                padding: 56px 32px;
                background: var(--tomo-bg-card);
                border-radius: var(--tomo-radius-lg);
                box-shadow: var(--tomo-shadow-card);
                text-align: center;
                animation-delay: 0.08s;
            }
            .empty-card h3 {
                font-size: 18px;
                font-weight: 700;
                color: var(--tomo-text-strong);
                margin: 4px 0 0;
            }
            .empty-card p {
                font-size: 14px;
                color: var(--tomo-text-muted);
                max-width: 380px;
                line-height: 1.5;
                margin: 0;
            }
            .empty-card .tomo-icon-badge {
                font-size: 28px;
                margin-bottom: 4px;
            }
        `
    ]
})
export class ComingSoon {
    readonly eyebrow = input.required<string>();
    readonly title = input.required<string>();
    readonly description = input<string>('');
    readonly icon = input<string>('');
}

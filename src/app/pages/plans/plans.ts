import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ConfirmationService } from 'primeng/api';
import { SubscriptionPlansService } from '@/services/subscription-plans.service';
import { SubscriptionPlan, SubscriptionPlanInsert } from '@/models/subscription-plan';

interface FormState {
    code: string;
    name: string;
    monthly_price: number;
    commission_pct: number;
    max_vehicles: number;
    priority_listing: boolean;
    is_active: boolean;
}

@Component({
    selector: 'app-plans',
    standalone: true,
    imports: [CommonModule, FormsModule, ButtonModule, DialogModule, InputTextModule, InputNumberModule, ToggleSwitchModule, ConfirmDialogModule],
    providers: [ConfirmationService],
    template: `
        <div class="plans-page">
            <div class="page-head tomo-anim-item">
                <div class="tomo-page-titlebar">
                    <span class="tomo-eyebrow">Configuration</span>
                    <h1 class="tomo-h1">Subscription plans</h1>
                    <p class="tomo-sub">Pricing tiers for agency hosting. Each tier sets the platform commission, fleet size cap, and marketplace priority.</p>
                </div>
                <p-button
                    label="New plan"
                    icon="pi pi-plus"
                    (onClick)="openCreate()"
                    styleClass="new-plan-btn"
                />
            </div>

            @if (loading()) {
                <div class="plans-grid">
                    @for (_ of skeletonCards; track $index) {
                        <div class="plan-card tomo-anim-item">
                            <div class="tomo-sk-line" style="width: 50%"></div>
                            <div class="tomo-sk-line" style="width: 80%; margin-top: 18px; height: 28px"></div>
                            <div class="tomo-sk-line" style="width: 60%; margin-top: 14px"></div>
                            <div class="tomo-sk-line" style="width: 70%; margin-top: 8px"></div>
                            <div class="tomo-sk-line" style="width: 50%; margin-top: 8px"></div>
                        </div>
                    }
                </div>
            } @else if (!plans().length) {
                <div class="empty-state tomo-anim-item">
                    <div class="tomo-icon-badge is-orange is-lg">
                        <i class="pi pi-credit-card"></i>
                    </div>
                    <h3>No plans yet</h3>
                    <p>Add the first pricing tier to get agencies started. Suggested tiers: Starter (15%), Basic (12%), Pro (9%), Enterprise (6%).</p>
                    <p-button label="Create the first plan" icon="pi pi-plus" (onClick)="openCreate()" />
                </div>
            } @else {
                <div class="plans-grid tomo-anim-stagger">
                    @for (plan of plans(); track plan.code) {
                        <article class="plan-card" [class.is-inactive]="!plan.is_active">
                            <header class="plan-head">
                                <div class="plan-name-row">
                                    <span class="plan-code">{{ plan.code }}</span>
                                    @if (plan.is_active) {
                                        <span class="tomo-status is-success">Active</span>
                                    } @else {
                                        <span class="tomo-status is-muted">Hidden</span>
                                    }
                                </div>
                                <h3 class="plan-name">{{ plan.name }}</h3>
                            </header>

                            <div class="plan-price">
                                <span class="amount">{{ plan.monthly_price | number }}</span>
                                <span class="suffix">MAD<span class="per">/mo</span></span>
                            </div>

                            <ul class="plan-feats">
                                <li>
                                    <i class="pi pi-percentage"></i>
                                    <span><strong>{{ plan.commission_pct }}%</strong> platform commission</span>
                                </li>
                                <li>
                                    <i class="pi pi-car"></i>
                                    <span>Up to <strong>{{ plan.max_vehicles }}</strong> vehicles</span>
                                </li>
                                <li [class.dim]="!plan.priority_listing">
                                    <i [class]="plan.priority_listing ? 'pi pi-star-fill gold' : 'pi pi-star'"></i>
                                    <span>{{ plan.priority_listing ? 'Priority listing' : 'Standard listing' }}</span>
                                </li>
                            </ul>

                            <div class="plan-actions">
                                <button class="ghost-btn" (click)="openEdit(plan)" type="button">
                                    <i class="pi pi-pencil"></i> Edit
                                </button>
                                <button class="ghost-btn danger" (click)="confirmDelete(plan)" type="button">
                                    <i class="pi pi-trash"></i> Delete
                                </button>
                            </div>
                        </article>
                    }
                </div>
            }
        </div>

        <!-- Create / edit modal -->
        <p-dialog
            [visible]="modalOpen()"
            (onHide)="closeModal()"
            [header]="isEdit() ? 'Edit plan' : 'New plan'"
            [modal]="true"
            [style]="{ width: '500px' }"
            [closable]="true"
            [draggable]="false"
            [resizable]="false"
        >
            <form class="plan-form" (ngSubmit)="onSubmit()" #f="ngForm">
                <div class="grid">
                    <div class="cell col-6">
                        <label class="tomo-sub-label" for="planCode">Code (PK)</label>
                        <input
                            pInputText
                            id="planCode"
                            [(ngModel)]="form.code"
                            name="code"
                            placeholder="e.g. starter"
                            [disabled]="isEdit()"
                            required
                            class="form-input"
                        />
                        @if (isEdit()) {
                            <span class="hint">Code is the primary key — cannot be changed.</span>
                        }
                    </div>
                    <div class="cell col-6">
                        <label class="tomo-sub-label" for="planName">Display name</label>
                        <input
                            pInputText
                            id="planName"
                            [(ngModel)]="form.name"
                            name="name"
                            placeholder="e.g. Starter"
                            required
                            class="form-input"
                        />
                    </div>
                    <div class="cell col-6">
                        <label class="tomo-sub-label" for="planPrice">Monthly price</label>
                        <p-inputNumber
                            inputId="planPrice"
                            [(ngModel)]="form.monthly_price"
                            name="monthly_price"
                            suffix=" MAD"
                            [min]="0"
                            [maxFractionDigits]="2"
                            styleClass="num-input"
                        />
                    </div>
                    <div class="cell col-6">
                        <label class="tomo-sub-label" for="planComm">Commission %</label>
                        <p-inputNumber
                            inputId="planComm"
                            [(ngModel)]="form.commission_pct"
                            name="commission_pct"
                            suffix=" %"
                            [min]="0"
                            [max]="100"
                            [maxFractionDigits]="2"
                            styleClass="num-input"
                        />
                    </div>
                    <div class="cell col-12">
                        <label class="tomo-sub-label" for="planMax">Max vehicles</label>
                        <p-inputNumber
                            inputId="planMax"
                            [(ngModel)]="form.max_vehicles"
                            name="max_vehicles"
                            [min]="0"
                            [showButtons]="true"
                            buttonLayout="horizontal"
                            styleClass="num-input num-stepper"
                        />
                    </div>
                    <div class="cell col-12">
                        <label class="toggle-row">
                            <div class="toggle-info">
                                <span class="toggle-title">Priority listing</span>
                                <span class="toggle-sub">Featured on the marketplace home for this plan's agencies</span>
                            </div>
                            <p-toggleswitch [(ngModel)]="form.priority_listing" name="priority_listing" />
                        </label>
                    </div>
                    <div class="cell col-12">
                        <label class="toggle-row">
                            <div class="toggle-info">
                                <span class="toggle-title">Active</span>
                                <span class="toggle-sub">Inactive plans are hidden from new sign-ups but kept for billing history</span>
                            </div>
                            <p-toggleswitch [(ngModel)]="form.is_active" name="is_active" />
                        </label>
                    </div>
                </div>

                @if (formError(); as err) {
                    <div class="form-error" role="alert">
                        <i class="pi pi-exclamation-circle"></i>
                        <span>{{ err }}</span>
                    </div>
                }
            </form>

            <ng-template pTemplate="footer">
                <p-button
                    label="Cancel"
                    severity="secondary"
                    [text]="true"
                    (onClick)="closeModal()"
                />
                <p-button
                    [label]="isEdit() ? 'Save' : 'Create plan'"
                    [loading]="saving()"
                    [disabled]="!canSubmit()"
                    (onClick)="onSubmit()"
                />
            </ng-template>
        </p-dialog>

        <p-confirmdialog />
    `,
    styles: [
        `
            .plans-page {
                padding: 28px 28px 48px;
                max-width: 1200px;
            }
            .page-head {
                display: flex;
                align-items: flex-end;
                justify-content: space-between;
                gap: 24px;
                margin-bottom: 24px;
                flex-wrap: wrap;
            }
            .tomo-page-titlebar {
                margin-bottom: 0;
            }
            ::ng-deep .new-plan-btn .p-button {
                height: 44px;
                border-radius: var(--tomo-radius-md);
                padding: 0 20px;
                font-weight: 700;
            }
            .plans-grid {
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
                gap: 16px;
            }
            .plan-card {
                position: relative;
                display: flex;
                flex-direction: column;
                gap: 14px;
                padding: 22px;
                background: var(--tomo-bg-card);
                border-radius: var(--tomo-radius-lg);
                box-shadow: var(--tomo-shadow-card);
                transition: transform 200ms ease;
            }
            .plan-card.is-inactive {
                opacity: 0.7;
            }
            .plan-head {
                display: flex;
                flex-direction: column;
                gap: 6px;
            }
            .plan-name-row {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 8px;
            }
            .plan-code {
                font-size: 11px;
                font-weight: 700;
                text-transform: uppercase;
                letter-spacing: 1px;
                color: var(--tomo-secondary);
            }
            .plan-name {
                font-size: 18px;
                font-weight: 800;
                letter-spacing: -0.2px;
                color: var(--tomo-text-strong);
                margin: 0;
            }
            .plan-price {
                display: flex;
                align-items: baseline;
                gap: 6px;
                padding-bottom: 14px;
                border-bottom: 1px solid var(--tomo-divider);
            }
            .plan-price .amount {
                font-size: 32px;
                font-weight: 800;
                letter-spacing: -1px;
                color: var(--tomo-text-strong);
                line-height: 1;
            }
            .plan-price .suffix {
                font-size: 13px;
                font-weight: 700;
                color: var(--tomo-text-muted);
            }
            .plan-price .per {
                font-weight: 500;
                margin-left: 2px;
            }
            .plan-feats {
                list-style: none;
                margin: 0;
                padding: 0;
                display: flex;
                flex-direction: column;
                gap: 8px;
                font-size: 13px;
                color: var(--tomo-text);
            }
            .plan-feats li {
                display: flex;
                align-items: center;
                gap: 10px;
            }
            .plan-feats li.dim {
                color: var(--tomo-text-faint);
            }
            .plan-feats i {
                font-size: 13px;
                color: var(--tomo-text-muted);
                width: 16px;
            }
            .plan-feats i.gold {
                color: var(--tomo-gold);
            }
            .plan-actions {
                display: flex;
                gap: 8px;
                margin-top: auto;
                padding-top: 14px;
                border-top: 1px solid var(--tomo-divider);
            }
            .ghost-btn {
                flex: 1;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 6px;
                height: 36px;
                padding: 0 12px;
                background: transparent;
                border: 0;
                border-radius: var(--tomo-radius-md);
                font-size: 12.5px;
                font-weight: 700;
                color: var(--tomo-text-secondary);
                cursor: pointer;
                transition: background 160ms ease, color 160ms ease;
            }
            .ghost-btn:hover {
                background: var(--tomo-bg-soft);
                color: var(--tomo-text-strong);
            }
            .ghost-btn.danger:hover {
                background: rgba(229, 57, 53, 0.08);
                color: var(--tomo-danger);
            }
            .ghost-btn i {
                font-size: 12px;
            }

            .empty-state {
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 12px;
                padding: 64px 32px;
                background: var(--tomo-bg-card);
                border-radius: var(--tomo-radius-lg);
                box-shadow: var(--tomo-shadow-card);
                text-align: center;
            }
            .empty-state h3 {
                font-size: 18px;
                font-weight: 700;
                color: var(--tomo-text-strong);
                margin: 4px 0 0;
            }
            .empty-state p {
                font-size: 14px;
                color: var(--tomo-text-muted);
                max-width: 420px;
                line-height: 1.5;
                margin: 0 0 6px;
            }
            .empty-state .tomo-icon-badge {
                font-size: 26px;
            }

            /* Modal form */
            .plan-form {
                display: flex;
                flex-direction: column;
                gap: 6px;
            }
            .grid {
                display: grid;
                grid-template-columns: repeat(12, 1fr);
                column-gap: 12px;
                row-gap: 14px;
            }
            .cell {
                min-width: 0;
                display: flex;
                flex-direction: column;
            }
            .cell.col-6 {
                grid-column: span 6;
            }
            .cell.col-12 {
                grid-column: span 12;
            }
            .form-input {
                width: 100%;
                font-size: 13.5px;
            }
            ::ng-deep .num-input {
                width: 100%;
            }
            ::ng-deep .num-input .p-inputnumber-input {
                width: 100%;
            }
            .hint {
                font-size: 11.5px;
                color: var(--tomo-text-muted);
                margin-top: 4px;
            }
            .toggle-row {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 12px;
                padding: 12px 14px;
                background: var(--tomo-bg-soft);
                border-radius: var(--tomo-radius-md);
                cursor: pointer;
            }
            .toggle-info {
                display: flex;
                flex-direction: column;
                gap: 2px;
            }
            .toggle-title {
                font-size: 13.5px;
                font-weight: 700;
                color: var(--tomo-text-strong);
            }
            .toggle-sub {
                font-size: 12px;
                color: var(--tomo-text-muted);
                font-weight: 500;
            }
            .form-error {
                display: flex;
                align-items: flex-start;
                gap: 8px;
                margin-top: 14px;
                padding: 10px 12px;
                background: rgba(229, 57, 53, 0.08);
                border-radius: var(--tomo-radius-md);
                font-size: 12.5px;
                color: var(--tomo-danger);
                font-weight: 600;
                line-height: 1.4;
            }
        `
    ]
})
export class Plans {
    private plansService = inject(SubscriptionPlansService);
    private confirmationService = inject(ConfirmationService);

    readonly skeletonCards = Array.from({ length: 4 });

    readonly plans = signal<SubscriptionPlan[]>([]);
    readonly loading = signal(false);

    readonly modalOpen = signal(false);
    readonly editingCode = signal<string | null>(null);
    readonly saving = signal(false);
    readonly formError = signal<string | null>(null);

    readonly isEdit = computed(() => this.editingCode() !== null);

    form: FormState = this.blankForm();

    constructor() {
        void this.load();
    }

    private blankForm(): FormState {
        return {
            code: '',
            name: '',
            monthly_price: 0,
            commission_pct: 0,
            max_vehicles: 5,
            priority_listing: false,
            is_active: true
        };
    }

    private async load(): Promise<void> {
        this.loading.set(true);
        const list = await this.plansService.listAll();
        this.plans.set(list);
        this.loading.set(false);
    }

    openCreate(): void {
        this.form = this.blankForm();
        this.editingCode.set(null);
        this.formError.set(null);
        this.modalOpen.set(true);
    }

    openEdit(plan: SubscriptionPlan): void {
        this.form = { ...plan };
        this.editingCode.set(plan.code);
        this.formError.set(null);
        this.modalOpen.set(true);
    }

    closeModal(): void {
        this.modalOpen.set(false);
    }

    canSubmit(): boolean {
        if (this.saving()) return false;
        return !!this.form.code.trim() && !!this.form.name.trim();
    }

    async onSubmit(): Promise<void> {
        if (!this.canSubmit()) return;
        this.formError.set(null);
        this.saving.set(true);

        if (this.isEdit()) {
            const ok = await this.plansService.update(this.editingCode()!, {
                name: this.form.name.trim(),
                monthly_price: this.form.monthly_price ?? 0,
                commission_pct: this.form.commission_pct ?? 0,
                max_vehicles: this.form.max_vehicles ?? 0,
                priority_listing: this.form.priority_listing,
                is_active: this.form.is_active
            });
            this.saving.set(false);
            if (!ok) {
                this.formError.set('Could not save changes. Check console for details.');
                return;
            }
        } else {
            const insert: SubscriptionPlanInsert = {
                code: this.form.code.trim().toLowerCase(),
                name: this.form.name.trim(),
                monthly_price: this.form.monthly_price ?? 0,
                commission_pct: this.form.commission_pct ?? 0,
                max_vehicles: this.form.max_vehicles ?? 0,
                priority_listing: this.form.priority_listing,
                is_active: this.form.is_active
            };
            const created = await this.plansService.create(insert);
            this.saving.set(false);
            if (!created) {
                this.formError.set('Could not create the plan. The code may already exist.');
                return;
            }
        }

        this.modalOpen.set(false);
        await this.load();
    }

    async confirmDelete(plan: SubscriptionPlan): Promise<void> {
        const linked = await this.plansService.agencyCount(plan.code);
        const message =
            linked > 0
                ? `<strong>${plan.name}</strong> is currently used by ${linked} agenc${linked === 1 ? 'y' : 'ies'}. Deleting will fail unless you re-assign them first. Continue?`
                : `Delete the <strong>${plan.name}</strong> plan? This cannot be undone.`;

        this.confirmationService.confirm({
            header: 'Delete plan',
            message,
            icon: 'pi pi-exclamation-triangle',
            acceptLabel: 'Delete',
            acceptButtonProps: { severity: 'danger' },
            rejectLabel: 'Cancel',
            rejectButtonProps: { severity: 'secondary', text: true },
            accept: async () => {
                const ok = await this.plansService.remove(plan.code);
                if (ok) await this.load();
            }
        });
    }
}

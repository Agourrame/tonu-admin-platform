import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ConfirmationService } from 'primeng/api';
import { PlatformConfigService } from '@/services/platform-config.service';
import { PlatformConfig as ConfigRow } from '@/models/platform-config';

interface FormState {
    key: string;
    value: string;
    description: string;
}

@Component({
    selector: 'app-platform-config',
    standalone: true,
    imports: [CommonModule, FormsModule, ButtonModule, DialogModule, InputTextModule, TextareaModule, ConfirmDialogModule],
    providers: [ConfirmationService],
    template: `
        <div class="config-page">
            <div class="page-head tomo-anim-item">
                <div class="tomo-page-titlebar">
                    <span class="tomo-eyebrow">Configuration</span>
                    <h1 class="tomo-h1">Platform config</h1>
                    <p class="tomo-sub">Plain key/value table for non-sensitive runtime settings (booking windows, cancellation grace periods, feature flags). Never store secrets here.</p>
                </div>
                <p-button
                    label="New key"
                    icon="pi pi-plus"
                    (onClick)="openCreate()"
                    styleClass="new-key-btn"
                />
            </div>

            @if (loading()) {
                <div class="rows tomo-anim-item">
                    @for (_ of skeletonRows; track $index) {
                        <div class="cfg-row">
                            <div class="tomo-sk-line" style="width: 30%; height: 14px"></div>
                            <div class="tomo-sk-line" style="width: 60%; margin-top: 10px"></div>
                        </div>
                    }
                </div>
            } @else if (!rows().length) {
                <div class="empty-state tomo-anim-item">
                    <div class="tomo-icon-badge is-orange is-lg">
                        <i class="pi pi-cog"></i>
                    </div>
                    <h3>Empty config</h3>
                    <p>Add your first runtime setting. Examples: <code>min_booking_hours</code>, <code>cancellation_grace_period</code>, <code>maintenance_mode</code>.</p>
                    <p-button label="Add the first key" icon="pi pi-plus" (onClick)="openCreate()" />
                </div>
            } @else {
                <div class="rows tomo-anim-stagger">
                    @for (row of rows(); track row.key) {
                        <div class="cfg-row">
                            <div class="cfg-main">
                                <div class="cfg-key">{{ row.key }}</div>
                                @if (row.description) {
                                    <div class="cfg-desc">{{ row.description }}</div>
                                }
                                <div class="cfg-value">
                                    <span class="cfg-value-label">value</span>
                                    <code>{{ row.value }}</code>
                                </div>
                            </div>
                            <div class="cfg-actions">
                                <span class="cfg-time">{{ formatRelative(row.updated_at) }}</span>
                                <button class="icon-btn" type="button" (click)="openEdit(row)" aria-label="Edit">
                                    <i class="pi pi-pencil"></i>
                                </button>
                                <button class="icon-btn danger" type="button" (click)="confirmDelete(row)" aria-label="Delete">
                                    <i class="pi pi-trash"></i>
                                </button>
                            </div>
                        </div>
                    }
                </div>
            }
        </div>

        <p-dialog
            [visible]="modalOpen()"
            (onHide)="closeModal()"
            [header]="isEdit() ? 'Edit key' : 'New key'"
            [modal]="true"
            [style]="{ width: '500px' }"
            [closable]="true"
            [draggable]="false"
            [resizable]="false"
        >
            <div class="form">
                <div>
                    <label class="tomo-sub-label">Key</label>
                    <input
                        pInputText
                        [(ngModel)]="form.key"
                        placeholder="snake_case_identifier"
                        [disabled]="isEdit()"
                        class="form-input mono"
                    />
                    @if (isEdit()) {
                        <span class="hint">Key is the primary key — cannot be changed.</span>
                    } @else {
                        <span class="hint">Lowercase + underscores. Used as the lookup id by the apps.</span>
                    }
                </div>
                <div>
                    <label class="tomo-sub-label">Value</label>
                    <textarea
                        pTextarea
                        [(ngModel)]="form.value"
                        rows="3"
                        placeholder="Plain text — JSON, number, string, or whatever your code expects"
                        class="form-input"
                    ></textarea>
                </div>
                <div>
                    <label class="tomo-sub-label">Description (optional)</label>
                    <input
                        pInputText
                        [(ngModel)]="form.description"
                        placeholder="What this key controls — for the next admin"
                        class="form-input"
                    />
                </div>

                @if (formError(); as err) {
                    <div class="form-error">
                        <i class="pi pi-exclamation-circle"></i>
                        <span>{{ err }}</span>
                    </div>
                }
            </div>

            <ng-template pTemplate="footer">
                <p-button label="Cancel" severity="secondary" [text]="true" (onClick)="closeModal()" />
                <p-button
                    [label]="isEdit() ? 'Save' : 'Create'"
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
            .config-page {
                padding: 28px 28px 48px;
                max-width: 920px;
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
            ::ng-deep .new-key-btn .p-button {
                height: 44px;
                border-radius: var(--tomo-radius-md);
                padding: 0 20px;
                font-weight: 700;
            }
            .rows {
                display: flex;
                flex-direction: column;
                gap: 10px;
            }
            .cfg-row {
                display: flex;
                gap: 16px;
                align-items: center;
                padding: 16px 20px;
                background: var(--tomo-bg-card);
                border-radius: var(--tomo-radius-lg);
                box-shadow: var(--tomo-shadow-card);
            }
            .cfg-main {
                flex: 1;
                min-width: 0;
            }
            .cfg-key {
                font-family: ui-monospace, SFMono-Regular, monospace;
                font-size: 13.5px;
                font-weight: 700;
                color: var(--tomo-primary);
                margin-bottom: 4px;
            }
            .cfg-desc {
                font-size: 12.5px;
                color: var(--tomo-text-muted);
                margin-bottom: 8px;
                line-height: 1.45;
            }
            .cfg-value {
                display: flex;
                align-items: center;
                gap: 8px;
                font-size: 12.5px;
            }
            .cfg-value-label {
                font-size: 10px;
                font-weight: 700;
                color: var(--tomo-text-muted);
                text-transform: uppercase;
                letter-spacing: 0.6px;
            }
            .cfg-value code {
                font-family: ui-monospace, SFMono-Regular, monospace;
                background: var(--tomo-bg-soft);
                padding: 3px 8px;
                border-radius: 6px;
                color: var(--tomo-text-strong);
                word-break: break-all;
            }
            .cfg-actions {
                display: flex;
                align-items: center;
                gap: 4px;
                flex-shrink: 0;
            }
            .cfg-time {
                font-size: 11px;
                color: var(--tomo-text-faint);
                margin-right: 8px;
            }
            .icon-btn {
                background: none;
                border: 0;
                padding: 8px;
                border-radius: 8px;
                cursor: pointer;
                color: var(--tomo-text-muted);
                transition: background 160ms ease, color 160ms ease;
            }
            .icon-btn i {
                font-size: 13px;
            }
            .icon-btn:hover {
                background: var(--tomo-bg-soft);
                color: var(--tomo-text-strong);
            }
            .icon-btn.danger:hover {
                background: rgba(229, 57, 53, 0.08);
                color: var(--tomo-danger);
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
                max-width: 460px;
                line-height: 1.5;
                margin: 0 0 6px;
            }
            .empty-state code {
                font-family: ui-monospace, SFMono-Regular, monospace;
                background: var(--tomo-bg-soft);
                padding: 1px 6px;
                border-radius: 4px;
                font-size: 12.5px;
                color: var(--tomo-primary);
            }
            .empty-state .tomo-icon-badge {
                font-size: 26px;
            }

            /* Form */
            .form {
                display: flex;
                flex-direction: column;
                gap: 14px;
            }
            .form-input {
                width: 100%;
                font-size: 13.5px;
            }
            .form-input.mono {
                font-family: ui-monospace, SFMono-Regular, monospace;
            }
            .hint {
                display: block;
                font-size: 11.5px;
                color: var(--tomo-text-muted);
                margin-top: 4px;
            }
            .form-error {
                display: flex;
                gap: 8px;
                padding: 10px 12px;
                background: rgba(229, 57, 53, 0.08);
                border-radius: var(--tomo-radius-md);
                font-size: 12.5px;
                color: var(--tomo-danger);
                font-weight: 600;
            }
        `
    ]
})
export class PlatformConfig {
    private configService = inject(PlatformConfigService);
    private confirmationService = inject(ConfirmationService);

    readonly skeletonRows = Array.from({ length: 4 });

    readonly rows = signal<ConfigRow[]>([]);
    readonly loading = signal(false);

    readonly modalOpen = signal(false);
    readonly editingKey = signal<string | null>(null);
    readonly saving = signal(false);
    readonly formError = signal<string | null>(null);

    readonly isEdit = computed(() => this.editingKey() !== null);

    form: FormState = this.blankForm();

    constructor() {
        void this.load();
    }

    private blankForm(): FormState {
        return { key: '', value: '', description: '' };
    }

    private async load(): Promise<void> {
        this.loading.set(true);
        this.rows.set(await this.configService.list());
        this.loading.set(false);
    }

    openCreate(): void {
        this.form = this.blankForm();
        this.editingKey.set(null);
        this.formError.set(null);
        this.modalOpen.set(true);
    }

    openEdit(row: ConfigRow): void {
        this.form = {
            key: row.key,
            value: row.value,
            description: row.description ?? ''
        };
        this.editingKey.set(row.key);
        this.formError.set(null);
        this.modalOpen.set(true);
    }

    closeModal(): void {
        this.modalOpen.set(false);
    }

    canSubmit(): boolean {
        if (this.saving()) return false;
        return !!this.form.key.trim() && this.form.value.length > 0;
    }

    async onSubmit(): Promise<void> {
        if (!this.canSubmit()) return;
        this.formError.set(null);
        this.saving.set(true);

        const desc = this.form.description.trim() || null;
        const ok = this.isEdit()
            ? await this.configService.update(this.editingKey()!, { value: this.form.value, description: desc })
            : !!(await this.configService.upsert({
                  key: this.form.key.trim(),
                  value: this.form.value,
                  description: desc
              }));

        this.saving.set(false);
        if (!ok) {
            this.formError.set(this.isEdit() ? 'Could not save changes.' : 'Could not create — key may already exist.');
            return;
        }

        this.modalOpen.set(false);
        await this.load();
    }

    confirmDelete(row: ConfigRow): void {
        this.confirmationService.confirm({
            header: 'Delete config key',
            message: `Permanently delete <code>${row.key}</code>? Any code reading this key will fall back to its hardcoded default.`,
            icon: 'pi pi-exclamation-triangle',
            acceptLabel: 'Delete',
            acceptButtonProps: { severity: 'danger' },
            rejectLabel: 'Cancel',
            rejectButtonProps: { severity: 'secondary', text: true },
            accept: async () => {
                const ok = await this.configService.remove(row.key);
                if (ok) await this.load();
            }
        });
    }

    formatRelative(iso: string | null | undefined): string {
        if (!iso) return '—';
        const ms = Date.now() - new Date(iso).getTime();
        const min = Math.round(ms / 60000);
        if (min < 1) return 'just now';
        if (min < 60) return `${min}m ago`;
        const hr = Math.round(min / 60);
        if (hr < 24) return `${hr}h ago`;
        const d = Math.round(hr / 24);
        if (d < 30) return `${d}d ago`;
        return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
    }
}

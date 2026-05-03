import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { TextareaModule } from 'primeng/textarea';
import { SelectModule } from 'primeng/select';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ConfirmationService } from 'primeng/api';
import { HELP_CATEGORIES, HelpArticlesFilter, HelpArticlesService } from '@/services/help-articles.service';
import { HelpArticle, HelpArticleCategory } from '@/models/help-article';

interface FormState {
    slug: string;
    title: string;
    summary: string;
    body: string;
    category: HelpArticleCategory;
    icon: string;
    sort_order: number;
    is_published: boolean;
}

interface FilterOption {
    key: HelpArticlesFilter;
    label: string;
}

@Component({
    selector: 'app-help-articles',
    standalone: true,
    imports: [CommonModule, FormsModule, ButtonModule, DialogModule, InputTextModule, InputNumberModule, TextareaModule, SelectModule, ToggleSwitchModule, ConfirmDialogModule],
    providers: [ConfirmationService],
    template: `
        <div class="ha-page">
            <div class="page-head tomo-anim-item">
                <div class="tomo-page-titlebar">
                    <span class="tomo-eyebrow">Configuration</span>
                    <h1 class="tomo-h1">Help articles</h1>
                    <p class="tomo-sub">Public help center content. Plain-text body (max 8 KB), rendered with paragraph breaks on <code>\\n\\n</code>. No HTML / markdown — keeps the trust surface tight.</p>
                </div>
                <p-button label="New article" icon="pi pi-plus" (onClick)="openCreate()" styleClass="new-btn" />
            </div>

            <div class="filter-row tomo-anim-item" style="animation-delay: 0.04s">
                <div class="chips">
                    @for (opt of filterOptions; track opt.key) {
                        <button
                            type="button"
                            class="tomo-chip"
                            [class.is-active]="filter() === opt.key"
                            (click)="setFilter(opt.key)"
                        >
                            {{ opt.label }}
                        </button>
                    }
                </div>
            </div>

            @if (loading()) {
                <div class="rows tomo-anim-item">
                    @for (_ of skeletonRows; track $index) {
                        <div class="ha-card">
                            <div class="tomo-sk-line" style="width: 30%; height: 16px"></div>
                            <div class="tomo-sk-line" style="width: 70%; margin-top: 10px"></div>
                            <div class="tomo-sk-line" style="width: 50%; margin-top: 6px"></div>
                        </div>
                    }
                </div>
            } @else if (!rows().length) {
                <div class="empty-state tomo-anim-item">
                    <div class="tomo-icon-badge is-orange is-lg">
                        <i class="pi pi-question-circle"></i>
                    </div>
                    @if (filter() !== 'all') {
                        <h3>Nothing here</h3>
                        <p>No help articles match the "{{ activeFilterLabel() }}" filter.</p>
                    } @else {
                        <h3>No articles yet</h3>
                        <p>Add your first FAQ. Categories: reservations, identity, account, payments, hosting, privacy, general.</p>
                        <p-button label="Add the first article" icon="pi pi-plus" (onClick)="openCreate()" />
                    }
                </div>
            } @else {
                <div class="rows tomo-anim-stagger">
                    @for (article of rows(); track article.id) {
                        <article class="ha-card" [class.is-draft]="!article.is_published">
                            <div class="card-head">
                                <div class="card-meta">
                                    <span class="cat-pill">{{ article.category }}</span>
                                    @if (article.is_published) {
                                        <span class="tomo-status is-success">Published</span>
                                    } @else {
                                        <span class="tomo-status is-muted">Draft</span>
                                    }
                                    <span class="sort">#{{ article.sort_order }}</span>
                                </div>
                                <div class="card-actions">
                                    <p-toggleswitch
                                        [ngModel]="article.is_published"
                                        (ngModelChange)="onTogglePublished(article, $event)"
                                        [disabled]="busyId() === article.id"
                                    />
                                    <button class="icon-btn" type="button" (click)="openEdit(article)" aria-label="Edit">
                                        <i class="pi pi-pencil"></i>
                                    </button>
                                    <button class="icon-btn danger" type="button" (click)="confirmDelete(article)" aria-label="Delete">
                                        <i class="pi pi-trash"></i>
                                    </button>
                                </div>
                            </div>
                            <div class="card-title-row">
                                <h3 class="card-title">{{ article.title }}</h3>
                                <span class="slug">/{{ article.slug }}</span>
                            </div>
                            @if (article.summary) {
                                <p class="card-summary">{{ article.summary }}</p>
                            }
                            <div class="card-body-preview">{{ truncate(article.body, 240) }}</div>
                            <div class="card-foot dim-small">Updated {{ formatRelative(article.updated_at) }}</div>
                        </article>
                    }
                </div>
            }
        </div>

        <!-- Create / edit modal -->
        <p-dialog
            [visible]="modalOpen()"
            (onHide)="closeModal()"
            [header]="isEdit() ? 'Edit article' : 'New article'"
            [modal]="true"
            [style]="{ width: '640px' }"
            [closable]="true"
            [draggable]="false"
            [resizable]="false"
        >
            <div class="form">
                <div class="grid">
                    <div class="cell col-7">
                        <label class="tomo-sub-label">Slug</label>
                        <input
                            pInputText
                            [(ngModel)]="form.slug"
                            placeholder="cancel-reservation"
                            [disabled]="isEdit()"
                            class="form-input mono"
                        />
                        @if (isEdit()) {
                            <span class="hint">URL identifier — locked once created.</span>
                        }
                    </div>
                    <div class="cell col-5">
                        <label class="tomo-sub-label">Category</label>
                        <p-select
                            [options]="categoryOptions"
                            [(ngModel)]="form.category"
                            optionLabel="label"
                            optionValue="value"
                            styleClass="form-select"
                        />
                    </div>
                    <div class="cell col-12">
                        <label class="tomo-sub-label">Title</label>
                        <input
                            pInputText
                            [(ngModel)]="form.title"
                            placeholder="How do I cancel a reservation?"
                            class="form-input"
                        />
                    </div>
                    <div class="cell col-12">
                        <label class="tomo-sub-label">Summary (optional)</label>
                        <input
                            pInputText
                            [(ngModel)]="form.summary"
                            placeholder="One-line preview shown in the help list"
                            class="form-input"
                        />
                    </div>
                    <div class="cell col-12">
                        <label class="tomo-sub-label">Body</label>
                        <textarea
                            pTextarea
                            [(ngModel)]="form.body"
                            rows="10"
                            placeholder="Plain text. Separate paragraphs with a blank line. No HTML or markdown."
                            class="form-input body-textarea"
                        ></textarea>
                        <span class="hint">{{ form.body.length }} / 8192 characters</span>
                    </div>
                    <div class="cell col-6">
                        <label class="tomo-sub-label">Icon (ionicon name)</label>
                        <input
                            pInputText
                            [(ngModel)]="form.icon"
                            placeholder="help-circle-outline"
                            class="form-input mono"
                        />
                    </div>
                    <div class="cell col-6">
                        <label class="tomo-sub-label">Sort order</label>
                        <p-inputNumber
                            [(ngModel)]="form.sort_order"
                            [min]="0"
                            [showButtons]="true"
                            buttonLayout="horizontal"
                            styleClass="form-num"
                        />
                    </div>
                    <div class="cell col-12">
                        <label class="toggle-row">
                            <div>
                                <div class="toggle-title">Published</div>
                                <div class="toggle-sub">Drafts are hidden from end users.</div>
                            </div>
                            <p-toggleswitch [(ngModel)]="form.is_published" />
                        </label>
                    </div>
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
            .ha-page {
                padding: 28px 28px 48px;
                max-width: 1100px;
            }
            .page-head {
                display: flex;
                align-items: flex-end;
                justify-content: space-between;
                gap: 24px;
                margin-bottom: 18px;
                flex-wrap: wrap;
            }
            .tomo-page-titlebar {
                margin-bottom: 0;
            }
            .tomo-page-titlebar code {
                font-family: ui-monospace, SFMono-Regular, monospace;
                background: var(--tomo-bg-soft);
                padding: 1px 6px;
                border-radius: 4px;
                font-size: 12.5px;
                color: var(--tomo-primary);
            }
            ::ng-deep .new-btn .p-button {
                height: 44px;
                border-radius: var(--tomo-radius-md);
                padding: 0 20px;
                font-weight: 700;
            }
            .filter-row {
                margin-bottom: 18px;
            }
            .chips {
                display: flex;
                flex-wrap: wrap;
                gap: 8px;
            }
            .rows {
                display: flex;
                flex-direction: column;
                gap: 12px;
            }
            .ha-card {
                background: var(--tomo-bg-card);
                border-radius: var(--tomo-radius-lg);
                box-shadow: var(--tomo-shadow-card);
                padding: 20px 22px;
            }
            .ha-card.is-draft {
                opacity: 0.7;
            }
            .card-head {
                display: flex;
                justify-content: space-between;
                align-items: flex-start;
                gap: 12px;
                margin-bottom: 8px;
            }
            .card-meta {
                display: flex;
                align-items: center;
                gap: 8px;
                flex-wrap: wrap;
            }
            .cat-pill {
                display: inline-flex;
                align-items: center;
                padding: 0 10px;
                height: 22px;
                border-radius: var(--tomo-radius-pill);
                background: rgba(226, 122, 52, 0.12);
                color: var(--tomo-secondary);
                font-size: 11px;
                font-weight: 700;
                text-transform: uppercase;
                letter-spacing: 0.4px;
            }
            .sort {
                font-family: ui-monospace, SFMono-Regular, monospace;
                font-size: 11px;
                color: var(--tomo-text-muted);
            }
            .card-actions {
                display: flex;
                align-items: center;
                gap: 6px;
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
            .card-title-row {
                display: flex;
                align-items: baseline;
                gap: 12px;
                flex-wrap: wrap;
                margin-bottom: 6px;
            }
            .card-title {
                font-size: 16px;
                font-weight: 800;
                letter-spacing: -0.2px;
                color: var(--tomo-text-strong);
                margin: 0;
            }
            .slug {
                font-family: ui-monospace, SFMono-Regular, monospace;
                font-size: 11.5px;
                color: var(--tomo-text-muted);
            }
            .card-summary {
                font-size: 13px;
                color: var(--tomo-text-secondary);
                margin: 0 0 8px;
                font-style: italic;
            }
            .card-body-preview {
                font-size: 13px;
                color: var(--tomo-text);
                line-height: 1.55;
                white-space: pre-wrap;
                background: var(--tomo-bg-soft);
                border-radius: var(--tomo-radius-md);
                padding: 12px 14px;
                margin-bottom: 10px;
            }
            .card-foot {
                font-size: 11.5px;
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
                max-width: 480px;
                line-height: 1.5;
                margin: 0 0 6px;
            }
            .empty-state .tomo-icon-badge {
                font-size: 26px;
            }

            .dim-small {
                color: var(--tomo-text-muted);
                font-size: 11.5px;
                font-weight: 500;
            }

            /* Form */
            .form {
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
            .cell.col-5 {
                grid-column: span 5;
            }
            .cell.col-6 {
                grid-column: span 6;
            }
            .cell.col-7 {
                grid-column: span 7;
            }
            .cell.col-12 {
                grid-column: span 12;
            }
            .form-input {
                width: 100%;
                font-size: 13.5px;
            }
            .form-input.mono {
                font-family: ui-monospace, SFMono-Regular, monospace;
            }
            .body-textarea {
                font-family: ui-monospace, SFMono-Regular, monospace;
                font-size: 12.5px;
                line-height: 1.6;
                resize: vertical;
            }
            ::ng-deep .form-select,
            ::ng-deep .form-num {
                width: 100%;
            }
            ::ng-deep .form-num .p-inputnumber-input {
                width: 100%;
            }
            .hint {
                display: block;
                font-size: 11.5px;
                color: var(--tomo-text-muted);
                margin-top: 4px;
            }
            .toggle-row {
                display: flex;
                justify-content: space-between;
                align-items: center;
                gap: 12px;
                padding: 12px 14px;
                background: var(--tomo-bg-soft);
                border-radius: var(--tomo-radius-md);
                cursor: pointer;
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
                margin-top: 2px;
            }
            .form-error {
                display: flex;
                gap: 8px;
                margin-top: 14px;
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
export class HelpArticles {
    private articlesService = inject(HelpArticlesService);
    private confirmationService = inject(ConfirmationService);

    readonly skeletonRows = Array.from({ length: 4 });

    readonly filterOptions: FilterOption[] = [
        { key: 'all', label: 'All' },
        { key: 'published', label: 'Published' },
        { key: 'drafts', label: 'Drafts' },
        ...HELP_CATEGORIES.map((c) => ({ key: c as HelpArticlesFilter, label: c[0]!.toUpperCase() + c.slice(1) }))
    ];

    readonly categoryOptions = HELP_CATEGORIES.map((c) => ({
        label: c[0]!.toUpperCase() + c.slice(1),
        value: c
    }));

    readonly rows = signal<HelpArticle[]>([]);
    readonly loading = signal(false);
    readonly filter = signal<HelpArticlesFilter>('all');

    readonly busyId = signal<string | null>(null);

    readonly modalOpen = signal(false);
    readonly editingId = signal<string | null>(null);
    readonly saving = signal(false);
    readonly formError = signal<string | null>(null);

    readonly isEdit = computed(() => this.editingId() !== null);

    readonly activeFilterLabel = computed(
        () => this.filterOptions.find((o) => o.key === this.filter())?.label ?? ''
    );

    form: FormState = this.blankForm();

    constructor() {
        void this.load();
    }

    private blankForm(): FormState {
        return {
            slug: '',
            title: '',
            summary: '',
            body: '',
            category: 'general',
            icon: '',
            sort_order: 100,
            is_published: false
        };
    }

    private async load(): Promise<void> {
        this.loading.set(true);
        this.rows.set(await this.articlesService.list(this.filter()));
        this.loading.set(false);
    }

    setFilter(filter: HelpArticlesFilter): void {
        if (this.filter() === filter) return;
        this.filter.set(filter);
        void this.load();
    }

    openCreate(): void {
        this.form = this.blankForm();
        this.editingId.set(null);
        this.formError.set(null);
        this.modalOpen.set(true);
    }

    openEdit(article: HelpArticle): void {
        this.form = {
            slug: article.slug,
            title: article.title,
            summary: article.summary ?? '',
            body: article.body,
            category: article.category,
            icon: article.icon ?? '',
            sort_order: article.sort_order,
            is_published: article.is_published
        };
        this.editingId.set(article.id);
        this.formError.set(null);
        this.modalOpen.set(true);
    }

    closeModal(): void {
        this.modalOpen.set(false);
    }

    canSubmit(): boolean {
        if (this.saving()) return false;
        if (!this.form.slug.trim() || !this.form.title.trim() || !this.form.body.trim()) return false;
        if (this.form.body.length > 8192) return false;
        return true;
    }

    async onSubmit(): Promise<void> {
        if (!this.canSubmit()) return;
        this.formError.set(null);
        this.saving.set(true);

        const payload = {
            slug: this.form.slug.trim(),
            title: this.form.title.trim(),
            summary: this.form.summary.trim() || null,
            body: this.form.body,
            category: this.form.category,
            icon: this.form.icon.trim() || null,
            sort_order: this.form.sort_order ?? 100,
            is_published: this.form.is_published
        };

        const ok = this.isEdit()
            ? await this.articlesService.update(this.editingId()!, payload)
            : !!(await this.articlesService.create(payload));

        this.saving.set(false);
        if (!ok) {
            this.formError.set(this.isEdit() ? 'Could not save changes.' : 'Could not create — slug may already exist.');
            return;
        }
        this.modalOpen.set(false);
        await this.load();
    }

    async onTogglePublished(article: HelpArticle, next: boolean): Promise<void> {
        if (this.busyId()) return;
        this.busyId.set(article.id);
        const ok = await this.articlesService.setPublished(article.id, next);
        this.busyId.set(null);
        if (ok) {
            this.rows.update((list) => list.map((a) => (a.id === article.id ? { ...a, is_published: next } : a)));
        }
    }

    confirmDelete(article: HelpArticle): void {
        this.confirmationService.confirm({
            header: 'Delete article',
            message: `Permanently delete <strong>${article.title}</strong> (<code>${article.slug}</code>)? Unpublishing is usually preferred — delete only if the slug is being retired.`,
            icon: 'pi pi-exclamation-triangle',
            acceptLabel: 'Delete',
            acceptButtonProps: { severity: 'danger' },
            rejectLabel: 'Cancel',
            rejectButtonProps: { severity: 'secondary', text: true },
            accept: async () => {
                const ok = await this.articlesService.remove(article.id);
                if (ok) await this.load();
            }
        });
    }

    truncate(s: string, n: number): string {
        if (!s) return '';
        if (s.length <= n) return s;
        return s.slice(0, n).trimEnd() + '…';
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

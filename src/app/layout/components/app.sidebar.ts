import { Component, ElementRef, ViewChild } from '@angular/core';
import { AppMenu } from './app.menu';
import { LayoutService } from '@/layout/service/layout.service';
import { RouterModule } from '@angular/router';

@Component({
    selector: '[app-sidebar]',
    standalone: true,
    imports: [AppMenu, RouterModule],
    template: `
        <div class="layout-sidebar" (mouseenter)="onMouseEnter()" (mouseleave)="onMouseLeave()">
            <div class="sidebar-header">
                <a [routerLink]="['/']" class="app-logo">
                    <!-- TOMO logo — full (slate plate + orange car silhouette + wordmark) -->
                    <svg
                        class="app-logo-normal"
                        viewBox="0 0 148 32"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                        aria-label="TOMO"
                    >
                        <rect x="0" y="0" width="32" height="32" rx="8" fill="#242830" />
                        <path
                            d="M7 19 L11.5 13 L20.5 13 L25 19"
                            stroke="#e27a34"
                            stroke-width="2"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            fill="none"
                        />
                        <rect x="9.5" y="18.5" width="13" height="2" rx="1" fill="#e27a34" />
                        <circle cx="11" cy="22" r="2" fill="#e27a34" />
                        <circle cx="21" cy="22" r="2" fill="#e27a34" />
                        <text
                            x="42"
                            y="22"
                            font-family="Lato, system-ui, sans-serif"
                            font-size="18"
                            font-weight="800"
                            letter-spacing="-0.4"
                            fill="var(--logo-color)"
                        >TOMO</text>
                        <text
                            x="42"
                            y="29"
                            font-family="Lato, system-ui, sans-serif"
                            font-size="7.5"
                            font-weight="800"
                            letter-spacing="1.6"
                            fill="#e27a34"
                        >ADMIN</text>
                    </svg>

                    <!-- TOMO mark — compact (just the icon plate) -->
                    <svg
                        class="app-logo-small"
                        viewBox="0 0 32 32"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                        aria-label="TOMO"
                    >
                        <rect x="0" y="0" width="32" height="32" rx="8" fill="#242830" />
                        <path
                            d="M7 19 L11.5 13 L20.5 13 L25 19"
                            stroke="#e27a34"
                            stroke-width="2"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            fill="none"
                        />
                        <rect x="9.5" y="18.5" width="13" height="2" rx="1" fill="#e27a34" />
                        <circle cx="11" cy="22" r="2" fill="#e27a34" />
                        <circle cx="21" cy="22" r="2" fill="#e27a34" />
                    </svg>
                </a>
                <button class="layout-sidebar-anchor p-link z-2" type="button" (click)="anchor()"></button>
            </div>

            <div #menuContainer class="layout-menu-container">
                <app-menu></app-menu>
            </div>
        </div>
    `
})
export class AppSidebar {
    timeout: any = null;

    @ViewChild('menuContainer') menuContainer!: ElementRef;

    constructor(
        public layoutService: LayoutService,
        public el: ElementRef
    ) {}

    onMouseEnter() {
        if (!this.layoutService.layoutState().anchored) {
            if (this.timeout) {
                clearTimeout(this.timeout);
                this.timeout = null;
            }

            this.layoutService.layoutState.update((state) => {
                if (!state.sidebarActive) {
                    return { ...state, sidebarActive: true };
                }
                return state;
            });
        }
    }

    onMouseLeave() {
        if (!this.layoutService.layoutState().anchored) {
            if (!this.timeout) {
                this.timeout = setTimeout(() => {
                    this.layoutService.layoutState.update((state) => {
                        if (state.sidebarActive) {
                            return { ...state, sidebarActive: false };
                        }
                        return state;
                    });
                }, 300);
            }
        }
    }

    anchor() {
        this.layoutService.layoutState.update((state) => ({
            ...state,
            anchored: !state.anchored
        }));
    }
}

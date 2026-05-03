import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AppMenuitem } from './app.menuitem';

@Component({
    selector: 'app-menu',
    standalone: true,
    imports: [CommonModule, AppMenuitem, RouterModule],
    template: `<ul class="layout-menu">
        <ng-container *ngFor="let item of model; let i = index">
            <li app-menuitem *ngIf="!item.separator" [item]="item" [index]="i" [root]="true"></li>
            <li *ngIf="item.separator" class="menu-separator"></li>
        </ng-container>
    </ul>`
})
export class AppMenu {
    model: any[] = [];

    ngOnInit() {
        this.model = [
            {
                label: 'Overview',
                items: [
                    {
                        label: 'Dashboard',
                        icon: 'pi pi-fw pi-th-large',
                        routerLink: ['/']
                    }
                ]
            },
            {
                label: 'People',
                items: [
                    {
                        label: 'Users',
                        icon: 'pi pi-fw pi-users',
                        routerLink: ['/users']
                    },
                    {
                        label: 'Agencies',
                        icon: 'pi pi-fw pi-building',
                        routerLink: ['/agencies']
                    }
                ]
            },
            {
                label: 'Marketplace',
                items: [
                    {
                        label: 'Vehicles',
                        icon: 'pi pi-fw pi-car',
                        routerLink: ['/vehicles']
                    },
                    {
                        label: 'Reservations',
                        icon: 'pi pi-fw pi-calendar',
                        routerLink: ['/reservations']
                    },
                    {
                        label: 'Reviews',
                        icon: 'pi pi-fw pi-star',
                        routerLink: ['/reviews']
                    }
                ]
            },
            {
                label: 'Finance',
                items: [
                    {
                        label: 'Payments',
                        icon: 'pi pi-fw pi-wallet',
                        routerLink: ['/payments']
                    },
                    {
                        label: 'Subscription plans',
                        icon: 'pi pi-fw pi-credit-card',
                        routerLink: ['/plans']
                    }
                ]
            },
            {
                label: 'Configuration',
                items: [
                    {
                        label: 'Help articles',
                        icon: 'pi pi-fw pi-question-circle',
                        routerLink: ['/help-articles']
                    },
                    {
                        label: 'Platform config',
                        icon: 'pi pi-fw pi-cog',
                        routerLink: ['/platform-config']
                    }
                ]
            }
        ];
    }
}

/** @type {import('tailwindcss').Config} */
import PrimeUI from 'tailwindcss-primeui';

export default {
    darkMode: ['selector', '[class*="app-dark"]'],
    content: ['./index.html', './src/**/*.{js,ts,html}', './public/**/*.json'],
    plugins: [PrimeUI],
    theme: {
        screens: {
            sm: '576px',
            md: '768px',
            lg: '992px',
            xl: '1200px',
            '2xl': '1920px'
        },
        extend: {
            colors: {
                tomo: {
                    primary: '#242830',
                    'primary-soft': '#2e323b',
                    'primary-deep': '#050608',
                    secondary: '#e27a34',
                    'secondary-soft': '#ed8c4a',
                    'secondary-deep': '#c96a2a',
                    success: '#1aaa55',
                    warning: '#f59e0b',
                    danger: '#e53935',
                    info: '#3b82f6',
                    gold: '#fbbf24',
                    bg: '#fafafa',
                    'bg-soft': '#f5f6f8',
                    'bg-softer': '#f3f4f6',
                    divider: '#f0f0f0',
                    border: '#e8e8e8',
                    text: '#1a1a1a',
                    'text-muted': '#888888'
                }
            },
            boxShadow: {
                'tomo-card': 'rgba(0, 0, 0, 0.03) 0px 1px 4px 0px, rgba(27, 31, 35, 0.12) 0px 0px 0px 1px',
                'tomo-overlay': '0 8px 32px rgba(0, 0, 0, 0.12)'
            },
            borderRadius: {
                'tomo-card': '14px',
                'tomo-pill': '999px'
            }
        }
    }
};

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: { extend: {
    colors: Object.fromEntries(['border', 'border-subtle', 'input-border', 'surface', 'surface-subtle', 'surface-raised', 'background', 'foreground', 'primary', 'primary-hover', 'primary-foreground', 'muted', 'muted-foreground', 'accent', 'accent-foreground', 'success', 'success-soft', 'warning', 'warning-soft', 'danger', 'danger-soft', 'info', 'info-soft', 'overlay'].map(name => [name, `var(--${name})`])),
    boxShadow: { raised: 'var(--shadow-raised)', control: 'var(--shadow-control)', paper: 'var(--shadow-paper)' },
    borderRadius: { sm: 'calc(var(--radius-control) - 4px)', md: 'calc(var(--radius-control) - 2px)', lg: 'var(--radius-control)', xl: 'calc(var(--radius-control) + 2px)', '2xl': 'var(--radius-card)', '3xl': 'var(--radius-dialog)' },
  }}, plugins: [],
}

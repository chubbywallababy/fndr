# Theme Customization Guide

The frontend uses CSS variables for easy color customization. All theme colors are defined in `src/theme.css`.

## Quick Start

1. Open `apps/frontend/src/theme.css`
2. Edit the CSS variables in the `:root` selector
3. Save and the changes will be reflected immediately

## Available Theme Variables

### Primary Colors
- `--color-primary`: Main primary color
- `--color-primary-dark`: Darker shade of primary
- `--color-primary-light`: Lighter shade of primary

### Background Colors
- `--color-bg-gradient-start`: Start color of the gradient background
- `--color-bg-gradient-end`: End color of the gradient background

### Text Colors
- `--color-text-primary`: Main text color (dark)
- `--color-text-secondary`: Secondary text color
- `--color-text-light`: Light text (for titles on dark backgrounds)
- `--color-text-muted`: Muted/subtle text

### Card Colors
- `--color-card-bg`: Background color for cards
- `--color-card-shadow`: Shadow color for cards
- `--color-card-border`: Border color for cards

### Form Colors
- `--color-input-border`: Border color for form inputs
- `--color-input-border-focus`: Border color when input is focused
- `--color-input-bg`: Background color for inputs

### Button Colors
- `--color-button-bg-start`: Start color of button gradient
- `--color-button-bg-end`: End color of button gradient
- `--color-button-text`: Text color for buttons
- `--color-button-shadow`: Shadow color for button hover effect

### Error Colors
- `--color-error-bg`: Background color for error messages
- `--color-error-border`: Border color for error messages
- `--color-error-text`: Text color for error messages
- `--color-required`: Color for required field asterisks

### Results Colors
- `--color-results-bg`: Background color for results container
- `--color-results-card-bg`: Background color for results card
- `--color-results-border`: Border color for results

## Example: Changing the Primary Color Scheme

To change from purple to blue:

```css
:root {
  --color-primary: #3b82f6;
  --color-primary-dark: #2563eb;
  --color-bg-gradient-start: #3b82f6;
  --color-bg-gradient-end: #2563eb;
  --color-button-bg-start: #3b82f6;
  --color-button-bg-end: #2563eb;
  --color-input-border-focus: #3b82f6;
}
```

## Dark Theme

A dark theme example is included in `theme.css` as a comment. To enable it:

1. Uncomment the `:root[data-theme="dark"]` block
2. Add `data-theme="dark"` to the `<html>` or `<body>` tag in your app

## Spacing and Other Variables

The theme also includes variables for:
- Spacing (`--spacing-xs` through `--spacing-xl`)
- Border radius (`--radius-sm`, `--radius-md`, `--radius-lg`)
- Shadows (`--shadow-sm`, `--shadow-md`, `--shadow-lg`)
- Transitions (`--transition-fast`, `--transition-normal`, `--transition-slow`)

These can be customized as needed for consistent spacing and styling throughout the app.

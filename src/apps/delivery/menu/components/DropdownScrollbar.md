# Dropdown Scrollbar Styling

## Current State
All MenuFilterDropdown components have the `boh-dropdown-scrollbar` class applied, which **hides scrollbars by default**.

## How to Enable Scrollbars (Future Use)

### Option 1: Enable for All Dropdowns
Add this CSS to override the default hidden scrollbar:

```css
/* Add to your CSS or in a style tag */
.boh-dropdown-scrollbar {
    scrollbar-width: thin !important;
    scrollbar-color: var(--boh-border) transparent !important;
}

.boh-dropdown-scrollbar::-webkit-scrollbar {
    width: 6px !important;
    display: block !important;
}

.boh-dropdown-scrollbar::-webkit-scrollbar-track {
    background: transparent;
}

.boh-dropdown-scrollbar::-webkit-scrollbar-thumb {
    background-color: var(--boh-border);
    border-radius: 3px;
}

.boh-dropdown-scrollbar::-webkit-scrollbar-thumb:hover {
    background-color: var(--boh-text-sub);
}
```

### Option 2: Enable for Specific Dropdowns
Use the commented CSS classes already available:

```css
/* Enable scrollbars for dropdowns with this additional class */
.boh-dropdown-scrollbar.show-scrollbar {
    scrollbar-width: thin;
    scrollbar-color: var(--boh-border) transparent;
}

.boh-dropdown-scrollbar.show-scrollbar::-webkit-scrollbar {
    width: 6px;
    display: block;
}

.boh-dropdown-scrollbar.show-scrollbar::-webkit-scrollbar-track {
    background: transparent;
}

.boh-dropdown-scrollbar.show-scrollbar::-webkit-scrollbar-thumb {
    background-color: var(--boh-border);
    border-radius: 3px;
}

.boh-dropdown-scrollbar.show-scrollbar::-webkit-scrollbar-thumb:hover {
    background-color: var(--boh-text-sub);
}
```

Then add the `show-scrollbar` class to specific dropdowns:

```tsx
<MenuFilterDropdown
  // ... other props
  className="boh-dropdown-scrollbar show-scrollbar"
/>
```

### Option 3: Conditional Scrollbar
Enable scrollbars only when content overflows:

```css
/* Only show scrollbar when content is scrollable */
.boh-dropdown-scrollbar:scrollbar {
    scrollbar-width: thin;
    scrollbar-color: var(--boh-border) transparent;
}

.boh-dropdown-scrollbar:scrollbar::-webkit-scrollbar {
    width: 6px;
    display: block;
}

.boh-dropdown-scrollbar:scrollbar::-webkit-scrollbar-track {
    background: transparent;
}

.boh-dropdown-scrollbar:scrollbar::-webkit-scrollbar-thumb {
    background-color: var(--boh-border);
    border-radius: 3px;
}

.boh-dropdown-scrollbar:scrollbar::-webkit-scrollbar-thumb:hover {
    background-color: var(--boh-text-sub);
}
```

## Current Dropdown Components with Scrollbar Support

- ReportFiltersBar.tsx: All filter dropdowns
- MenuFiltersBar.tsx: All filter dropdowns
- Any component using MenuFilterDropdown

## Styling Details

### Scrollbar Properties
- **Width**: 6px (when enabled)
- **Track**: Transparent
- **Thumb**: Uses `--boh-border` color
- **Thumb Hover**: Uses `--boh-text-sub` color
- **Border Radius**: 3px

### Browser Support
- ✅ Chrome, Safari, Opera: `::-webkit-scrollbar`
- ✅ Firefox: `scrollbar-width`
- ✅ IE/Edge: `-ms-overflow-style`

### Current Behavior
- Scrollbars are **hidden by default**
- Content still scrolls when needed
- No visual scrollbar indicators
- Clean, minimal appearance

## Future Enhancement Ideas

1. **Auto-show on hover**: Show scrollbar only when hovering over dropdown
2. **Context-aware styling**: Different scrollbar styles for different dropdown types
3. **Animated scrollbar**: Smooth transitions when scrollbar appears
4. **Custom scrollbar designs**: More elaborate scrollbar styling options

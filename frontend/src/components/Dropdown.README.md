# Dropdown Component Usage Guide

## Overview
The `Dropdown` component is a reusable, fully-featured dropdown menu that handles all edge cases automatically:
- ✅ Click outside to close
- ✅ Escape key to close
- ✅ Proper event propagation
- ✅ Smooth animations
- ✅ Mobile responsive
- ✅ Accessible

## Basic Usage

```tsx
import Dropdown, { DropdownItem, DropdownDivider } from '@/components/Dropdown';
import { Settings, Trash2, User } from 'lucide-react';

function MyComponent() {
    return (
        <Dropdown
            align="right"  // or "left"
            trigger={
                <button>Open Menu</button>
            }
        >
            <DropdownItem
                icon={<User size={16} />}
                onClick={() => console.log('Profile clicked')}
            >
                Profile
            </DropdownItem>

            <DropdownItem
                icon={<Settings size={16} />}
                onClick={() => console.log('Settings clicked')}
            >
                Settings
            </DropdownItem>

            <DropdownDivider />

            <DropdownItem
                icon={<Trash2 size={16} />}
                onClick={() => console.log('Delete clicked')}
                variant="danger"
            >
                Delete
            </DropdownItem>
        </Dropdown>
    );
}
```

## Props

### Dropdown Props
- `trigger` (ReactNode, required): The element that opens the dropdown when clicked
- `children` (ReactNode, required): The dropdown menu items
- `align` ('left' | 'right', optional): Alignment of the dropdown menu (default: 'right')
- `className` (string, optional): Additional CSS classes
- `onOpenChange` (function, optional): Callback when dropdown opens/closes

### DropdownItem Props
- `children` (ReactNode, required): The item text/content
- `onClick` (function, optional): Click handler
- `icon` (ReactNode, optional): Icon to display before text
- `variant` ('default' | 'danger', optional): Visual style (default: 'default')
- `disabled` (boolean, optional): Whether the item is disabled
- `closeOnClick` (boolean, optional): Whether to close dropdown after click (default: true)

### DropdownDivider Props
- `style` (CSSProperties, optional): Custom styles for the divider

## Advanced Examples

### With Custom Trigger
```tsx
<Dropdown
    trigger={
        <div style={{
            padding: '10px',
            background: '#f0f0f0',
            borderRadius: '8px',
            cursor: 'pointer'
        }}>
            Custom Trigger
        </div>
    }
>
    <DropdownItem>Item 1</DropdownItem>
    <DropdownItem>Item 2</DropdownItem>
</Dropdown>
```

### With Disabled Items
```tsx
<Dropdown trigger={<button>Menu</button>}>
    <DropdownItem onClick={() => console.log('Active')}>
        Active Item
    </DropdownItem>
    
    <DropdownItem disabled>
        Disabled Item
    </DropdownItem>
</Dropdown>
```

### With State Tracking
```tsx
function MyComponent() {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <Dropdown
            trigger={<button>Menu</button>}
            onOpenChange={setIsOpen}
        >
            <DropdownItem>Item 1</DropdownItem>
        </Dropdown>
    );
}
```

### Preventing Auto-Close
```tsx
<Dropdown trigger={<button>Menu</button>}>
    <DropdownItem 
        onClick={() => console.log('Clicked but stays open')}
        closeOnClick={false}
    >
        Keep Open
    </DropdownItem>
</Dropdown>
```

## Styling

The component uses inline styles for maximum portability, but you can customize:

1. **Trigger**: Style the trigger element directly
2. **Menu Items**: Use the `variant` prop or pass custom styles via className
3. **Divider**: Pass custom styles via the `style` prop

## Features

### Automatic Behaviors
- Closes when clicking outside
- Closes when pressing Escape
- Prevents event bubbling
- Smooth fade-in animation
- Mobile-friendly (max-width constraint)

### Accessibility
- Keyboard navigation (Escape to close)
- Proper event handling
- Disabled state support

## Migration from Manual Implementation

**Before:**
```tsx
const [showMenu, setShowMenu] = useState(false);

<div style={{ position: 'relative' }}>
    <button onClick={() => setShowMenu(!showMenu)}>Menu</button>
    {showMenu && (
        <div style={{ position: 'absolute', ... }}>
            <button onClick={() => { doSomething(); setShowMenu(false); }}>
                Item
            </button>
        </div>
    )}
</div>
```

**After:**
```tsx
<Dropdown trigger={<button>Menu</button>}>
    <DropdownItem onClick={doSomething}>
        Item
    </DropdownItem>
</Dropdown>
```

## Notes

- The component manages its own state internally
- No need to track `showMenu` state
- Automatically handles all edge cases
- Works on both desktop and mobile

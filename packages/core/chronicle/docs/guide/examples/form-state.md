---
title: 'Example: Form State Management'
description: Comprehensive form state manager with validation and dirty tracking
keywords: example, forms, validation, dirty tracking, error handling, real-time
---

# Example: Form State Management

A comprehensive form state manager with validation, dirty tracking, and error handling using Chronicle.

## Overview

This example demonstrates:

- ✅ Real-time field validation
- 🔄 Dirty state tracking
- ⚠️ Field-level and form-level errors
- 💾 Save/cancel with undo support
- 🔁 Form reset capabilities
- 📝 Async validation
- 🎯 Touched field tracking

## Complete Implementation

### Type Definitions

```typescript
import { chronicle, ChronicleProxy } from '@arcmantle/chronicle';

interface FormField<T = any> {
  value: T;
  error: string | null;
  touched: boolean;
  dirty: boolean;
}

interface UserFormData {
  username: FormField<string>;
  email: FormField<string>;
  age: FormField<number>;
  password: FormField<string>;
  confirmPassword: FormField<string>;
  bio: FormField<string>;
  agreedToTerms: FormField<boolean>;
}

interface FormState {
  fields: UserFormData;
  isSubmitting: boolean;
  submitError: string | null;
  savedSnapshot: any | null;
}
```

### Validation Rules

```typescript
// Validation functions
const validators = {
  required: (value: any, message = 'This field is required') => {
    if (value === null || value === undefined || value === '') {
      return message;
    }
    return null;
  },

  email: (value: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(value)) {
      return 'Please enter a valid email address';
    }
    return null;
  },

  minLength: (min: number) => (value: string) => {
    if (value.length < min) {
      return `Must be at least ${min} characters`;
    }
    return null;
  },

  maxLength: (max: number) => (value: string) => {
    if (value.length > max) {
      return `Must be no more than ${max} characters`;
    }
    return null;
  },

  range: (min: number, max: number) => (value: number) => {
    if (value < min || value > max) {
      return `Must be between ${min} and ${max}`;
    }
    return null;
  },

  pattern: (regex: RegExp, message: string) => (value: string) => {
    if (!regex.test(value)) {
      return message;
    }
    return null;
  },

  custom: (fn: (value: any) => boolean, message: string) => (value: any) => {
    if (!fn(value)) {
      return message;
    }
    return null;
  },
};

// Field validation rules
const fieldRules: Record<keyof UserFormData, Array<(value: any) => string | null>> = {
  username: [
    validators.required,
    validators.minLength(3),
    validators.maxLength(20),
    validators.pattern(/^[a-zA-Z0-9_]+$/, 'Only letters, numbers, and underscores'),
  ],
  email: [validators.required, validators.email],
  age: [validators.required, validators.range(13, 120)],
  password: [validators.required, validators.minLength(8)],
  confirmPassword: [validators.required],
  bio: [validators.maxLength(500)],
  agreedToTerms: [
    validators.custom((v) => v === true, 'You must agree to the terms'),
  ],
};
```

### State Initialization

```typescript
// Create initial field
function createField<T>(value: T): FormField<T> {
  return {
    value,
    error: null,
    touched: false,
    dirty: false,
  };
}

// Initialize form state
const initialState: FormState = {
  fields: {
    username: createField(''),
    email: createField(''),
    age: createField(0),
    password: createField(''),
    confirmPassword: createField(''),
    bio: createField(''),
    agreedToTerms: createField(false),
  },
  isSubmitting: false,
  submitError: null,
  savedSnapshot: null,
};

// Create observable form
const form = chronicle(initialState, {
  maxHistory: 100,
  filter: (path) => {
    // Don't track error, touched, or dirty changes in history
    return path[path.length - 1] !== 'error' &&
           path[path.length - 1] !== 'touched' &&
           path[path.length - 1] !== 'dirty';
  },
});
```

### Field Operations

```typescript
// Update field value
function setFieldValue<K extends keyof UserFormData>(
  field: K,
  value: UserFormData[K]['value']
): void {
  const fieldObj = form.fields[field];

  fieldObj.value = value;
  fieldObj.dirty = true;

  // Validate immediately
  validateField(field);
}

// Mark field as touched
function setFieldTouched(field: keyof UserFormData): void {
  form.fields[field].touched = true;
  validateField(field);
}

// Validate single field
function validateField(field: keyof UserFormData): boolean {
  const fieldObj = form.fields[field];
  const rules = fieldRules[field];

  // Run all validators
  for (const rule of rules) {
    const error = rule(fieldObj.value);
    if (error) {
      fieldObj.error = error;
      return false;
    }
  }

  // Special case: confirm password
  if (field === 'confirmPassword' || field === 'password') {
    if (form.fields.password.value !== form.fields.confirmPassword.value) {
      form.fields.confirmPassword.error = 'Passwords must match';
      return false;
    }
  }

  fieldObj.error = null;
  return true;
}

// Validate all fields
function validateForm(): boolean {
  let isValid = true;

  for (const field of Object.keys(form.fields) as Array<keyof UserFormData>) {
    if (!validateField(field)) {
      isValid = false;
    }
  }

  return isValid;
}
```

### Async Validation

```typescript
// Check if username is available (simulated API call)
async function checkUsernameAvailability(username: string): Promise<boolean> {
  await new Promise((resolve) => setTimeout(resolve, 500));

  // Simulate checking against existing usernames
  const taken = ['admin', 'user', 'test', 'demo'];
  return !taken.includes(username.toLowerCase());
}

// Async validator with debouncing
let usernameCheckTimeout: number;

function validateUsernameAsync(username: string): void {
  clearTimeout(usernameCheckTimeout);

  if (username.length < 3) return; // Skip if too short

  usernameCheckTimeout = setTimeout(async () => {
    const isAvailable = await checkUsernameAvailability(username);

    // Only update if username hasn't changed
    if (form.fields.username.value === username) {
      if (!isAvailable) {
        form.fields.username.error = 'Username is already taken';
      } else if (!form.fields.username.error) {
        form.fields.username.error = null;
      }
    }
  }, 500) as any;
}

// Listen for username changes
chronicle.on(form, 'fields.username.value', (event) => {
  validateUsernameAsync(event.value as string);
}, { mode: 'exact' });
```

### Form Actions

```typescript
// Reset entire form
function resetForm(): void {
  chronicle.batch(form, () => {
    for (const field of Object.keys(form.fields) as Array<keyof UserFormData>) {
      const initialField = initialState.fields[field];
      form.fields[field].value = initialField.value;
      form.fields[field].error = null;
      form.fields[field].touched = false;
      form.fields[field].dirty = false;
    }
    form.submitError = null;
  });

  chronicle.clearHistory(form);
}

// Reset single field
function resetField(field: keyof UserFormData): void {
  const initialField = initialState.fields[field];
  const fieldObj = form.fields[field];

  chronicle.batch(form, () => {
    fieldObj.value = initialField.value;
    fieldObj.error = null;
    fieldObj.touched = false;
    fieldObj.dirty = false;
  });
}

// Save current state (for cancel functionality)
function saveSnapshot(): void {
  form.savedSnapshot = chronicle.snapshot(form);
}

// Restore from saved snapshot
function restoreSnapshot(): void {
  if (!form.savedSnapshot) return;

  chronicle.batch(form, () => {
    const saved = form.savedSnapshot.fields;
    for (const field of Object.keys(form.fields) as Array<keyof UserFormData>) {
      form.fields[field].value = saved[field].value;
      form.fields[field].error = saved[field].error;
      form.fields[field].touched = saved[field].touched;
      form.fields[field].dirty = saved[field].dirty;
    }
  });
}

// Submit form
async function submitForm(): Promise<void> {
  // Mark all fields as touched
  for (const field of Object.keys(form.fields) as Array<keyof UserFormData>) {
    form.fields[field].touched = true;
  }

  // Validate
  if (!validateForm()) {
    form.submitError = 'Please fix the errors above';
    return;
  }

  form.isSubmitting = true;
  form.submitError = null;

  try {
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Success - save snapshot for future comparison
    saveSnapshot();

    console.log('Form submitted:', getFormValues());
  } catch (error) {
    form.submitError = 'Failed to submit form. Please try again.';
  } finally {
    form.isSubmitting = false;
  }
}
```

### Helper Functions

```typescript
// Get all form values
function getFormValues() {
  const values: any = {};
  for (const field of Object.keys(form.fields) as Array<keyof UserFormData>) {
    values[field] = form.fields[field].value;
  }
  return values;
}

// Check if form is dirty
function isFormDirty(): boolean {
  return Object.values(form.fields).some((field) => field.dirty);
}

// Check if form is valid
function isFormValid(): boolean {
  return Object.values(form.fields).every((field) => field.error === null);
}

// Get all errors
function getErrors(): Record<string, string> {
  const errors: any = {};
  for (const [key, field] of Object.entries(form.fields)) {
    if (field.error) {
      errors[key] = field.error;
    }
  }
  return errors;
}

// Check if field has error and is touched
function showFieldError(field: keyof UserFormData): boolean {
  const fieldObj = form.fields[field];
  return fieldObj.touched && fieldObj.error !== null;
}
```

## UI Integration

### React Example

```typescript
import { useEffect, useState } from 'react';

function UserForm() {
  const [, forceUpdate] = useState({});

  useEffect(() => {
    const unsubscribe = chronicle.on(form, '', () => {
      forceUpdate({});
    }, { mode: 'down' });

    return unsubscribe;
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await submitForm();
  };

  return (
    <form onSubmit={handleSubmit}>
      <h2>User Registration</h2>

      {form.submitError && (
        <div className="error-banner">{form.submitError}</div>
      )}

      {/* Username */}
      <div className="field">
        <label htmlFor="username">Username</label>
        <input
          id="username"
          value={form.fields.username.value}
          onChange={(e) => setFieldValue('username', e.target.value)}
          onBlur={() => setFieldTouched('username')}
          className={showFieldError('username') ? 'error' : ''}
        />
        {showFieldError('username') && (
          <span className="error-message">{form.fields.username.error}</span>
        )}
      </div>

      {/* Email */}
      <div className="field">
        <label htmlFor="email">Email</label>
        <input
          id="email"
          type="email"
          value={form.fields.email.value}
          onChange={(e) => setFieldValue('email', e.target.value)}
          onBlur={() => setFieldTouched('email')}
          className={showFieldError('email') ? 'error' : ''}
        />
        {showFieldError('email') && (
          <span className="error-message">{form.fields.email.error}</span>
        )}
      </div>

      {/* Age */}
      <div className="field">
        <label htmlFor="age">Age</label>
        <input
          id="age"
          type="number"
          value={form.fields.age.value}
          onChange={(e) => setFieldValue('age', parseInt(e.target.value) || 0)}
          onBlur={() => setFieldTouched('age')}
          className={showFieldError('age') ? 'error' : ''}
        />
        {showFieldError('age') && (
          <span className="error-message">{form.fields.age.error}</span>
        )}
      </div>

      {/* Password */}
      <div className="field">
        <label htmlFor="password">Password</label>
        <input
          id="password"
          type="password"
          value={form.fields.password.value}
          onChange={(e) => setFieldValue('password', e.target.value)}
          onBlur={() => setFieldTouched('password')}
          className={showFieldError('password') ? 'error' : ''}
        />
        {showFieldError('password') && (
          <span className="error-message">{form.fields.password.error}</span>
        )}
      </div>

      {/* Confirm Password */}
      <div className="field">
        <label htmlFor="confirmPassword">Confirm Password</label>
        <input
          id="confirmPassword"
          type="password"
          value={form.fields.confirmPassword.value}
          onChange={(e) => setFieldValue('confirmPassword', e.target.value)}
          onBlur={() => setFieldTouched('confirmPassword')}
          className={showFieldError('confirmPassword') ? 'error' : ''}
        />
        {showFieldError('confirmPassword') && (
          <span className="error-message">{form.fields.confirmPassword.error}</span>
        )}
      </div>

      {/* Bio */}
      <div className="field">
        <label htmlFor="bio">Bio (optional)</label>
        <textarea
          id="bio"
          value={form.fields.bio.value}
          onChange={(e) => setFieldValue('bio', e.target.value)}
          onBlur={() => setFieldTouched('bio')}
          rows={4}
          className={showFieldError('bio') ? 'error' : ''}
        />
        <span className="char-count">
          {form.fields.bio.value.length}/500
        </span>
        {showFieldError('bio') && (
          <span className="error-message">{form.fields.bio.error}</span>
        )}
      </div>

      {/* Terms */}
      <div className="field checkbox">
        <input
          id="terms"
          type="checkbox"
          checked={form.fields.agreedToTerms.value}
          onChange={(e) => setFieldValue('agreedToTerms', e.target.checked)}
          onBlur={() => setFieldTouched('agreedToTerms')}
        />
        <label htmlFor="terms">I agree to the terms and conditions</label>
        {showFieldError('agreedToTerms') && (
          <span className="error-message">{form.fields.agreedToTerms.error}</span>
        )}
      </div>

      {/* Actions */}
      <div className="actions">
        <button
          type="button"
          onClick={resetForm}
          disabled={!isFormDirty() || form.isSubmitting}
        >
          Reset
        </button>
        <button
          type="button"
          onClick={restoreSnapshot}
          disabled={!form.savedSnapshot || form.isSubmitting}
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={!isFormValid() || form.isSubmitting}
        >
          {form.isSubmitting ? 'Submitting...' : 'Submit'}
        </button>
      </div>

      {/* Debug Info */}
      <details>
        <summary>Debug Info</summary>
        <pre>{JSON.stringify({
          dirty: isFormDirty(),
          valid: isFormValid(),
          errors: getErrors(),
          canUndo: chronicle.canUndo(form),
          canRedo: chronicle.canRedo(form),
        }, null, 2)}</pre>
      </details>
    </form>
  );
}
```

## Key Features Demonstrated

### 1. Real-time Validation

Fields validate as you type:

```typescript
setFieldValue('email', 'invalid');
// → field.error = "Please enter a valid email address"

setFieldValue('email', 'user@example.com');
// → field.error = null
```

### 2. Dirty Tracking

Know which fields changed:

```typescript
console.log(isFormDirty()); // false

setFieldValue('username', 'alice');
console.log(isFormDirty()); // true
console.log(form.fields.username.dirty); // true
console.log(form.fields.email.dirty); // false
```

### 3. Touch Tracking

Show errors only after user interaction:

```typescript
// Before blur
form.fields.email.error = 'Invalid email';
form.fields.email.touched = false;
showFieldError('email'); // false - don't show yet

// After blur
setFieldTouched('email');
showFieldError('email'); // true - now show error
```

### 4. History Integration

Undo/redo field edits:

```typescript
setFieldValue('username', 'alice');
setFieldValue('username', 'bob');

chronicle.undo(form);
// username back to 'alice'

chronicle.redo(form);
// username back to 'bob'
```

### 5. Snapshot & Restore

Save/cancel pattern:

```typescript
// User starts editing
saveSnapshot();

setFieldValue('username', 'newname');
setFieldValue('email', 'new@email.com');

// User clicks cancel
restoreSnapshot();
// All fields restored to saved state
```

## Advanced Patterns

### Conditional Validation

```typescript
// Only validate if another field has a value
function validateConditional() {
  if (form.fields.password.value) {
    return validators.required(form.fields.confirmPassword.value);
  }
  return null;
}
```

### Cross-field Validation

```typescript
// Validate multiple fields together
chronicle.on(form, 'fields.password.value', () => {
  validateField('confirmPassword');
}, { mode: 'exact' });
```

### Dynamic Fields

```typescript
interface DynamicFormState {
  fields: Record<string, FormField>;
}

function addField(name: string, initialValue: any) {
  form.fields[name] = createField(initialValue);
}

function removeField(name: string) {
  delete form.fields[name];
}
```

## Testing

```typescript
import { describe, it, expect, beforeEach } from 'vitest';

describe('Form State', () => {
  beforeEach(() => {
    resetForm();
  });

  it('should validate required fields', () => {
    setFieldValue('username', '');
    setFieldTouched('username');

    expect(form.fields.username.error).toBe('This field is required');
  });

  it('should validate email format', () => {
    setFieldValue('email', 'invalid');
    setFieldTouched('email');

    expect(form.fields.email.error).toContain('valid email');

    setFieldValue('email', 'user@example.com');
    expect(form.fields.email.error).toBeNull();
  });

  it('should track dirty state', () => {
    expect(isFormDirty()).toBe(false);

    setFieldValue('username', 'alice');
    expect(isFormDirty()).toBe(true);
    expect(form.fields.username.dirty).toBe(true);
  });

  it('should validate password match', () => {
    setFieldValue('password', 'password123');
    setFieldValue('confirmPassword', 'different');

    expect(form.fields.confirmPassword.error).toContain('match');

    setFieldValue('confirmPassword', 'password123');
    expect(form.fields.confirmPassword.error).toBeNull();
  });

  it('should support snapshot/restore', () => {
    setFieldValue('username', 'original');
    saveSnapshot();

    setFieldValue('username', 'modified');
    expect(form.fields.username.value).toBe('modified');

    restoreSnapshot();
    expect(form.fields.username.value).toBe('original');
  });
});
```

## Next Steps

- [Collaborative Editor](./collaborative-editor) - Multi-user state synchronization
- [Data Table](./data-table) - Handle complex data structures
- [TypeScript Guide](../typescript) - Full type safety for forms

## Related Guides

- [Listeners](../listeners) - React to field changes
- [Batching](../batching) - Optimize bulk updates
- [Best Practices](../best-practices) - Form patterns and tips

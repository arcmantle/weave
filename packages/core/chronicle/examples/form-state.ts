/**
 * Form State Example
 *
 * Demonstrates:
 * - Debounced validation
 * - Nested object observation
 * - Transaction for async operations
 * - Error handling with rollback
 */

import { chronicle } from '../src/chronicle.ts';

interface FormValues {
	email:           string;
	password:        string;
	confirmPassword: string;
	agreeToTerms:    boolean;
}

interface FormErrors {
	email?:           string;
	password?:        string;
	confirmPassword?: string;
	agreeToTerms?:    string;
}

interface FormState {
	values:        FormValues;
	errors:        FormErrors;
	touched:       Record<keyof FormValues, boolean>;
	isValid:       boolean;
	isSubmitting:  boolean;
	submitError?:  string;
	submitSuccess: boolean;
}

// Create form state
const formState: FormState = chronicle({
	values: {
		email:           '',
		password:        '',
		confirmPassword: '',
		agreeToTerms:    false,
	},
	errors:  {},
	touched: {
		email:           false,
		password:        false,
		confirmPassword: false,
		agreeToTerms:    false,
	},
	isValid:       false,
	isSubmitting:  false,
	submitSuccess: false,
});


// Validation logic
function validateField(field: keyof FormValues, value: any): string | undefined {
	switch (field) {
	case 'email':
		if (!value)
			return 'Email is required';
		if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))
			return 'Invalid email format';

		return undefined;

	case 'password':
		if (!value)
			return 'Password is required';
		if (value.length < 8)
			return 'Password must be at least 8 characters';

		return undefined;

	case 'confirmPassword':
		if (!value)
			return 'Please confirm your password';
		if (value !== formState.values.password)
			return 'Passwords do not match';

		return undefined;

	case 'agreeToTerms':
		if (!value)
			return 'You must agree to the terms';

		return undefined;
	}
}

function validateForm(): void {
	const errors: FormErrors = {};
	let hasErrors = false;

	for (const field of Object.keys(formState.values) as (keyof FormValues)[]) {
		const error = validateField(field, formState.values[field]);
		if (error) {
			errors[field] = error;
			hasErrors = true;
		}
	}

	formState.errors = errors;
	formState.isValid = !hasErrors;
}

// Debounced validation on value changes
chronicle.listen(formState, s => s.values, (path) => {
	const field = path[1] as keyof FormValues;
	if (formState.touched[field])
		validateForm();
}, 'down', { debounceMs: 300 });

// Actions
function setFieldValue<K extends keyof FormValues>(field: K, value: FormValues[K]): void {
	formState.values[field] = value;
}

function setFieldTouched(field: keyof FormValues): void {
	formState.touched[field] = true;
	validateForm();
}

function handleBlur(field: keyof FormValues): void {
	setFieldTouched(field);
}

function resetForm(): void {
	chronicle.batch(formState, (state) => {
		state.values = {
			email:           '',
			password:        '',
			confirmPassword: '',
			agreeToTerms:    false,
		};
		state.errors = {};
		state.touched = {
			email:           false,
			password:        false,
			confirmPassword: false,
			agreeToTerms:    false,
		};
		state.isValid = false;
		state.submitError = undefined;
		state.submitSuccess = false;
	});
}

// Simulated API call
async function submitToApi(values: FormValues): Promise<{ userId: number; }> {
	await new Promise(resolve => setTimeout(resolve, 1000));

	// Simulate random failure
	if (Math.random() > 0.7)
		throw new Error('Server error: Please try again');


	return { userId: Math.floor(Math.random() * 1000) };
}

// Submit with transaction (auto-rollback on error)
async function submitForm(): Promise<{ userId: number; } | null> {
	if (!formState.isValid) {
		console.log('❌ Form is invalid');

		return null;
	}

	try {
		const { result } = await chronicle.transaction(formState, async (state) => {
			state.isSubmitting = true;
			state.submitError = undefined;

			try {
				const result = await submitToApi(state.values);
				state.submitSuccess = true;
				console.log('✅ Form submitted successfully');

				return result;
			}
			catch (error) {
				state.submitError = (error as Error).message;
				throw error; // Re-throw to trigger rollback
			}
			finally {
				state.isSubmitting = false;
			}
		});

		return result;
	}
	catch (error) {
		console.log('❌ Submit failed:', (error as Error).message);

		return null;
	}
}

// Demo usage
console.log('=== Form State Demo ===\n');

// Fill out form
setFieldValue('email', 'user@example.com');
setFieldTouched('email');

setFieldValue('password', 'password123');
setFieldTouched('password');

setFieldValue('confirmPassword', 'password123');
setFieldTouched('confirmPassword');

setFieldValue('agreeToTerms', true);
setFieldTouched('agreeToTerms');

console.log('📝 Form filled');
console.log('✓ Valid:', formState.isValid);
console.log('📧 Email:', formState.values.email);
console.log('🔒 Password:', '•'.repeat(formState.values.password.length));

// Try submitting
console.log('\n🚀 Attempting submit...');
await submitForm();

if (formState.submitSuccess) {
	console.log('🎉 Success! Form was submitted');
}
else if (formState.submitError) {
	console.log('💥 Error:', formState.submitError);
	console.log('🔄 Form state was rolled back to before submission');
}

export { formState, handleBlur, resetForm, setFieldTouched, setFieldValue, submitForm };

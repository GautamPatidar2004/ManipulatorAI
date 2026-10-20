import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AuthScreen } from '../components/Auth/AuthScreen';
import { Header } from '../components/Layout/Header';
import { AuthProvider } from '../context/AuthContext';
import { api } from '../api/client';

describe('Authentication & Role Enforcement Frontend Tests', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('renders single authentication screen with Sign In and Create Account tabs', () => {
    render(
      <AuthProvider>
        <AuthScreen />
      </AuthProvider>
    );

    expect(screen.getByRole('heading', { name: /CareerCompass AI/i })).toBeDefined();
    expect(screen.getByTestId('tab-login')).toBeDefined();
    expect(screen.getByTestId('tab-signup')).toBeDefined();

    // Default mode is Sign In: Full Name and Confirm Password should not be visible
    expect(screen.queryByPlaceholderText(/Aarav Sharma/i)).toBeNull();
    expect(screen.getByPlaceholderText(/name@example.com/i)).toBeDefined();

    // Switch to Create Account tab
    fireEvent.click(screen.getByTestId('tab-signup'));

    // Full Name and Confirm Password should now be visible
    expect(screen.getByPlaceholderText(/Aarav Sharma/i)).toBeDefined();
    expect(screen.getAllByPlaceholderText(/••••••••/i)).toHaveLength(2);
    expect(screen.getByText(/Account role is set to/i)).toBeDefined();
  });

  it('toggles password visibility on eye button click', () => {
    render(
      <AuthProvider>
        <AuthScreen />
      </AuthProvider>
    );

    const passwordInput = screen.getByPlaceholderText(/••••••••/i) as HTMLInputElement;
    expect(passwordInput.type).toBe('password');

    const toggleBtn = screen.getByLabelText(/Show password/i);
    fireEvent.click(toggleBtn);

    expect(passwordInput.type).toBe('text');

    fireEvent.click(screen.getByLabelText(/Hide password/i));
    expect(passwordInput.type).toBe('password');
  });

  it('enforces client-side validation for short passwords and invalid emails', async () => {
    render(
      <AuthProvider>
        <AuthScreen />
      </AuthProvider>
    );

    const emailInput = screen.getByPlaceholderText(/name@example.com/i);
    const passwordInput = screen.getByPlaceholderText(/••••••••/i);
    const submitBtn = screen.getByTestId('auth-submit-btn');

    // Invalid email
    fireEvent.change(emailInput, { target: { value: 'invalid-email' } });
    fireEvent.change(passwordInput, { target: { value: '12345678' } });
    fireEvent.click(submitBtn);

    expect(await screen.findByText(/Please enter a valid email address/i)).toBeDefined();

    // Short password (< 8 chars)
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(passwordInput, { target: { value: '123' } });
    fireEvent.click(submitBtn);

    expect(await screen.findByText(/Password must be at least 8 characters long/i)).toBeDefined();
  });

  it('validates password matching on signup', async () => {
    render(
      <AuthProvider>
        <AuthScreen />
      </AuthProvider>
    );

    // Switch to signup
    fireEvent.click(screen.getByTestId('tab-signup'));

    const nameInput = screen.getByPlaceholderText(/Aarav Sharma/i);
    const emailInput = screen.getByPlaceholderText(/name@example.com/i);
    const [passwordInput, confirmInput] = screen.getAllByPlaceholderText(/••••••••/i);

    fireEvent.change(nameInput, { target: { value: 'Priya Patel' } });
    fireEvent.change(emailInput, { target: { value: 'priya@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'Password123!' } });
    fireEvent.change(confirmInput, { target: { value: 'Mismatch999!' } });

    fireEvent.click(screen.getByTestId('auth-submit-btn'));

    expect(await screen.findByText(/Passwords do not match/i)).toBeDefined();
  });

  it('calls api.signup with valid input', async () => {
    const signupSpy = vi.spyOn(api, 'signup').mockResolvedValueOnce({
      access_token: 'mock-jwt-token',
      token_type: 'bearer',
      user: {
        id: 'usr-101',
        email: 'priya@example.com',
        full_name: 'Priya Patel',
        role: 'user',
        is_active: true,
        created_at: new Date().toISOString(),
      },
    });

    render(
      <AuthProvider>
        <AuthScreen />
      </AuthProvider>
    );

    fireEvent.click(screen.getByTestId('tab-signup'));

    fireEvent.change(screen.getByPlaceholderText(/Aarav Sharma/i), { target: { value: 'Priya Patel' } });
    fireEvent.change(screen.getByPlaceholderText(/name@example.com/i), { target: { value: 'priya@example.com' } });
    const [passwordInput, confirmInput] = screen.getAllByPlaceholderText(/••••••••/i);
    fireEvent.change(passwordInput, { target: { value: 'Password123!' } });
    fireEvent.change(confirmInput, { target: { value: 'Password123!' } });

    fireEvent.click(screen.getByTestId('auth-submit-btn'));

    await waitFor(() => {
      expect(signupSpy).toHaveBeenCalledWith('Priya Patel', 'priya@example.com', 'Password123!');
    });
  });

  it('hides Admin Portal button for standard user', () => {
    localStorage.setItem(
      'careercompass_auth_user',
      JSON.stringify({
        id: 'usr-regular',
        email: 'user@test.com',
        full_name: 'Student User',
        role: 'user',
        is_active: true,
        created_at: new Date().toISOString(),
      })
    );
    localStorage.setItem('careercompass_auth_token', 'mock-token');

    render(
      <AuthProvider>
        <Header
          currentTitle="Career Consultation"
          isHealthy={true}
          aiAvailable={true}
          checkingHealth={false}
          onToggleSidebar={() => {}}
          onOpenAdmin={() => {}}
        />
      </AuthProvider>
    );

    expect(screen.queryByText(/Admin Portal/i)).toBeNull();
  });

  it('renders Admin Portal button for admin user', () => {
    localStorage.setItem(
      'careercompass_auth_user',
      JSON.stringify({
        id: 'usr-admin',
        email: 'admin@test.com',
        full_name: 'Admin Boss',
        role: 'admin',
        is_active: true,
        created_at: new Date().toISOString(),
      })
    );
    localStorage.setItem('careercompass_auth_token', 'mock-token');

    render(
      <AuthProvider>
        <Header
          currentTitle="Career Consultation"
          isHealthy={true}
          aiAvailable={true}
          checkingHealth={false}
          onToggleSidebar={() => {}}
          onOpenAdmin={() => {}}
        />
      </AuthProvider>
    );

    expect(screen.getByText(/Admin Portal/i)).toBeDefined();
  });
});

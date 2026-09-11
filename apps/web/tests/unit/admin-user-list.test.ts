import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { AdminUserList } from '@/components/admin/user-list';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

vi.mock('@/components/toast', () => ({
  useToast: () => ({ push: vi.fn() }),
}));

vi.mock('@/i18n/client', () => ({
  useT: () => (key: string) => (key === 'admin.manageUser' ? 'Manage user' : key),
}));

describe('AdminUserList', () => {
  it('shows an explicit management link for each user', () => {
    const html = renderToStaticMarkup(
      React.createElement(AdminUserList, {
        users: [
          {
            id: 'user-123',
            email: 'user@example.com',
            displayName: 'Test User',
            role: 'USER',
            accessUntilLabel: null,
          },
        ],
      }),
    );

    expect(html).toContain('href="/admin/users/user-123"');
    expect(html).toContain('>Manage user</a>');
  });
});

import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { LeadModal } from './LeadModal';

describe('LeadModal', () => {
  it('validates required fields and submits', async () => {
    const onSubmit = vi.fn().mockResolvedValue({ id: 'x' });
    render(<LeadModal open onClose={() => {}} onSubmit={onSubmit} />);
    fireEvent.change(screen.getByPlaceholderText('Jane Doe'), { target: { value: 'Jane' } });
    fireEvent.change(screen.getByPlaceholderText('jane@company.com'), { target: { value: 'jane@acme.com' } });
    fireEvent.click(screen.getByText('Submit'));
    expect(onSubmit).toHaveBeenCalled();
  });
});



import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../src/App';
import { STORAGE_KEYS } from '../src/lib/storage';
import type { DealRunbookItem } from '../src/types/contracts';

function stored(): DealRunbookItem[] {
  return JSON.parse(window.localStorage.getItem(STORAGE_KEYS.RUNBOOK_ITEMS) ?? '[]');
}

describe('App integration', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new Error('offline'))),
    );
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('renders header, tabs and default runbook', () => {
    render(<App />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/ShoopeeTool 11\/11/);
    for (const name of ['Kịch bản săn', 'Thêm ca săn', 'Tối ưu tách đơn', 'Hướng dẫn ĐT']) {
      expect(screen.getByRole('tab', { name })).toBeInTheDocument();
    }
    expect(screen.getByText('Mã Toàn Sàn 20% tối đa 100K', { selector: 'h3' })).toBeInTheDocument();
  });

  it('toggles checklist and persists to localStorage', () => {
    render(<App />);
    const card = screen.getByTestId('runbook-card-' + stored()[0].id);
    const box = within(card).getByLabelText('1. Đã tick sẵn món trong Giỏ');
    fireEvent.click(box);
    expect(box).toBeChecked();
    expect(stored()[0].checklist.itemsTickedInCart).toBe(true);
  });

  it('adds a new deal via the form and selects it', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('tab', { name: 'Thêm ca săn' }));
    fireEvent.change(screen.getByPlaceholderText('VD: Săn mã Mall 20% đêm 11/11'), {
      target: { value: 'Ca thử nghiệm' },
    });
    fireEvent.change(screen.getByPlaceholderText('VD: AFF1111HOANXU'), {
      target: { value: 'abc123' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Thêm Vào Kịch Bản Săn Mã/ }));

    expect(screen.getByText('Ca thử nghiệm', { selector: 'h3' })).toBeInTheDocument();
    const added = stored().find((d) => d.title === 'Ca thử nghiệm');
    expect(added?.voucherCode).toBe('ABC123');
    expect(added?.checklist.itemsTickedInCart).toBe(false);
    expect(screen.getByTestId('runbook-card-' + added!.id)).toHaveTextContent('Đang canh ca này');
  });

  it('copies a voucher code', async () => {
    const writeText = vi.fn(() => Promise.resolve());
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    render(<App />);
    fireEvent.click(screen.getAllByRole('button', { name: /^Copy Mã \(SHOPEE1111TS100K\)/ })[0]);
    await waitFor(() => expect(writeText).toHaveBeenCalledWith('SHOPEE1111TS100K'));
    expect(await screen.findByText('Đã Copy: SHOPEE1111TS100K')).toBeInTheDocument();
  });

  it('opens Shopee safely with noopener,noreferrer', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn(() => Promise.resolve()) },
      configurable: true,
    });
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    render(<App />);
    fireEvent.click(screen.getAllByRole('button', { name: 'Copy Mã + Mở Shopee' })[0]);
    await waitFor(() => expect(open).toHaveBeenCalled());
    expect(open.mock.calls[0][1]).toBe('_blank');
    expect(open.mock.calls[0][2]).toBe('noopener,noreferrer');
  });

  it('imports an optimized split into the runbook', () => {
    render(<App />);
    const before = stored().length;
    fireEvent.click(screen.getByRole('tab', { name: 'Tối ưu tách đơn' }));
    fireEvent.click(screen.getByRole('button', { name: /Đưa phương án này vào Kịch Bản/ }));
    const after = stored();
    expect(after.length).toBeGreaterThan(before);
    expect(screen.getByRole('tab', { name: 'Kịch bản săn' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(after.slice(before).every((d) => d.title.startsWith('Đơn #'))).toBe(true);
  });

  it('shows the mobile guide with current URL', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('tab', { name: 'Hướng dẫn ĐT' }));
    expect(screen.getByTestId('current-url')).toHaveTextContent(window.location.href);
    expect(screen.getByText('npm run dev:lan')).toBeInTheDocument();
  });
});

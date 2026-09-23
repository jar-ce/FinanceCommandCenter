import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ResizableTable, ColumnDef } from '../components/common/ResizableTable';

interface TestRow {
  id: string;
  name: string;
  amount: string;
}

describe('ResizableTable Primitive', () => {
  const columns: ColumnDef<TestRow>[] = [
    { id: 'name', header: 'Party Name', accessor: (row) => row.name, width: 200 },
    { id: 'amount', header: 'Balance', accessor: (row) => row.amount, numeric: true, width: 150 }
  ];

  const data: TestRow[] = [
    { id: '1', name: 'Alpha Corp', amount: '12500.0000' },
    { id: '2', name: 'Beta Traders', amount: '4200.5000' }
  ];

  it('renders column headers and row data with tabular numeric alignment', () => {
    render(
      <ResizableTable
        columns={columns}
        data={data}
        keyExtractor={(row) => row.id}
      />
    );

    expect(screen.getByText(/Party Name/i)).toBeDefined();
    expect(screen.getByText(/Balance/i)).toBeDefined();
    expect(screen.getByText('Alpha Corp')).toBeDefined();
    expect(screen.getByText('12500.0000')).toBeDefined();
  });

  it('renders LoadingState when isLoading is true', () => {
    render(
      <ResizableTable
        columns={columns}
        data={[]}
        keyExtractor={(row) => row.id}
        isLoading={true}
      />
    );

    expect(screen.getByLabelText('Loading data')).toBeDefined();
  });

  it('renders EmptyState when data array is empty', () => {
    render(
      <ResizableTable
        columns={columns}
        data={[]}
        keyExtractor={(row) => row.id}
        emptyTitle="No Entries Found"
      />
    );

    expect(screen.getByText('No Entries Found')).toBeDefined();
  });
});
